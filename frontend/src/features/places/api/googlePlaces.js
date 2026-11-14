import { apiClient } from '../../../lib/apiClient';

// Keep Text Search to card/map fields. Rating and review count put this request
// at Enterprise; Atmosphere fields such as editorialSummary and reviews are
// requested only after a user opens the corresponding place detail section.
const GUIDE_PLACE_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'primaryTypeDisplayName',
];

const CATEGORY_SEARCH = {
  attraction: [
    (name) => `top places to visit, tourist attractions, landmarks, museums, and parks in ${name}`,
    (name) => `popular historic sites, cultural attractions, and museums in ${name}`,
    (name) => `popular parks, viewpoints, and must-see attractions in ${name}`,
  ],
  restaurant: [
    (name) => `restaurants in ${name}`,
    (name) => `top-rated local restaurants and regional food in ${name}`,
    (name) => `popular restaurants for local cuisine and dining in ${name}`,
  ],
};

const GUIDE_SEARCH_QUOTA_KEY = 'guide_places_text_search_quota_date';
let guideSearchQuotaBlockedDate = '';

function quotaBlockDate() {
  return new Date().toISOString().slice(0, 10);
}

function isQuotaError(error) {
  const message = String(error?.message || error || '');
  return error?.code === 429 || /RESOURCE_EXHAUSTED|quota exceeded|SearchTextRequest|\b429\b/i.test(message);
}

function markGuideSearchQuotaBlocked() {
  guideSearchQuotaBlockedDate = quotaBlockDate();
  try {
    sessionStorage.setItem(GUIDE_SEARCH_QUOTA_KEY, guideSearchQuotaBlockedDate);
  } catch {
    // The in-memory guard still prevents repeated requests in this tab.
  }
}

export function isGoogleGuideSearchQuotaBlocked() {
  const today = quotaBlockDate();
  if (guideSearchQuotaBlockedDate === today) return true;
  guideSearchQuotaBlockedDate = '';
  try {
    const blockedDate = sessionStorage.getItem(GUIDE_SEARCH_QUOTA_KEY);
    if (blockedDate === today) {
      guideSearchQuotaBlockedDate = today;
      return true;
    }
    if (blockedDate) sessionStorage.removeItem(GUIDE_SEARCH_QUOTA_KEY);
  } catch {
    // Continue without persisted state when browser storage is unavailable.
  }
  return false;
}

export function googleGuideSearchErrorMessage(error) {
  if (error?.code === 'GUIDE_SEARCH_QUOTA_BLOCKED' || isQuotaError(error)) {
    return 'Google place discovery has reached today’s quota. Your saved guide is still available; try again after the quota resets.';
  }
  return 'Google place discovery is unavailable right now. Your saved guide is still available.';
}

function quotaBlockedError() {
  const error = new Error('Google place discovery has reached today’s quota.');
  error.code = 'GUIDE_SEARCH_QUOTA_BLOCKED';
  return error;
}

// Ephemeral in-memory and sessionStorage cache for client-side Place details.
// Compliant with Google Maps Platform Terms of Service: Place IDs can be stored
// in databases, while details are resolved on-demand and cached temporarily in the browser.
const detailsCache = new Map();

export function cachePlaceDetails(placeId, details) {
  if (!placeId || !details) return;
  const current = detailsCache.get(placeId) || {};
  const merged = { ...current, ...details, id: placeId };
  detailsCache.set(placeId, merged);
  try {
    sessionStorage.setItem(`google_place_${placeId}`, JSON.stringify(merged));
  } catch {
    // SessionStorage quota or private mode; in-memory cache remains active.
  }
}

export function getCachedPlaceDetails(placeId) {
  if (!placeId) return null;
  if (detailsCache.has(placeId)) return detailsCache.get(placeId);
  try {
    const raw = sessionStorage.getItem(`google_place_${placeId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      detailsCache.set(placeId, parsed);
      return parsed;
    }
  } catch {
    // Continue if sessionStorage is restricted.
  }
  return null;
}

export async function fetchGooglePlaceDetails(placesLibrary, placeId) {
  if (!placeId) return null;
  const cached = getCachedPlaceDetails(placeId);
  if (cached?.name && cached.name !== 'Saved place' && cached.businessDetailsResolved) return cached;

  if (!placesLibrary?.Place) return cached || null;

  try {
    const place = new placesLibrary.Place({ id: placeId });
    await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location', 'editorialSummary', 'primaryTypeDisplayName', 'rating', 'userRatingCount'] });
    const name = (typeof place.displayName === 'string' ? place.displayName : place.displayName?.text)
      || place.formattedAddress
      || '';
    const details = {
      id: placeId,
      name,
      formattedAddress: place.formattedAddress || '',
      description: typeof place.editorialSummary === 'string' ? place.editorialSummary : place.editorialSummary?.text || '',
      type: typeof place.primaryTypeDisplayName === 'string' ? place.primaryTypeDisplayName : place.primaryTypeDisplayName?.text || '',
      rating: place.rating ?? null,
      userRatingCount: place.userRatingCount ?? 0,
      latitude: place.location?.lat?.() ?? null,
      longitude: place.location?.lng?.() ?? null,
      businessDetailsResolved: true,
    };
    cachePlaceDetails(placeId, details);
    return details;
  } catch (err) {
    console.warn(`[Places] Could not resolve place details for ${placeId}:`, err);
    return cached || null;
  }
}

export async function searchGoogleGuidePlaces(placesLibrary, category, destinationName, center, maxResultCount = 20, queryVariant = 0) {
  const queryVariants = CATEGORY_SEARCH[category];
  const textQuery = queryVariants?.[queryVariant]?.(destinationName);
  if (!placesLibrary?.Place?.searchByText || !textQuery || !destinationName || !center) {
    return [];
  }

  if (isGoogleGuideSearchQuotaBlocked()) throw quotaBlockedError();

  let response;
  try {
    response = await placesLibrary.Place.searchByText({
      textQuery,
      ...(category === 'restaurant' ? { includedType: 'restaurant', useStrictTypeFiltering: true } : {}),
      locationBias: { center, radius: 20000 },
      maxResultCount: Math.max(1, Math.min(20, maxResultCount)),
      fields: GUIDE_PLACE_FIELDS,
    });
  } catch (error) {
    if (isQuotaError(error)) markGuideSearchQuotaBlocked();
    throw error;
  }

  return (response.places || [])
    .filter((place) => place.id)
    .map((place) => {
      const name = (typeof place.displayName === 'string' ? place.displayName : place.displayName?.text)
        || place.formattedAddress
        || 'Place';
      const formattedAddress = place.formattedAddress || '';
      cachePlaceDetails(place.id, { name, formattedAddress, latitude: place.location?.lat?.(), longitude: place.location?.lng?.() });
      return {
        id: place.id,
        google_place_id: place.id,
        // Maps JavaScript Place.displayName is a string. The REST API uses a
        // localized object, so accept both shapes to keep cards named.
        name,
        category,
        latitude: place.location?.lat?.(),
        longitude: place.location?.lng?.(),
        formattedAddress,
        rating: place.rating ?? null,
        userRatingCount: place.userRatingCount ?? 0,
        description: '',
        type: typeof place.primaryTypeDisplayName === 'string'
          ? place.primaryTypeDisplayName
          : place.primaryTypeDisplayName?.text || '',
        source: 'Google Maps',
      };
    });
}

// Google Place IDs are permitted to be stored indefinitely. No place details
// are sent to this endpoint or retained alongside these identifiers.
export async function storeGooglePlaceIds(placeIds) {
  const uniqueIds = [...new Set(placeIds.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))];
  if (!uniqueIds.length) return;
  await apiClient.post('/places/identifiers/google', { placeIds: uniqueIds });
}
