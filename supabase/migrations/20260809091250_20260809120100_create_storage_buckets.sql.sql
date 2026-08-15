-- Create storage buckets for video streaming platform
-- Buckets: videos (500MB, video types), thumbnails (5MB, image types)
-- Both public-readable, authenticated-only writes with ownership checks

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos',
  'videos',
  true,
  524288000,
  ARRAY['video/mp4', 'video/x-msvideo', 'video/quicktime', 'video/x-matroska', 'video/webm', 'video/mpeg', 'video/x-m4v']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 524288000,
  allowed_mime_types = ARRAY['video/mp4', 'video/x-msvideo', 'video/quicktime', 'video/x-matroska', 'video/webm', 'video/mpeg', 'video/x-m4v'];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'thumbnails',
  'thumbnails',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "videos_bucket_read" ON storage.objects;
CREATE POLICY "videos_bucket_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'videos');

DROP POLICY IF EXISTS "videos_bucket_upload" ON storage.objects;
CREATE POLICY "videos_bucket_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'videos' AND auth.uid() = owner);

DROP POLICY IF EXISTS "videos_bucket_update" ON storage.objects;
CREATE POLICY "videos_bucket_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'videos' AND auth.uid() = owner)
  WITH CHECK (bucket_id = 'videos' AND auth.uid() = owner);

DROP POLICY IF EXISTS "videos_bucket_delete" ON storage.objects;
CREATE POLICY "videos_bucket_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'videos' AND auth.uid() = owner);

DROP POLICY IF EXISTS "thumbnails_bucket_read" ON storage.objects;
CREATE POLICY "thumbnails_bucket_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'thumbnails');

DROP POLICY IF EXISTS "thumbnails_bucket_upload" ON storage.objects;
CREATE POLICY "thumbnails_bucket_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'thumbnails' AND auth.uid() = owner);

DROP POLICY IF EXISTS "thumbnails_bucket_update" ON storage.objects;
CREATE POLICY "thumbnails_bucket_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'thumbnails' AND auth.uid() = owner)
  WITH CHECK (bucket_id = 'thumbnails' AND auth.uid() = owner);

DROP POLICY IF EXISTS "thumbnails_bucket_delete" ON storage.objects;
CREATE POLICY "thumbnails_bucket_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'thumbnails' AND auth.uid() = owner);
