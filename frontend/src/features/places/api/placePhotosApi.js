import { apiClient } from '../../../lib/apiClient';

export async function getPlacePhotos(placeId) {
  const { data } = await apiClient.get(`/places/${encodeURIComponent(placeId)}/photos`);
  return data.photos || [];
}

export async function uploadPlacePhoto(placeId, file) {
  const { data } = await apiClient.post(`/places/${encodeURIComponent(placeId)}/photos`, file, {
    headers: { 'Content-Type': file.type },
    transformRequest: [(body) => body],
  });
  return data.photo;
}
