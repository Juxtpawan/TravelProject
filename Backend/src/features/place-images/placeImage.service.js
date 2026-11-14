import { findPlaceImage, savePlaceImage, savePlaceImageMiss } from './placeImage.repository.js';

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const APP_USER_AGENT = 'TravelProject/1.0 (image lookup; mailto:contact.eksafar@gmail.com)';
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const REFRESH_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const MISS_REFRESH_AFTER_MS = 10 * 60 * 1000;
const activeLookups = new Map();
const recentMisses = new Map();
const destinationTravelTerms = [
  'travel', 'tourism', 'tourist', 'beach', 'coast', 'coastal', 'marina', 'waterfront',
  'promenade', 'landscape', 'skyline', 'cityscape', 'sea', 'ocean', 'nature', 'waterfall',
  'mountain', 'hill', 'valley', 'river', 'lake', 'island', 'view', 'scenery', 'destination',
  'vacation', 'holiday', 'heritage', 'street', 'market', 'bazaar', 'temple', 'fort',
  'palace', 'monument', 'garden', 'park', 'landmark', 'architecture', 'gate', 'castle',
  'cathedral', 'church', 'mosque', 'shrine', 'facade', 'ruins', 'fountain', 'square', 'plaza'
];

const DISQUALIFIED_TERMS = [
  // People / portraits / human figures / selfies / crowds / events
  'portrait', 'portraits', 'person', 'persons', 'people', 'man', 'men', 'woman', 'women',
  'girl', 'girls', 'boy', 'boys', 'child', 'children', 'crowd', 'crowds', 'selfie', 'selfies',
  'face', 'faces', 'headshot', 'performing', 'performance', 'actor', 'actress', 'author', 'writer',
  'politician', 'minister', 'maharaja', 'king', 'queen', 'prince', 'princess', 'governor',
  'player', 'cricketer', 'athlete', 'attendee', 'attendees', 'conference', 'meeting', 'interview',
  'speech', 'presentation', 'singer', 'musician', 'artist', 'human',
  'festival', 'literature', 'delegation', 'symposium', 'seminar', 'ceremony', 'rally',
  // Non-place artifacts
  'map', 'maps', 'plan', 'plans', 'diagram', 'diagrams', 'chart', 'charts',
  'stamp', 'stamps', 'coin', 'coins', 'banknote', 'banknotes', 'currency', 'money',
  'flag', 'flags', 'logo', 'logos', 'emblem', 'emblems', 'coat of arms', 'seal', 'symbol',
  'postage', 'newspaper', 'document', 'documents', 'letter', 'letters',
  'book', 'page', 'pages', 'scan', 'scans', 'drawing', 'drawings', 'sketch', 'sketches',
  'caricature', 'cartoon', 'illustration', 'illustrations', 'poster', 'posters',
  'receipt', 'signature',
  // Animals / non-travel objects
  'cow', 'cows', 'dog', 'dogs', 'cat', 'cats', 'insect', 'bird', 'birds'
];

function isDisqualified(text) {
  const lower = String(text || '').toLowerCase();
  return DISQUALIFIED_TERMS.some((term) => {
    const regex = new RegExp(`(^|[^a-z0-9])${term}([^a-z0-9]|$)`, 'i');
    return regex.test(lower);
  });
}

function safeText(value, max = 500) {
  return String(value || '').replace(/<[^>]*>/g, '').trim().slice(0, max);
}

function metadataValue(metadata, key) {
  return safeText(metadata?.[key]?.value || metadata?.[key]?.title || '');
}

function creatorCredit(metadata) {
  const raw = metadataValue(metadata, 'Artist') || metadataValue(metadata, 'Credit');
  return safeText(raw.split(/\r?\n|\.\s+If\b/i, 1)[0]
    .replace(/^this image was created by\s*/i, '')
    .replace(/^\s*\|?\s*\|?\s*/, ''), 180);
}

function acceptableReuseLicense(name) {
  const license = String(name || '').trim();
  // Only accept CC0 (Creative Commons Zero) and Public Domain images that do not require attribution or credits
  return /^CC0(?:\s|$)/i.test(license)
    || /^(?:public domain|public domain mark|pd[-\s_]|pdm\b|no restrictions)/i.test(license);
}

function searchableText(value) {
  return safeText(value, 4000).toLowerCase().replace(/&amp;/g, '&').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

async function fetchWikimediaJson(endpoint, params) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams(params).toString();
  const response = await fetch(url, {
    headers: { 'User-Agent': APP_USER_AGENT, 'Api-User-Agent': APP_USER_AGENT },
    signal: AbortSignal.timeout(22000),
  });
  if (!response.ok) return null;
  return response.json();
}

function coordinateDistanceKm(latitude1, longitude1, latitude2, longitude2) {
  const toRadians = (value) => value * Math.PI / 180;
  const deltaLatitude = toRadians(latitude2 - latitude1);
  const deltaLongitude = toRadians(longitude2 - longitude1);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(latitude1)) * Math.cos(toRadians(latitude2)) * Math.sin(deltaLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Looks up geotagged Commons files around the exact Google Place selected in
 * Autocomplete. No free-text Commons search is used by the photo picker.
 */
async function findNearbyCommonsImages({ category, destinationName, placeName, googlePlaceName, latitude, longitude }) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
  const payload = await fetchWikimediaJson(COMMONS_API, {
    action: 'query', format: 'json', formatversion: '2',
    generator: 'geosearch', ggsprimary: 'all', ggsnamespace: '6',
    ggsradius: '10000', ggscoord: `${latitude}|${longitude}`, ggslimit: '50',
    prop: 'coordinates|imageinfo', iiprop: 'url|mime|size|extmetadata', iiurlwidth: '1400',
  });
  const identityName = googlePlaceName || placeName || String(destinationName || '').split(',')[0];
  const genericIdentityTerms = new Set(['the', 'and', 'of', 'near', 'city', 'town', 'village', 'district', 'state', 'india']);
  const nameTerms = searchableText(identityName).split(' ').filter((term) => term.length > 2
    && !genericIdentityTerms.has(term));
  const uniqueNameTerms = [...new Set(nameTerms)];
  const travelTerms = new Set(destinationTravelTerms);
  return (payload?.query?.pages || []).flatMap((page) => {
    const info = page.imageinfo?.[0];
    const metadata = info?.extmetadata || {};
    const licenseName = metadataValue(metadata, 'LicenseShortName') || metadataValue(metadata, 'UsageTerms');
    if (!info?.thumburl || !/^image\/(jpeg|png|webp|gif)$/i.test(info.mime || '')
        || !acceptableReuseLicense(licenseName)) return [];
    const location = page.coordinates?.[0];
    const distanceKm = location && Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lon))
      ? coordinateDistanceKm(latitude, longitude, Number(location.lat), Number(location.lon))
      : Number.isFinite(Number(page.dist)) ? Number(page.dist) / 1000 : Infinity;
    if (distanceKm > 5) return [];
    const title = searchableText(page.title?.replace(/^File:/i, '').replace(/\.[^.]+$/, ''));
    const description = searchableText(metadataValue(metadata, 'ImageDescription'));
    const categories = searchableText(metadataValue(metadata, 'Categories'));
    const searchable = `${title} ${description} ${categories}`;
    if (isDisqualified(searchable)) return [];
    const nameMatches = uniqueNameTerms.filter((term) => searchable.includes(term)).length;
    const hasTravelContext = [...travelTerms].some((term) => searchable.includes(term));
    // Very close geotags are strong evidence for the selected Google place.
    // At greater distances require both destination text and travel context.
    if (distanceKm > 0.75 && (!nameMatches || !hasTravelContext)) return [];
    const score = nameMatches * 30 + (hasTravelContext ? 15 : 0) - distanceKm * 4;
    return [{ page, info, metadata, licenseName, score }];
  }).sort((a, b) => b.score - a.score).slice(0, 12);
}

function asPhotoOption(candidate) {
  return {
    title: safeText(candidate.page.title),
    previewUrl: candidate.info.thumburl,
    sourceUrl: candidate.info.descriptionurl || '',
    creator: creatorCredit(candidate.metadata),
    license: candidate.licenseName,
    licenseUrl: metadataValue(candidate.metadata, 'LicenseUrl'),
    score: candidate.score,
  };
}

export async function getPlaceImageOptions({ category, destinationName, placeName, locationContext = '', googlePlaceName = '', latitude, longitude }) {
  if (category === 'restaurant' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
  if (!destinationName || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
  return (await findNearbyCommonsImages({
    category, destinationName, placeName, googlePlaceName, latitude, longitude,
  })).map(asPhotoOption);
}

async function storeSelectedCommonsImage({ env, placeId, category, destinationName, placeName, locationContext = '', googlePlaceName = '', latitude, longitude, fileTitle }) {
  const options = await getPlaceImageOptions({
    category, destinationName, placeName, locationContext, googlePlaceName, latitude, longitude,
  });
  const chosen = options.find((option) => option.title === fileTitle);
  if (!chosen) return null;
  const payload = await fetchWikimediaJson(COMMONS_API, {
    action: 'query', format: 'json', formatversion: '2', titles: chosen.title,
    prop: 'imageinfo', iiprop: 'url|mime|size|extmetadata', iiurlwidth: '1400',
  });
  const page = payload?.query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  const metadata = info?.extmetadata || {};
  const licenseName = metadataValue(metadata, 'LicenseShortName') || metadataValue(metadata, 'UsageTerms');
  if (!info?.thumburl || !acceptableReuseLicense(licenseName)) return null;
  const response = await fetch(info.thumburl, { headers: { 'User-Agent': APP_USER_AGENT }, signal: AbortSignal.timeout(22000) });
  if (!response.ok) throw new Error(`Commons image download returned ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > IMAGE_MAX_BYTES) throw new Error('Commons image exceeds the cache size limit.');
  const contentType = (response.headers.get('content-type') || info.mime).split(';')[0].trim();
  if (!/^image\/(jpeg|png|webp|gif)$/i.test(contentType)) throw new Error('Image provider returned an unsupported image type.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${placeId}:${category}`));
  const objectKey = `place-images/wikimedia-commons/${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  await env.BUCKET.put(objectKey, bytes, {
    httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { sourcePage: info.descriptionurl || '', license: licenseName, sourceProvider: 'wikimedia-commons' },
  });
  const row = {
    provider: 'google', placeId, category, objectKey, matchType: 'user-selected',
    sourceProvider: 'wikimedia-commons', fileTitle: safeText(page.title),
    filePageUrl: info.descriptionurl || chosen.sourceUrl,
    creator: creatorCredit(metadata), licenseName,
    licenseUrl: metadataValue(metadata, 'LicenseUrl'), checkedAt: new Date().toISOString(),
  };
  await savePlaceImage(row);
  recentMisses.delete(`${placeId}:${category}`);
  return row;
}

export async function selectPlaceImage(args) {
  if (!args.env?.BUCKET || args.category === 'restaurant' || String(args.placeId || '').startsWith('local:')) return null;
  return storeSelectedCommonsImage(args);
}

async function getOrCreatePlaceImageOnce({ env, placeId, category, destinationName, placeName, googlePlaceName = '', latitude, longitude }) {
  // Restaurant imagery is served from the live Google Places photo field in
  // the browser; never create or refresh Commons/R2 restaurant copies.
  if (category === 'restaurant' || String(placeId || '').startsWith('local:')) return null;
  const storedImage = await findPlaceImage('google', placeId, category);
  // Ignore legacy Pixabay rows while that provider is disabled.
  const existing = storedImage?.source_provider === 'pixabay' ? null : storedImage;
  const cacheKey = `${placeId}:${category}`;
  if (existing?.match_type === 'user-selected' && existing.object_key
      && await env.BUCKET.head(existing.object_key)) return { ...existing, cached: true };
  if (existing && !existing.object_key
      && Date.now() - Date.parse(existing.checked_at) < MISS_REFRESH_AFTER_MS) return null;
  const missedAt = recentMisses.get(cacheKey);
  if (missedAt && Date.now() - missedAt < MISS_REFRESH_AFTER_MS) return null;
  if (missedAt) recentMisses.delete(cacheKey);
  const existingImageIsRelevant = existing?.match_type === 'google-geosearch';
  if (existing && acceptableReuseLicense(existing.license_name)
      && !isDisqualified(existing.file_title)
      && existingImageIsRelevant
      && Date.now() - Date.parse(existing.checked_at) < REFRESH_AFTER_MS) {
    if (!existing.object_key) return null;
    if (await env.BUCKET.head(existing.object_key)) return { ...existing, cached: true };
  }
  // Do not cache a miss until the exact Google Place coordinates are present;
  // the photo client may be waiting for the Places library to load.
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const candidate = (await findNearbyCommonsImages({
    category, destinationName, placeName, googlePlaceName, latitude, longitude,
  }))[0] || null;
  if (!candidate) {
    if (existing?.object_key) await env.BUCKET.delete(existing.object_key);
    await savePlaceImageMiss('google', placeId, category, new Date().toISOString());
    recentMisses.set(cacheKey, Date.now());
    return null;
  }
  candidate.matchType = 'google-geosearch';
  const { page, info, metadata, licenseName } = candidate;
  const imageResponse = await fetch(info.thumburl, {
    headers: { 'User-Agent': APP_USER_AGENT }, signal: AbortSignal.timeout(22000),
  });
  if (!imageResponse.ok) throw new Error(`Commons image download returned ${imageResponse.status}`);
  const bytes = await imageResponse.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > IMAGE_MAX_BYTES) throw new Error('Commons image exceeds the cache size limit.');
  const contentType = (imageResponse.headers.get('content-type') || info.mime).split(';')[0].trim();
  if (!/^image\/(jpeg|png|webp|gif)$/i.test(contentType)) throw new Error('Image provider returned an unsupported image type.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${placeId}:${category}`));
  const sourceProvider = 'wikimedia-commons';
  const objectKey = `place-images/${sourceProvider}/${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  await env.BUCKET.put(objectKey, bytes, {
    httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { sourcePage: info.descriptionurl || '', license: licenseName, sourceProvider },
  });
  const row = {
    provider: 'google', placeId, category, objectKey, matchType: candidate.matchType,
    sourceProvider,
    fileTitle: safeText(page.title),
    filePageUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
    creator: candidate.creator || creatorCredit(metadata),
    licenseName,
    licenseUrl: candidate.licenseUrl || metadataValue(metadata, 'LicenseUrl'),
    checkedAt: new Date().toISOString(),
  };
  await savePlaceImage(row);
  if (existing?.object_key && existing.object_key !== objectKey) await env.BUCKET.delete(existing.object_key);
  return { ...row, cached: false };
}

export function getOrCreatePlaceImage(args) {
  const key = `${args.placeId}:${args.category}`;
  if (activeLookups.has(key)) return activeLookups.get(key);
  const lookup = getOrCreatePlaceImageOnce(args).finally(() => activeLookups.delete(key));
  activeLookups.set(key, lookup);
  return lookup;
}
