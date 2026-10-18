import { apiClient } from '../../../lib/apiClient';

// Keep the live Google field mask minimal. Display name and address are shown
// in guide cards; location is needed to place the result on the map.
const GUIDE_PLACE_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
];

const CATEGORY_SEARCH = {
  attraction: (destinationName) => ({
    textQuery: `top places to visit, tourist attractions, landmarks, museums, and parks in ${destinationName}`,
  }),
  restaurant: (destinationName) => ({
    textQuery: `restaurants in ${destinationName}`,
    includedType: 'restaurant',
    useStrictTypeFiltering: true,
  }),
};

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
  if (cached?.name && cached.name !== 'Saved place') return cached;

  if (!placesLibrary?.Place) return cached || null;

  try {
    const place = new placesLibrary.Place({ id: placeId });
    await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
    const name = (typeof place.displayName === 'string' ? place.displayName : place.displayName?.text)
      || place.formattedAddress
      || '';
    const details = {
      id: placeId,
      name,
      formattedAddress: place.formattedAddress || '',
      latitude: place.location?.lat?.() ?? null,
      longitude: place.location?.lng?.() ?? null,
    };
    cachePlaceDetails(placeId, details);
    return details;
  } catch (err) {
    console.warn(`[Places] Could not resolve place details for ${placeId}:`, err);
    return cached || null;
  }
}

export async function searchGoogleGuidePlaces(placesLibrary, category, destinationName, center, maxResultCount = 20) {
  const categoryQuery = CATEGORY_SEARCH[category];
  if (!placesLibrary?.Place?.searchByText || !categoryQuery || !destinationName || !center) {
    return [];
  }

  const response = await placesLibrary.Place.searchByText({
    ...categoryQuery(destinationName),
    locationBias: { center, radius: 20000 },
    maxResultCount: Math.max(1, Math.min(20, maxResultCount)),
    fields: GUIDE_PLACE_FIELDS,
  });

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

