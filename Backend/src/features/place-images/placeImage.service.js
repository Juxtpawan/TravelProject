import { findPlaceImage, savePlaceImage, savePlaceImageMiss } from './placeImage.repository.js';

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const APP_USER_AGENT = 'TravelProject/1.0 (image lookup; mailto:contact.eksafar@gmail.com)';
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const REFRESH_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const MISS_REFRESH_AFTER_MS = 10 * 60 * 1000;
const activeLookups = new Map();
const recentMisses = new Map();
const destinationTravelTerms = ['travel', 'tourism', 'tourist', 'beach', 'coast', 'coastal', 'marina', 'waterfront', 'promenade', 'landscape', 'skyline', 'cityscape', 'sea', 'ocean', 'nature', 'waterfall', 'mountain', 'river', 'island', 'view', 'destination', 'vacation', 'holiday', 'heritage', 'street', 'market', 'temple', 'fort', 'palace', 'monument', 'garden'];
const strongTravelTerms = new Set(['travel', 'tourism', 'tourist', 'beach', 'coast', 'coastal', 'marina', 'waterfront', 'landscape', 'skyline', 'cityscape', 'sea', 'ocean', 'nature', 'waterfall', 'mountain', 'river', 'island', 'destination', 'vacation', 'holiday']);

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
  // Attribution-required CC licenses are allowed; the UI exposes the creator,
  // file page, and license details through the image info control.
  return /^CC0(?:\s|$)/i.test(license)
    || /^(?:public domain|public domain mark|pd[-\s]|pdm\b)/i.test(license)
    || /^CC[-\s]BY(?:[-\s]SA)?(?:\s|$)/i.test(license)
    || /^Attribution(?:-ShareAlike)?(?:\s|$)/i.test(license);
}

function searchableText(value) {
  return safeText(value, 4000).toLowerCase().replace(/&amp;/g, '&').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function relevanceScore({ page, metadata }, placeName, destinationName, category) {
  const title = searchableText(page.title?.replace(/^File:/i, '').replace(/\.[^.]+$/, ''));
  const description = searchableText(metadataValue(metadata, 'ImageDescription'));
  const combined = `${title} ${description}`;
  const destinationTerms = searchableText(destinationName).split(' ').filter((term) => term.length > 2);
  const genericTerms = new Set(['the', 'and', 'for', 'from', 'hotel', 'resort', 'restaurant', 'cafe', 'coffee', 'shop', 'museum', 'temple', 'church', 'park', 'fort', 'palace', 'beach', 'attraction', 'landmark', 'goa', 'india']);
  const terms = searchableText(placeName).split(' ').filter((term) => term.length > 2
    && !genericTerms.has(term) && !destinationTerms.includes(term));
  if (category !== 'destination' && terms.length) {
    const exactName = searchableText(placeName);
    const hasExactName = exactName.length > 2 && (title.includes(exactName) || description.includes(exactName));
    const matched = terms.filter((term) => combined.includes(term)).length;
    // Require a distinctive place-name token; city/category matches alone
    // must never be presented as a photo of a named venue.
    const requiredMatches = Math.min(terms.length, Math.max(2, Math.ceil(terms.length * 0.75)));
    if (!hasExactName && matched < requiredMatches) return -1;
    const categoryTerms = {
      attraction: ['attraction', 'landmark', 'monument', 'museum', 'temple', 'park', 'fort', 'palace'],
      restaurant: ['restaurant', 'cafe', 'dining', 'food', 'eatery'],
      hotel: ['hotel', 'resort', 'lodging', 'accommodation'],
    }[category] || [];
    const categoryMatches = categoryTerms.filter((term) => combined.includes(term)).length;
    return (hasExactName ? 100 : 0) + matched * 10 + categoryMatches * 2
      + (destinationTerms.some((term) => combined.includes(term)) ? 3 : 0);
  }
  const matched = destinationTerms.filter((term) => combined.includes(term)).length;
  if (!matched) return -1;
  const travelScore = destinationTravelTerms.reduce((score, term) => score
    + (combined.includes(term) ? (strongTravelTerms.has(term) ? 8 : 2) : 0), 0);
  return matched * 10 + travelScore;
}

function cachedTitleRelevant(title, placeName, destinationName, category) {
  if (!title) return false;
  const destinationTerms = searchableText(destinationName).split(' ').filter((term) => term.length > 2);
  const genericTerms = new Set(['the', 'and', 'for', 'from', 'hotel', 'resort', 'restaurant', 'cafe', 'coffee', 'shop', 'museum', 'temple', 'church', 'park', 'fort', 'palace', 'beach', 'attraction', 'landmark', 'india']);
  const terms = searchableText(placeName).split(' ').filter((term) => term.length > 2
    && !genericTerms.has(term) && !destinationTerms.includes(term));
  const normalizedTitle = searchableText(title.replace(/^File:/i, '').replace(/\.[^.]+$/, ''));
  if (category === 'destination') return destinationTravelTerms.some((term) => strongTravelTerms.has(term) && normalizedTitle.includes(term));
  if (!terms.length) return false;
  const requiredMatches = Math.min(terms.length, Math.max(2, Math.ceil(terms.length * 0.75)));
  return terms.filter((term) => normalizedTitle.includes(term)).length >= requiredMatches;
}

async function findCommonsImage(query, placeName, destinationName, category, relatedOnly = false) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', generator: 'search',
    gsrnamespace: '6', gsrsearch: query, gsrwhat: 'text', gsrlimit: '30',
    prop: 'imageinfo', iiprop: 'url|mime|size|extmetadata', iiurlwidth: '1400',
  });
  const response = await fetch(`${COMMONS_API}?${params}`, {
    headers: { 'User-Agent': APP_USER_AGENT, 'Api-User-Agent': APP_USER_AGENT },
    signal: AbortSignal.timeout(22000),
  });
  if (!response.ok) throw new Error(`Wikimedia Commons returned ${response.status}`);
  const payload = await response.json();
  const pages = payload.query?.pages || [];
  const candidates = pages.map((page) => {
    const info = page.imageinfo?.[0];
    const metadata = info?.extmetadata || {};
    const licenseName = metadataValue(metadata, 'LicenseShortName') || metadataValue(metadata, 'UsageTerms');
    const candidate = { page, info, metadata, licenseName };
    let score = relevanceScore(candidate, placeName, destinationName, category);
    if (relatedOnly) {
      const titleAndDescription = `${searchableText(page.title)} ${searchableText(metadataValue(metadata, 'ImageDescription'))}`;
      const destinationTerms = searchableText(destinationName).split(' ').filter((term) => term.length > 2);
      const categoryTerms = {
        attraction: ['attraction', 'landmark', 'monument', 'museum', 'temple', 'park', 'fort', 'palace'],
        restaurant: ['restaurant', 'cafe', 'dining', 'food', 'eatery'],
        hotel: ['hotel', 'resort', 'lodging', 'accommodation'],
      }[category] || [];
      const cityMatches = destinationTerms.filter((term) => titleAndDescription.includes(term)).length;
      const typeMatches = categoryTerms.filter((term) => titleAndDescription.includes(term)).length;
      score = cityMatches && typeMatches ? cityMatches * 10 + typeMatches * 5 : -1;
    }
    return { ...candidate, score };
  }).filter(({ info, licenseName, score }) => info?.thumburl && score >= 0
    && /^image\/(jpeg|png|webp|gif)$/i.test(info.mime || '')
    && acceptableReuseLicense(licenseName));
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] ? { ...candidates[0], matchType: relatedOnly ? 'related' : category === 'destination' ? 'destination' : 'place' } : null;
}

function categorySearchTerm(category) {
  return ({ attraction: 'landmark monument architecture', restaurant: 'restaurant food cafe cuisine', hotel: 'hotel resort accommodation' })[category] || 'travel';
}

async function getOrCreatePlaceImageOnce({ env, placeId, category, destinationName, placeName }) {
  const storedImage = await findPlaceImage('google', placeId, category);
  // Ignore legacy Pixabay rows while that provider is disabled.
  const existing = storedImage?.source_provider === 'pixabay' ? null : storedImage;
  const cacheKey = `${placeId}:${category}`;
  if (existing && !existing.object_key
      && Date.now() - Date.parse(existing.checked_at) < 24 * 60 * 60 * 1000) return null;
  const missedAt = recentMisses.get(cacheKey);
  if (missedAt && Date.now() - missedAt < MISS_REFRESH_AFTER_MS) return null;
  if (missedAt) recentMisses.delete(cacheKey);
  if (existing && (existing.match_type === 'destination' || existing.match_type === 'representative'
      || cachedTitleRelevant(existing.file_title, placeName, destinationName, category))
      && Date.now() - Date.parse(existing.checked_at) < REFRESH_AFTER_MS) {
    if (!existing.object_key) return null;
    if (await env.BUCKET.head(existing.object_key)) return { ...existing, cached: true };
  }
  const query = category === 'destination' ? destinationName : placeName;
  let candidate = null;
  try {
    candidate = await findCommonsImage(query, placeName, destinationName, category);
  } catch (error) {
    console.warn('[Place images] Commons search unavailable:', error?.message || error);
  }
  if (!candidate && category !== 'destination') {
    const categoryQuery = categorySearchTerm(category);
    try {
      candidate = await findCommonsImage(`${destinationName} ${categoryQuery}`, '', destinationName, category, true);
    } catch (error) {
      console.warn('[Place images] Commons category fallback unavailable:', error?.message || error);
    }
  }
  if (!candidate) {
    if (existing?.object_key) await env.BUCKET.delete(existing.object_key);
    await savePlaceImageMiss('google', placeId, category, new Date().toISOString());
    recentMisses.set(cacheKey, Date.now());
    return null;
  }
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
