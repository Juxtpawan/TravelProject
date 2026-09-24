import { env } from 'cloudflare:workers';

/**
 * Same story as D1 — R2 is a native binding too, so the @aws-sdk/client-s3
 * dependency isn't needed anymore. `env.BUCKET` matches whatever binding
 * name you gave your R2 bucket in wrangler.toml.
 *
 * Example usage elsewhere in your code:
 *   await r2Bucket.put(key, fileBuffer, { httpMetadata: { contentType } });
 *   const object = await r2Bucket.get(key);
 */
export const r2Bucket = env.BUCKET;