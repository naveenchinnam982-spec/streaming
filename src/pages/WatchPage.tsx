import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchVideoById, fetchRelatedVideos, incrementViews, deleteVideo } from '@/lib/video-service';
import { Video } from '@/lib/types';

import { ErrorBanner } from '@/components/ErrorBanner';
import { useAuth } from '@/context/AuthContext';
import { formatDuration, formatViews, formatDate } from '@/lib/format';
import toast from 'react-hot-toast';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Settings, ArrowLeft,
  Eye, Clock, Tag, Trash2, Pencil, Loader2, PictureInPicture2,
} from 'lucide-react';

export function WatchPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const nav = useNavigate();

  const [video, setVideo] = useState<Video | null>(null);
  const [related, setRelated] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const v = await fetchVideoById(id);
      if (!v) {
        setError('Video not found');
        return;
      }
      setVideo(v);
      const rel = await fetchRelatedVideos(v);
      setRelated(rel);
      // Increment view count
      await incrementViews(id).catch(() => {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load video');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Video player handlers
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const val = parseFloat(e.target.value);
    v.volume = val;
    v.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const val = parseFloat(e.target.value);
    v.currentTime = (val / 100) * v.duration;
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setCurrent(v.currentTime);
    setProgress((v.currentTime / v.duration) * 100);
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    v.playbackRate = playbackRate;
  };

  const handlePlaybackRate = (rate: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
  };

  const toggleFullscreen = () => {
    const container = videoRef.current?.parentElement;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  };

  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await v.requestPictureInPicture();
      }
    } catch {
      // PiP may not be supported in all browsers
    }
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  };

  const handleDelete = async () => {
    if (!video) return;
    try {
      await deleteVideo(video);
      toast.success('Video deleted');
      nav('/');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete video');
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={error || 'Video not found'} />
        <Link to="/" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>
      </div>
    );
  }

  const isOwner = user?.id === video.user_id;

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Player + info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Custom Video Player */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden rounded-xl bg-black"
            onMouseMove={showControlsTemporarily}
            onMouseLeave={() => playing && setShowControls(false)}
          >
            <video
              ref={videoRef}
              src={video.video_url}
              poster={video.thumbnail_url || undefined}
              autoPlay
              onClick={togglePlay}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => { setPlaying(true); setShowControls(false); }}
              onPause={() => { setPlaying(false); setShowControls(true); }}
              onEnded={() => setPlaying(false)}
              className="aspect-video w-full"
            />

            {/* Controls overlay */}
            <div
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
            >
              {/* Progress bar */}
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={handleSeek}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/30 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-500"
              />

              <div className="mt-2 flex items-center gap-3 text-white">
                <button onClick={togglePlay} className="rounded p-1 hover:bg-white/20">
                  {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
                </button>

                <button onClick={toggleMute} className="rounded p-1 hover:bg-white/20">
                  {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/30 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />

                <span className="text-xs tabular-nums">
                  {formatDuration(current)} / {formatDuration(duration)}
                </span>

                <div className="ml-auto flex items-center gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setShowSettings((v) => !v)}
                      className="rounded p-1 hover:bg-white/20"
                    >
                      <Settings className="h-5 w-5" />
                    </button>
                    {showSettings && (
                      <div className="absolute bottom-10 right-0 w-32 rounded-lg bg-gray-900/95 p-2 shadow-xl backdrop-blur">
                        <p className="mb-1 text-xs text-gray-400">Speed</p>
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                          <button
                            key={r}
                            onClick={() => handlePlaybackRate(r)}
                            className={`block w-full rounded px-2 py-1 text-left text-xs hover:bg-white/10 ${playbackRate === r ? 'text-brand-400' : 'text-white'}`}
                          >
                            {r}x{r === 1 ? ' (Normal)' : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={togglePiP}
                    className="rounded p-1 hover:bg-white/20"
                    title="Picture in picture"
                  >
                    <PictureInPicture2 className="h-5 w-5" />
                  </button>

                  <button onClick={toggleFullscreen} className="rounded p-1 hover:bg-white/20">
                    <Maximize className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Video info */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1">
                <h1 className="text-xl font-bold sm:text-2xl">{video.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4" /> {formatViews(video.views)} views
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" /> {formatDate(video.created_at)}
                  </span>
                  {video.category && (
                    <span className="flex items-center gap-1">
                      <Tag className="h-4 w-4" /> {video.category}
                    </span>
                  )}
                </div>
              </div>

              {isOwner && (
                <div className="flex items-center gap-2">
                  <Link to={`/edit/${video.id}`} className="btn-secondary">
                    <Pencil className="h-4 w-4" /> Edit
                  </Link>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="btn-danger"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              )}
            </div>

            {video.description && (
              <p className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
                {video.description}
              </p>
            )}
          </motion.div>
        </div>

        {/* Related videos */}
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">Related Videos</h2>
          {related.length === 0 ? (
            <p className="text-sm text-gray-500">No related videos.</p>
          ) : (
            <div className="space-y-3">
              {related.map((v) => (
                <Link
                  key={v.id}
                  to={`/watch/${v.id}`}
                  className="card group flex gap-3 overflow-hidden transition-all hover:shadow-md"
                >
                  <div className="relative aspect-video w-32 flex-shrink-0 overflow-hidden rounded-l-xl bg-gray-800">
                    {v.thumbnail_url ? (
                      <img src={v.thumbnail_url} alt={v.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Play className="h-6 w-6 text-gray-600" />
                      </div>
                    )}
                    <div className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-xs text-white">
                      {formatDuration(v.duration)}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 p-2">
                    <h3 className="line-clamp-2 text-sm font-medium">{v.title}</h3>
                    <p className="mt-1 text-xs text-gray-500">{formatViews(v.views)} views</p>
                    <p className="text-xs text-gray-500">{formatDate(v.created_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmDelete(false)}>
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
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleDelete} className="btn-danger">Delete</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
