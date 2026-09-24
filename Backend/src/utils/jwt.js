import { SignJWT, jwtVerify } from 'jose';

// jose works identically in Node and Workers — no change needed here.

export async function signAccessToken(payload, secret, expiresIn = '15m') {
  const key = new TextEncoder().encode(secret);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function verifyAccessToken(token, secret) {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  return payload;
}