-- Re-evaluate existing Commons matches after image ranking/provider changes.
-- The image service replaces or deletes each old R2 object as its place is
-- requested, so cached files remain tied to a validated current match.
UPDATE place_images
SET checked_at = '1970-01-01T00:00:00.000Z'
WHERE source_provider = 'wikimedia-commons';
