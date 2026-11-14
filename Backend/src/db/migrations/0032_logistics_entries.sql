CREATE TABLE IF NOT EXISTS trip_arrival_entries (
  id TEXT PRIMARY KEY NOT NULL,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS trip_arrival_entries_trip_id_idx ON trip_arrival_entries(trip_id);

CREATE TABLE IF NOT EXISTS trip_transfer_entries (
  id TEXT PRIMARY KEY NOT NULL,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS trip_transfer_entries_trip_id_idx ON trip_transfer_entries(trip_id);
