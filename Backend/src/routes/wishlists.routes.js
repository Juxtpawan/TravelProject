import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { d1Query } from '../db/client.js';
import { loadWishlistState, replaceWishlistState } from '../features/wishlist/wishlist.repository.js';

const router = express.Router();
const DEFAULT_WISHLIST_ID = 'wishlist-want-to-go';
const MAX_LISTS = 100;
const MAX_ITEMS = 3000;
const MAX_DOCUMENT_BYTES = 80_000;

router.use(authMiddleware);

function requireOwnWishlist(req, res, next) {
  if (req.params.userId !== req.user.id) return res.status(403).json({ error: 'You can only access your own wishlists.' });
  return next();
}

function cleanText(value, maxLength, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : fallback;
}

function normalizeCategory(value) {
  const category = String(value || '').toLowerCase();
  if (/restaurant|cafe|bar|food|dining/.test(category)) return 'restaurant';
  if (/hotel|lodging|accommodation|stay/.test(category)) return 'hotel';
  return 'attraction';
}

function sanitizeWishlistDocument(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.lists)) {
    return { error: 'Wishlist data must include a list array.' };
  }
  if (value.lists.length > MAX_LISTS) return { error: `You can save up to ${MAX_LISTS} wishlists.` };

  let totalItems = 0;
  const lists = value.lists.map((list) => {
    if (!list || typeof list !== 'object' || !Array.isArray(list.items)) return null;
    totalItems += list.items.length;
    const id = cleanText(list.id, 120);
    const name = cleanText(list.name, 48);
    if (!id || !name) return null;

    const items = [];
    const seen = new Set();
    list.items.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const itemId = cleanText(item.googlePlaceId || item.google_place_id || item.id, 4096);
      if (!itemId) return;
      const destinationSlug = cleanText(item.destinationSlug, 180);
      const provider = item.provider === 'google' || item.google_place_id || item.googlePlaceId ? 'google' : 'app';
      const uniqueKey = `${provider}:${itemId}`;
      if (seen.has(uniqueKey)) return;
      seen.add(uniqueKey);
      items.push({
        id: itemId,
        provider,
        // This is the app's list organization; Places details are excluded
        // from durable storage, even after a user clicks Save.
        category: normalizeCategory(item.category),
        destinationSlug,
      });
    });
    return {
      id,
      name,
      createdAt: cleanText(list.createdAt, 40, new Date().toISOString()),
      items,
    };
  }).filter(Boolean);

  if (totalItems > MAX_ITEMS) return { error: `You can save up to ${MAX_ITEMS} places across your wishlists.` };
  if (!lists.length) return { error: 'Add at least one named wishlist.' };
  if (!lists.some((list) => list.id === DEFAULT_WISHLIST_ID)) {
    lists.push({ id: DEFAULT_WISHLIST_ID, name: 'Want to go', createdAt: new Date().toISOString(), items: [] });
  }

  const activeListId = lists.some((list) => list.id === value.activeListId)
    ? value.activeListId
    : DEFAULT_WISHLIST_ID;
  const document = { lists, activeListId };
  if (new TextEncoder().encode(JSON.stringify(document)).length > MAX_DOCUMENT_BYTES) {
    return { error: 'Your wishlist data is too large to save.' };
  }
  return { document };
}

// GET /wishlists — load the authenticated user's saved collections.
router.get('/:userId', requireOwnWishlist, async (req, res) => {
  try {
    const storedState = await loadWishlistState(req.user.id);
    if (storedState) return res.json({ wishlists: storedState });

    const [row] = await d1Query(
      'SELECT wishlists_json, updated_at FROM user_wishlists WHERE user_id = ?',
      [req.user.id],
    );
    if (!row) return res.json({ wishlists: null });
    const result = sanitizeWishlistDocument(JSON.parse(row.wishlists_json));
    if (result.error) return res.status(500).json({ error: 'Saved wishlist data is invalid.' });
    const { updatedAt } = await replaceWishlistState(req.user.id, result.document);
    return res.json({ wishlists: result.document, updatedAt });
  } catch (error) {
    console.error('Error loading wishlists:', error);
    return res.status(500).json({ error: 'Failed to load wishlists.' });
  }
});

// PUT /wishlists — replace the user's collection snapshot atomically.
router.put('/:userId', requireOwnWishlist, async (req, res) => {
  const result = sanitizeWishlistDocument(req.body?.wishlists);
  if (result.error) return res.status(400).json({ error: result.error });

  try {
    const { updatedAt } = await replaceWishlistState(req.user.id, result.document);
    return res.json({ wishlists: result.document, updatedAt });
  } catch (error) {
    console.error('Error saving wishlists:', error);
    return res.status(500).json({ error: 'Failed to save wishlists.' });
  }
});

export default router;
