import express from 'express';
import { d1Query } from '../db/client.js';

const router = express.Router();

// Mock endpoint to initiate a subscription upgrade
router.post('/upgrade', async (req, res) => {
  const { userId, tier } = req.body;
  if (!userId || !tier) {
    return res.status(400).json({ error: 'userId and tier are required' });
  }

  try {
    // In a real app, this would create a Stripe Checkout Session
    // For now, we'll directly update the DB to simulate success
    await d1Query(
      'UPDATE users SET subscription_tier = ?, subscription_status = ? WHERE id = ?',
      [tier, 'active', userId]
    );

    res.json({ success: true, message: `Successfully upgraded to ${tier} plan!` });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({ error: 'Failed to upgrade subscription' });
  }
});

// Endpoint to fetch current subscription status
router.get('/:userId/status', async (req, res) => {
  const { userId } = req.params;
  try {
    const [user] = await d1Query(
      'SELECT subscription_tier, subscription_status FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

export default router;
