import { d1Query } from '../../db/client.js';

export async function findPlaceImage(provider, placeId, category) {
  const [row] = await d1Query(
    `SELECT object_key, file_title, file_page_url, creator, license_name, license_url,
            match_type, source_provider, modified, checked_at
     FROM place_images WHERE provider = ? AND place_id = ? AND category = ? LIMIT 1`,
    [provider, placeId, category],
  );
  return row || null;
}

export async function savePlaceImage(image) {
  await d1Query(
    `INSERT INTO place_images
      (provider, place_id, category, object_key, file_title, file_page_url, creator,
       license_name, license_url, match_type, source_provider, modified, checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(provider, place_id, category) DO UPDATE SET
       object_key = excluded.object_key, file_title = excluded.file_title,
       file_page_url = excluded.file_page_url, creator = excluded.creator,
       license_name = excluded.license_name, license_url = excluded.license_url,
       match_type = excluded.match_type, source_provider = excluded.source_provider,
       modified = 0, checked_at = excluded.checked_at`,
    [image.provider, image.placeId, image.category, image.objectKey, image.fileTitle,
      image.filePageUrl, image.creator, image.licenseName, image.licenseUrl, image.matchType,
      image.sourceProvider || 'wikimedia-commons', image.checkedAt],
  );
}

export async function savePlaceImageMiss(provider, placeId, category, checkedAt) {
  await d1Query(
    `INSERT INTO place_images (provider, place_id, category, object_key, checked_at)
     VALUES (?, ?, ?, NULL, ?)
     ON CONFLICT(provider, place_id, category) DO UPDATE SET
       object_key = NULL, file_title = NULL, file_page_url = NULL, creator = NULL,
       license_name = NULL, license_url = NULL,
       modified = 0, checked_at = excluded.checked_at`,
    [provider, placeId, category, checkedAt],
  );
}
