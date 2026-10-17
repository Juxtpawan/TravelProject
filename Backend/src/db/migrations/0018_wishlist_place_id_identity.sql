-- A saved provider place is one item per list, even if encountered from
-- multiple destination guides. Preserve one navigation context when merging.
CREATE TABLE wishlist_places_by_place_id (
    user_id TEXT NOT NULL,
    list_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    place_id TEXT NOT NULL,
    destination_slug TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'attraction',
    saved_at TEXT NOT NULL,
    PRIMARY KEY (user_id, list_id, provider, place_id),
    FOREIGN KEY (user_id, list_id) REFERENCES wishlist_lists(user_id, list_id) ON DELETE CASCADE
);

INSERT INTO wishlist_places_by_place_id
    (user_id, list_id, provider, place_id, destination_slug, category, saved_at)
SELECT user_id, list_id, provider, place_id,
       COALESCE(MAX(CASE WHEN destination_slug <> '' THEN destination_slug END), ''),
       MIN(category), MIN(saved_at)
FROM wishlist_places
GROUP BY user_id, list_id, provider, place_id;

DROP TABLE wishlist_places;
ALTER TABLE wishlist_places_by_place_id RENAME TO wishlist_places;
CREATE INDEX wishlist_places_provider_place_idx ON wishlist_places(provider, place_id);
CREATE INDEX wishlist_places_user_list_idx ON wishlist_places(user_id, list_id);
