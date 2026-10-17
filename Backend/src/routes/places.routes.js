import express from 'express';
import { d1Query } from '../db/client.js';
import { purgeExpiredGoogleDestinationCoordinates, saveGooglePlaceIdentifiers } from '../features/places/placeIdentity.repository.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

function googleMapsApiKey(req) {
  return req.cloudflare?.env?.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
}

router.post('/autocomplete', async (req, res) => {
  const input = typeof req.body?.input === 'string' ? req.body.input.trim() : '';
  const sessionToken = typeof req.body?.sessionToken === 'string' ? req.body.sessionToken : '';
  if (input.length < 3 || input.length > 200) return res.status(400).json({ error: 'Enter at least three characters.' });
  if (!/^[A-Za-z0-9_-]{1,36}$/.test(sessionToken)) return res.status(400).json({ error: 'Start a new destination search session.' });
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
  if (!placeId || placeId.length > 4096) return res.status(400).json({ error: 'Choose a suggested destination.' });
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
  if (!/^[A-Za-z0-9_-]{1,36}$/.test(sessionToken)) return res.status(400).json({ error: 'Choose a destination from the current search session.' });
  if (!apiKey) return res.status(503).json({ error: 'Google Places search is not configured.' });
  try {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    if (sessionToken) url.searchParams.set('sessionToken', sessionToken);
    // Location is a Place Details Essentials field. Keep displayName out of
    // this session-ending request; the selected prediction already supplies
    // the transient label for the current user interaction.
    const response = await fetch(url, { headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'id,location' } });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      console.warn('[Places] Place details were rejected by Google:', response.status, failure.error?.status || 'unknown');
      return res.status(502).json({ error: failure.error?.status === 'PERMISSION_DENIED'
        ? 'Google Places is not enabled for this API key. Enable Places API (New) in Google Cloud.'
        : 'That destination could not be loaded.' });
    }
    const place = await response.json();
    res.json({ placeId: place.id, location: place.location ? { lat: place.location.latitude, lng: place.location.longitude } : null });
  } catch (error) {
    console.error('[Places] Place details request failed:', error?.message || error);
    res.status(502).json({ error: 'That destination could not be loaded.' });
  }
});

// Persist only Google Place IDs so crawler-owned records can match them later.
// No names, categories, addresses, photos, ratings, or search payloads are stored.
router.post('/identifiers/google', authMiddleware, async (req, res) => {
  const requestedIds = req.body?.placeIds;
  if (!Array.isArray(requestedIds) || requestedIds.length > 60) {
    return res.status(400).json({ error: 'Send up to 60 Google Place IDs.' });
  }
  const placeIds = [...new Set(requestedIds.filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value.length <= 4096))];
  if (placeIds.length !== requestedIds.length) {
    return res.status(400).json({ error: 'Every Google Place ID must be a unique non-empty string.' });
  }
  try {
    if (placeIds.length) await saveGooglePlaceIdentifiers(placeIds);
    return res.json({ stored: placeIds.length });
  } catch (error) {
    console.error('Google Place ID storage failed:', error);
    return res.status(500).json({ error: 'Could not save place identifiers.' });
  }
});

router.get('/', async (_req, res) => {
  try {
    const destinations = await d1Query(
      `SELECT d.id, d.name, d.slug, d.country, d.state, d.description, d.google_place_id,
              COUNT(p.id) AS places_count
       FROM destinations d
       LEFT JOIN places p ON p.destination_id = d.id
         AND NOT EXISTS (
           SELECT 1 FROM place_sources ps
           WHERE ps.place_id = p.id AND lower(ps.source_name) = 'wikivoyage'
         )
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
    await purgeExpiredGoogleDestinationCoordinates();
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
  if (query.length < 2 || query.length > 120 || (!googlePlaceId && !hasLocation) || googlePlaceId.length > 4096) {
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
      const [slugOwner] = slug === byPlaceId.slug ? [] : await d1Query(
        'SELECT id FROM destinations WHERE slug = ? LIMIT 1',
        [slug]
      );
      const resolvedSlug = slugOwner && slugOwner.id !== byPlaceId.id
        ? `${slug}-${byPlaceId.id.slice(0, 8)}`
        : slug;
      const now = new Date().toISOString();
      if (hasLocation) {
        await d1Query('UPDATE destinations SET name = ?, slug = ?, latitude = ?, longitude = ?, geo_cached_at = ?, updated_at = ? WHERE id = ?',
          [query, resolvedSlug, latitude, longitude, now, now, byPlaceId.id]);
        return res.json({ destination: { ...byPlaceId, name: query, slug: resolvedSlug, latitude, longitude, geo_cached_at: now } });
      }
      await d1Query('UPDATE destinations SET name = ?, slug = ?, updated_at = ? WHERE id = ?',
        [query, resolvedSlug, now, byPlaceId.id]);
      return res.json({ destination: { ...byPlaceId, name: query, slug: resolvedSlug } });
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
          await d1Query('UPDATE destinations SET name = ?, latitude = ?, longitude = ?, geo_cached_at = ?, updated_at = ? WHERE id = ?',
            [query, latitude, longitude, now, now, bySlug.id]);
        } else {
          await d1Query('UPDATE destinations SET name = ?, google_place_id = ?, latitude = ?, longitude = ?, geo_cached_at = ?, updated_at = ? WHERE id = ?',
            [query, googlePlaceId, latitude, longitude, now, now, bySlug.id]);
        }
      } else {
        if (!isLocalPlaceId) await d1Query('UPDATE destinations SET name = ?, google_place_id = ?, updated_at = ? WHERE id = ?', [query, googlePlaceId, now, bySlug.id]);
      }
      return res.json({ destination: { ...bySlug, name: query, google_place_id: isLocalPlaceId ? bySlug.google_place_id : googlePlaceId, ...(hasLocation ? { latitude, longitude, geo_cached_at: now } : {}) } });
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
// Combine app-owned destination/place records with cached crawler facts.
// The crawler API credential stays server-side; a missing crawler service must
// not prevent the destination guide itself from rendering.
router.get('/:slug/guide', async (req, res) => {
  const { slug } = req.params;
  try {
    await purgeExpiredGoogleDestinationCoordinates();
    const [destination] = await d1Query(
      'SELECT * FROM destinations WHERE slug = ? LIMIT 1',
      [slug]
    );
    if (!destination) return res.status(404).json({ error: 'Destination not found.' });

    const places = await d1Query(
      `SELECT p.* FROM places p
       WHERE p.destination_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM place_sources ps
           WHERE ps.place_id = p.id AND lower(ps.source_name) = 'wikivoyage'
         )
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
