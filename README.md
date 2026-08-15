# ClassFlix — Class & Movie Sharing Platform

A full-stack media-sharing platform where any registered user can upload recorded class videos and movies, and everyone can browse, stream (with seek), download, rate, comment, bookmark, and track watch history.

## Architecture — Real Client-Server, No Browser Storage

This is a **real client-server application**. Video files and metadata are stored server-side — never in the browser.

| Layer | Technology | Where data lives |
|-------|-----------|-----------------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + React Router | Browser (UI only — no video data) |
| Database | Supabase (hosted PostgreSQL) | Supabase servers |
| File Storage | Supabase Storage (hosted object storage) | Supabase servers |
| Auth | Supabase Auth (email/password, JWT sessions) | Supabase servers |
| Uploads | TUS resumable protocol (tus-js-client) | Browser → Supabase Storage directly |
| Streaming | HTTP Range requests via Supabase Storage public URLs | Supabase CDN |
| Charts | Recharts | — |
| Icons | lucide-react | — |
| Toasts | react-hot-toast | — |
| Email notifications | Supabase Edge Function (Deno) | Supabase servers |

### What is NOT used for video storage

- **NO `localStorage`** — used only for the dark/light theme toggle (a single string: `"dark"` or `"light"`)
- **NO `sessionStorage`** — not used anywhere
- **NO `IndexedDB`** — not used anywhere
- **NO in-memory React state for video files** — React state holds only UI state (loading flags, form fields); all video data is fetched from the database on every page load

Video files travel: **Browser → HTTPS → Supabase Storage servers (permanent cloud object storage)**. The database stores only metadata (title, description, file path, duration, views, etc.) — never the video binary.

## Tech Stack Note

The original prompt requested Node.js + Express + MongoDB + multer + ffmpeg. Bolt's environment runs a Vite React frontend with a managed Supabase backend (PostgreSQL + Auth + Storage + Edge Functions) — it cannot host a separate Express server, MongoDB, or run ffmpeg. The app is built to the same functional spec using the available stack:

- **Express + MongoDB → Supabase** (hosted PostgreSQL with RLS policies replacing Mongoose models)
- **multer local disk → Supabase Storage** (managed cloud object storage with HTTP Range streaming)
- **ffprobe duration check → browser HTML5 video metadata API** (same 2-hour rule for classes)
- **ffmpeg thumbnail → client-side canvas frame capture**
- **express-rate-limit → Supabase Auth built-in brute-force protection**
- **Nodemailer → Supabase Edge Function** (logs notification intents; enable with an email provider secret)

## Features

- **Auth**: Signup (name, email, password, confirm), Login with instant redirect to home. Sessions persist across refresh. Already-logged-in users are redirected away from login/signup.
- **Upload** (any logged-in user): Tabbed UI for Class Recording vs Movie. Broad file-type acceptance (mp4, mov, avi, mkv, webm, mpeg, m4v) validated by both MIME type and extension. 5 GB max file size (platform-limited — see below). Class videos rejected if over 2 hours. Real-time upload progress bar with percentage, upload speed (MB/s), and estimated time remaining via TUS resumable uploads. Auto-thumbnail from video if no poster uploaded. Cancelable uploads. Toast notifications. Upload button locked during upload to prevent double-submit.
- **Browse**: Home with Recent Classes, Recent Movies, Continue Watching, and Watchlist preview. Separate library with search-as-you-type (debounced), filters (type, genre/subject), sort (newest, oldest, most viewed, most downloaded, top rated), and pagination. All data fetched live from the database on every load.
- **Playback**: HTML5 video player with full seek support (HTTP range requests via Supabase Storage public URLs). Real file download (blob download, not just opening in browser). View and download counts tracked. Resume from last watched position.
- **Advanced**: Continue Watching row, Watchlist/Favorites, Comments, 1-5 star ratings, Analytics dashboard (per-user upload stats + admin platform-wide stats with Recharts), optional email notification toggle, dark mode (default), toast notifications (react-hot-toast), responsive mobile + desktop.
- **Admin**: A simple `is_admin` flag on profiles gates the admin analytics dashboard and allows deleting any user's content. Uploading is open to all logged-in users.

## Getting Started

The dev server runs automatically in this environment — no need to start it manually.

### Environment

Supabase credentials are pre-populated in `.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Database

The schema is applied via a Supabase migration. Tables created:
- `profiles` — display name, avatar, admin flag, email-notify toggle
- `media` — unified class/movie records with storage paths, views, downloads
- `comments`, `ratings`, `watch_history`, `favorites`

Row Level Security is enabled on every table with ownership-scoped policies.

### Storage buckets

Two public buckets are created automatically:
- `media-videos` — uploaded video files (permanent cloud storage)
- `media-posters` — poster images / auto-captured thumbnails

### Making a user an admin

By default all users are non-admin. To grant admin privileges to a user (for the analytics dashboard and content moderation), run this in the Supabase SQL editor:

```sql
UPDATE public.profiles SET is_admin = true WHERE id = '<user-uuid>';
```

### Email notifications

The `notify-upload` edge function is deployed. It looks up users with `email_notify = true` and logs a notification intent. To actually send emails, configure an email provider secret (e.g. `RESEND_API_KEY`) in the Supabase project and add the sending call in `supabase/functions/notify-upload/index.ts`.

## Upload Architecture — TUS Resumable Chunked Uploads

Videos are uploaded to Supabase Storage using the **TUS resumable upload protocol** via `tus-js-client`. This is Supabase's officially recommended method for uploading large files: https://supabase.com/docs/guides/storage/uploads/resumable-uploads

### How it works

1. The browser breaks the file into **5 MB chunks** and uploads them sequentially to Supabase's TUS endpoint (`/storage/v1/upload/resumable`).
2. Each chunk is sent as a separate HTTP request, so there's no single massive POST body that could hit size limits.
3. The TUS protocol tracks upload progress server-side, so if the connection drops, the upload can **resume from where it left off** without restarting from zero.
4. Real progress events fire on each chunk — the UI shows percentage, speed (MB/s), and ETA.
5. The upload is **user-cancelable** via an `AbortController` wired to an on-screen Cancel button.
6. Only AFTER the TUS upload completes (all chunks confirmed) does the app create the database record with the file path. If the upload fails, no database record is created.

### Why not a single POST?

The previous version used a single XHR POST to upload the entire file at once. On large files (100 MB+), this can fail with "object exceeded the maximum allowed size" because:
- The Supabase platform's global file size limit applies to the total file, and on the Free plan this is capped at 50 MB per file.
- A single large POST body can hit platform-level body-size limits before the file is fully received.

TUS chunked uploads avoid the body-size issue by sending 5 MB pieces. However, **the platform's global per-file size limit still applies** — see below.

### File size limits

| Layer | Limit | Where it's set |
|-------|-------|----------------|
| Frontend validation | 5 GB | `MAX_FILE_SIZE` in `src/lib/media-utils.ts` |
| Upload UI label | "5 GB" | `MAX_FILE_SIZE_LABEL` in `src/lib/media-utils.ts` |
| Supabase Free plan | **50 MB per file** | Supabase dashboard → Storage Settings → Global file size limit |
| Supabase Pro plan | **500 GB per file** | Supabase dashboard → Storage Settings → Global file size limit |
| Supabase Storage bucket | No per-bucket limit (platform default applies) | `storage.buckets` row for `media-videos` |
| Class recording duration | 2 hours | `CLASS_MAX_DURATION` in `src/lib/media-utils.ts` |

### IMPORTANT: Increasing the Supabase file size limit

If you need to upload files larger than 50 MB (the Free plan default), you must either:

1. **Upgrade to Supabase Pro** ($25/month) — raises the per-file limit to 500 GB. Then go to Dashboard → Storage → Settings → Global file size limit and set it to your desired maximum.
2. **Stay on Free but keep files under 50 MB** — the app will work, but large videos will be rejected with a clear error message explaining the limit.

The error message in the app will tell you exactly what happened: `"File too large for storage. Your Supabase plan may have a per-file size limit (Free: 50 MB, Pro: 500 GB). This file is X.X MB."`

### Reverse proxy note (Nginx)

If you deploy this app behind Nginx or another reverse proxy, increase the proxy's body size limit:

```nginx
client_max_body_size 5g;
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```

### Persistence guarantee

Uploaded files are stored in Supabase Storage (managed cloud object storage on Supabase's servers). The exact storage path (e.g. `{user-id}/video-{timestamp}-{rand}.mp4`) is saved in the `media` table's `video_path` column in the PostgreSQL database. The public URL is derived from this path. Files persist permanently across server restarts, page refreshes, and redeployments — they live in cloud storage, not in any temp directory or browser storage.

### Upload flow (end to end)

1. User selects a video file (accept: mp4, mov, avi, mkv, webm, mpeg, m4v)
2. Frontend validates file type (MIME + extension) and size (≤ 5 GB)
3. For class recordings: browser reads video metadata to check duration ≤ 2 hours — rejects with clear message if exceeded
4. User clicks Upload → TUS client starts chunked upload to Supabase Storage (5 MB chunks)
5. Progress bar shows percentage, speed (MB/s), and ETA in real time
6. Upload button is locked; Cancel button available; metadata form is disabled
7. Only after TUS confirms 100% upload complete:
   - Poster image is uploaded (user-provided or auto-captured from video via canvas)
   - Database record is created in the `media` table with the file path, metadata, and duration
8. "Upload complete! Redirecting…" shows for 1.5 seconds, then navigates to the video's player page
9. If any step fails, the app stays on the upload page with a specific error toast — no redirect

### Streaming & download

- **Streaming**: The video player uses the Supabase Storage public URL, which supports HTTP Range requests for smooth seeking (skip to any point without downloading the whole file first).
- **Download**: The download button fetches the file as a blob and triggers a real browser download with the correct filename.
- **Home/Library pages**: Fetch the media list fresh from the database on every page load via `supabase.from('media').select(...)` — newly uploaded videos appear immediately for all users.

## Project Structure

```
src/
├── components/      # Reusable UI (Navbar, MediaCard, SearchBar, StarRating, etc.)
├── context/         # AuthContext, ThemeContext (dark mode — localStorage for theme string only)
├── lib/              # supabase client, types, media-service, upload-service, utils
├── pages/            # Home, Library, Login, Signup, Upload, Player, Watchlist, Profile, Analytics
├── App.tsx           # Router + providers + Toaster
└── main.tsx          # Entry point
supabase/functions/notify-upload/   # Edge function for upload notifications
```

## Scripts

- `npm run build` — production build
- `npm run typecheck` — TypeScript type checking
- `npm run lint` — ESLint

## Assumptions

1. **Storage**: Supabase Storage (public buckets on Supabase's hosted servers) — videos are publicly readable for streaming; uploads require authentication. Files persist permanently (managed cloud storage, not local disk). The app requires this real backend to function — it cannot run as a frontend-only or browser-storage-only app.
2. **File size limit**: The Free Supabase plan caps individual file uploads at 50 MB. To upload larger videos, upgrade to Pro (500 GB limit) and increase the global file size limit in Storage Settings.
3. **Email notifications**: Off by default per user (opt-in via profile toggle). The edge function logs intents rather than sending real emails until an email provider secret is configured.
4. **Duration check**: Performed client-side using the browser's HTML5 video metadata API (replacing ffprobe, which isn't available in this environment).
5. **Thumbnail generation**: Done client-side via canvas frame capture (replacing ffmpeg).
6. **Rate limiting**: Supabase Auth has built-in brute-force protection on login/signup.
7. **Admin role**: Minimal — only for the analytics dashboard and deleting any user's content. Uploading is open to every logged-in user.
8. **Chunked uploads**: Uses TUS resumable protocol (tus-js-client) with 5 MB chunks, as recommended by Supabase docs for large file uploads.
