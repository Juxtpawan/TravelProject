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

export async function getPlaceImage(placeId, category, destination, name) {
  const key = `${placeId}:${category}`;
  if (pendingImageRequests.has(key)) return pendingImageRequests.get(key);
  const request = enqueueImageRequest(async () => {
    const { data } = await apiClient.get(`/place-images/${encodeURIComponent(placeId)}`, {
      params: { category, destination, name },
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
