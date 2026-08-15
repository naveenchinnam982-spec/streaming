import { supabase, VIDEO_BUCKET, THUMBNAIL_BUCKET } from '@/lib/supabase';

/**
 * Extract the storage object path from a Supabase public URL.
 * Returns null if the URL does not match the expected public URL pattern.
 */
export function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.substring(idx + marker.length));
}

/**
 * Build a clean, controlled storage path for a video file.
 * Format: {userId}/{timestamp}-{random}/{safeFileName}
 * Using a per-upload folder avoids duplicate-filename collisions and
 * keeps each user's uploads organized. The original filename is sanitized
 * and preserved so files are identifiable in Storage.
 */
export function buildVideoStoragePath(userId: string, fileName: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  const safeName = sanitizeFileName(fileName);
  return `${userId}/${ts}-${rand}/${safeName}`;
}

/**
 * Build a clean storage path for a thumbnail.
 * Format: {userId}/{timestamp}-{random}/{safeFileName}
 */
export function buildThumbnailStoragePath(userId: string, fileName: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  const safeName = sanitizeFileName(fileName);
  return `${userId}/${ts}-${rand}/${safeName}`;
}

/**
 * Sanitize a filename for safe use as a Storage object path.
 * Removes path separators, collapses spaces, and keeps only safe characters.
 */
function sanitizeFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || 'mp4';
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 60) || 'video';
  return `${base}.${ext}`;
}

export function getVideoPublicUrl(path: string): string {
  const { data } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function getThumbnailPublicUrl(path: string): string {
  const { data } = supabase.storage.from(THUMBNAIL_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete a file from the videos bucket by its storage path.
 * Silently succeeds if the path is null.
 */
export async function deleteVideoFile(path: string | null): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(VIDEO_BUCKET).remove([path]);
  if (error) throw error;
}

/**
 * Delete a file from the thumbnails bucket by its storage path.
 * Silently succeeds if the path is null.
 */
export async function deleteThumbnailFile(path: string | null): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(THUMBNAIL_BUCKET).remove([path]);
  if (error) throw error;
}
