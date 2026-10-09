import { verifyAccessToken } from '../utils/jwt.js';
import { findUserById } from '../db/queries/users.queries.js';
import { d1Query } from '../db/client.js';
import { generateUniqueTravelUsername } from '../utils/travelUsername.js';

export async function authMiddleware(req, res, next) {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    const jwtSecret = req.cloudflare?.env?.JWT_SECRET || process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[authMiddleware] JWT_SECRET is not configured.');
      return res.status(500).json({ error: 'Authentication is not configured on the server.' });
    }

    const payload = await verifyAccessToken(token, jwtSecret);
    const user = await findUserById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Not authenticated.' });

    // Guarantee every user has an automatically created unique travel username
    let username = user.username;
    if (!username) {
      username = await generateUniqueTravelUsername(d1Query);
      await d1Query('UPDATE users SET username = ? WHERE id = ?', [username, user.id]);
      user.username = username;
    }

    req.user = {
      id: user.id,
      email: user.email,
      username,
      name: user.name,
      avatarUrl: user.avatar_url,
    };
    next();
  } catch (err) {
    console.error('[authMiddleware] verify failed:', err?.message || err);
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}