import { d1Query } from '../client.js';

/**
 * Normalizes email (trimmed + lowercased) for all reads and writes.
 */
export function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : '';
}

export async function findUserByEmail(email) {
  if (!email) return null;
  const rows = await d1Query('SELECT * FROM users WHERE email = ? LIMIT 1', [normalizeEmail(email)]);
  return rows[0] ?? null;
}

export async function findUserByUsername(username) {
  if (!username) return null;
  const rows = await d1Query('SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1', [username.trim()]);
  return rows[0] ?? null;
}

export async function findUserByEmailOrUsername(identifier) {
  if (!identifier) return null;
  const clean = identifier.trim();
  const rows = await d1Query(
    'SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?) LIMIT 1',
    [clean, clean]
  );
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

export async function findCredentialsByUserId(userId) {
  const rows = await d1Query(
    'SELECT id, provider, provider_user_id, CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END as has_password FROM auth_credentials WHERE user_id = ?',
    [userId]
  );
  return rows;
}

export async function createUser({ id, email, username, name, avatarUrl = null, emailVerified = false, now }) {
  await d1Query(
    `INSERT INTO users (id, email, username, name, avatar_url, email_verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, normalizeEmail(email), username ? username.trim() : null, name, avatarUrl, emailVerified ? 1 : 0, now.getTime(), now.getTime()]
  );
}

export async function createCredential({ id, userId, provider, providerUserId = null, passwordHash = null, now }) {
  await d1Query(
    `INSERT INTO auth_credentials (id, user_id, provider, provider_user_id, password_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, provider, providerUserId, passwordHash, now.getTime()]
  );
}

export async function upsertEmailCredential({ userId, passwordHash, now }) {
  const existing = await findCredentialByUserAndProvider(userId, 'email');
  if (existing) {
    await d1Query(
      'UPDATE auth_credentials SET password_hash = ? WHERE id = ?',
      [passwordHash, existing.id]
    );
  } else {
    await d1Query(
      `INSERT INTO auth_credentials (id, user_id, provider, provider_user_id, password_hash, created_at)
       VALUES (?, ?, 'email', null, ?, ?)`,
      [crypto.randomUUID(), userId, passwordHash, now.getTime()]
    );
  }
}

export async function touchLastLogin(userId, now) {
  await d1Query('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?', [
    now.getTime(),
    now.getTime(),
    userId,
  ]);
}

export async function updateUserProfile(userId, { name, email, username, avatarUrl }) {
  const fields = [];
  const params = [];

  if (name !== undefined) {
    fields.push('name = ?');
    params.push(name.trim());
  }
  if (email !== undefined) {
    fields.push('email = ?');
    params.push(normalizeEmail(email));
  }
  if (username !== undefined) {
    fields.push('username = ?');
    params.push(username.trim());
  }
  if (avatarUrl !== undefined) {
    fields.push('avatar_url = ?');
    params.push(avatarUrl ? avatarUrl.trim() : null);
  }

  fields.push('updated_at = ?');
  params.push(Date.now());

  params.push(userId);

  await d1Query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
  return findUserById(userId);
}

export async function deleteUserById(userId) {
  // Cascading cleanup of sessions, credentials, and trips/itinerary items
  try {
    await d1Query(
      'DELETE FROM itinerary_items WHERE trip_id IN (SELECT id FROM trips WHERE user_id = ?)',
      [userId]
    );
  } catch (err) {
    // Table may not have foreign keys or might be empty
  }

  try {
    await d1Query('DELETE FROM trips WHERE user_id = ?', [userId]);
  } catch (err) {}

  await d1Query('DELETE FROM sessions WHERE user_id = ?', [userId]);
  await d1Query('DELETE FROM auth_credentials WHERE user_id = ?', [userId]);
  await d1Query('DELETE FROM users WHERE id = ?', [userId]);
}