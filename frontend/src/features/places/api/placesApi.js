import { apiClient } from '../../../lib/apiClient';

export async function getDestinations() {
  const { data } = await apiClient.get('/places');
  return Array.isArray(data) ? data : [];
}

export async function searchPlaces(query, destinationSlug) {
  const { data } = await apiClient.post('/search', { query, destinationSlug });
  return data.results || [];
}

export async function autocompleteDestinations(input, sessionToken) {
  const { data } = await apiClient.post('/places/autocomplete', { input, sessionToken });
  return data;
}

export async function getDestinationPlaceDetails(placeId, sessionToken) {
  const { data } = await apiClient.post('/places/details', { placeId, sessionToken });
  return data;
}

export async function lookupDestination(query) {
  const { data } = await apiClient.get('/places/lookup', { params: { q: query } });
  return data;
}

export async function resolveDestination(query, googlePlaceId, location) {
  const { data } = await apiClient.post('/places/resolve', { query, googlePlaceId, location });
  return data.destination;
}

export async function getDestination(slug) {
  const { data } = await apiClient.get(`/places/${encodeURIComponent(slug)}`);
  return data;
}

export async function getDestinationGuide(slug) {
  const { data } = await apiClient.get(`/places/${encodeURIComponent(slug)}/guide`);
  return data;
}

export async function startDestinationDiscovery(slug) {
  const { data } = await apiClient.post(`/places/${encodeURIComponent(slug)}/discover`);
  return data;
}
