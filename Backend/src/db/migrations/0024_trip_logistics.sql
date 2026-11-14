CREATE TABLE IF NOT EXISTS trip_logistics (
  trip_id TEXT PRIMARY KEY NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  arrival_mode TEXT NOT NULL DEFAULT '',
  arrival_details TEXT NOT NULL DEFAULT '',
  local_transport TEXT NOT NULL DEFAULT '',
  local_transport_details TEXT NOT NULL DEFAULT '',
  stay_name TEXT NOT NULL DEFAULT '',
  stay_details TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
