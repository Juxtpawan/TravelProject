-- Remove unused snapshot data and sync tracking after disabling the importer.
DELETE FROM destinations
WHERE google_place_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM places p
    JOIN place_sources s ON s.place_id = p.id
    WHERE p.destination_id = destinations.id
      AND lower(s.source_name) = 'wikivoyage'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM places p
    JOIN place_sources s ON s.place_id = p.id
    WHERE p.destination_id = destinations.id
      AND lower(s.source_name) <> 'wikivoyage'
  )
  AND NOT EXISTS (
    SELECT 1 FROM trips t WHERE t.destination_id = destinations.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM itinerary_items i
    JOIN places p ON p.id = i.place_id
    WHERE p.destination_id = destinations.id
  );

DELETE FROM places
WHERE EXISTS (
  SELECT 1 FROM place_sources s
  WHERE s.place_id = places.id
    AND lower(s.source_name) = 'wikivoyage'
)
AND NOT EXISTS (
  SELECT 1 FROM place_sources s
  WHERE s.place_id = places.id
    AND lower(s.source_name) <> 'wikivoyage'
)
AND NOT EXISTS (
  SELECT 1 FROM itinerary_items i WHERE i.place_id = places.id
);

DROP TABLE IF EXISTS sync_jobs;
