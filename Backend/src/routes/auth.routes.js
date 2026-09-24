import { Router } from 'express';
import crypto from 'node:crypto';
import { signupSchema, loginSchema, googleAuthSchema } from '../schemas/auth.schema.js';
import * as usersQueries from '../db/queries/users.queries.js';
import { hashPassword, verifyPassword, verifyGoogleIdToken } from '../services/auth.service.js';
import { signAccessToken } from '../utils/jwt.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

// No separate auth.controller.js — same reasoning as before: for 5 small
// handlers, the route calling the service/queries directly is fine. Split
// the handler bodies into controllers/auth.controller.js if this grows.

const router = Router();

router.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { name, email, password } = parsed.data;

  const existing = await usersQueries.findUserByEmail(email);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  const now = new Date();
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await usersQueries.createUser({ id: userId, email, name, now });
  await usersQueries.createCredential({ id: crypto.randomUUID(), userId, provider: 'email', passwordHash, now });

  return respondWithSession(res, { id: userId, email, name, avatar_url: null });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;

  const user = await usersQueries.findUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

  const credential = await usersQueries.findCredentialByUserAndProvider(user.id, 'email');
  if (!credential?.password_hash) {
    return res.status(401).json({ error: 'This account uses a different sign-in method (Google/Apple).' });
  }

  const validPassword = await verifyPassword(password, credential.password_hash);
  if (!validPassword) return res.status(401).json({ error: 'Invalid email or password.' });

  await usersQueries.touchLastLogin(user.id, new Date());
  return respondWithSession(res, user);
});

router.post('/google', async (req, res) => {
  const parsed = googleAuthSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const profile = await verifyGoogleIdToken(parsed.data.idToken, process.env.GOOGLE_CLIENT_ID);
  const now = new Date();

  const existingCredential = await usersQueries.findCredentialByProvider('google', profile.providerUserId);

  let user;
  if (existingCredential) {
    user = await usersQueries.findUserById(existingCredential.user_id);
  } else {
    const existingByEmail = await usersQueries.findUserByEmail(profile.email);
    const userId = existingByEmail?.id ?? crypto.randomUUID();

    if (!existingByEmail) {
      await usersQueries.createUser({
        id: userId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        emailVerified: profile.emailVerified,
        now,
      });
    }

    await usersQueries.createCredential({
      id: crypto.randomUUID(),
      userId,
      provider: 'google',
      providerUserId: profile.providerUserId,
      now,
    });

    user = existingByEmail ?? {
      id: userId,
      email: profile.email,
      name: profile.name,
      avatar_url: profile.avatarUrl,
    };
  }

  await usersQueries.touchLastLogin(user.id, now);
  return respondWithSession(res, user);
});

// Apple — mirrors /google exactly. Uncomment once you have an Apple
// Developer key (Services ID + private key for client_secret generation).
//
// router.post('/apple', async (req, res) => {
//   const parsed = appleAuthSchema.safeParse(req.body);
//   if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
//   const profile = await verifyAppleIdToken(parsed.data.identityToken, process.env.APPLE_CLIENT_ID);
//   // ...same find-or-create pattern as /google
// });

router.post('/logout', (req, res) => {
  res.clearCookie('access_token', { path: '/' });
  res.json({ success: true });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

async function respondWithSession(res, user) {
  const token = await signAccessToken({ sub: user.id, email: user.email }, process.env.JWT_SECRET, '15m');

  res.cookie('access_token', token, {
    httpOnly: true,
    secure: true, // set to false only if testing over plain http on localhost
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000, // 15 minutes — matches the JWT's own expiry
  });

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url ?? null,
  });
}

export default router;