-- Commons-derived images are independent content and retain their own
-- provenance/license metadata, keyed to the app's durable provider identity.
CREATE TABLE IF NOT EXISTS place_images (
    provider TEXT NOT NULL,
    place_id TEXT NOT NULL,
    category TEXT NOT NULL,
    object_key TEXT,
    file_title TEXT,
    file_page_url TEXT,
    creator TEXT,
    license_name TEXT,
    license_url TEXT,
    modified INTEGER NOT NULL DEFAULT 0,
    checked_at TEXT NOT NULL,
    PRIMARY KEY (provider, place_id, category)
);
