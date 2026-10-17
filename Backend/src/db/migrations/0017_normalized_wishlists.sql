-- Store list/place relationships separately from transient Google Places content.
CREATE TABLE IF NOT EXISTS wishlist_lists (
    user_id TEXT NOT NULL,
    list_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, list_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wishlist_places (
    user_id TEXT NOT NULL,
    list_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    place_id TEXT NOT NULL,
    destination_slug TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'attraction',
    saved_at TEXT NOT NULL,
    PRIMARY KEY (user_id, list_id, provider, place_id, destination_slug),
    FOREIGN KEY (user_id, list_id) REFERENCES wishlist_lists(user_id, list_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS wishlist_places_provider_place_idx
    ON wishlist_places(provider, place_id);
CREATE INDEX IF NOT EXISTS wishlist_places_user_list_idx
    ON wishlist_places(user_id, list_id);

CREATE TABLE IF NOT EXISTS wishlist_preferences (
    user_id TEXT PRIMARY KEY,
    active_list_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Move existing per-user snapshots to ID-only rows so previously saved Google
-- names, addresses, photos, descriptions, and coordinates are removed as well.
INSERT OR IGNORE INTO wishlist_lists (user_id, list_id, name, created_at, position)
SELECT w.user_id,
       json_extract(list.value, '$.id'),
       substr(trim(json_extract(list.value, '$.name')), 1, 48),
       COALESCE(json_extract(list.value, '$.createdAt'), w.updated_at),
       CAST(list.key AS INTEGER)
FROM user_wishlists AS w,
     json_each(w.wishlists_json, '$.lists') AS list
WHERE json_valid(w.wishlists_json)
  AND json_type(list.value, '$.id') = 'text'
  AND length(trim(json_extract(list.value, '$.id'))) > 0
  AND json_type(list.value, '$.name') = 'text'
  AND length(trim(json_extract(list.value, '$.name'))) > 0;

INSERT OR IGNORE INTO wishlist_places
    (user_id, list_id, provider, place_id, destination_slug, category, saved_at)
SELECT w.user_id,
       json_extract(list.value, '$.id'),
       CASE WHEN json_extract(item.value, '$.provider') = 'google'
                  OR json_extract(item.value, '$.google_place_id') IS NOT NULL
                  OR json_extract(item.value, '$.googlePlaceId') IS NOT NULL
            THEN 'google' ELSE 'app' END,
       COALESCE(json_extract(item.value, '$.googlePlaceId'),
                json_extract(item.value, '$.google_place_id'),
                json_extract(item.value, '$.id')),
       substr(COALESCE(json_extract(item.value, '$.destinationSlug'), ''), 1, 180),
       CASE
         WHEN lower(COALESCE(json_extract(item.value, '$.category'), '')) LIKE '%restaurant%'
           OR lower(COALESCE(json_extract(item.value, '$.category'), '')) LIKE '%cafe%'
           OR lower(COALESCE(json_extract(item.value, '$.category'), '')) LIKE '%food%' THEN 'restaurant'
         WHEN lower(COALESCE(json_extract(item.value, '$.category'), '')) LIKE '%hotel%'
           OR lower(COALESCE(json_extract(item.value, '$.category'), '')) LIKE '%lodging%' THEN 'hotel'
         ELSE 'attraction'
       END,
       COALESCE(w.updated_at, datetime('now'))
FROM user_wishlists AS w,
     json_each(w.wishlists_json, '$.lists') AS list,
     json_each(list.value, '$.items') AS item
WHERE json_valid(w.wishlists_json)
  AND json_type(list.value, '$.id') = 'text'
  AND COALESCE(json_type(item.value, '$.googlePlaceId'),
               json_type(item.value, '$.google_place_id'),
               json_type(item.value, '$.id')) = 'text'
  AND length(COALESCE(json_extract(item.value, '$.googlePlaceId'),
                      json_extract(item.value, '$.google_place_id'),
                      json_extract(item.value, '$.id'))) BETWEEN 1 AND 4096;

INSERT OR REPLACE INTO wishlist_preferences (user_id, active_list_id)
SELECT w.user_id, COALESCE(json_extract(w.wishlists_json, '$.activeListId'), 'wishlist-want-to-go')
FROM user_wishlists AS w
WHERE json_valid(w.wishlists_json)
  AND EXISTS (SELECT 1 FROM wishlist_lists AS l WHERE l.user_id = w.user_id);

DELETE FROM user_wishlists;
