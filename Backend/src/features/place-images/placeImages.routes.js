import express from 'express';
import { getOrCreatePlaceImage, getPlaceImageOptions, selectPlaceImage } from './placeImage.service.js';
import { findPlaceImage } from './placeImage.repository.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();
const CATEGORIES = new Set(['destination', 'attraction', 'restaurant', 'hotel']);

function coordinate(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

router.get('/:placeId/options', async (req, res) => {
  const placeId = String(req.params.placeId || '').trim();
  const category = String(req.query.category || 'destination').trim().toLowerCase();
  const destinationName = String(req.query.destination || '').trim().slice(0, 120);
  const placeName = String(req.query.name || '').trim().slice(0, 160);
  const locationContext = String(req.query.context || '').trim().slice(0, 300);
  const googlePlaceName = String(req.query.googlePlaceName || '').trim().slice(0, 160);
  const latitude = coordinate(req.query.latitude);
  const longitude = coordinate(req.query.longitude);
  if (!placeId || placeId.length > 4096 || !CATEGORIES.has(category) || destinationName.length < 2) {
    return res.status(400).json({ error: 'Provide a valid place ID, category, and destination.' });
  }
  try {
    const options = await getPlaceImageOptions({ category, destinationName, placeName, locationContext, googlePlaceName, latitude, longitude });
    res.set('Cache-Control', 'no-store');
    return res.json({ options });
  } catch (error) {
    console.error('[Place images] Candidate lookup failed:', error?.message || error);
    return res.status(502).json({ error: 'Photo choices could not be loaded.' });
  }
});

router.post('/:placeId/select', authMiddleware, async (req, res) => {
  const placeId = String(req.params.placeId || '').trim();
  const category = String(req.body?.category || 'destination').trim().toLowerCase();
  const destinationName = String(req.body?.destination || '').trim().slice(0, 120);
  const placeName = String(req.body?.name || '').trim().slice(0, 160);
  const locationContext = String(req.body?.context || '').trim().slice(0, 300);
  const googlePlaceName = String(req.body?.googlePlaceName || '').trim().slice(0, 160);
  const latitude = coordinate(req.body?.latitude);
  const longitude = coordinate(req.body?.longitude);
  const fileTitle = String(req.body?.fileTitle || '').trim().slice(0, 500);
  if (!placeId || placeId.length > 4096 || !CATEGORIES.has(category) || category === 'restaurant'
      || destinationName.length < 2 || !fileTitle) {
    return res.status(400).json({ error: 'Choose a valid photo for this destination.' });
  }
  try {
    const image = await selectPlaceImage({ env: req.cloudflare?.env, placeId, category, destinationName, placeName, locationContext, googlePlaceName, latitude, longitude, fileTitle });
    if (!image) return res.status(422).json({ error: 'That photo is no longer available. Refresh the choices and try again.' });
    return res.json({ image: {
      url: `/place-images/${encodeURIComponent(placeId)}/file?category=${encodeURIComponent(category)}&v=${encodeURIComponent(image.checkedAt)}`,
      title: image.fileTitle, sourceUrl: image.filePageUrl, creator: image.creator,
      license: image.licenseName, licenseUrl: image.licenseUrl,
      matchType: image.matchType, sourceProvider: image.sourceProvider,
    } });
  } catch (error) {
    console.error('[Place images] Selection save failed:', error?.message || error);
    return res.status(502).json({ error: 'The selected photo could not be saved.' });
  }
});

router.get('/:placeId', async (req, res) => {
  const placeId = String(req.params.placeId || '').trim();
  const category = String(req.query.category || 'attraction').trim().toLowerCase();
  const destinationName = String(req.query.destination || '').trim().slice(0, 120);
  const placeName = String(req.query.name || '').trim().slice(0, 160);
  const googlePlaceName = String(req.query.googlePlaceName || '').trim().slice(0, 160);
  const latitude = coordinate(req.query.latitude);
  const longitude = coordinate(req.query.longitude);
  if (!placeId || placeId.length > 4096 || !CATEGORIES.has(category) || destinationName.length < 2) {
    return res.status(400).json({ error: 'Provide a valid place ID, category, and destination.' });
  }
  const env = req.cloudflare?.env;
  if (category === 'restaurant') {
    res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return res.json({ image: null, sourceProvider: 'google-places' });
  }
  if (!env?.BUCKET) return res.status(503).json({ error: 'Image storage is not configured.' });
  try {
    const image = await getOrCreatePlaceImage({ env, placeId, category, destinationName, placeName, googlePlaceName, latitude, longitude });
    res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    if (!image) return res.json({ image: null });
    return res.json({ image: {
      url: `/place-images/${encodeURIComponent(placeId)}/file?category=${encodeURIComponent(category)}&v=${encodeURIComponent(image.checked_at || image.checkedAt || '')}`,
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
