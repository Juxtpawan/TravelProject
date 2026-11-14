import { apiClient } from '../../../lib/apiClient';

const pendingImageRequests = new Map();
const requestQueue = [];
const MAX_CONCURRENT_IMAGE_REQUESTS = 3;
let activeImageRequests = 0;

function enqueueImageRequest(run) {
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      activeImageRequests += 1;
      try { resolve(await run()); } catch (error) { reject(error); }
      finally {
        activeImageRequests -= 1;
        requestQueue.shift()?.();
      }
    });
    if (activeImageRequests < MAX_CONCURRENT_IMAGE_REQUESTS && requestQueue.length <= MAX_CONCURRENT_IMAGE_REQUESTS) {
      requestQueue.shift()?.();
    }
  });
}

export async function getPlaceImage(placeId, category, destination, name, locationContext = {}) {
  const key = `${placeId}:${category}`;
  if (pendingImageRequests.has(key)) return pendingImageRequests.get(key);
  const request = enqueueImageRequest(async () => {
    const { data } = await apiClient.get(`/place-images/${encodeURIComponent(placeId)}`, {
      params: {
        category, destination, name,
        googlePlaceName: locationContext.placeName,
        context: [locationContext.formattedAddress, locationContext.primaryType].filter(Boolean).join(', '),
        latitude: locationContext.latitude,
        longitude: locationContext.longitude,
      },
      timeout: 65000,
    });
    return data.image || null;
  })
    .catch((error) => {
      if (error.response?.status === 404) return null;
      throw error;
    })
    .finally(() => pendingImageRequests.delete(key));
  pendingImageRequests.set(key, request);
  return request;
}

export async function getPlaceImageOptions(placeId, category, destination, name, locationContext = '') {
  const context = typeof locationContext === 'string'
    ? { placeName: '', formattedAddress: locationContext, primaryType: '', latitude: null, longitude: null }
    : locationContext || {};
  const { data } = await apiClient.get(`/place-images/${encodeURIComponent(placeId)}/options`, {
    params: {
      category, destination, name,
      googlePlaceName: context.placeName,
      context: [context.formattedAddress, context.primaryType].filter(Boolean).join(', '),
      latitude: context.latitude,
      longitude: context.longitude,
    },
    timeout: 65000,
  });
  return Array.isArray(data.options) ? data.options : [];
}

export async function selectPlaceImage(placeId, category, destination, name, fileTitle, locationContext = '') {
  const context = typeof locationContext === 'string'
    ? { placeName: '', formattedAddress: locationContext, primaryType: '', latitude: null, longitude: null }
    : locationContext || {};
  const { data } = await apiClient.post(`/place-images/${encodeURIComponent(placeId)}/select`, {
    category, destination, name, fileTitle,
    googlePlaceName: context.placeName,
    context: [context.formattedAddress, context.primaryType].filter(Boolean).join(', '),
    latitude: context.latitude,
    longitude: context.longitude,
  }, { timeout: 65000 });
  return data.image || null;
}
