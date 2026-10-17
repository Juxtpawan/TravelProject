import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { loadUserWishlists, saveUserWishlists } from '../api/wishlistApi';
import {
  clearGuestWishlistStorage,
  createWishlistId,
  DEFAULT_WISHLIST_ID,
  mergeWishlistStates,
  normalizeWishlistCategory,
  persistWishlists,
  readWishlists,
  wishlistItemKey,
  wishlistStorageKeyForUser,
  WISHLISTS_CHANGE_EVENT,
  WISHLISTS_STORAGE_KEY,
} from '../api/wishlistStorage';

const GUEST_IMPORT_OWNER_KEY = `${WISHLISTS_STORAGE_KEY}:guest-import-owner`;

function makeWishlistItem(place, destinationSlug, destinationName) {
  return {
    id: String(place.id || place.google_place_id || place.name),
    provider: place.provider === 'google' || place.google_place_id || place.googlePlaceId || place.source === 'Google Maps' ? 'google' : 'app',
    name: place.name || 'Saved place',
    category: normalizeWishlistCategory(place.category),
    destinationSlug: place.destinationSlug || destinationSlug || '',
    destinationName: place.destinationName || destinationName || (destinationSlug || '').replace(/-/g, ' '),
    formattedAddress: place.formattedAddress || place.formatted_address || '',
    latitude: place.latitude ?? place.lat ?? null,
    longitude: place.longitude ?? place.lng ?? null,
    photoUrl: place.photoUrl || place.photo_url || '',
    summary: place.summary || place.description || '',
  };
}

function pendingSyncKey(userId) {
  return `${WISHLISTS_STORAGE_KEY}:pending-sync:${userId}`;
}

function hasPendingSync(userId) {
  try { return localStorage.getItem(pendingSyncKey(userId)) === '1'; } catch { return false; }
}

function setPendingSync(userId, pending) {
  try {
    if (pending) localStorage.setItem(pendingSyncKey(userId), '1');
    else localStorage.removeItem(pendingSyncKey(userId));
  } catch {
    // Wishlist actions remain usable from memory if browser storage is unavailable.
  }
}

export default function useWishlist() {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id || null;
  const storageKey = wishlistStorageKeyForUser(userId);
  const [state, setState] = useState(() => ({ lists: [{ id: DEFAULT_WISHLIST_ID, name: 'Want to go', items: [] }], activeListId: DEFAULT_WISHLIST_ID }));
  const [stateStorageKey, setStateStorageKey] = useState('');
  const [syncStatus, setSyncStatus] = useState(userId ? 'loading' : 'guest');
  const mutationRevisionRef = useRef(0);
  const fallbackState = { lists: [{ id: DEFAULT_WISHLIST_ID, name: 'Want to go', items: [] }], activeListId: DEFAULT_WISHLIST_ID };
  const currentState = stateStorageKey === storageKey ? state : fallbackState;
  const currentSyncStatus = userId && stateStorageKey !== storageKey ? 'loading' : syncStatus;
  const stateRef = useRef(currentState);
  stateRef.current = currentState;

  useEffect(() => {
    const refresh = (event) => {
      if (event.detail?.storageKey && event.detail.storageKey !== storageKey) return;
      const next = event.detail?.state && event.detail.storageKey === storageKey
        ? event.detail.state
        : userId
        ? readWishlists(storageKey)
        : { lists: [{ id: DEFAULT_WISHLIST_ID, name: 'Want to go', items: [] }], activeListId: DEFAULT_WISHLIST_ID };
      mutationRevisionRef.current += 1;
      stateRef.current = next;
      setState(next);
      setStateStorageKey(storageKey);
    };
    const refreshFromStorage = (event) => {
      if (event.key === storageKey || (!userId && event.key?.startsWith('travelproject-wishlist-'))) refresh();
    };
    window.addEventListener(WISHLISTS_CHANGE_EVENT, refresh);
    window.addEventListener('storage', refreshFromStorage);
    return () => {
      window.removeEventListener(WISHLISTS_CHANGE_EVENT, refresh);
      window.removeEventListener('storage', refreshFromStorage);
    };
  }, [storageKey, userId]);

  useEffect(() => {
    if (authLoading) return undefined;
    let active = true;
    const loadRevision = mutationRevisionRef.current;
    const cachedState = userId
      ? readWishlists(storageKey)
      : { lists: [{ id: DEFAULT_WISHLIST_ID, name: 'Want to go', items: [] }], activeListId: DEFAULT_WISHLIST_ID };
    stateRef.current = cachedState;
    setState(cachedState);
    setStateStorageKey(storageKey);
    setSyncStatus(userId ? 'loading' : 'guest');
    if (!userId) return () => { active = false; };

    let guestState = null;
    let canImportGuestState = false;
    try {
      const owner = localStorage.getItem(GUEST_IMPORT_OWNER_KEY);
      if (!owner || owner === userId) {
        localStorage.setItem(GUEST_IMPORT_OWNER_KEY, userId);
        canImportGuestState = true;
        guestState = readWishlists(WISHLISTS_STORAGE_KEY);
      }
    } catch {
      // Continue loading this account's server copy even if guest migration is unavailable.
    }

    loadUserWishlists(userId).then((serverState) => {
      if (!active) return;
      const pending = hasPendingSync(userId);
      const changedWhileLoading = mutationRevisionRef.current !== loadRevision;
      const localState = changedWhileLoading ? stateRef.current : cachedState;
      let next = serverState
        ? (pending ? localState : changedWhileLoading ? mergeWishlistStates(serverState, localState) : serverState)
        : localState;
      if (guestState) next = mergeWishlistStates(next, guestState);

      stateRef.current = next;
      setState(next);
      setStateStorageKey(storageKey);
      persistWishlists(next, false, storageKey);
      setSyncStatus('ready');

      const needsSave = !serverState || pending || Boolean(guestState && JSON.stringify(next) !== JSON.stringify(serverState));
      const sync = needsSave ? saveUserWishlists(userId, next) : Promise.resolve();
      sync.then(() => {
        setPendingSync(userId, false);
        if (canImportGuestState) {
          clearGuestWishlistStorage();
          try {
            if (localStorage.getItem(GUEST_IMPORT_OWNER_KEY) === userId) localStorage.removeItem(GUEST_IMPORT_OWNER_KEY);
          } catch {
            // The remote copy is authoritative even if cleanup cannot run.
          }
        }
      }).catch(() => setPendingSync(userId, true));
    }).catch(() => {
      if (active) {
        setSyncStatus('offline');
        if (mutationRevisionRef.current !== loadRevision) setPendingSync(userId, true);
      }
    });

    return () => { active = false; };
  }, [authLoading, storageKey, userId]);

  const commit = useCallback((updater) => {
    if (!userId) return stateRef.current;
    const next = updater(stateRef.current);
    mutationRevisionRef.current += 1;
    stateRef.current = next;
    setState(next);
    setStateStorageKey(storageKey);
    persistWishlists(next, true, storageKey);
    if (userId && currentSyncStatus !== 'loading') {
      saveUserWishlists(userId, next)
        .then(() => setPendingSync(userId, false))
        .catch(() => setPendingSync(userId, true));
    }
    return next;
  }, [currentSyncStatus, storageKey, userId]);

  const selectList = useCallback((listId) => {
    commit((current) => current.lists.some((list) => list.id === listId)
      ? { ...current, activeListId: listId }
      : current);
  }, [commit]);

  const createList = useCallback((name, initialPlace = null, destination = {}, { selectNewList = false } = {}) => {
    if (!userId) return { error: 'Create an account to use wishlists.' };
    const cleanName = String(name || '').trim().slice(0, 48);
    if (!cleanName) return { error: 'Enter a name for this list.' };
    if (stateRef.current.lists.some((list) => list.name.toLowerCase() === cleanName.toLowerCase())) {
      return { error: 'A list with that name already exists.' };
    }
    const id = createWishlistId();
    const item = initialPlace ? makeWishlistItem(initialPlace, destination.slug, destination.name) : null;
    commit((current) => ({
      lists: [...current.lists, { id, name: cleanName, createdAt: new Date().toISOString(), items: item ? [item] : [] }],
      activeListId: selectNewList ? id : current.activeListId,
    }));
    return { id };
  }, [commit, userId]);

  const setPlaceSaved = useCallback((listId, place, destination = {}, shouldBeSaved) => {
    const item = makeWishlistItem(place, destination.slug, destination.name);
    const key = wishlistItemKey(item);
    commit((current) => ({
      ...current,
      lists: current.lists.map((list) => {
        if (list.id !== listId) return list;
        const exists = list.items.some((saved) => wishlistItemKey(saved) === key);
        if (exists === shouldBeSaved) return list;
        return { ...list, items: shouldBeSaved ? [...list.items, item] : list.items.filter((saved) => wishlistItemKey(saved) !== key) };
      }),
    }));
  }, [commit]);

  const togglePlace = useCallback((listId, place, destination = {}) => {
    const item = makeWishlistItem(place, destination.slug, destination.name);
    const key = wishlistItemKey(item);
    const exists = stateRef.current.lists.find((list) => list.id === listId)?.items.some((saved) => wishlistItemKey(saved) === key) || false;
    setPlaceSaved(listId, place, destination, !exists);
  }, [setPlaceSaved]);

  const removeItem = useCallback((listId, item) => {
    const key = wishlistItemKey(item);
    commit((current) => ({
      ...current,
      lists: current.lists.map((list) => list.id === listId
        ? { ...list, items: list.items.filter((saved) => wishlistItemKey(saved) !== key) }
        : list),
    }));
  }, [commit]);

  const lists = currentState.lists.length ? currentState.lists : fallbackState.lists;
  const defaultList = lists.find((list) => list.id === DEFAULT_WISHLIST_ID) || lists[0];
  const activeList = lists.find((list) => list.id === currentState.activeListId) || lists[0];
  const hasPlaceInList = useCallback((listId, place, destinationSlug) => {
    const placeId = String(place.id || place.google_place_id || place.name);
    return lists.find((list) => list.id === listId)?.items.some((item) =>
      item.id === placeId && item.provider === (place.provider === 'google' || place.google_place_id || place.googlePlaceId || place.source === 'Google Maps' ? 'google' : 'app'),
    ) || false;
  }, [lists]);

  return {
    lists,
    defaultList,
    activeList,
    activeListId: activeList.id,
    syncStatus: currentSyncStatus,
    selectList,
    createList,
    togglePlace,
    setPlaceSaved,
    removeItem,
    hasPlaceInList,
    allItems: lists.flatMap((list) => list.items),
  };
}
