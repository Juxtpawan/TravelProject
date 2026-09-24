import { env } from 'cloudflare:workers';

/**
 * D1 is a NATIVE binding again — no REST API roundtrip. `env` here comes
 * from Cloudflare's Node-compat layer (cloudflare:workers), which makes
 * your wrangler.toml bindings available anywhere in the code, not just
 * inside a fetch handler — so this works fine even though it's called
 * from deep inside an Express route handler.
 *
 * users.queries.js is UNCHANGED — it still just calls d1Query(sql, params),
 * it has no idea whether that's REST or a binding underneath.
 */
export async function d1Query(sql, params = []) {
  const stmt = env.DB.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const result = await bound.all();
  return result.results ?? [];
}