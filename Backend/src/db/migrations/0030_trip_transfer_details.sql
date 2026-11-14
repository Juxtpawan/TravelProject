ALTER TABLE trip_logistics ADD COLUMN transfer_mode TEXT NOT NULL DEFAULT '';
ALTER TABLE trip_logistics ADD COLUMN transfer_from TEXT NOT NULL DEFAULT '';
ALTER TABLE trip_logistics ADD COLUMN transfer_to TEXT NOT NULL DEFAULT '';
ALTER TABLE trip_logistics ADD COLUMN transfer_notes TEXT NOT NULL DEFAULT '';
