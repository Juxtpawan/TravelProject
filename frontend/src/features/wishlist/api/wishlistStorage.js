export const WISHLISTS_STORAGE_KEY = 'travelproject-wishlists-v2';
export const WISHLISTS_CHANGE_EVENT = 'travelproject-wishlists-change';
const PREVIOUS_STORAGE_KEY = 'travelproject-wishlists-v1';
const LEGACY_PREFIX = 'travelproject-wishlist-';
export const DEFAULT_WISHLIST_ID = 'wishlist-want-to-go';

export function wishlistStorageKeyForUser(userId) {
  return userId ? `${WISHLISTS_STORAGE_KEY}:user:${userId}` : WISHLISTS_STORAGE_KEY;
}

export function normalizeWishlistCategory(category = '') {
  const value = String(category).toLowerCase();
  if (/restaurant|cafe|bar|food|dining/.test(value)) return 'restaurant';
  if (/hotel|lodging|accommodation|stay/.test(value)) return 'hotel';
  return 'attraction';
}

export function wishlistItemKey(item) {
  return `${item.provider || 'app'}:${item.id || item.name || ''}`;
}

// Google Place IDs can be retained; Places details cannot be persisted with
// them. Keep only the ID and app-side organization when writing browser storage.
export function sanitizeWishlistState(value) {
  const lists = (Array.isArray(value?.lists) ? value.lists : []).map((list) => ({
    id: String(list?.id || ''),
    name: String(list?.name || '').trim().slice(0, 48),
    createdAt: String(list?.createdAt || new Date().toISOString()),
    items: [...new Map((Array.isArray(list?.items) ? list.items : []).map((item) => ({
      id: String(item?.googlePlaceId || item?.google_place_id || item?.id || '').trim(),
      provider: item?.provider === 'google' || item?.google_place_id || item?.googlePlaceId || item?.source === 'Google Maps' ? 'google' : 'app',
      category: normalizeWishlistCategory(item?.category),
      destinationSlug: String(item?.destinationSlug || '').trim().slice(0, 180),
    })).filter((item) => item.id).map((item) => [wishlistItemKey(item), item])).values()],
  })).filter((list) => list.id && list.name);
  const activeListId = lists.some((list) => list.id === value?.activeListId)
    ? value.activeListId
    : DEFAULT_WISHLIST_ID;
  return { lists, activeListId };
}

function defaultList() {
  return { id: DEFAULT_WISHLIST_ID, name: 'Want to go', items: [], createdAt: new Date().toISOString() };
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `wishlist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function migrateLegacyLists() {
  const items = [];
  try {
    Object.keys(localStorage).filter((key) => key.startsWith(LEGACY_PREFIX)).forEach((key) => {
      const destinationSlug = key.slice(LEGACY_PREFIX.length);
      const destinationName = destinationSlug.replace(/-/g, ' ');
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(saved)) return;
      saved.filter((item) => item && typeof item === 'object').forEach((item) => items.push({
        id: String(item.googlePlaceId || item.google_place_id || item.id || ''),
        provider: item.provider === 'google' || item.source === 'Google Maps' || item.google_place_id ? 'google' : 'app',
        destinationSlug,
        category: normalizeWishlistCategory(item.category),
      }));
    });
  } catch {
    // Continue with an empty default list when legacy browser storage is unavailable.
  }

  const uniqueItems = [...new Map(items.map((item) => [wishlistItemKey(item), item])).values()];
  return { lists: [{ ...defaultList(), items: uniqueItems }], activeListId: DEFAULT_WISHLIST_ID };
}

export function readWishlists(storageKey = WISHLISTS_STORAGE_KEY) {
  try {
    const isGuestStorage = storageKey === WISHLISTS_STORAGE_KEY;
    const currentValue = localStorage.getItem(storageKey);
    const previousValue = isGuestStorage ? localStorage.getItem(PREVIOUS_STORAGE_KEY) : null;
    const isPreviousVersion = !currentValue && Boolean(previousValue);
    const stored = JSON.parse(currentValue || previousValue || 'null');
    if (stored && Array.isArray(stored.lists)) {
      let lists = stored.lists
        .filter((list) => list && typeof list.name === 'string' && Array.isArray(list.items))
        .map((list) => ({
          id: String(list.id || makeId()),
          name: list.name.trim() || 'Untitled list',
          createdAt: list.createdAt || new Date().toISOString(),
          items: [...new Map(list.items.filter((item) => item && typeof item === 'object').map((item) => ({
            id: String(item.googlePlaceId || item.google_place_id || item.id || '').trim(),
            provider: item.provider === 'google' || item.source === 'Google Maps' || item.google_place_id || item.googlePlaceId ? 'google' : 'app',
            category: normalizeWishlistCategory(item.category),
            destinationSlug: String(item.destinationSlug || '').trim().slice(0, 180),
          })).filter((item) => item.id).map((item) => [wishlistItemKey(item), item])).values()],
        }));
      if (lists.length) {
        const defaultListExists = lists.some((list) => list.id === DEFAULT_WISHLIST_ID);
        if (!defaultListExists) lists = [...lists, { ...defaultList(), items: [] }];
        const activeListId = isPreviousVersion && defaultListExists
          ? DEFAULT_WISHLIST_ID
          : lists.some((list) => list.id === stored.activeListId) ? stored.activeListId : DEFAULT_WISHLIST_ID;
        const migrated = { lists, activeListId };
        if (isPreviousVersion || !defaultListExists) persistWishlists(migrated, false, storageKey);
        return migrated;
      }
    }
  } catch {
    // Migrate or initialize below if stored data is invalid or unavailable.
  }

  const migrated = storageKey === WISHLISTS_STORAGE_KEY
    ? migrateLegacyLists()
    : { lists: [{ ...defaultList(), items: [] }], activeListId: DEFAULT_WISHLIST_ID };
  persistWishlists(migrated, false, storageKey);
  return migrated;
}

export function persistWishlists(value, announce = true, storageKey = WISHLISTS_STORAGE_KEY) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(sanitizeWishlistState(value)));
    if (announce && typeof window !== 'undefined') {
      // Share the live in-memory state with same-tab wishlist consumers so
      // newly saved Google place names remain visible for this session. The
      // persisted copy above still contains only permitted identifiers and
      // app-authored organization fields.
      window.dispatchEvent(new CustomEvent(WISHLISTS_CHANGE_EVENT, { detail: { storageKey, state: value } }));
    }
    return true;
  } catch {
    return false;
  }
}

export function clearGuestWishlistStorage() {
  try {
    localStorage.removeItem(WISHLISTS_STORAGE_KEY);
    localStorage.removeItem(PREVIOUS_STORAGE_KEY);
    Object.keys(localStorage).filter((key) => key.startsWith(LEGACY_PREFIX)).forEach((key) => localStorage.removeItem(key));
  } catch {
    // The account copy has already been saved; guest cleanup is best effort.
  }
}

export function mergeWishlistStates(primary, secondary) {
  const mergedLists = primary.lists.map((list) => {
    const secondaryList = secondary.lists.find((candidate) => candidate.id === list.id);
    if (!secondaryList) return list;
    const items = new Map(list.items.map((item) => [wishlistItemKey(item), item]));
    secondaryList.items.forEach((item) => {
      if (!items.has(wishlistItemKey(item))) items.set(wishlistItemKey(item), item);
    });
    return { ...list, items: [...items.values()] };
  });
  secondary.lists.forEach((list) => {
    if (!mergedLists.some((candidate) => candidate.id === list.id)) mergedLists.push(list);
  });

  const activeListId = mergedLists.some((list) => list.id === primary.activeListId)
    ? primary.activeListId
    : mergedLists.some((list) => list.id === secondary.activeListId) ? secondary.activeListId : DEFAULT_WISHLIST_ID;
  return { lists: mergedLists, activeListId };
}

export function createWishlistId() {
  return makeId();
}
