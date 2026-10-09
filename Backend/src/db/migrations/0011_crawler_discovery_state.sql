CREATE TABLE IF NOT EXISTS crawler_discovery_state (
  destination_id TEXT PRIMARY KEY NOT NULL,
  requested_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE CASCADE
);
