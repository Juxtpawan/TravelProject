import express from 'express';
import { wikimediaService } from '../services/wikimedia.service.js';
import { d1Query } from '../db/client.js';

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────────
// Helper: parse Wikivoyage kartographer data to extract structured place listings
// ──────────────────────────────────────────────────────────────────────────────
function parseListings(rawArticle) {
  const listings = [];
  try {
    const htmlString = rawArticle.article_body?.html || '';
    // The API embeds structured geo JSON inside a <meta> tag in the HTML
    const match = htmlString.match(/mw:jsConfigVars[^>]*content='([^']+)'/);
    if (match) {
      const decoded = match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
      const config = JSON.parse(decoded);
      const liveData = config.wgKartographerLiveData || {};

      const categoryMap = {
        see:   'attraction',
        do:    'activity',
        eat:   'restaurant',
        drink: 'bar',
        sleep: 'hotel',
        buy:   'shop',
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
    }
  } catch (e) {
    console.warn('Could not parse kartographer listings:', e.message);
  }
  return listings;
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /places/seed/:destination
// Fetch from Wikivoyage → parse → save destination + places into D1
// ──────────────────────────────────────────────────────────────────────────────
router.get('/seed/:destination', async (req, res) => {
  const { destination } = req.params;
  const env = req.cloudflare?.env || process.env;

  if (!env.WIKIMEDIA_USERNAME || !env.WIKIMEDIA_PASSWORD) {
    return res.status(500).json({
      error: 'Missing WIKIMEDIA_USERNAME or WIKIMEDIA_PASSWORD in .dev.vars',
    });
  }

  try {
    // ── 1. Fetch + parse from Wikivoyage ──────────────────────────────────────
    const rawArticle = await wikimediaService.getArticle('enwikivoyage', destination, env);
    const { destination: destData } = wikimediaService.parseWikivoyageArticle(rawArticle);
    const listings = parseListings(rawArticle);

    const now = new Date().toISOString();

    // ── 2. Upsert the destination row ─────────────────────────────────────────
    const newDestId = crypto.randomUUID();
    await d1Query(
      `INSERT OR IGNORE INTO destinations
         (id, name, slug, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newDestId, destData.name, destData.slug, destData.description, now, now]
    );

    // Re-fetch to get the real id (INSERT OR IGNORE won't return id if row existed)
    const [existing] = await d1Query(
      'SELECT id FROM destinations WHERE slug = ?',
      [destData.slug]
    );
    const destId = existing?.id || newDestId;

    // ── 3. Insert each Place + provenance record ──────────────────────────────
    let insertedPlaces = 0;
    for (const listing of listings) {
      const newPlaceId = crypto.randomUUID();

      await d1Query(
        `INSERT OR IGNORE INTO places
           (id, destination_id, name, category, latitude, longitude, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newPlaceId, destId, listing.name, listing.category,
         listing.latitude, listing.longitude, now, now]
      );

      // Get the actual place id
      const [existingPlace] = await d1Query(
        'SELECT id FROM places WHERE destination_id = ? AND name = ?',
        [destId, listing.name]
      );
      const placeId = existingPlace?.id || newPlaceId;

      // Insert provenance (Wikivoyage as the source)
      await d1Query(
        `INSERT OR IGNORE INTO place_sources
           (id, place_id, source_name, source_url, license, raw_data_json, last_checked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          placeId,
          'Wikivoyage',
          `https://en.wikivoyage.org/wiki/${encodeURIComponent(destData.name)}`,
          'CC BY-SA 4.0',
          JSON.stringify(listing),
          now,
        ]
      );
      insertedPlaces++;
    }

    // ── 4. Return a clean summary ─────────────────────────────────────────────
    res.json({
      success: true,
      message: `✅ Seeded "${destData.name}" into D1`,
      destinationId: destId,
      destinationSlug: destData.slug,
      placesInserted: insertedPlaces,
      description: destData.description,
    });

  } catch (error) {
    console.error(`Error seeding ${destination}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /places/:slug
// Read a destination + all its places and sources from D1
// ──────────────────────────────────────────────────────────────────────────────
router.get('/:slug', async (req, res) => {
  const { slug } = req.params;

  try {
    const [dest] = await d1Query(
      'SELECT * FROM destinations WHERE slug = ?',
      [slug]
    );

    if (!dest) {
      return res.status(404).json({ error: `Destination "${slug}" not found in database` });
    }

    const placesList = await d1Query(
      'SELECT * FROM places WHERE destination_id = ? ORDER BY category, name',
      [dest.id]
    );

    const sources = await d1Query(
      `SELECT ps.source_name, COUNT(*) as count
       FROM place_sources ps
       JOIN places p ON ps.place_id = p.id
       WHERE p.destination_id = ?
       GROUP BY ps.source_name`,
      [dest.id]
    );

    res.json({
      destination: dest,
      places: placesList,
      totalPlaces: placesList.length,
      sources,  // e.g., [{ source_name: 'Wikivoyage', count: 12 }]
    });

  } catch (error) {
    console.error(`Error reading ${slug}:`, error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
