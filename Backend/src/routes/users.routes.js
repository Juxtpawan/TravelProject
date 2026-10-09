import express from 'express';
import { d1Query } from '../db/client.js';
import * as usersQueries from '../db/queries/users.queries.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { generateRandomTravelUsername, generateUniqueTravelUsername } from '../utils/travelUsername.js';

const router = express.Router();

// GET /users/suggest-username — returns a random travel username idea
router.get('/suggest-username', (req, res) => {
  res.json({ username: generateRandomTravelUsername() });
});

// GET /users/:userId/profile
router.get('/:userId/profile', async (req, res) => {
  const { userId } = req.params;
  try {
    const [user] = await d1Query(
      `SELECT id, name, email, username, avatar_url, subscription_tier, subscription_status, created_at
       FROM users WHERE id = ?`,
      [userId]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Auto-create unique travel username if user doesn't have one
    if (!user.username) {
      const generatedUsername = await generateUniqueTravelUsername(d1Query);
      await d1Query('UPDATE users SET username = ? WHERE id = ?', [generatedUsername, userId]);
      user.username = generatedUsername;
    }

    // Fetch connected auth providers (e.g. google, email)
    const credentials = await usersQueries.findCredentialsByUserId(userId);
    const providers = {
      google: credentials.some((c) => c.provider === 'google'),
      email: credentials.some((c) => c.provider === 'email' && c.has_password === 1),
    };

    res.json({
      ...user,
      providers,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /users/:userId/profile
router.put('/:userId/profile', authMiddleware, async (req, res) => {
  const { userId } = req.params;

  // Ensure users can only modify their own account
  if (req.user.id !== userId) {
    return res.status(403).json({ error: 'Forbidden: you cannot edit another account.' });
  }

  const { name, email, username, avatarUrl } = req.body;

  try {
    const currentUser = await usersQueries.findUserById(userId);
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    // Validate username if provided / changed
    if (username && username.trim() !== (currentUser.username || '')) {
      const cleanUsername = username.trim();
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(cleanUsername)) {
        return res.status(400).json({
          error: 'Travel handle must be 3-30 characters (letters, numbers, underscores, or hyphens only).',
        });
      }

      const existingWithUsername = await usersQueries.findUserByUsername(cleanUsername);
      if (existingWithUsername && existingWithUsername.id !== userId) {
        return res.status(409).json({ error: 'This travel username is already taken. Try another unique handle!' });
      }
    }

    // Email updates are disabled — keep currentUser.email
    const updated = await usersQueries.updateUserProfile(userId, {
      name: name ?? currentUser.name,
      username: username ?? currentUser.username,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : currentUser.avatar_url,
    });

    const credentials = await usersQueries.findCredentialsByUserId(userId);
    const providers = {
      google: credentials.some((c) => c.provider === 'google'),
      email: credentials.some((c) => c.provider === 'email' && c.has_password === 1),
    };

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        username: updated.username,
        avatar_url: updated.avatar_url,
        subscription_tier: updated.subscription_tier,
        subscription_status: updated.subscription_status,
        providers,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /users/:userId — Delete whole account
router.delete('/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;

  if (req.user.id !== userId) {
    return res.status(403).json({ error: 'Forbidden: you cannot delete another account.' });
  }

  try {
    await usersQueries.deleteUserById(userId);
    res.clearCookie('access_token', { path: '/' });
    res.json({ success: true, message: 'Account deleted permanently.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /users/:userId/upload-url — R2 pre-signed URL
router.post('/:userId/upload-url', async (req, res) => {
  const { userId } = req.params;
  const { fileName, contentType = 'image/jpeg' } = req.body;

  const key = `avatars/${userId}/${Date.now()}-${fileName}`;

  try {
    res.json({
      key,
      uploadEndpoint: `http://localhost:8080/users/upload/${encodeURIComponent(key)}`,
      expiresIn: 300,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /users/upload/:key — accepts binary body, writes to R2
router.put('/upload/:key', express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
  const key = decodeURIComponent(req.params.key);
  const bucket = req.cloudflare?.env?.BUCKET;
  try {
    if (!bucket) {
      return res.status(501).json({ error: 'R2 bucket not available in this environment.' });
    }
    await bucket.put(key, req.body, {
      httpMetadata: { contentType: req.headers['content-type'] || 'image/jpeg' },
    });
    res.json({ success: true, key, publicUrl: `https://your-r2-domain.com/${key}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
