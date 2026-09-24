-- Migration: 0004_places_destinations.sql
-- Purpose: Creating the core data aggregation and provenance tables.

-- 1. DESTINATIONS (e.g., Manali, Delhi)
CREATE TABLE IF NOT EXISTS destinations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    country TEXT,
    state TEXT,
    latitude REAL,
    longitude REAL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. PLACES (e.g., Cafe Himalayan, Hadimba Temple)
-- This is our normalized, deduplicated view of a place.
CREATE TABLE IF NOT EXISTS places (
    id TEXT PRIMARY KEY,
    destination_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- e.g., 'attraction', 'cafe', 'hotel'
    latitude REAL,
    longitude REAL,
    google_place_id TEXT UNIQUE, -- Useful for direct maps integration
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE CASCADE
);

-- 3. PLACE SOURCES (The Provenance Engine)
-- This allows us to say: "Found in 3 sources (Google, Wikivoyage, Tourism Board)"
CREATE TABLE IF NOT EXISTS place_sources (
    id TEXT PRIMARY KEY,
    place_id TEXT NOT NULL,
    source_name TEXT NOT NULL, -- e.g., 'Google Places', 'Wikivoyage'
    source_url TEXT,
    license TEXT, -- e.g., 'CC BY-SA 4.0' for Wikivoyage
    raw_data_json TEXT, -- Store the allowed raw extracted info here
    last_checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
);

-- Indexes for fast querying
CREATE INDEX idx_places_destination ON places(destination_id);
CREATE INDEX idx_place_sources_place ON place_sources(place_id);
