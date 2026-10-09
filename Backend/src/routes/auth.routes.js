import { Router } from 'express';
import crypto from 'node:crypto';
import { signupSchema, loginSchema, googleAuthSchema } from '../schemas/auth.schema.js';
import * as usersQueries from '../db/queries/users.queries.js';
import { d1Query } from '../db/client.js';
import { hashPassword, verifyPassword, verifyGoogleIdToken } from '../services/auth.service.js';
import { signAccessToken } from '../utils/jwt.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { generateUniqueTravelUsername } from '../utils/travelUsername.js';

const router = Router();

router.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { name, email, password } = parsed.data;
  const now = new Date();

  const existing = await usersQueries.findUserByEmail(email);
  if (existing) {
    const existingEmailCred = await usersQueries.findCredentialByUserAndProvider(existing.id, 'email');
    if (existingEmailCred?.password_hash) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
    }

    // Account exists via Google/social but has no password yet. Link password credential to this account!
    const passwordHash = await hashPassword(password);
    await usersQueries.upsertEmailCredential({ userId: existing.id, passwordHash, now });
    await usersQueries.touchLastLogin(existing.id, now);

    // If existing user lacks a username, generate one
    if (!existing.username) {
      const username = await generateUniqueTravelUsername(d1Query);
      await d1Query('UPDATE users SET username = ? WHERE id = ?', [username, existing.id]);
      existing.username = username;
    }

    return respondWithSession(res, existing, getRequestEnv(req));
  }

  const userId = crypto.randomUUID();
  const username = await generateUniqueTravelUsername(d1Query);
  const passwordHash = await hashPassword(password);

  await usersQueries.createUser({ id: userId, email, username, name, now });
  await usersQueries.createCredential({ id: crypto.randomUUID(), userId, provider: 'email', passwordHash, now });

  return respondWithSession(res, { id: userId, email, username, name, avatar_url: null }, getRequestEnv(req));
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;

  // Supports login by either Email or Travel Username
  const user = await usersQueries.findUserByEmailOrUsername(email);
  if (!user) return res.status(401).json({ error: 'Invalid email/username or password.' });

  const credential = await usersQueries.findCredentialByUserAndProvider(user.id, 'email');
  if (!credential?.password_hash) {
    const googleCred = await usersQueries.findCredentialByUserAndProvider(user.id, 'google');
    if (googleCred) {
      return res.status(401).json({
        error: 'This account was registered with Google. Please use "Continue with Google" or create a password in your account profile.'
      });
    }
    return res.status(401).json({ error: 'This account uses a different sign-in method.' });
  }

  const validPassword = await verifyPassword(password, credential.password_hash);
  if (!validPassword) return res.status(401).json({ error: 'Invalid email/username or password.' });

  // Ensure user has a travel username
  if (!user.username) {
    const username = await generateUniqueTravelUsername(d1Query);
    await d1Query('UPDATE users SET username = ? WHERE id = ?', [username, user.id]);
    user.username = username;
  }

  await usersQueries.touchLastLogin(user.id, new Date());
  return respondWithSession(res, user, getRequestEnv(req));
});

router.post('/google', async (req, res) => {
  const parsed = googleAuthSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const env = getRequestEnv(req);
  if (!env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google sign-in is not configured on the API.' });
  }
  if (!env.JWT_SECRET) {
    return res.status(503).json({ error: 'Authentication is not configured on the API.' });
  }

  let profile;
  try {
    profile = await verifyGoogleIdToken(parsed.data.idToken, env.GOOGLE_CLIENT_ID);
  } catch (error) {
    console.warn('[auth] Google ID token verification failed:', error.code || error.name);
    return res.status(401).json({ error: 'Google could not verify this sign-in. Check the OAuth client configuration and try again.' });
  }
  const now = new Date();

  const existingCredential = await usersQueries.findCredentialByProvider('google', profile.providerUserId);

  let user;
  if (existingCredential) {
    user = await usersQueries.findUserById(existingCredential.user_id);
    if (user && !user.username) {
      const username = await generateUniqueTravelUsername(d1Query);
      await d1Query('UPDATE users SET username = ? WHERE id = ?', [username, user.id]);
      user.username = username;
    }
  } else {
    const existingByEmail = await usersQueries.findUserByEmail(profile.email);
    const userId = existingByEmail?.id ?? crypto.randomUUID();

    if (!existingByEmail) {
      const username = await generateUniqueTravelUsername(d1Query);
      await usersQueries.createUser({
        id: userId,
        email: profile.email,
        username,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        emailVerified: profile.emailVerified,
        now,
      });

      user = {
        id: userId,
        email: profile.email,
        username,
        name: profile.name,
        avatar_url: profile.avatarUrl,
      };
    } else {
      if (!existingByEmail.username) {
        const username = await generateUniqueTravelUsername(d1Query);
        await d1Query('UPDATE users SET username = ? WHERE id = ?', [username, existingByEmail.id]);
        existingByEmail.username = username;
      }
      user = existingByEmail;
    }

    await usersQueries.createCredential({
      id: crypto.randomUUID(),
      userId,
      provider: 'google',
      providerUserId: profile.providerUserId,
      now,
    });
  }

  await usersQueries.touchLastLogin(user.id, now);
  return respondWithSession(res, user, env);
});

router.post('/logout', (req, res) => {
  res.clearCookie('access_token', { path: '/' });
  res.json({ success: true });
});

router.get('/me', (req, res, next) => {
  if (!req.cookies?.access_token) return res.json(null);
  return authMiddleware(req, res, next);
}, (req, res) => {
  res.json(req.user);
});

// Set or change password for the authenticated user
router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const existingCred = await usersQueries.findCredentialByUserAndProvider(req.user.id, 'email');
  if (existingCred?.password_hash) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required to change password.' });
    }
    const valid = await verifyPassword(currentPassword, existingCred.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
  }

  const passwordHash = await hashPassword(newPassword);
  await usersQueries.upsertEmailCredential({ userId: req.user.id, passwordHash, now: new Date() });
  return res.json({ success: true, message: 'Password updated successfully.' });
});

function getRequestEnv(req) {
  const requestEnv = req.cloudflare?.env;
  return {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || requestEnv?.GOOGLE_CLIENT_ID,
    JWT_SECRET: process.env.JWT_SECRET || requestEnv?.JWT_SECRET,
  };
}

async function respondWithSession(res, user, env) {
  if (!env?.JWT_SECRET) {
    return res.status(503).json({ error: 'Authentication is not configured on the API.' });
  }
  const token = await signAccessToken({ sub: user.id, email: user.email }, env.JWT_SECRET, '15m');

  res.cookie('access_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000,
  });

  res.json({
    id: user.id,
    email: user.email,
    username: user.username ?? null,
    name: user.name,
    avatarUrl: user.avatar_url ?? user.avatarUrl ?? null,
  });
}

export default router;
