import { apiClient } from '../../../lib/apiClient';

export async function getTrips() {
  const { data } = await apiClient.get('/trips');
  return Array.isArray(data) ? data : [];
}

export async function createTrip(payload) {
  const { data } = await apiClient.post('/trips', payload);
  return data;
}

export async function getTripItinerary(tripId) {
  const { data } = await apiClient.get(`/itinerary/${tripId}`);
  return Array.isArray(data) ? data : [];
}

export async function addTripItineraryItem(tripId, item) {
  const { data } = await apiClient.post(`/itinerary/${tripId}`, item);
  return data;
}

export async function reorderTripItinerary(tripId, items) {
  const { data } = await apiClient.put(`/itinerary/${tripId}/reorder`, { items });
  return data;
}

export async function optimizeTripItineraryDay(tripId, dayIndex, travelMode = 'DRIVE') {
  const { data } = await apiClient.post(`/itinerary/${tripId}/optimize-day`, { dayIndex, travelMode });
  return data;
}

export async function generateTripItinerary(tripId, options) {
  const { data } = await apiClient.post(`/ai/${tripId}/generate`, options);
  return data;
}

export async function updateTripItineraryItem(tripId, itemId, updates) {
  const { data } = await apiClient.patch(`/itinerary/${tripId}/item/${itemId}`, updates);
  return data;
}

export async function deleteTripItineraryItem(tripId, itemId) {
  const { data } = await apiClient.delete(`/itinerary/item/${itemId}`);
  return data;
}
