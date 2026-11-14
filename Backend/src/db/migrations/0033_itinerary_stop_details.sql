ALTER TABLE itinerary_items ADD COLUMN visited_at TEXT;
ALTER TABLE itinerary_items ADD COLUMN estimated_cost TEXT NOT NULL DEFAULT '';
ALTER TABLE itinerary_items ADD COLUMN cost_currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE itinerary_items ADD COLUMN booking_url TEXT NOT NULL DEFAULT '';
