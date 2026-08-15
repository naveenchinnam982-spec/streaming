import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { fetchVideos } from '@/lib/video-service';
import { Video } from '@/lib/types';
import { VideoCard, VideoCardSkeleton } from '@/components/VideoCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useAuth } from '@/context/AuthContext';
import { Play, Upload, Film, TrendingUp, Eye, Clock, Tag } from 'lucide-react';
import { formatViews, formatDate } from '@/lib/format';

export function HomePage() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVideos({ sort: 'newest', limit: 50 });
      setVideos(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: auto-update when any user uploads/deletes a video
  useEffect(() => {
    const channel = supabase
      .channel('videos-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'videos' }, (payload) => {
        setVideos((prev) => {
          const newVideo = payload.new as Video;
          if (newVideo.status !== 'ready') return prev;
          if (prev.some((v) => v.id === newVideo.id)) return prev;
          return [newVideo, ...prev];
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'videos' }, (payload) => {
        setVideos((prev) => prev.filter((v) => v.id !== (payload.old as Video).id));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'videos' }, (payload) => {
        setVideos((prev) => prev.map((v) => (v.id === (payload.new as Video).id ? (payload.new as Video) : v)));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const heroVideo = videos[0];
  const trending = [...videos].sort((a, b) => b.views - a.views).slice(0, 10);
  const recent = videos.slice(0, 10);

  return (
    <div className="space-y-10">
      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

      {/* Hero */}
      {loading ? (
        <div className="skeleton h-[300px] rounded-2xl sm:h-[400px]" />
      ) : heroVideo ? (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl"
        >
          <div className="relative h-[300px] sm:h-[400px]">
            {heroVideo.thumbnail_url && (
              <img
                src={heroVideo.thumbnail_url}
                alt={heroVideo.title}
                className="h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
              <div className="max-w-2xl">
                {heroVideo.category && (
                  <span className="badge mb-3 bg-brand-600 text-white">
                    <Tag className="mr-1 h-3 w-3" /> {heroVideo.category}
                  </span>
                )}
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
                  {heroVideo.title}
                </h1>
                {heroVideo.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-gray-200 sm:text-base">
                    {heroVideo.description}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-4 text-sm text-gray-300">
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4" /> {formatViews(heroVideo.views)} views
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" /> {formatDate(heroVideo.created_at)}
                  </span>
                </div>
                <div className="mt-4 flex gap-3">
                  <Link to={`/watch/${heroVideo.id}`} className="btn-primary bg-white text-brand-700 hover:bg-brand-50">
                    <Play className="h-4 w-4 fill-current" /> Watch now
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      ) : !loading && !error ? (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-8 text-white sm:p-12"
        >
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {user ? 'Start uploading your videos' : 'Watch and share videos'}
            </h1>
            <p className="mt-3 text-brand-100">
              {user
                ? 'Upload your first video to see it appear here instantly.'
                : 'Sign up to upload, share, and stream videos from the community.'}
            </p>
            <div className="mt-5 flex gap-3">
              {user ? (
                <Link to="/upload" className="btn-primary bg-white text-brand-700 hover:bg-brand-50">
                  <Upload className="h-4 w-4" /> Upload a video
                </Link>
              ) : (
                <>
                  <Link to="/signup" className="btn-primary bg-white text-brand-700 hover:bg-brand-50">Get started</Link>
                  <Link to="/login" className="btn-secondary bg-white/10 text-white hover:bg-white/20">Log in</Link>
                </>
              )}
            </div>
          </div>
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-16 right-20 h-64 w-64 rounded-full bg-accent-500/20 blur-3xl" />
        </motion.section>
      ) : null}

      {/* Trending */}
      {trending.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <h2 className="text-xl font-semibold tracking-tight">Trending Now</h2>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => <VideoCardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {trending.map((v, i) => <VideoCard key={v.id} video={v} index={i} />)}
            </div>
          )}
        </motion.section>
      )}

      {/* Recently Added */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <h2 className="text-xl font-semibold tracking-tight">Recently Added</h2>
          </div>
          <Link to="/browse" className="text-sm text-brand-600 hover:text-brand-500 dark:text-brand-400">
            View all
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => <VideoCardSkeleton key={i} />)}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            title="No videos yet"
            description="Be the first to upload a video to the platform."
            icon={<Film className="h-12 w-12" />}
            action={user ? <Link to="/upload" className="btn-primary"><Upload className="h-4 w-4" /> Upload</Link> : null}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {recent.map((v, i) => <VideoCard key={v.id} video={v} index={i} />)}
          </div>
        )}
      </motion.section>
    </div>
  );
}
