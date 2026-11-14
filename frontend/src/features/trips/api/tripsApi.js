import { apiClient } from '../../../lib/apiClient';

export async function getTrips() {
  const { data } = await apiClient.get('/trips');
  return Array.isArray(data) ? data : [];
}

export async function createTrip(payload) {
  const { data } = await apiClient.post('/trips', payload);
  return data;
}

export async function deleteTrip(tripId) {
  const { data } = await apiClient.delete(`/trips/${tripId}`);
  return data;
}

export async function getTripLogistics(tripId) {
  const { data } = await apiClient.get(`/trips/${tripId}/logistics`);
  return data;
}

export async function saveTripLogistics(tripId, payload) {
  const { data } = await apiClient.put(`/trips/${tripId}/logistics`, payload);
  return data;
}

export async function saveTripNotes(tripId, notes) {
  const { data } = await apiClient.put(`/trips/${tripId}/notes`, { notes });
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

export async function createTripShareLink(tripId, role, inviteeUserId = '') {
  const { data } = await apiClient.post(`/trips/${tripId}/share-links`, { role, inviteeUserId });
  return data;
}

export async function searchTripInviteUsers(query) {
  const { data } = await apiClient.get('/users/search', { params: { q: query } });
  return Array.isArray(data) ? data : [];
}

export async function getTripShareLinks(tripId) {
  const { data } = await apiClient.get(`/trips/${tripId}/share-links`);
  return Array.isArray(data) ? data : [];
}

export async function revokeTripShareLink(tripId, linkId) {
  const { data } = await apiClient.delete(`/trips/${tripId}/share-links/${linkId}`);
  return data;
}

export async function getTripCollaborators(tripId) {
  const { data } = await apiClient.get(`/trips/${tripId}/collaborators`);
  return Array.isArray(data) ? data : [];
}

export async function removeTripCollaborator(tripId, userId) {
  const { data } = await apiClient.delete(`/trips/${tripId}/collaborators/${userId}`);
  return data;
}

export async function requestTripAccess(tripId, token) {
  const { data } = await apiClient.post(`/trips/invitations/${encodeURIComponent(tripId)}/${encodeURIComponent(token)}/request`);
  return data;
}

export async function getTripNotifications() {
  const { data } = await apiClient.get('/trips/notifications');
  return Array.isArray(data) ? data : [];
}

export async function markTripNotificationsRead() {
  const { data } = await apiClient.post('/trips/notifications/read');
  return data;
}

export async function respondToTripNotification(id, decision, role) {
  const { data } = await apiClient.post(`/trips/notifications/${id}/respond`, { decision, role });
  return data;
}

export async function getPublicSharedTrip(tripId, token) {
  const { data } = await apiClient.get(`/trips/shared/${encodeURIComponent(tripId)}/${encodeURIComponent(token)}`);
  return data;
}
