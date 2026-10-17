import express from 'express';
import { getOrCreatePlaceImage } from './placeImage.service.js';
import { findPlaceImage } from './placeImage.repository.js';

const router = express.Router();
const CATEGORIES = new Set(['destination', 'attraction', 'restaurant', 'hotel']);

router.get('/:placeId', async (req, res) => {
  const placeId = String(req.params.placeId || '').trim();
  const category = String(req.query.category || 'attraction').trim().toLowerCase();
  const destinationName = String(req.query.destination || '').trim().slice(0, 120);
  const placeName = String(req.query.name || '').trim().slice(0, 160);
  if (!placeId || placeId.length > 4096 || !CATEGORIES.has(category) || destinationName.length < 2) {
    return res.status(400).json({ error: 'Provide a valid place ID, category, and destination.' });
  }
  const env = req.cloudflare?.env;
  if (!env?.BUCKET) return res.status(503).json({ error: 'Image storage is not configured.' });
  try {
    const image = await getOrCreatePlaceImage({ env, placeId, category, destinationName, placeName });
    if (!image) return res.json({ image: null });
    return res.json({ image: {
      url: `/place-images/${encodeURIComponent(placeId)}/file?category=${encodeURIComponent(category)}`,
      title: image.file_title || image.fileTitle,
      sourceUrl: image.file_page_url || image.filePageUrl,
      creator: image.creator,
      license: image.license_name || image.licenseName,
      licenseUrl: image.license_url || image.licenseUrl,
      matchType: image.match_type || image.matchType || 'place',
      sourceProvider: image.source_provider || image.sourceProvider || 'wikimedia-commons',
    } });
  } catch (error) {
    console.error('[Place images] Image lookup failed:', error?.message || error);
    return res.status(502).json({ error: 'A place image could not be loaded.' });
  }
});

router.get('/:placeId/file', async (req, res) => {
  const placeId = String(req.params.placeId || '').trim();
  const category = String(req.query.category || 'attraction').trim().toLowerCase();
  if (!placeId || placeId.length > 4096 || !CATEGORIES.has(category)) return res.status(400).end();
  const env = req.cloudflare?.env;
  try {
    const image = await findPlaceImage('google', placeId, category);
    if (!image || image.source_provider === 'pixabay' || !env?.BUCKET) return res.status(404).end();
    const object = await env.BUCKET.get(image.object_key);
    if (!object) return res.status(404).end();
    res.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('X-Content-Type-Options', 'nosniff');
    const bytes = await object.arrayBuffer();
    return res.end(new Uint8Array(bytes));
  } catch (error) {
    console.error('[Place images] R2 read failed:', error?.message || error);
    return res.status(502).end();
  }
});

export default router;
