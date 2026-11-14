-- Cover common itinerary read ordering and the user's upcoming-trip listing.
-- Replace the prefix-only indexes so these queries read only the matching range.
DROP INDEX IF EXISTS idx_itinerary_items_trip;
DROP INDEX IF EXISTS idx_trips_user;

CREATE INDEX IF NOT EXISTS idx_itinerary_items_trip_day_order
  ON itinerary_items(trip_id, day_index, order_index);

CREATE INDEX IF NOT EXISTS idx_trips_user_start_date
  ON trips(user_id, start_date);
