ALTER TABLE trip_logistics ADD COLUMN arrival_name TEXT NOT NULL DEFAULT '';
ALTER TABLE trip_logistics ADD COLUMN arrival_number TEXT NOT NULL DEFAULT '';
ALTER TABLE trip_logistics ADD COLUMN arrival_from TEXT NOT NULL DEFAULT '';
ALTER TABLE trip_logistics ADD COLUMN arrival_to TEXT NOT NULL DEFAULT '';
ALTER TABLE trip_logistics ADD COLUMN arrival_confirmation TEXT NOT NULL DEFAULT '';
ALTER TABLE trip_logistics ADD COLUMN arrival_status TEXT NOT NULL DEFAULT '';
ALTER TABLE trip_logistics ADD COLUMN arrival_departure_date TEXT NOT NULL DEFAULT '';
ALTER TABLE trip_logistics ADD COLUMN arrival_departure_time TEXT NOT NULL DEFAULT '';
ALTER TABLE trip_logistics ADD COLUMN arrival_arrival_date TEXT NOT NULL DEFAULT '';
ALTER TABLE trip_logistics ADD COLUMN arrival_arrival_time TEXT NOT NULL DEFAULT '';
ALTER TABLE trip_logistics ADD COLUMN arrival_cost TEXT NOT NULL DEFAULT '';
ALTER TABLE trip_logistics ADD COLUMN arrival_currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE trip_logistics ADD COLUMN arrival_notes TEXT NOT NULL DEFAULT '';

UPDATE trip_logistics
SET arrival_notes = arrival_details
WHERE arrival_notes = '' AND arrival_details <> '';
