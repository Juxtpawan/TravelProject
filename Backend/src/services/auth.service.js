import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const scrypt = promisify(scryptCallback);

/**
 * Password hashing now uses Node's built-in crypto module directly (scrypt)
 * instead of Web Crypto's PBKDF2 — the previous version was written for
 * Workers, which doesn't have node:crypto. Now that we're on real Node via
 * Express, this is the more idiomatic choice and needs no extra dependency.
 */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [saltHex, keyHex] = stored.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const storedKey = Buffer.from(keyHex, 'hex');
  const derivedKey = await scrypt(password, salt, 64);
  return timingSafeEqual(storedKey, derivedKey);
}

/**
 * Google ID token verification is unchanged — jose's remote JWKS fetch
 * works the same in Node as it did in Workers.
 */
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export async function verifyGoogleIdToken(idToken, googleClientId) {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: googleClientId,
  });

  return {
    providerUserId: payload.sub,
    email: payload.email,
    name: payload.name,
    avatarUrl: payload.picture,
    emailVerified: payload.email_verified,
  };
}

/**
 * Apple Sign In — same shape, waiting on your Apple Developer key.
 *
 * const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
 *
 * export async function verifyAppleIdToken(identityToken, appleClientId) {
 *   const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
 *     issuer: 'https://appleid.apple.com',
 *     audience: appleClientId,
 *   });
 *   return {
 *     providerUserId: payload.sub,
 *     email: payload.email,
 *     name: payload.name ?? null,
 *     emailVerified: payload.email_verified,
 *   };
 * }
 */