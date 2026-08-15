import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Eye, Clock, Tag } from 'lucide-react';
import { Video } from '@/lib/types';
import { formatDuration, formatViews, formatDate } from '@/lib/format';

interface Props {
  video: Video;
  index?: number;
}

export function VideoCard({ video, index = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
    >
      <Link
        to={`/watch/${video.id}`}
        className="card group block overflow-hidden transition-all duration-300 hover:shadow-xl hover:ring-1 hover:ring-brand-400/50"
      >
        <div className="relative aspect-video bg-gray-800 dark:bg-gray-900">
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
              <Play className="h-12 w-12 text-gray-600" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600/90 text-white shadow-lg backdrop-blur-sm">
              <Play className="h-6 w-6 fill-current" />
            </div>
          </div>
          <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {formatDuration(video.duration)}
          </div>
          {video.category && (
            <div className="absolute top-2 left-2">
              <span className="badge bg-brand-600/90 text-white backdrop-blur-sm">
                <Tag className="mr-1 h-3 w-3" />
                {video.category}
              </span>
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="line-clamp-2 font-semibold text-sm leading-snug">{video.title}</h3>
          {video.description && (
            <p className="mt-1 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
              {video.description}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(video.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatViews(video.views)}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-video" />
      <div className="p-3">
        <div className="skeleton mb-2 h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="mt-2 flex justify-between">
          <div className="skeleton h-3 w-16 rounded" />
          <div className="skeleton h-3 w-12 rounded" />
        </div>
      </div>
    </div>
  );
}
