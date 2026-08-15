-- Update storage buckets: remove file_size_limit to allow multi-GB uploads,
-- and expand allowed MIME types for all required video formats.
-- Resumable uploads use 6MB chunks, so the bucket needs no size cap on the bucket config itself;
-- the effective limit is the Supabase plan's storage quota, not a per-file cap.

UPDATE storage.buckets
SET
  file_size_limit = NULL,
  allowed_mime_types = ARRAY[
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-matroska',
    'video/x-msvideo',
    'video/mpeg',
    'video/x-m4v',
    'video/x-flv',
    'video/3gpp',
    'video/x-ms-wmv',
    'application/octet-stream'
  ]
WHERE id = 'videos';

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
WHERE id = 'thumbnails';
