import express from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { d1Query } from '../db/client.js';

const router = express.Router();
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

// Public, account-free view links only expose the itinerary overview. Notes,
// logistics, and reservations stay private.
router.get('/shared/:tripId/:token', async (req, res) => {
  try {
    const [link] = await d1Query(
      `SELECT t.id, t.title, t.start_date, t.end_date, d.name AS destination_name,
              d.slug AS destination_slug, l.id AS share_link_id
       FROM trip_share_links l JOIN trips t ON t.id = l.trip_id
       JOIN destinations d ON d.id = t.destination_id
       WHERE l.trip_id = ? AND l.token_hash = ? AND l.role = 'viewer' AND l.revoked_at IS NULL LIMIT 1`,
      [req.params.tripId, hashToken(req.params.token)]
    );
    if (!link) return res.status(404).json({ error: 'This shared trip link is unavailable.' });
    const items = await d1Query(
      `SELECT i.id, i.day_index, i.order_index, i.start_time, i.end_time,
              p.name AS place_name, p.category, p.latitude, p.longitude
       FROM itinerary_items i JOIN places p ON p.id = i.place_id
       WHERE i.trip_id = ? ORDER BY i.day_index, i.order_index`, [link.id]
    );
    return res.json({ trip: { id: link.id, title: link.title, start_date: link.start_date, end_date: link.end_date, destination_name: link.destination_name, destination_slug: link.destination_slug }, items });
  } catch (error) {
    console.error('Error loading public shared trip:', error);
    return res.status(500).json({ error: 'The shared trip could not be loaded.' });
  }
});

router.use(authMiddleware);

router.get('/notifications', async (req, res) => {
  try {
    const rows = await d1Query(
      `SELECT n.id, n.trip_id, n.type, n.payload_json, n.created_at, n.read_at,
              t.title AS trip_title, d.name AS destination_name
       FROM notifications n LEFT JOIN trips t ON t.id = n.trip_id
       LEFT JOIN destinations d ON d.id = t.destination_id
       WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 50`, [req.user.id]
    );
    return res.json(rows.map(row => ({ ...row, payload: JSON.parse(row.payload_json || '{}') })));
  } catch (error) {
    console.error('Error loading notifications:', error);
    return res.status(500).json({ error: 'Notifications could not be loaded.' });
  }
});

router.post('/notifications/read', async (req, res) => {
  try {
    await d1Query('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', [new Date().toISOString(), req.user.id]);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error marking notifications read:', error);
    return res.status(500).json({ error: 'Notifications could not be updated.' });
  }
});

router.post('/invitations/:tripId/:token/request', async (req, res) => {
  try {
    const [invite] = await d1Query(
      `SELECT l.trip_id, l.target_user_id, t.user_id AS owner_id, t.title AS trip_title, d.name AS destination_name
       FROM trip_share_links l JOIN trips t ON t.id = l.trip_id
       JOIN destinations d ON d.id = t.destination_id
       WHERE l.trip_id = ? AND l.token_hash = ? AND l.role = 'editor' AND l.revoked_at IS NULL LIMIT 1`,
      [req.params.tripId, hashToken(req.params.token)]
    );
    if (!invite) return res.status(404).json({ error: 'This collaboration invite is unavailable.' });
    if (invite.target_user_id && invite.target_user_id !== req.user.id) return res.status(403).json({ error: 'This invite was created for a different account.' });
    if (invite.owner_id === req.user.id) return res.status(400).json({ error: 'You already own this trip.' });
    const [existing] = await d1Query('SELECT status FROM trip_collaborators WHERE trip_id = ? AND user_id = ? LIMIT 1', [invite.trip_id, req.user.id]);
    if (existing?.status === 'accepted') return res.json({ status: 'accepted', tripId: invite.trip_id });
    if (existing?.status === 'pending') return res.json({ status: 'pending', tripTitle: invite.trip_title });

    const now = new Date().toISOString();
    await d1Query(
      `INSERT INTO trip_collaborators (trip_id, user_id, role, status, requested_at, updated_at)
       VALUES (?, ?, 'editor', 'pending', ?, ?)
       ON CONFLICT(trip_id, user_id) DO UPDATE SET role = 'editor', status = 'pending', requested_at = excluded.requested_at, updated_at = excluded.updated_at`,
      [invite.trip_id, req.user.id, now, now]
    );
    const id = randomUUID();
    await d1Query(
      `INSERT INTO notifications (id, user_id, trip_id, type, payload_json, created_at)
       VALUES (?, ?, ?, 'trip_access_request', ?, ?)`,
      [id, invite.owner_id, invite.trip_id, JSON.stringify({ requesterId: req.user.id, requesterName: req.user.name, requesterUsername: req.user.username, requesterEmail: req.user.email }), now]
    );
    return res.status(201).json({ status: 'pending', tripTitle: invite.trip_title });
  } catch (error) {
    console.error('Error requesting trip access:', error);
    return res.status(500).json({ error: 'The access request could not be sent.' });
  }
});

router.post('/notifications/:notificationId/respond', async (req, res) => {
  const decision = req.body?.decision;
  const role = req.body?.role;
  if (!['accept', 'decline'].includes(decision) || (decision === 'accept' && !['editor', 'viewer'].includes(role))) {
    return res.status(400).json({ error: 'Choose whether to accept or decline, and select an access level.' });
  }
  try {
    const [notification] = await d1Query(
      `SELECT id, trip_id, payload_json FROM notifications WHERE id = ? AND user_id = ? AND type = 'trip_access_request' LIMIT 1`,
      [req.params.notificationId, req.user.id]
    );
    if (!notification) return res.status(404).json({ error: 'Request not found.' });
    const payload = JSON.parse(notification.payload_json || '{}');
    const [trip] = await d1Query('SELECT id, title FROM trips WHERE id = ? AND user_id = ? LIMIT 1', [notification.trip_id, req.user.id]);
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    const now = new Date().toISOString();
    await d1Query(
      `UPDATE trip_collaborators SET status = ?, role = ?, invited_by = ?, updated_at = ?
       WHERE trip_id = ? AND user_id = ? AND status = 'pending'`,
      [decision === 'accept' ? 'accepted' : 'rejected', role || 'editor', req.user.id, now, trip.id, payload.requesterId]
    );
    await d1Query('UPDATE notifications SET read_at = ? WHERE id = ?', [now, notification.id]);
    if (payload.requesterId) {
      await d1Query(
        `INSERT INTO notifications (id, user_id, trip_id, type, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), payload.requesterId, trip.id, decision === 'accept' ? 'trip_access_approved' : 'trip_access_declined', JSON.stringify({ role: decision === 'accept' ? role : null, tripTitle: trip.title }), now]
      );
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Error responding to trip access request:', error);
    return res.status(500).json({ error: 'The request could not be updated.' });
  }
});

router.post('/:tripId/share-links', async (req, res) => {
  const role = req.body?.role;
  const inviteeUserId = typeof req.body?.inviteeUserId === 'string' ? req.body.inviteeUserId.trim() : '';
  if (!['editor', 'viewer'].includes(role)) return res.status(400).json({ error: 'Choose Can edit or View only.' });
  try {
    const [trip] = await d1Query('SELECT id FROM trips WHERE id = ? AND user_id = ? LIMIT 1', [req.params.tripId, req.user.id]);
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    let targetUserId = null;
    if (role === 'editor') {
      if (!inviteeUserId) return res.status(400).json({ error: 'Search for and select a tripmate profile first.' });
      const [target] = await d1Query('SELECT id FROM users WHERE id = ? LIMIT 1', [inviteeUserId]);
      if (!target) return res.status(404).json({ error: 'That tripmate profile no longer exists.' });
      if (target.id === req.user.id) return res.status(400).json({ error: 'You already own this trip.' });
      targetUserId = target.id;
    }
    const token = randomBytes(32).toString('base64url');
    const id = randomUUID();
    await d1Query(
      `INSERT INTO trip_share_links (id, trip_id, token_hash, role, target_user_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, trip.id, hashToken(token), role, targetUserId, req.user.id, new Date().toISOString()]
    );
    return res.status(201).json({ id, role, path: role === 'viewer' ? `/trips/shared/${trip.id}/${token}` : `/trips/invite/${trip.id}/${token}`, targetUserId });
  } catch (error) {
    console.error('Error creating trip share link:', error);
    return res.status(500).json({ error: 'The trip link could not be created.' });
  }
});

router.get('/:tripId/share-links', async (req, res) => {
  try {
    const [trip] = await d1Query('SELECT id FROM trips WHERE id = ? AND user_id = ? LIMIT 1', [req.params.tripId, req.user.id]);
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    const links = await d1Query(
      `SELECT l.id, l.role, l.created_at, u.email AS target_email, u.username AS target_username
       FROM trip_share_links l LEFT JOIN users u ON u.id = l.target_user_id
       WHERE l.trip_id = ? AND l.revoked_at IS NULL ORDER BY l.created_at DESC`, [trip.id]
    );
    return res.json(links);
  } catch (error) {
    console.error('Error loading trip links:', error);
    return res.status(500).json({ error: 'Trip links could not be loaded.' });
  }
});

router.delete('/:tripId/share-links/:linkId', async (req, res) => {
  try {
    const [trip] = await d1Query('SELECT id FROM trips WHERE id = ? AND user_id = ? LIMIT 1', [req.params.tripId, req.user.id]);
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    await d1Query('UPDATE trip_share_links SET revoked_at = ? WHERE id = ? AND trip_id = ? AND revoked_at IS NULL', [new Date().toISOString(), req.params.linkId, trip.id]);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error revoking trip link:', error);
    return res.status(500).json({ error: 'The trip link could not be revoked.' });
  }
});

router.get('/:tripId/collaborators', async (req, res) => {
  try {
    const [trip] = await d1Query('SELECT id FROM trips WHERE id = ? AND user_id = ? LIMIT 1', [req.params.tripId, req.user.id]);
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    const collaborators = await d1Query(
      `SELECT c.user_id, c.role, c.status, c.requested_at, u.name, u.username, u.email, u.avatar_url
       FROM trip_collaborators c JOIN users u ON u.id = c.user_id
       WHERE c.trip_id = ? ORDER BY c.updated_at DESC`, [trip.id]
    );
    return res.json(collaborators);
  } catch (error) {
    console.error('Error loading tripmates:', error);
    return res.status(500).json({ error: 'Tripmates could not be loaded.' });
  }
});

router.delete('/:tripId/collaborators/:userId', async (req, res) => {
  try {
    const [trip] = await d1Query('SELECT id FROM trips WHERE id = ? AND user_id = ? LIMIT 1', [req.params.tripId, req.user.id]);
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    await d1Query('DELETE FROM trip_collaborators WHERE trip_id = ? AND user_id = ?', [trip.id, req.params.userId]);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error removing tripmate:', error);
    return res.status(500).json({ error: 'Tripmate could not be removed.' });
  }
});

router.get('/:tripId/logistics', async (req, res) => {
  try {
    const [trip] = await d1Query(`SELECT t.id FROM trips t WHERE t.id = ? AND (t.user_id = ? OR EXISTS (SELECT 1 FROM trip_collaborators c WHERE c.trip_id = t.id AND c.user_id = ? AND c.role = 'editor' AND c.status = 'accepted')) LIMIT 1`, [req.params.tripId, req.user.id, req.user.id]);
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    const fields = ['arrival_mode', 'arrival_details', 'arrival_name', 'arrival_number', 'arrival_from', 'arrival_to', 'arrival_confirmation', 'arrival_departure_date', 'arrival_departure_time', 'arrival_arrival_date', 'arrival_arrival_time', 'arrival_cost', 'arrival_currency', 'arrival_notes', 'arrival_transport_options', 'arrival_items', 'local_transport', 'local_transport_details', 'transfer_mode', 'transfer_from', 'transfer_to', 'transfer_notes', 'transfer_items', 'stay_name', 'stay_details'];
    const [logistics] = await d1Query(`SELECT ${fields.join(', ')} FROM trip_logistics WHERE trip_id = ? LIMIT 1`, [trip.id]);
    return res.json(logistics || Object.fromEntries(fields.map(field => [field, field === 'arrival_currency' ? 'INR' : ''])));
  } catch (error) {
    console.error('Error fetching trip logistics:', error);
    return res.status(500).json({ error: 'Trip details could not be loaded.' });
  }
});

router.put('/:tripId/logistics', async (req, res) => {
  const fields = ['arrival_mode', 'arrival_details', 'arrival_name', 'arrival_number', 'arrival_from', 'arrival_to', 'arrival_confirmation', 'arrival_departure_date', 'arrival_departure_time', 'arrival_arrival_date', 'arrival_arrival_time', 'arrival_cost', 'arrival_currency', 'arrival_notes', 'arrival_transport_options', 'arrival_items', 'local_transport', 'local_transport_details', 'transfer_mode', 'transfer_from', 'transfer_to', 'transfer_notes', 'transfer_items', 'stay_name', 'stay_details'];
  const limits = { arrival_notes: 2000, arrival_transport_options: 16000, arrival_items: 30000, transfer_items: 30000, arrival_cost: 24, arrival_departure_date: 10, arrival_arrival_date: 10, arrival_departure_time: 5, arrival_arrival_time: 5 };
  const values = fields.map((field) => typeof req.body?.[field] === 'string' ? req.body[field].trim().slice(0, limits[field] || 300) : (field === 'arrival_currency' ? 'INR' : ''));
  try {
    const [trip] = await d1Query(`SELECT t.id FROM trips t WHERE t.id = ? AND (t.user_id = ? OR EXISTS (SELECT 1 FROM trip_collaborators c WHERE c.trip_id = t.id AND c.user_id = ? AND c.role = 'editor' AND c.status = 'accepted')) LIMIT 1`, [req.params.tripId, req.user.id, req.user.id]);
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    const now = new Date().toISOString();
    await d1Query(`INSERT INTO trip_logistics (trip_id, ${fields.join(', ')}, updated_at)
      VALUES (${Array(fields.length + 2).fill('?').join(', ')})
      ON CONFLICT(trip_id) DO UPDATE SET ${fields.map((field) => `${field} = excluded.${field}`).join(', ')}, updated_at = excluded.updated_at`,
    [trip.id, ...values, now]);
    return res.json(Object.fromEntries(fields.map((field, index) => [field, values[index]])));
  } catch (error) {
    console.error('Error saving trip logistics:', error);
    return res.status(500).json({ error: 'Trip details could not be saved.' });
  }
});

router.put('/:tripId/notes', async (req, res) => {
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 4000) : '';
  try {
    const [trip] = await d1Query(`SELECT t.id FROM trips t WHERE t.id = ? AND (t.user_id = ? OR EXISTS (SELECT 1 FROM trip_collaborators c WHERE c.trip_id = t.id AND c.user_id = ? AND c.role = 'editor' AND c.status = 'accepted')) LIMIT 1`, [req.params.tripId, req.user.id, req.user.id]);
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    await d1Query('UPDATE trips SET notes = ?, updated_at = ? WHERE id = ?', [notes, new Date().toISOString(), trip.id]);
    return res.json({ notes });
  } catch (error) {
    console.error('Error saving trip notes:', error);
    return res.status(500).json({ error: 'Trip notes could not be saved.' });
  }
});

// GET /trips - List all trips for a user
router.get('/', async (req, res) => {
  try {
    const trips = await d1Query(
      `SELECT t.*, CASE WHEN t.user_id = ? THEN 'owner' ELSE
                (SELECT c.role FROM trip_collaborators c WHERE c.trip_id = t.id AND c.user_id = ? AND c.status = 'accepted' LIMIT 1) END AS trip_role,
              d.name as destination_name, d.slug as destination_slug,
              d.latitude as destination_latitude, d.longitude as destination_longitude,
              COALESCE(d.google_place_id, 'local:' || d.id) as destination_google_place_id
       FROM trips t
       JOIN destinations d ON t.destination_id = d.id
       WHERE t.user_id = ? OR EXISTS (SELECT 1 FROM trip_collaborators c WHERE c.trip_id = t.id AND c.user_id = ? AND c.status = 'accepted')
       ORDER BY t.start_date ASC`,
      [req.user.id, req.user.id, req.user.id, req.user.id]
    );
    res.json(trips.map(trip => trip.trip_role === 'viewer' ? { ...trip, notes: '' } : trip));
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
