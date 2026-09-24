import { verifyAccessToken } from '../utils/jwt.js';
import { findUserById } from '../db/queries/users.queries.js';

/**
 * FIX: process.env.JWT_SECRET is not reliably populated here — same issue
 * auth.routes.js already worked around. Read it the same proven way.
 */
export async function authMiddleware(req, res, next) {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    const jwtSecret = req.cloudflare.env.JWT_SECRET;
    const payload = await verifyAccessToken(token, jwtSecret);
    const user = await findUserById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Not authenticated.' });

    req.user = { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatar_url };
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}