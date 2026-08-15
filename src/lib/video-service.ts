import { supabase, VIDEO_BUCKET, THUMBNAIL_BUCKET } from '@/lib/supabase';
import {
  buildVideoStoragePath,
  buildThumbnailStoragePath,
  extractStoragePath,
  getVideoPublicUrl,
  getThumbnailPublicUrl,
  deleteVideoFile,
  deleteThumbnailFile,
} from '@/lib/storage';
import { Video, VideoInput, VideoUpdate, SortOption } from '@/lib/types';

function getSortColumn(sort: SortOption): { column: string; ascending: boolean } {
  switch (sort) {
    case 'oldest':
      return { column: 'created_at', ascending: true };
    case 'trending':
      return { column: 'views', ascending: false };
    case 'views':
      return { column: 'views', ascending: false };
    case 'newest':
    default:
      return { column: 'created_at', ascending: false };
  }
}

export async function fetchVideos(opts: {
  search?: string;
  category?: string;
  sort?: SortOption;
  limit?: number;
  offset?: number;
  userId?: string;
}): Promise<Video[]> {
  const { search = '', category = '', sort = 'newest', limit = 24, offset = 0, userId } = opts;
  let query = supabase.from('videos').select('*').eq('status', 'ready');

  if (userId) {
    query = query.eq('user_id', userId);
  }

  if (category && category !== 'All') {
    query = query.eq('category', category);
  }

  if (search.trim()) {
    const s = search.trim();
    query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%,category.ilike.%${s}%`);
  }

  const { column, ascending } = getSortColumn(sort);
  query = query.order(column, { ascending }).range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Video[];
}

export async function fetchVideoById(id: string): Promise<Video | null> {
  const { data, error } = await supabase.from('videos').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Video | null;
}

export async function fetchRelatedVideos(video: Video, limit = 6): Promise<Video[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('status', 'ready')
    .neq('id', video.id)
    .order('views', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Video[];
}

export async function createVideo(input: VideoInput): Promise<Video> {
  const { data, error } = await supabase
    .from('videos')
    .insert({
      title: input.title,
      description: input.description || null,
      category: input.category,
      thumbnail_url: input.thumbnail_url,
      thumbnail_path: input.thumbnail_path,
      video_url: input.video_url,
      video_path: input.video_path,
      file_name: input.file_name,
      file_size: input.file_size,
      mime_type: input.mime_type,
      duration: input.duration,
      status: input.status,
    })
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as Video;
}

export async function updateVideo(id: string, updates: VideoUpdate): Promise<Video> {
  const { data, error } = await supabase
    .from('videos')
    .update(updates)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as Video;
}

export async function deleteVideo(video: Video): Promise<void> {
  // Delete thumbnail from storage
  if (video.thumbnail_path) {
    await deleteThumbnailFile(video.thumbnail_path).catch(() => {});
  } else if (video.thumbnail_url) {
    const thumbPath = extractStoragePath(video.thumbnail_url, THUMBNAIL_BUCKET);
    if (thumbPath) await deleteThumbnailFile(thumbPath).catch(() => {});
  }

  // Delete video from storage
  if (video.video_path) {
    await deleteVideoFile(video.video_path).catch(() => {});
  } else if (video.video_url) {
    const vPath = extractStoragePath(video.video_url, VIDEO_BUCKET);
    if (vPath) await deleteVideoFile(vPath).catch(() => {});
  }

  // Delete the database row
  const { error } = await supabase.from('videos').delete().eq('id', video.id);
  if (error) throw error;
}

export async function incrementViews(videoId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_video_views', { p_video_id: videoId });
  if (error) throw error;
}

export {
  buildVideoStoragePath,
  buildThumbnailStoragePath,
  getVideoPublicUrl,
  getThumbnailPublicUrl,
};
