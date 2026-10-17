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
  hotel: (destinationName) => ({
    textQuery: `hotels and places to stay in ${destinationName}`,
    includedType: 'hotel',
    useStrictTypeFiltering: true,
  }),
};

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
    .map((place) => ({
        id: place.id,
        google_place_id: place.id,
        // Maps JavaScript Place.displayName is a string. The REST API uses a
        // localized object, so accept both shapes to keep cards named.
        name: (typeof place.displayName === 'string' ? place.displayName : place.displayName?.text)
          || place.formattedAddress
          || 'Place',
        category,
        latitude: place.location?.lat(),
        longitude: place.location?.lng(),
        formattedAddress: place.formattedAddress || '',
        source: 'Google Maps',
      }));
}

// Google Place IDs are permitted to be stored indefinitely. No place details
// are sent to this endpoint or retained alongside these identifiers.
export async function storeGooglePlaceIds(placeIds) {
  const uniqueIds = [...new Set(placeIds.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))];
  if (!uniqueIds.length) return;
  await apiClient.post('/places/identifiers/google', { placeIds: uniqueIds });
}
