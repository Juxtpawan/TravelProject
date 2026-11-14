ALTER TABLE trip_logistics ADD COLUMN arrival_items TEXT NOT NULL DEFAULT '[]';
ALTER TABLE trip_logistics ADD COLUMN transfer_items TEXT NOT NULL DEFAULT '[]';
