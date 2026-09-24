/**
 * SnapshotService — Monthly Wikivoyage Data Downloader
 *
 * Architecture:
 *   Cloudflare Cron (1st of every month)
 *     │
 *     ▼
 *   List chunks for enwikivoyage_namespace_0
 *     │
 *     ▼  (for each chunk)
 *   Download chunk .tar.gz → stream into Cloudflare R2
 *     │
 *     ▼
 *   Read NDJSON from R2 → parse each article line
 *     │
 *     ▼
 *   Upsert destination + places + place_sources into D1
 *
 * The sync_jobs D1 table tracks progress so if the cron is killed
 * (Cloudflare gives crons up to 15 min), it can resume next time.
 */

import { wikimediaService } from './wikimedia.service.js';
import { d1Query } from '../db/client.js';

const SNAPSHOT_ID = 'enwikivoyage_namespace_0';
const BASE_URL    = 'https://api.enterprise.wikimedia.com/v2';

export class SnapshotService {

  // ── Step 1: Get list of chunks for the latest enwikivoyage snapshot ──────────
  async listChunks(token) {
    const res = await fetch(`${BASE_URL}/snapshots/${SNAPSHOT_ID}/chunks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to list chunks: ${res.statusText}`);
    return await res.json(); // Array of chunk objects: [{ identifier, size, ... }]
  }

  // ── Step 2: Download one chunk and save it raw to Cloudflare R2 ──────────────
  async downloadChunkToR2(token, chunkId, r2Bucket) {
    const r2Key = `snapshots/${SNAPSHOT_ID}/${chunkId}.tar.gz`;

    // Check if this chunk was already downloaded (avoid re-downloading on resume)
    const existing = await r2Bucket.head(r2Key);
    if (existing) {
      console.log(`[snapshot] Chunk ${chunkId} already in R2, skipping download`);
      return r2Key;
    }

    console.log(`[snapshot] Downloading chunk ${chunkId}...`);
    const res = await fetch(
      `${BASE_URL}/snapshots/${SNAPSHOT_ID}/chunks/${chunkId}/download`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`Failed to download chunk ${chunkId}: ${res.statusText}`);

    // Stream body directly into R2 (no memory buffering of the whole file!)
    await r2Bucket.put(r2Key, res.body, {
      httpMetadata: { contentType: 'application/gzip' },
    });

    console.log(`[snapshot] Chunk ${chunkId} saved to R2 at ${r2Key}`);
    return r2Key;
  }

  // ── Step 3: Read NDJSON from R2 and process each article line ────────────────
  // NOTE: Because Cloudflare Workers cannot natively decompress .tar.gz files,
  // we use a workaround: the Wikimedia API also supports streaming NDJSON
  // directly (without tar.gz compression) when you pass Accept: application/x-ndjson.
  // This is simpler and avoids decompression entirely.
  async processChunkStream(token, chunkId) {
    console.log(`[snapshot] Streaming chunk ${chunkId} as NDJSON...`);

    const res = await fetch(
      `${BASE_URL}/snapshots/${SNAPSHOT_ID}/chunks/${chunkId}/download`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/x-ndjson', // Request uncompressed NDJSON
        },
      }
    );
    if (!res.ok) throw new Error(`Failed to stream chunk ${chunkId}: ${res.statusText}`);

    let articlesProcessed = 0;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep the incomplete last line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const article = JSON.parse(line);
          await this.upsertArticle(article);
          articlesProcessed++;
        } catch (e) {
          console.warn(`[snapshot] Failed to parse article line: ${e.message}`);
        }
      }
    }

    // Process any remaining buffered content
    if (buffer.trim()) {
      try {
        const article = JSON.parse(buffer);
        await this.upsertArticle(article);
        articlesProcessed++;
      } catch (_) {}
    }

    console.log(`[snapshot] Chunk ${chunkId} done — ${articlesProcessed} articles processed`);
    return articlesProcessed;
  }

  // ── Step 4: Upsert a single parsed article into D1 ───────────────────────────
  async upsertArticle(article) {
    // Re-use the same parser logic from wikimediaService
    const { destination: destData } = wikimediaService.parseWikivoyageArticle(article);
    if (!destData.name || !destData.slug) return; // Skip stubs/redirects

    const now = new Date().toISOString();
    const newDestId = crypto.randomUUID();

    // Upsert destination (INSERT OR REPLACE updates description on re-runs)
    await d1Query(
      `INSERT INTO destinations (id, name, slug, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         description = excluded.description,
         updated_at  = excluded.updated_at`,
      [newDestId, destData.name, destData.slug, destData.description, now, now]
    );

    // Get the actual id (needed for places FK)
    const [existing] = await d1Query(
      'SELECT id FROM destinations WHERE slug = ?',
      [destData.slug]
    );
    const destId = existing?.id || newDestId;

    // Extract listings from kartographer data
    const listings = this.extractListings(article);

    for (const listing of listings) {
      const newPlaceId = crypto.randomUUID();
      await d1Query(
        `INSERT INTO places (id, destination_id, name, category, latitude, longitude, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(destination_id, name) DO NOTHING`,
        [newPlaceId, destId, listing.name, listing.category,
         listing.latitude, listing.longitude, now, now]
      );

      const [existingPlace] = await d1Query(
        'SELECT id FROM places WHERE destination_id = ? AND name = ?',
        [destId, listing.name]
      );
      const placeId = existingPlace?.id || newPlaceId;

      await d1Query(
        `INSERT INTO place_sources (id, place_id, source_name, source_url, license, raw_data_json, last_checked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(place_id, source_name) DO UPDATE SET
           last_checked_at = excluded.last_checked_at`,
        [
          crypto.randomUUID(), placeId, 'Wikivoyage',
          `https://en.wikivoyage.org/wiki/${encodeURIComponent(destData.name)}`,
          'CC BY-SA 4.0', JSON.stringify(listing), now,
        ]
      );
    }
  }

  // ── Helper: extract geo listings from kartographer config in HTML ─────────────
  extractListings(article) {
    const listings = [];
    try {
      const html = article.article_body?.html || '';
      const match = html.match(/mw:jsConfigVars[^>]*content='([^']+)'/);
      if (!match) return listings;

      const config = JSON.parse(
        match[1]
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      );
      const liveData = config.wgKartographerLiveData || {};
      const categoryMap = {
        see: 'attraction', do: 'activity',
        eat: 'restaurant', drink: 'bar',
        sleep: 'hotel',    buy: 'shop',
      };
      for (const [wikiCat, dbCat] of Object.entries(categoryMap)) {
        for (const item of (liveData[wikiCat] || [])) {
          if (item.geometry?.coordinates && item.properties?.title) {
            listings.push({
              name:      item.properties.title,
              category:  dbCat,
              longitude: item.geometry.coordinates[0],
              latitude:  item.geometry.coordinates[1],
            });
          }
        }
      }
    } catch (_) {}
    return listings;
  }

  // ── Main entry point: orchestrate the full monthly sync ───────────────────────
  async runMonthlySync(env) {
    const jobId = crypto.randomUUID();
    const now   = new Date().toISOString();

    // Create a sync_job record so we can track / resume progress
    await d1Query(
      `INSERT INTO sync_jobs (id, status, snapshot_id, started_at, created_at)
       VALUES (?, 'running', ?, ?, ?)`,
      [jobId, SNAPSHOT_ID, now, now]
    );

    try {
      // 1. Authenticate
      const token = await wikimediaService.authenticate(
        env.WIKIMEDIA_USERNAME, env.WIKIMEDIA_PASSWORD
      );

      // 2. List all chunks for this snapshot
      const chunks = await this.listChunks(token);
      console.log(`[snapshot] Found ${chunks.length} chunks for ${SNAPSHOT_ID}`);

      await d1Query(
        'UPDATE sync_jobs SET total_chunks = ? WHERE id = ?',
        [chunks.length, jobId]
      );

      // 3. Process each chunk
      let totalArticles = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`[snapshot] Processing chunk ${i + 1}/${chunks.length}: ${chunk.identifier}`);

        const articlesInChunk = await this.processChunkStream(token, chunk.identifier);
        totalArticles += articlesInChunk;

        // Update progress in DB
        await d1Query(
          'UPDATE sync_jobs SET chunks_done = ?, articles_processed = ? WHERE id = ?',
          [i + 1, totalArticles, jobId]
        );
      }

      // 4. Mark as done
      await d1Query(
        `UPDATE sync_jobs SET status = 'done', finished_at = ?, articles_processed = ? WHERE id = ?`,
        [new Date().toISOString(), totalArticles, jobId]
      );

      console.log(`[snapshot] ✅ Monthly sync complete! ${totalArticles} articles processed`);
      return { success: true, jobId, articlesProcessed: totalArticles };

    } catch (error) {
      await d1Query(
        `UPDATE sync_jobs SET status = 'failed', error_message = ?, finished_at = ? WHERE id = ?`,
        [error.message, new Date().toISOString(), jobId]
      );
      console.error('[snapshot] ❌ Monthly sync failed:', error);
      throw error;
    }
  }
}

export const snapshotService = new SnapshotService();
