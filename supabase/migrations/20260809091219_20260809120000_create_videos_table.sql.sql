/*
# Create videos table for Netflix-style streaming platform

1. New Tables
- `videos` — stores all uploaded videos with metadata
  - `id` (uuid, primary key, auto-generated)
  - `user_id` (uuid, owner of the video, defaults to auth.uid())
  - `title` (text, not null)
  - `description` (text, nullable)
  - `category` (text, nullable — e.g. Action, Comedy, Documentary, Education, etc.)
  - `thumbnail_url` (text, nullable — public URL from thumbnails bucket)
  - `video_url` (text, not null — public URL from videos bucket)
  - `duration` (integer, default 0 — seconds)
  - `views` (integer, default 0)
  - `likes` (integer, default 0)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Security
- Enable RLS on `videos`.
- SELECT: public (anon + authenticated) — all videos are visible to everyone.
- INSERT: authenticated only, must own the row (auth.uid() = user_id).
- UPDATE: authenticated only, must own the row.
- DELETE: authenticated only, must own the row.

3. Indexes
- Index on `created_at` (descending) for newest-first queries.
- Index on `views` for trending/most-viewed sort.
- Index on `category` for category filtering.

4. Realtime
- Enable realtime replication on `videos` table so the Home page
  updates automatically when any user uploads a new video.

5. Notes
- The `user_id` column defaults to `auth.uid()` so frontend inserts
  that omit `user_id` still satisfy the INSERT policy's WITH CHECK.
- An increment function `increment_video_views` is created as SECURITY DEFINER
  to safely increment views without requiring an UPDATE policy grant.
*/

CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text DEFAULT 'Other',
  thumbnail_url text,
  video_url text NOT NULL,
  duration integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "videos_select_public" ON videos;
CREATE POLICY "videos_select_public"
  ON videos FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "videos_insert_own" ON videos;
CREATE POLICY "videos_insert_own"
  ON videos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "videos_update_own" ON videos;
CREATE POLICY "videos_update_own"
  ON videos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "videos_delete_own" ON videos;
CREATE POLICY "videos_delete_own"
  ON videos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_views ON videos (views DESC);
CREATE INDEX IF NOT EXISTS idx_videos_category ON videos (category);

-- SECURITY DEFINER function to increment views atomically
-- (avoids needing UPDATE policy for view-count increments from anon)
CREATE OR REPLACE FUNCTION increment_video_views(p_video_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE videos SET views = views + 1, updated_at = now() WHERE id = p_video_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_video_views(uuid) TO anon, authenticated;

-- Enable realtime on videos table
ALTER PUBLICATION supabase_realtime ADD TABLE videos;
