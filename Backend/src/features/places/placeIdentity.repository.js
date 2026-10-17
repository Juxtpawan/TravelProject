import { d1Batch, d1Query } from '../../db/client.js';

export async function saveGooglePlaceIdentifiers(placeIds) {
  const now = new Date().toISOString();
  const operations = placeIds.map((externalId) => ({
    sql: `INSERT INTO place_identifiers (provider, external_id, entity_id, created_at, last_seen_at)
          VALUES ('google', ?, ?, ?, ?)
          ON CONFLICT(provider, external_id) DO NOTHING`,
    params: [externalId, crypto.randomUUID(), now, now],
  }));
  await d1Batch(operations);
}

// Expire ahead of the 30-day ceiling so an hourly cron never leaves an
// expired coordinate in storage while waiting for its next run.
export async function purgeExpiredGoogleDestinationCoordinates(db) {
  const cutoff = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString();
  if (db) {
    return db.prepare(
      `UPDATE destinations
       SET latitude = NULL, longitude = NULL, geo_cached_at = NULL
       WHERE geo_cached_at IS NOT NULL AND geo_cached_at <= ?`,
    ).bind(cutoff).run();
  }
  await d1Query(
    `UPDATE destinations
     SET latitude = NULL, longitude = NULL, geo_cached_at = NULL
     WHERE geo_cached_at IS NOT NULL AND geo_cached_at <= ?`,
    [cutoff],
  );
}
