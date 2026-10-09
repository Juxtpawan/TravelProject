ALTER TABLE destinations ADD COLUMN google_place_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS destinations_google_place_id_unique
  ON destinations(google_place_id);
