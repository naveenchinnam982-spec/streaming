import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { fetchVideos, deleteVideo } from '@/lib/video-service';
import { Video } from '@/lib/types';
import { VideoCard, VideoCardSkeleton } from '@/components/VideoCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { formatViews } from '@/lib/format';
import toast from 'react-hot-toast';
import { Film, Eye, Upload, Trash2, User as UserIcon } from 'lucide-react';

export function ProfilePage() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVideos({ userId: user.id, sort: 'newest', limit: 100 });
      setVideos(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load your videos');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const totalViews = videos.reduce((s, v) => s + v.views, 0);
  const totalLikes = videos.reduce((s, v) => s + v.likes, 0);

  const handleDelete = async () => {
    const video = videos.find((v) => v.id === confirmDeleteId);
    if (!video) return;
    try {
      await deleteVideo(video);
      setVideos((prev) => prev.filter((v) => v.id !== video.id));
      toast.success('Video deleted');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete video');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Profile header */}
        <div className="card flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-start">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-white">
            <UserIcon className="h-10 w-10" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold">
              {user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'}
            </h1>
            <p className="text-sm text-gray-500">{user.email}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-4 sm:justify-start">
              <StatCard icon={<Film className="h-5 w-5" />} label="Uploads" value={videos.length.toString()} />
              <StatCard icon={<Eye className="h-5 w-5" />} label="Total Views" value={formatViews(totalViews)} />
              <StatCard icon={<Upload className="h-5 w-5" />} label="Total Likes" value={formatViews(totalLikes)} />
            </div>
          </div>
          <Link to="/upload" className="btn-primary">
            <Upload className="h-4 w-4" /> Upload
          </Link>
        </div>
      </motion.div>

      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

      {/* Uploaded videos */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Your Uploaded Videos</h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => <VideoCardSkeleton key={i} />)}
          </div>
        ) : videos.length === 0 ? (
          <EmptyState
            title="No videos uploaded yet"
            description="Upload your first video to see it here."
            icon={<Film className="h-12 w-12" />}
            action={<Link to="/upload" className="btn-primary"><Upload className="h-4 w-4" /> Upload a video</Link>}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {videos.map((v, i) => (
              <div key={v.id} className="relative group">
                <VideoCard video={v} index={i} />
                <button
                  onClick={() => setConfirmDeleteId(v.id)}
                  className="absolute top-2 right-2 z-10 rounded-lg bg-error-600/90 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  title="Delete video"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmDeleteId(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Delete this video?</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This will permanently remove the video and its thumbnail. This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteId(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleDelete} className="btn-danger">Delete</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 dark:border-gray-800">
      <div className="text-brand-600 dark:text-brand-400">{icon}</div>
      <div>
        <div className="text-lg font-bold leading-none">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}
