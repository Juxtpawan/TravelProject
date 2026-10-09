import express from 'express';
import { wikimediaService } from '../services/wikimedia.service.js';
import { d1Query } from '../db/client.js';

const router = express.Router();

function googleMapsApiKey(req) {
  return req.cloudflare?.env?.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
}

router.post('/autocomplete', async (req, res) => {
  const input = typeof req.body?.input === 'string' ? req.body.input.trim() : '';
  const sessionToken = typeof req.body?.sessionToken === 'string' ? req.body.sessionToken : '';
  if (input.length < 2 || input.length > 200) return res.status(400).json({ error: 'Enter at least two characters.' });
  const apiKey = googleMapsApiKey(req);
  if (!apiKey) return res.status(503).json({ error: 'Google Places search is not configured.' });
  try {
    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
      // Keep autocomplete to broad travel destinations only. Google accepts at
      // most five specific primary types here; `(regions)` cannot be combined
      // with them and would also include neighborhoods and postal codes.
      body: JSON.stringify({
        input,
        sessionToken: sessionToken || undefined,
        includedPrimaryTypes: [
          'continent',
          'country',
          'administrative_area_level_1', // state / province / region
          'administrative_area_level_2', // district / county
          'locality', // city / town
        ],
      }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      const googleStatus = failure.error?.status;
      console.warn('[Places] Autocomplete was rejected by Google:', response.status, googleStatus || 'unknown');
      return res.status(502).json({ error: googleStatus === 'PERMISSION_DENIED'
        ? 'Google Places is not enabled for this API key. Enable Places API (New) in Google Cloud.'
        : 'Google Places suggestions are temporarily unavailable.' });
    }
    const payload = await response.json();
    const suggestions = (payload.suggestions || []).flatMap(({ placePrediction }) => placePrediction ? [{
      placeId: placePrediction.placeId,
      description: placePrediction.text?.text || '',
      mainText: placePrediction.structuredFormat?.mainText?.text || placePrediction.text?.text || '',
      secondaryText: placePrediction.structuredFormat?.secondaryText?.text || '',
    }] : []);
    res.json({ suggestions });
  } catch (error) {
    console.error('[Places] Autocomplete request failed:', error?.message || error);
    res.status(502).json({ error: 'Google Places suggestions are temporarily unavailable.' });
  }
});

router.post('/details', async (req, res) => {
  const placeId = typeof req.body?.placeId === 'string' ? req.body.placeId.trim() : '';
  const sessionToken = typeof req.body?.sessionToken === 'string' ? req.body.sessionToken : '';
  if (!placeId || placeId.length > 255) return res.status(400).json({ error: 'Choose a suggested destination.' });
  const apiKey = googleMapsApiKey(req);
  if (placeId.startsWith('local:')) {
    const localId = placeId.slice('local:'.length);
    const [destination] = await d1Query(
      'SELECT id, name, country, state, latitude, longitude, google_place_id FROM destinations WHERE id = ? LIMIT 1',
      [localId]
    );
    if (!destination) return res.status(404).json({ error: 'That saved destination could not be found.' });
    return res.json({
      placeId: destination.google_place_id || `local:${destination.id}`,
      name: destination.name,
      location: Number.isFinite(Number(destination.latitude)) && Number.isFinite(Number(destination.longitude))
        ? { lat: Number(destination.latitude), lng: Number(destination.longitude) }
        : null,
    });
  }
  if (!apiKey) return res.status(503).json({ error: 'Google Places search is not configured.' });
  try {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    if (sessionToken) url.searchParams.set('sessionToken', sessionToken);
    const response = await fetch(url, { headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'id,displayName,location,formattedAddress' } });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      console.warn('[Places] Place details were rejected by Google:', response.status, failure.error?.status || 'unknown');
      return res.status(502).json({ error: failure.error?.status === 'PERMISSION_DENIED'
        ? 'Google Places is not enabled for this API key. Enable Places API (New) in Google Cloud.'
        : 'That destination could not be loaded.' });
    }
    const place = await response.json();
    res.json({ placeId: place.id, name: place.displayName?.text || place.formattedAddress || '', location: place.location ? { lat: place.location.latitude, lng: place.location.longitude } : null });
  } catch (error) {
    console.error('[Places] Place details request failed:', error?.message || error);
    res.status(502).json({ error: 'That destination could not be loaded.' });
  }
});

router.get('/', async (_req, res) => {
  try {
    const destinations = await d1Query(
      `SELECT d.id, d.name, d.slug, d.country, d.state, d.description,
              COUNT(p.id) AS places_count
       FROM destinations d
       LEFT JOIN places p ON p.destination_id = d.id
       GROUP BY d.id
       ORDER BY d.name ASC`
    );
    res.json(destinations);
  } catch (error) {
    console.error('Error fetching destinations:', error);
    res.status(500).json({ error: 'Failed to fetch destinations' });
  }
});

// Look up a previously resolved destination before making a Google request.
router.get('/lookup', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (query.length < 2 || query.length > 120) {
    return res.status(400).json({ error: 'Enter a destination between 2 and 120 characters.' });
  }

  try {
    const slug = query.toLowerCase().normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const [destination] = await d1Query(
      'SELECT id, name, slug, country, state, latitude, longitude, geo_cached_at, google_place_id FROM destinations WHERE slug = ? LIMIT 1',
      [slug]
    );
    res.json({ cached: Boolean(destination?.google_place_id), destination: destination || null });
  } catch (error) {
    console.error('Destination cache lookup failed:', error);
    res.status(500).json({ error: 'Could not search saved destinations.' });
  }
});

// Save a user-entered destination query and Google Place ID after selection.
// Place IDs are the durable Google identifier; live Places details are fetched
// by the destination page instead of caching restricted Google content here.
router.post('/resolve', async (req, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  const googlePlaceId = typeof req.body?.googlePlaceId === 'string' ? req.body.googlePlaceId.trim() : '';
  const latitude = Number(req.body?.location?.lat);
  const longitude = Number(req.body?.location?.lng);
  const hasLocation = Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
  const isLocalPlaceId = googlePlaceId.startsWith('local:');
  if (query.length < 2 || query.length > 120 || (!googlePlaceId && !hasLocation) || googlePlaceId.length > 255) {
    return res.status(400).json({ error: 'Choose a valid suggested destination.' });
  }

  const slug = query.toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return res.status(400).json({ error: 'Enter a valid destination.' });

  try {
    if (isLocalPlaceId) {
      const [localDestination] = await d1Query(
        'SELECT id, slug FROM destinations WHERE id = ? LIMIT 1',
        [googlePlaceId.slice('local:'.length)]
      );
      if (!localDestination || localDestination.slug !== slug) {
        return res.status(404).json({ error: 'That saved destination could not be found.' });
      }
    }

    const [byPlaceId] = isLocalPlaceId ? [] : await d1Query(
      'SELECT id, name, slug, country, state, latitude, longitude, geo_cached_at, google_place_id FROM destinations WHERE google_place_id = ? LIMIT 1',
      [googlePlaceId]
    );
    if (byPlaceId) {
      if (hasLocation) {
        const now = new Date().toISOString();
        await d1Query('UPDATE destinations SET latitude = ?, longitude = ?, geo_cached_at = ?, updated_at = ? WHERE id = ?',
          [latitude, longitude, now, now, byPlaceId.id]);
        return res.json({ destination: { ...byPlaceId, latitude, longitude, geo_cached_at: now } });
      }
      return res.json({ destination: byPlaceId });
    }

    const [bySlug] = await d1Query(
      'SELECT id, name, slug, country, state, latitude, longitude, geo_cached_at, google_place_id FROM destinations WHERE slug = ? LIMIT 1',
      [slug]
    );
    if (bySlug) {
      if (!isLocalPlaceId && bySlug.google_place_id && bySlug.google_place_id !== googlePlaceId) {
        return res.status(409).json({ error: 'A different Google destination already uses this name.' });
      }
      const now = new Date().toISOString();
      if (hasLocation) {
        if (isLocalPlaceId) {
          await d1Query('UPDATE destinations SET latitude = ?, longitude = ?, geo_cached_at = ?, updated_at = ? WHERE id = ?',
            [latitude, longitude, now, now, bySlug.id]);
        } else {
          await d1Query('UPDATE destinations SET google_place_id = ?, latitude = ?, longitude = ?, geo_cached_at = ?, updated_at = ? WHERE id = ?',
            [googlePlaceId, latitude, longitude, now, now, bySlug.id]);
        }
      } else {
        if (!isLocalPlaceId) await d1Query('UPDATE destinations SET google_place_id = ?, updated_at = ? WHERE id = ?', [googlePlaceId, now, bySlug.id]);
      }
      return res.json({ destination: { ...bySlug, google_place_id: isLocalPlaceId ? bySlug.google_place_id : googlePlaceId, ...(hasLocation ? { latitude, longitude, geo_cached_at: now } : {}) } });
    }

    if (isLocalPlaceId) return res.status(404).json({ error: 'That saved destination could not be found.' });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await d1Query(
      `INSERT INTO destinations (id, name, slug, google_place_id, latitude, longitude, geo_cached_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, query, slug, googlePlaceId, hasLocation ? latitude : null, hasLocation ? longitude : null, hasLocation ? now : null, now, now]
    );
    res.status(201).json({ destination: { id, name: query, slug, google_place_id: googlePlaceId, latitude: hasLocation ? latitude : null, longitude: hasLocation ? longitude : null, geo_cached_at: hasLocation ? now : null } });
  } catch (error) {
    console.error('Destination resolution failed:', error);
    res.status(500).json({ error: 'Could not save this destination.' });
  }
});

// Start discovery as soon as a destination is selected in the home search.
// The crawler API accepts this quickly and continues its crawl/AI queue in the background.
router.post('/:slug/discover', async (req, res) => {
  try {
    const [destination] = await d1Query(
      'SELECT id, name, slug, google_place_id FROM destinations WHERE slug = ? LIMIT 1',
      [req.params.slug]
    );
    if (!destination) return res.status(404).json({ error: 'Destination not found.' });
    const env = req.cloudflare?.env || process.env;
    const result = await requestCrawlerDiscovery(destination, env);
    res.status(result.started ? 202 : 200).json({ status: result.active ? 'queued' : result.configured ? 'cached' : 'unavailable' });
  } catch (error) {
    console.warn('Could not start crawler discovery:', error?.message || error);
    // Searching and opening the destination should still work when the optional crawler is down.
    res.status(202).json({ status: 'unavailable' });
  }
});

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

// Combine app-owned destination/place records with cached crawler facts.
// The crawler API credential stays server-side; a missing crawler service must
// not prevent the destination guide itself from rendering.
router.get('/:slug/guide', async (req, res) => {
  const { slug } = req.params;
  try {
    const [destination] = await d1Query(
      'SELECT * FROM destinations WHERE slug = ? LIMIT 1',
      [slug]
    );
    if (!destination) return res.status(404).json({ error: 'Destination not found.' });

    const places = await d1Query(
      `SELECT p.*,
              (SELECT ps.source_name FROM place_sources ps WHERE ps.place_id = p.id ORDER BY ps.last_checked_at DESC LIMIT 1) AS source_name,
              (SELECT ps.source_url FROM place_sources ps WHERE ps.place_id = p.id ORDER BY ps.last_checked_at DESC LIMIT 1) AS source_url
       FROM places p
       WHERE p.destination_id = ?
       ORDER BY p.category, p.name`,
      [destination.id]
    );

    const env = req.cloudflare?.env || process.env;
    const crawler = await loadCrawlerGuide(destination, env);
    res.json({ destination, places, crawler });
  } catch (error) {
    console.error('Destination guide request failed:', error);
    res.status(500).json({ error: 'Could not load this destination guide.' });
  }
});

async function loadCrawlerGuide(destination, env) {
  const apiUrl = String(env.CRAWLER_API_URL || '').trim().replace(/\/$/, '');
  if (!apiUrl || !destination.google_place_id) {
    return { status: 'unavailable', facts: [], sourceStatus: null };
  }

  const headers = { accept: 'application/json' };
  if (env.CRAWLER_API_SHARED_SECRET) headers.authorization = `Bearer ${env.CRAWLER_API_SHARED_SECRET}`;

  try {
    const placePath = encodeURIComponent(destination.google_place_id);
    const [dataResponse, entitiesResponse] = await Promise.all([
      fetch(`${apiUrl}/places/${placePath}/travel-data`, { headers, signal: AbortSignal.timeout(4000) }).catch(() => null),
      fetch(`${apiUrl}/places/${placePath}/entities`, { headers, signal: AbortSignal.timeout(4000) }).catch(() => null),
    ]);
    const data = dataResponse?.ok ? await dataResponse.json() : null;
    const facts = Array.isArray(data?.facts) ? data.facts : [];
    const entitiesPayload = entitiesResponse?.ok ? await entitiesResponse.json() : null;
    const entities = Array.isArray(entitiesPayload?.entities) ? entitiesPayload.entities : [];
    let sourceStatus = null;

    if ((data?.status === 'empty' && entities.length === 0) || data?.status === 'stale') {
      const statusResponse = await fetch(`${apiUrl}/places/${placePath}/status`, {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      if (statusResponse.ok) sourceStatus = await statusResponse.json();
    }

    const needsDiscovery = (data?.status === 'empty' && entities.length === 0) || data?.status === 'stale';
    const discovery = needsDiscovery ? await requestCrawlerDiscovery(destination, env) : { active: false };

    const pendingSources = Object.entries(sourceStatus?.source_status_counts || {})
      .some(([status, count]) => ['PENDING', 'FETCHED'].includes(status) && Number(count) > 0);
    const guideStatus = data?.status === 'empty' && entities.length > 0 ? 'fresh' : data?.status;
    return {
      status: guideStatus === 'empty' && pendingSources ? 'pending' : discovery.active ? 'queued' : guideStatus || 'unavailable',
      facts,
      entities,
      sourceStatus,
      discoveredAt: data?.newest_extracted_at || null,
    };
  } catch (error) {
    console.warn('Crawler guide service unavailable:', error?.message || error);
    return { status: 'unavailable', facts: [], sourceStatus: null };
  }
}

async function requestCrawlerDiscovery(destination, env) {
  const apiUrl = String(env.CRAWLER_API_URL || '').trim().replace(/\/$/, '');
  if (!apiUrl || !destination.google_place_id) return { configured: false, active: false };
  const [lastRequest] = await d1Query(
    'SELECT requested_at, status FROM crawler_discovery_state WHERE destination_id = ? LIMIT 1',
    [destination.id]
  );
  const lastTime = Date.parse(lastRequest?.requested_at || '');
  const age = Date.now() - lastTime;
  if (Number.isFinite(lastTime) && age >= 0 && age < 30 * 24 * 60 * 60 * 1000) {
    const active = ['starting', 'queued'].includes(lastRequest.status) && age < 10 * 60 * 1000;
    return { configured: true, active, started: false };
  }

  const now = new Date().toISOString();
  await d1Query(
    `INSERT INTO crawler_discovery_state (destination_id, requested_at, status)
     VALUES (?, ?, 'starting')
     ON CONFLICT(destination_id) DO UPDATE SET requested_at = excluded.requested_at, status = 'starting'`,
    [destination.id, now]
  );
  const headers = { accept: 'application/json', 'content-type': 'application/json' };
  if (env.CRAWLER_API_SHARED_SECRET) headers.authorization = `Bearer ${env.CRAWLER_API_SHARED_SECRET}`;
  try {
    const response = await fetch(`${apiUrl}/places/${encodeURIComponent(destination.google_place_id)}/discover`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ destination_name: destination.name }),
      signal: AbortSignal.timeout(2500),
    });
    const status = response.ok ? 'queued' : 'failed';
    await d1Query('UPDATE crawler_discovery_state SET status = ? WHERE destination_id = ?', [status, destination.id]);
    if (!response.ok) console.warn('Crawler discovery request failed:', response.status);
    return { configured: true, active: response.ok, started: response.ok };
  } catch (error) {
    await d1Query('UPDATE crawler_discovery_state SET status = ? WHERE destination_id = ?', ['failed', destination.id]);
    throw error;
  }
}

export default router;
