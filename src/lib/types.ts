export type VideoStatus = 'processing' | 'ready' | 'failed';

export interface Video {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string | null;
  thumbnail_url: string | null;
  thumbnail_path: string | null;
  video_url: string;
  video_path: string | null;
  file_name: string | null;
  file_size: number;
  mime_type: string | null;
  duration: number;
  status: VideoStatus;
  views: number;
  likes: number;
  created_at: string;
  updated_at: string;
}

export interface VideoInput {
  title: string;
  description: string;
  category: string;
  thumbnail_url: string | null;
  thumbnail_path: string | null;
  video_url: string;
  video_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  duration: number;
  status: VideoStatus;
}

export interface VideoUpdate {
  title?: string;
  description?: string;
  category?: string;
  thumbnail_url?: string | null;
  thumbnail_path?: string | null;
  status?: VideoStatus;
}

export type SortOption = 'newest' | 'oldest' | 'trending' | 'views';

export interface VideoFilters {
  search: string;
  category: string;
  sort: SortOption;
}

export const CATEGORIES = [
  'Action',
  'Comedy',
  'Documentary',
  'Drama',
  'Education',
  'Entertainment',
  'Horror',
  'Music',
  'Sci-Fi',
  'Thriller',
  'Other',
] as const;

export const ACCEPTED_VIDEO_TYPES = [
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
];

export const ACCEPTED_VIDEO_EXTS = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'mpeg', 'm4v', 'flv', '3gp', 'wmv'];

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// No artificial frontend size limit.
// The effective limit is the Supabase Storage plan's quota.
// Resumable uploads send the file in 6MB chunks, so even multi-GB files work.
export const MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024; // 5 MB
