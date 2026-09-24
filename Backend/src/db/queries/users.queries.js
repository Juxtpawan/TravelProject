import { d1Query } from '../client.js';

/**
 * FIX: emails are now normalized (trimmed + lowercased) right here, in one
 * place, for every read AND write. This is what actually links a Google
 * sign-in to an existing email/password account — without it, "John@x.com"
 * (typed at signup) and "john@x.com" (from Google's token) are treated as
 * two different people, since SQLite string comparison is case-sensitive
 * by default.
 */
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email) {
  const rows = await d1Query('SELECT * FROM users WHERE email = ? LIMIT 1', [normalizeEmail(email)]);
  return rows[0] ?? null;
}

export async function findUserById(id) {
  const rows = await d1Query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] ?? null;
}

export async function findCredentialByProvider(provider, providerUserId) {
  const rows = await d1Query(
    'SELECT * FROM auth_credentials WHERE provider = ? AND provider_user_id = ? LIMIT 1',
    [provider, providerUserId]
  );
  return rows[0] ?? null;
}

export async function findCredentialByUserAndProvider(userId, provider) {
  const rows = await d1Query(
    'SELECT * FROM auth_credentials WHERE user_id = ? AND provider = ? LIMIT 1',
    [userId, provider]
  );
  return rows[0] ?? null;
}

export async function createUser({ id, email, name, avatarUrl = null, emailVerified = false, now }) {
  await d1Query(
    `INSERT INTO users (id, email, name, avatar_url, email_verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, normalizeEmail(email), name, avatarUrl, emailVerified ? 1 : 0, now.getTime(), now.getTime()]
  );
}

export async function createCredential({ id, userId, provider, providerUserId = null, passwordHash = null, now }) {
  await d1Query(
    `INSERT INTO auth_credentials (id, user_id, provider, provider_user_id, password_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, provider, providerUserId, passwordHash, now.getTime()]
  );
}

export async function touchLastLogin(userId, now) {
  await d1Query('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?', [
    now.getTime(),
    now.getTime(),
    userId,
  ]);
}