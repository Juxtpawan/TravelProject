-- Migration: 0008_itinerary_items.sql
-- Purpose: Create the itinerary_items table to allow drag-and-drop daily planning.

CREATE TABLE IF NOT EXISTS itinerary_items (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL,
    place_id TEXT NOT NULL,
    day_index INTEGER NOT NULL,
    order_index INTEGER NOT NULL,
    start_time TEXT,
    end_time TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (place_id) REFERENCES places(id)
);

CREATE INDEX idx_itinerary_items_trip ON itinerary_items(trip_id);
