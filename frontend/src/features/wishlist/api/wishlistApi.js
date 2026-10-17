import { apiClient } from '../../../lib/apiClient';
import { sanitizeWishlistState } from './wishlistStorage';

const inFlightLoads = new Map();
const writeQueues = new Map();

export function loadUserWishlists(userId) {
  if (!inFlightLoads.has(userId)) {
    const request = apiClient.get(`/wishlists/${encodeURIComponent(userId)}`)
      .then(({ data }) => data.wishlists)
      .finally(() => inFlightLoads.delete(userId));
    inFlightLoads.set(userId, request);
  }
  return inFlightLoads.get(userId);
}

export function saveUserWishlists(userId, wishlists) {
  const previous = writeQueues.get(userId) || Promise.resolve();
  const current = previous.catch(() => {}).then(async () => {
    const { data } = await apiClient.put(`/wishlists/${encodeURIComponent(userId)}`, { wishlists: sanitizeWishlistState(wishlists) });
    return data.wishlists;
  });
  writeQueues.set(userId, current);
  current.finally(() => {
    if (writeQueues.get(userId) === current) writeQueues.delete(userId);
  }).catch(() => {});
  return current;
}
