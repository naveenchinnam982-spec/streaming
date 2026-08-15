-- Expand videos table for large-file upload system
-- Adds file metadata columns and a status field used to track upload progress.
-- The Home page will only show videos with status = 'ready'.

ALTER TABLE videos ADD COLUMN IF NOT EXISTS video_path text;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_path text;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS file_size bigint DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready';

-- Add a check constraint so status only accepts known values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'videos_status_check'
  ) THEN
    ALTER TABLE videos ADD CONSTRAINT videos_status_check
      CHECK (status IN ('processing', 'ready', 'failed'));
  END IF;
END $$;

-- Backfill any existing rows so they are visible on the Home page
UPDATE videos SET status = 'ready' WHERE status IS NULL;

-- Index on status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos (status);

-- Add updated_at auto-update trigger
CREATE OR REPLACE FUNCTION update_videos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_videos_updated_at ON videos;
CREATE TRIGGER trg_videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION update_videos_updated_at();
