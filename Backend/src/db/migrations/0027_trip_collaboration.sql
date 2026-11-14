CREATE TABLE IF NOT EXISTS trip_share_links (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  target_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS trip_share_links_trip_idx ON trip_share_links(trip_id);

CREATE TABLE IF NOT EXISTS trip_collaborators (
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  requested_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS trip_collaborators_user_idx ON trip_collaborators(user_id, status);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id TEXT REFERENCES trips(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  read_at TEXT
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at DESC);
