-- Durable source identity links only; Google Places details are not stored here.
CREATE TABLE IF NOT EXISTS place_identifiers (
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    PRIMARY KEY (provider, external_id)
);

CREATE INDEX IF NOT EXISTS place_identifiers_entity_idx
    ON place_identifiers(entity_id);
