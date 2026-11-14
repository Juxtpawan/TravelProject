import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { d1Batch, d1Query } from '../db/client.js';
import { fetchGoogleRouteMatrix, optimizeStopOrder } from '../services/itinerary-ai/route-optimizer.js';

const router = express.Router();
router.use(authMiddleware);

// GET /itinerary/:tripId - Fetch all itinerary items for a trip
router.get('/:tripId', async (req, res) => {
  const { tripId } = req.params;
  try {
    const [ownedTrip] = await d1Query(`SELECT t.id FROM trips t WHERE t.id = ? AND (t.user_id = ? OR EXISTS (SELECT 1 FROM trip_collaborators c WHERE c.trip_id = t.id AND c.user_id = ? AND c.status = 'accepted'))`, [tripId, req.user.id, req.user.id]);
    if (!ownedTrip) return res.status(404).json({ error: 'Trip not found' });

    const items = await d1Query(
      `SELECT i.*, p.name as place_name, p.category, p.latitude, p.longitude, p.google_place_id
       FROM itinerary_items i
       JOIN places p ON i.place_id = p.id
       WHERE i.trip_id = ?
       ORDER BY i.day_index ASC, i.order_index ASC`,
      [tripId]
    );
    res.json(items);
  } catch (error) {
    console.error('Error fetching itinerary:', error);
    res.status(500).json({ error: 'Failed to fetch itinerary' });
  }
});

router.post('/:tripId/optimize-day', async (req, res) => {
  const { tripId } = req.params;
  const dayIndex = Number(req.body?.dayIndex);
  const requestedMode = req.body?.travelMode;
  const travelMode = ['DRIVE', 'WALK', 'BICYCLE'].includes(requestedMode) ? requestedMode : 'DRIVE';

  if (!Number.isInteger(dayIndex) || dayIndex < 0) {
    return res.status(400).json({ error: 'A valid dayIndex is required.' });
  }

  try {
    const [trip] = await d1Query(
      `SELECT t.id, t.start_date, t.end_date FROM trips t WHERE t.id = ? AND (t.user_id = ? OR EXISTS (SELECT 1 FROM trip_collaborators c WHERE c.trip_id = t.id AND c.user_id = ? AND c.role = 'editor' AND c.status = 'accepted'))`,
      [tripId, req.user.id, req.user.id]
    );
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    const dayCount = Math.floor((Date.parse(`${trip.end_date}T00:00:00Z`) - Date.parse(`${trip.start_date}T00:00:00Z`)) / 86400000) + 1;
    if (dayIndex >= dayCount) return res.status(400).json({ error: 'dayIndex falls outside the trip dates.' });

    const items = await d1Query(
      `SELECT i.id, i.place_id, i.day_index, i.order_index, i.start_time, i.note,
              p.name as place_name, p.category, p.latitude, p.longitude, p.google_place_id
       FROM itinerary_items i JOIN places p ON i.place_id = p.id
       WHERE i.trip_id = ? AND i.day_index = ? ORDER BY i.order_index ASC`,
      [tripId, dayIndex]
    );
    if (items.length < 2) return res.status(422).json({ error: 'Add at least two stops to this day before optimizing.' });
    if (items.length > 20) return res.status(422).json({ error: 'Route optimization supports up to 20 stops per day.' });
    if (items.some(item => !Number.isFinite(Number(item.latitude)) || !Number.isFinite(Number(item.longitude)))) {
      return res.status(422).json({ error: 'Every stop needs map coordinates before its route can be optimized.' });
    }

    const matrix = await fetchGoogleRouteMatrix(items, req.cloudflare?.env, travelMode);
    const optimized = optimizeStopOrder(items, matrix);
    const now = new Date().toISOString();
    await d1Batch(optimized.items.map(item => ({
      sql: `UPDATE itinerary_items SET order_index = ?, start_time = ?, updated_at = ?
            WHERE id = ? AND trip_id = ? AND day_index = ?`,
      params: [item.order_index, item.start_time, now, item.id, tripId, dayIndex],
    })));

    res.json({
      success: true,
      source: optimized.source,
      items: optimized.items.map(item => ({
        ...item,
        lat: Number(item.latitude),
        lng: Number(item.longitude),
        title: item.place_name,
      })),
    });
  } catch (error) {
    console.error('[Itinerary optimize] Failed:', error);
    res.status(500).json({ error: 'This day could not be optimized. Your existing stop order is unchanged.' });
  }
});

// POST /itinerary/:tripId - Add a new place to the itinerary
router.post('/:tripId', async (req, res) => {
  const { tripId } = req.params;
  let { placeId } = req.body;
  const { googlePlace, dayIndex, orderIndex, startTime, endTime, note } = req.body;

  if ((!googlePlace && typeof placeId !== 'string') || !Number.isInteger(dayIndex) || dayIndex < 0
      || !Number.isInteger(orderIndex) || orderIndex < 0) {
    return res.status(400).json({ error: 'A place, non-negative dayIndex, and non-negative orderIndex are required.' });
  }
  if (googlePlace && (typeof googlePlace.googlePlaceId !== 'string' || !googlePlace.googlePlaceId.trim() || googlePlace.googlePlaceId.length > 4096
      || typeof googlePlace.name !== 'string' || !googlePlace.name.trim() || googlePlace.name.length > 200
      || (googlePlace.category && typeof googlePlace.category !== 'string')
      || !Number.isFinite(Number(googlePlace.latitude)) || Number(googlePlace.latitude) < -90 || Number(googlePlace.latitude) > 90
      || !Number.isFinite(Number(googlePlace.longitude)) || Number(googlePlace.longitude) < -180 || Number(googlePlace.longitude) > 180)) {
    return res.status(400).json({ error: 'Google place name, ID, and coordinates are required.' });
  }
  if ((startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime))
      || (endTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime))
      || (startTime && endTime && endTime <= startTime)) {
    return res.status(400).json({ error: 'Itinerary times must use HH:MM and end after start.' });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    const [matchingTripPlace] = await d1Query(
      `SELECT t.id, t.destination_id, t.start_date, t.end_date FROM trips t
       WHERE t.id = ? AND (t.user_id = ? OR EXISTS (SELECT 1 FROM trip_collaborators c WHERE c.trip_id = t.id AND c.user_id = ? AND c.role = 'editor' AND c.status = 'accepted'))`,
      [tripId, req.user.id, req.user.id]
    );
    if (!matchingTripPlace) return res.status(404).json({ error: 'Trip not found.' });
    if (googlePlace) {
      const googleId = googlePlace.googlePlaceId.trim();
      const [existingPlace] = await d1Query('SELECT id FROM places WHERE google_place_id = ? AND destination_id = ? LIMIT 1', [googleId, matchingTripPlace.destination_id]);
      placeId = existingPlace?.id;
      if (!placeId) {
        placeId = crypto.randomUUID();
        const now = new Date().toISOString();
        await d1Query(
          `INSERT INTO places (id, destination_id, name, category, latitude, longitude, google_place_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [placeId, matchingTripPlace.destination_id, googlePlace.name.trim(), googlePlace.category || 'attraction',
            Number(googlePlace.latitude), Number(googlePlace.longitude), googleId, now, now]
        );
      }
    } else {
      const [matchingPlace] = await d1Query('SELECT id FROM places WHERE id = ? AND destination_id = ? LIMIT 1', [placeId, matchingTripPlace.destination_id]);
      if (!matchingPlace) return res.status(404).json({ error: 'Destination place not found.' });
    }
    const dayCount = Math.floor((Date.parse(`${matchingTripPlace.end_date}T00:00:00Z`) - Date.parse(`${matchingTripPlace.start_date}T00:00:00Z`)) / 86400000) + 1;
    if (dayIndex >= dayCount) return res.status(400).json({ error: 'dayIndex falls outside the trip dates.' });

    await d1Query(
      `INSERT INTO itinerary_items (id, trip_id, place_id, day_index, order_index, start_time, end_time, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tripId, placeId, dayIndex, orderIndex, startTime, endTime, note, now, now]
    );
    res.status(201).json({ success: true, id, message: 'Item added to itinerary' });
  } catch (error) {
    console.error('Error adding itinerary item:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

router.patch('/:tripId/item/:itemId', async (req, res) => {
  const { tripId, itemId } = req.params;
  const body = req.body || {};
  const hasPlaceId = Object.hasOwn(req.body || {}, 'placeId');
  const hasDayIndex = Object.hasOwn(body, 'dayIndex');
  const hasStartTime = Object.hasOwn(req.body || {}, 'startTime');
  const hasEndTime = Object.hasOwn(body, 'endTime');
  const hasNote = Object.hasOwn(body, 'note');
  const hasVisitedAt = Object.hasOwn(body, 'visitedAt');
  const hasEstimatedCost = Object.hasOwn(body, 'estimatedCost');
  const hasCostCurrency = Object.hasOwn(body, 'costCurrency');
  const hasBookingUrl = Object.hasOwn(body, 'bookingUrl');
  const hasPhotoUrl = Object.hasOwn(body, 'photoUrl');
  const placeId = req.body?.placeId;
  const dayIndex = Number(body.dayIndex);
  const startTime = req.body?.startTime;
  const endTime = body.endTime;
  const note = body.note;

  const visitedAt = body.visitedAt;
  const estimatedCost = body.estimatedCost;
  const costCurrency = body.costCurrency;
  const bookingUrl = body.bookingUrl;
  const photoUrl = body.photoUrl;

  if ((!hasPlaceId && !hasDayIndex && !hasStartTime && !hasEndTime && !hasNote && !hasVisitedAt && !hasEstimatedCost && !hasCostCurrency && !hasBookingUrl && !hasPhotoUrl)
      || (hasPlaceId && (typeof placeId !== 'string' || !placeId.trim()))
      || (hasDayIndex && (!Number.isInteger(dayIndex) || dayIndex < 0))
      || (hasStartTime && typeof startTime !== 'string' && startTime !== null)
      || (hasEndTime && typeof endTime !== 'string' && endTime !== null)
      || (hasNote && (typeof note !== 'string' || note.length > 1000))
      || (hasVisitedAt && visitedAt !== null && (typeof visitedAt !== 'string' || Number.isNaN(Date.parse(visitedAt))))
      || (hasEstimatedCost && (typeof estimatedCost !== 'string' || (estimatedCost && (!/^\d+(\.\d{1,2})?$/.test(estimatedCost) || Number(estimatedCost) > 100000000))))
      || (hasCostCurrency && (typeof costCurrency !== 'string' || !/^[A-Z]{3}$/.test(costCurrency)))
      || (hasBookingUrl && (typeof bookingUrl !== 'string' || bookingUrl.length > 1000 || (bookingUrl && !/^https?:\/\//i.test(bookingUrl))))
      || (hasPhotoUrl && (typeof photoUrl !== 'string' || photoUrl.length > 2000 || (photoUrl && !/^https?:\/\//i.test(photoUrl))))
      || (typeof startTime === 'string' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime))
      || (typeof endTime === 'string' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime))) {
    return res.status(400).json({ error: 'Provide valid place, day, times, and notes.' });
  }

  try {
    const [current] = await d1Query(
      `SELECT i.id, i.place_id, i.day_index, i.order_index, i.start_time, i.end_time, i.note, i.visited_at, i.estimated_cost, i.cost_currency, i.booking_url,
              t.destination_id, t.start_date, t.end_date
       FROM itinerary_items i JOIN trips t ON t.id = i.trip_id
       WHERE i.id = ? AND i.trip_id = ? AND (t.user_id = ? OR EXISTS (SELECT 1 FROM trip_collaborators c WHERE c.trip_id = t.id AND c.user_id = ? AND c.role = 'editor' AND c.status = 'accepted')) LIMIT 1`,
      [itemId, tripId, req.user.id, req.user.id]
    );
    if (!current) return res.status(404).json({ error: 'Itinerary stop not found.' });

    const dayCount = Math.floor((Date.parse(`${current.end_date}T00:00:00Z`) - Date.parse(`${current.start_date}T00:00:00Z`)) / 86400000) + 1;
    if (hasDayIndex && dayIndex >= dayCount) {
      return res.status(400).json({ error: 'Choose a day within this trip.' });
    }

    let nextPlaceId = current.place_id;
    if (hasPlaceId) {
      const [place] = await d1Query(
        'SELECT id FROM places WHERE id = ? AND destination_id = ? LIMIT 1',
        [placeId, current.destination_id]
      );
      if (!place) return res.status(400).json({ error: 'Choose a place from this trip destination.' });
      nextPlaceId = place.id;
    }
    const nextDayIndex = hasDayIndex ? dayIndex : current.day_index;
    const nextStartTime = hasStartTime ? startTime : current.start_time;
    const nextEndTime = hasEndTime ? endTime : current.end_time;
    const nextNote = hasNote ? note.trim() : current.note;
    const nextVisitedAt = hasVisitedAt ? visitedAt : current.visited_at;
    const nextEstimatedCost = hasEstimatedCost ? estimatedCost : current.estimated_cost;
    const nextCostCurrency = hasCostCurrency ? costCurrency : current.cost_currency;
    const nextBookingUrl = hasBookingUrl ? bookingUrl.trim() : current.booking_url;
    const nextPhotoUrl = hasPhotoUrl ? photoUrl.trim() : current.photo_url;
    if (nextEndTime && !nextStartTime) {
      return res.status(400).json({ error: 'Add a start time before the end time.' });
    }
    if (nextEndTime && nextStartTime && nextEndTime <= nextStartTime) {
      return res.status(400).json({ error: 'The stop must start before its end time.' });
    }

    let nextOrderIndex = current.order_index;
    if (nextDayIndex !== current.day_index) {
      const [lastItem] = await d1Query(
        'SELECT COALESCE(MAX(order_index), -1) AS max_order_index FROM itinerary_items WHERE trip_id = ? AND day_index = ?',
        [tripId, nextDayIndex]
      );
      nextOrderIndex = Number(lastItem?.max_order_index ?? -1) + 1;
    }

    await d1Query(
      `UPDATE itinerary_items
       SET place_id = ?, day_index = ?, order_index = ?, start_time = ?, end_time = ?, note = ?, visited_at = ?, estimated_cost = ?, cost_currency = ?, booking_url = ?, photo_url = ?, updated_at = ?
       WHERE id = ? AND trip_id = ?`,
      [nextPlaceId, nextDayIndex, nextOrderIndex, nextStartTime, nextEndTime, nextNote, nextVisitedAt, nextEstimatedCost, nextCostCurrency, nextBookingUrl, nextPhotoUrl, new Date().toISOString(), itemId, tripId]
    );
    const [updated] = await d1Query(
      `SELECT i.*, p.name AS place_name, p.category, p.latitude, p.longitude, p.google_place_id
       FROM itinerary_items i JOIN places p ON p.id = i.place_id
       WHERE i.id = ? AND i.trip_id = ? LIMIT 1`,
      [itemId, tripId]
    );
    res.json({
      success: true,
      item: { ...updated, lat: updated.latitude, lng: updated.longitude, title: updated.place_name },
    });
  } catch (error) {
    console.error('[Itinerary update] Failed:', error);
    res.status(500).json({ error: 'The itinerary stop could not be updated.' });
  }
});

// PUT /itinerary/:tripId/reorder - Bulk update order after drag and drop
router.put('/:tripId/reorder', async (req, res) => {
  const { tripId } = req.params;
  const { items } = req.body; // Array of { id, dayIndex, orderIndex }

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items array is required' });
  }

  const now = new Date().toISOString();

  try {
    const [ownedTrip] = await d1Query(
      `SELECT t.id, t.start_date, t.end_date FROM trips t WHERE t.id = ? AND (t.user_id = ? OR EXISTS (SELECT 1 FROM trip_collaborators c WHERE c.trip_id = t.id AND c.user_id = ? AND c.role = 'editor' AND c.status = 'accepted'))`,
      [tripId, req.user.id, req.user.id]
    );
    if (!ownedTrip) return res.status(404).json({ error: 'Trip not found' });

    const dayCount = Math.floor((Date.parse(`${ownedTrip.end_date}T00:00:00Z`) - Date.parse(`${ownedTrip.start_date}T00:00:00Z`)) / 86400000) + 1;
    const validItems = items.every(item => item && typeof item.id === 'string'
      && Number.isInteger(item.dayIndex) && item.dayIndex >= 0 && item.dayIndex < dayCount
      && Number.isInteger(item.orderIndex) && item.orderIndex >= 0);
    const itemIds = [...new Set(items.map(item => item?.id).filter(id => typeof id === 'string'))];
    if (!validItems || itemIds.length !== items.length) {
      return res.status(400).json({ error: 'Items need unique ids and valid day/order indexes.' });
    }

    if (itemIds.length === 0) return res.json({ success: true, message: 'Itinerary order unchanged.' });

    const ownedItems = await d1Query(
      `SELECT id FROM itinerary_items WHERE trip_id = ? AND id IN (${itemIds.map(() => '?').join(',')})`,
      [tripId, ...itemIds]
    );
    if (ownedItems.length !== itemIds.length) return res.status(400).json({ error: 'Some items do not belong to this trip' });

    // In a real production app with massive scale, use a transaction.
    // For D1, we can do multiple queries or a CASE statement.
    // We'll execute them sequentially for simplicity.
    for (const item of items) {
      await d1Query(
        `UPDATE itinerary_items 
         SET day_index = ?, order_index = ?, updated_at = ?
         WHERE id = ? AND trip_id = ?`,
        [item.dayIndex, item.orderIndex, now, item.id, tripId]
      );
    }
    res.json({ success: true, message: 'Itinerary reordered successfully' });
  } catch (error) {
    console.error('Error reordering itinerary:', error);
    res.status(500).json({ error: 'Failed to reorder itinerary' });
  }
});

// DELETE /itinerary/item/:itemId - Remove an item
router.delete('/item/:itemId', async (req, res) => {
  const { itemId } = req.params;
  try {
    const [ownedItem] = await d1Query(
      `SELECT i.id FROM itinerary_items i JOIN trips t ON t.id = i.trip_id
       WHERE i.id = ? AND (t.user_id = ? OR EXISTS (SELECT 1 FROM trip_collaborators c WHERE c.trip_id = t.id AND c.user_id = ? AND c.role = 'editor' AND c.status = 'accepted'))`,
      [itemId, req.user.id, req.user.id]
    );
    if (!ownedItem) return res.status(404).json({ error: 'Itinerary item not found' });
    await d1Query('DELETE FROM itinerary_items WHERE id = ?', [itemId]);
    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

export default router;
