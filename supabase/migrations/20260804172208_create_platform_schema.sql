/*
# Class & Movie Sharing Platform — full schema

## Overview
A media-sharing platform where any registered user can upload recorded class videos
and movies, and all users can browse, stream, download, rate, comment, bookmark, and
track watch history.

## New Tables
1. `profiles` — public user profile data (display name, avatar, admin flag, email-notify toggle).
   One row per auth user, keyed by auth.users(id).
2. `media` — unified media items (classes and movies). Stores metadata + storage paths.
   Owner-scoped via user_id (defaults to auth.uid()). All logged-in users can upload.
3. `comments` — per-media comments. Owner-scoped.
4. `ratings` — per-media 1-5 star ratings, one per user per media (unique constraint).
5. `watch_history` — per-user watch progress, used for Continue Watching (resume timestamp).
6. `favorites` — per-user watchlist/bookmarks (one per user per media).

## Security / RLS
- RLS enabled on every table.
- profiles: owner can read/update own profile; any authenticated user can read profiles.
- media: any authenticated user can SELECT (browse), any authenticated user can INSERT
  their own (upload open to all), owner can UPDATE/DELETE own, admin can DELETE any.
- comments: authenticated can SELECT all; owner can INSERT/UPDATE/DELETE own.
- ratings: authenticated can SELECT all; owner can INSERT/UPSERT/DELETE own rating.
- watch_history: owner-only CRUD (private).
- favorites: owner-only CRUD (private).

## Notes
- `user_id` columns default to auth.uid() so client inserts that omit user_id succeed.
- Storage buckets: `media-videos` and `media-posters` (public read).
- Rating uniqueness: one rating row per (user_id, media_id).
- Watch history keyed on (user_id, media_id).
*/

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  avatar_url text,
  is_admin boolean NOT NULL DEFAULT false,
  email_notify boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all"
ON public.profiles FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---------- media ----------
CREATE TABLE IF NOT EXISTS public.media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('class','movie')),
  title text NOT NULL,
  description text,
  class_date date,
  instructor text,
  subject text,
  genre text,
  release_year int,
  cast_names text,
  duration int NOT NULL DEFAULT 0,
  video_path text NOT NULL,
  poster_url text,
  size_bytes bigint NOT NULL DEFAULT 0,
  views int NOT NULL DEFAULT 0,
  downloads int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_select_all" ON public.media;
CREATE POLICY "media_select_all"
ON public.media FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "media_insert_own" ON public.media;
CREATE POLICY "media_insert_own"
ON public.media FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "media_update_own" ON public.media;
CREATE POLICY "media_update_own"
ON public.media FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "media_delete_own_or_admin" ON public.media;
CREATE POLICY "media_delete_own_or_admin"
ON public.media FOR DELETE
TO authenticated USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

CREATE INDEX IF NOT EXISTS media_type_idx ON public.media (type);
CREATE INDEX IF NOT EXISTS media_created_idx ON public.media (created_at DESC);
CREATE INDEX IF NOT EXISTS media_user_idx ON public.media (user_id);
CREATE INDEX IF NOT EXISTS media_views_idx ON public.media (views DESC);
CREATE INDEX IF NOT EXISTS media_downloads_idx ON public.media (downloads DESC);

-- ---------- comments ----------
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select_all" ON public.comments;
CREATE POLICY "comments_select_all"
ON public.comments FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "comments_insert_own" ON public.comments;
CREATE POLICY "comments_insert_own"
ON public.comments FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_update_own" ON public.comments;
CREATE POLICY "comments_update_own"
ON public.comments FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_delete_own" ON public.comments;
CREATE POLICY "comments_delete_own"
ON public.comments FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS comments_media_idx ON public.comments (media_id, created_at DESC);

-- ---------- ratings ----------
CREATE TABLE IF NOT EXISTS public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (media_id, user_id)
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ratings_select_all" ON public.ratings;
CREATE POLICY "ratings_select_all"
ON public.ratings FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "ratings_insert_own" ON public.ratings;
CREATE POLICY "ratings_insert_own"
ON public.ratings FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ratings_update_own" ON public.ratings;
CREATE POLICY "ratings_update_own"
ON public.ratings FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ratings_delete_own" ON public.ratings;
CREATE POLICY "ratings_delete_own"
ON public.ratings FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ratings_media_idx ON public.ratings (media_id);

-- ---------- watch_history ----------
CREATE TABLE IF NOT EXISTS public.watch_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  duration int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (media_id, user_id)
);

ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "history_select_own" ON public.watch_history;
CREATE POLICY "history_select_own"
ON public.watch_history FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "history_insert_own" ON public.watch_history;
CREATE POLICY "history_insert_own"
ON public.watch_history FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "history_update_own" ON public.watch_history;
CREATE POLICY "history_update_own"
ON public.watch_history FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "history_delete_own" ON public.watch_history;
CREATE POLICY "history_delete_own"
ON public.watch_history FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS history_user_idx ON public.watch_history (user_id, updated_at DESC);

-- ---------- favorites ----------
CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (media_id, user_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favorites_select_own" ON public.favorites;
CREATE POLICY "favorites_select_own"
ON public.favorites FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_insert_own" ON public.favorites;
CREATE POLICY "favorites_insert_own"
ON public.favorites FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_delete_own" ON public.favorites;
CREATE POLICY "favorites_delete_own"
ON public.favorites FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS favorites_user_idx ON public.favorites (user_id, created_at DESC);

-- ---------- auto-create profile on signup ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- helper: increment media counter (callable via RPC) ----------
CREATE OR REPLACE FUNCTION public.increment_media_counter(p_media_id uuid, p_field text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.media SET views = views + 1 WHERE id = p_media_id AND p_field = 'views';
  UPDATE public.media SET downloads = downloads + 1 WHERE id = p_media_id AND p_field = 'downloads';
$$;

-- ---------- storage buckets ----------
INSERT INTO storage.buckets (id, name, public) VALUES ('media-videos', 'media-videos', true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('media-posters', 'media-posters', true)
ON ConFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "videos_read_public" ON storage.objects;
CREATE POLICY "videos_read_public" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'media-videos');

DROP POLICY IF EXISTS "videos_insert_own" ON storage.objects;
CREATE POLICY "videos_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media-videos');

DROP POLICY IF EXISTS "videos_delete_own" ON storage.objects;
CREATE POLICY "videos_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'media-videos' AND owner = auth.uid());

DROP POLICY IF EXISTS "posters_read_public" ON storage.objects;
CREATE POLICY "posters_read_public" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'media-posters');

DROP POLICY IF EXISTS "posters_insert_own" ON storage.objects;
CREATE POLICY "posters_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media-posters');

DROP POLICY IF EXISTS "posters_delete_own" ON storage.objects;
CREATE POLICY "posters_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'media-posters' AND owner = auth.uid());
