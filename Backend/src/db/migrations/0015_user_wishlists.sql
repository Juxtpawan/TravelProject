-- Store each authenticated user's named wishlists as a JSON document.
-- The document keeps list order, active list, saved items, and local ids intact.
CREATE TABLE IF NOT EXISTS user_wishlists (
    user_id TEXT PRIMARY KEY,
    wishlists_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
