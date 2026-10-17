import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { d1Query } from '../db/client.js';

const router = express.Router();
router.use(authMiddleware);

// GET /trips - List all trips for a user
router.get('/', async (req, res) => {
  try {
    const trips = await d1Query(
      `SELECT t.*, d.name as destination_name, d.slug as destination_slug
       FROM trips t
       JOIN destinations d ON t.destination_id = d.id
       WHERE t.user_id = ?
       ORDER BY t.start_date ASC`,
      [req.user.id]
    );
    res.json(trips);
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// POST /trips - Create a new trip
router.post('/', async (req, res) => {
  const { destinationId, destinationName, title, startDate, endDate } = req.body;

  const validStartDate = /^\d{4}-\d{2}-\d{2}$/.test(startDate || '')
    && !Number.isNaN(Date.parse(`${startDate}T00:00:00Z`));
  const validEndDate = /^\d{4}-\d{2}-\d{2}$/.test(endDate || '')
    && !Number.isNaN(Date.parse(`${endDate}T00:00:00Z`));
  const cleanDestinationName = typeof destinationName === 'string' ? destinationName.trim().slice(0, 120) : '';
  if ((!cleanDestinationName && typeof destinationId !== 'string')
      || (title != null && typeof title !== 'string')
      || !validStartDate || !validEndDate || endDate < startDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const newId = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    let resolvedDestinationId = '';
    let resolvedDestinationName = '';
    if (typeof destinationId === 'string' && destinationId) {
      const [destination] = await d1Query('SELECT id, name FROM destinations WHERE id = ? LIMIT 1', [destinationId]);
      if (!destination) return res.status(400).json({ error: 'Choose a valid destination.' });
      resolvedDestinationId = destination.id;
      resolvedDestinationName = destination.name;
    } else if (cleanDestinationName) {
      const [existing] = await d1Query('SELECT id, name FROM destinations WHERE lower(name) = lower(?) LIMIT 1', [cleanDestinationName]);
      if (existing) {
        resolvedDestinationId = existing.id;
        resolvedDestinationName = existing.name;
      } else {
        resolvedDestinationId = crypto.randomUUID();
        const slugBase = cleanDestinationName.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'destination';
        const slug = `${slugBase}-${resolvedDestinationId.slice(0, 8)}`;
        await d1Query(
          `INSERT INTO destinations (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
          [resolvedDestinationId, cleanDestinationName, slug, now, now]
        );
      }
    }
    const tripTitle = title?.trim() || resolvedDestinationName || cleanDestinationName;
    if (!tripTitle) return res.status(400).json({ error: 'Destination is required.' });
    await d1Query(
      `INSERT INTO trips (id, user_id, destination_id, title, start_date, end_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, req.user.id, resolvedDestinationId, tripTitle, startDate, endDate, now, now]
    );

    res.status(201).json({ success: true, id: newId, destinationName: resolvedDestinationName || cleanDestinationName, message: 'Trip created successfully' });
  } catch (error) {
    console.error('Error creating trip:', error);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

// DELETE /trips/:tripId - Delete a trip and its itinerary stops.
router.delete('/:tripId', async (req, res) => {
  const { tripId } = req.params;
  try {
    const [trip] = await d1Query('SELECT id FROM trips WHERE id = ? AND user_id = ? LIMIT 1', [tripId, req.user.id]);
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });

    await d1Query('DELETE FROM itinerary_items WHERE trip_id = ?', [tripId]);
    await d1Query('DELETE FROM trips WHERE id = ? AND user_id = ?', [tripId, req.user.id]);
    res.json({ success: true, id: tripId });
  } catch (error) {
    console.error('Error deleting trip:', error);
    res.status(500).json({ error: 'Trip could not be deleted.' });
  }
});

export default router;
