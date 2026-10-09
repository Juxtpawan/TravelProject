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
  const { destinationId, title, startDate, endDate } = req.body;

  const validStartDate = /^\d{4}-\d{2}-\d{2}$/.test(startDate || '')
    && !Number.isNaN(Date.parse(`${startDate}T00:00:00Z`));
  const validEndDate = /^\d{4}-\d{2}-\d{2}$/.test(endDate || '')
    && !Number.isNaN(Date.parse(`${endDate}T00:00:00Z`));
  if (typeof destinationId !== 'string' || typeof title !== 'string' || !title.trim()
      || !validStartDate || !validEndDate || endDate < startDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const newId = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await d1Query(
      `INSERT INTO trips (id, user_id, destination_id, title, start_date, end_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, req.user.id, destinationId, title, startDate, endDate, now, now]
    );

    res.status(201).json({ success: true, id: newId, message: 'Trip created successfully' });
  } catch (error) {
    console.error('Error creating trip:', error);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

export default router;
