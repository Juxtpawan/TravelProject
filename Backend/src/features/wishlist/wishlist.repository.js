import { d1Batch, d1Query } from '../../db/client.js';

const DEFAULT_LIST_ID = 'wishlist-want-to-go';

export async function loadWishlistState(userId) {
  const rows = await d1Query(
    `SELECT list_id, name, created_at, position
     FROM wishlist_lists WHERE user_id = ? ORDER BY position, created_at, list_id`,
    [userId],
  );
  if (!rows.length) return null;

  const [items, preference] = await Promise.all([
    d1Query(
      `SELECT list_id, provider, place_id, destination_slug, category
       FROM wishlist_places WHERE user_id = ? ORDER BY saved_at, place_id`,
      [userId],
    ),
    d1Query('SELECT active_list_id FROM wishlist_preferences WHERE user_id = ? LIMIT 1', [userId]),
  ]);
  const itemsByList = new Map();
  for (const item of items) {
    if (!itemsByList.has(item.list_id)) itemsByList.set(item.list_id, []);
    itemsByList.get(item.list_id).push({
      id: item.place_id,
      provider: item.provider,
      destinationSlug: item.destination_slug,
      category: item.category,
    });
  }
  const lists = rows.map((list) => ({
    id: list.list_id,
    name: list.name,
    createdAt: list.created_at,
    items: itemsByList.get(list.list_id) || [],
  }));
  const activeListId = lists.some((list) => list.id === preference[0]?.active_list_id)
    ? preference[0].active_list_id
    : lists.find((list) => list.id === DEFAULT_LIST_ID)?.id || lists[0].id;
  return { lists, activeListId };
}

export async function replaceWishlistState(userId, document) {
  const now = new Date().toISOString();
  const serialized = JSON.stringify(document);
  await d1Batch([
    {
      sql: 'DELETE FROM wishlist_places WHERE user_id = ?',
      params: [userId],
    },
    {
      sql: 'DELETE FROM wishlist_lists WHERE user_id = ?',
      params: [userId],
    },
    {
      sql: `INSERT INTO wishlist_lists (user_id, list_id, name, created_at, position)
            SELECT ?, json_extract(value, '$.id'), json_extract(value, '$.name'),
                   COALESCE(json_extract(value, '$.createdAt'), ?), CAST(key AS INTEGER)
            FROM json_each(?, '$.lists')`,
      params: [userId, now, serialized],
    },
    {
      sql: `INSERT INTO wishlist_places
              (user_id, list_id, provider, place_id, destination_slug, category, saved_at)
            SELECT ?, json_extract(list.value, '$.id'),
                   COALESCE(json_extract(item.value, '$.provider'), 'app'),
                   json_extract(item.value, '$.id'),
                   COALESCE(json_extract(item.value, '$.destinationSlug'), ''),
                   COALESCE(json_extract(item.value, '$.category'), 'attraction'), ?
            FROM json_each(?, '$.lists') AS list,
                 json_each(list.value, '$.items') AS item`,
      params: [userId, now, serialized],
    },
    {
      sql: `INSERT INTO wishlist_preferences (user_id, active_list_id) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET active_list_id = excluded.active_list_id`,
      params: [userId, document.activeListId],
    },
    {
      sql: 'DELETE FROM user_wishlists WHERE user_id = ?',
      params: [userId],
    },
  ]);
  return { updatedAt: now };
}
