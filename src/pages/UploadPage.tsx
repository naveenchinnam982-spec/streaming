import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import {
  ResumableUploadManager,
  UploadProgressInfo,
  UploadState,
  UploadErrorDetail,
  uploadThumbnail,
  getVideoMetadata,
} from '@/lib/upload-service';
import {
  buildVideoStoragePath,
  buildThumbnailStoragePath,
  getVideoPublicUrl,
  getThumbnailPublicUrl,
  createVideo,
} from '@/lib/video-service';
import {
  CATEGORIES, ACCEPTED_VIDEO_EXTS, ACCEPTED_IMAGE_TYPES, MAX_THUMBNAIL_SIZE,
} from '@/lib/types';
import { getExt, formatBytes, formatSpeed, formatEta } from '@/lib/format';
import { ErrorBanner } from '@/components/ErrorBanner';
import toast from 'react-hot-toast';
import {
  UploadCloud, Film, Image as ImageIcon, Loader2, X, AlertCircle,
  Play, Pause, RotateCw, XCircle, CheckCircle2, Eye, Clock,
  ChevronDown, ChevronUp, Server,
} from 'lucide-react';

export function UploadPage() {
  const { user } = useAuth();
  const nav = useNavigate();

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);

  // File selections
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<{ duration: number; width: number; height: number } | null>(null);

  // Upload state
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState<UploadProgressInfo | null>(null);
  const [errorDetail, setErrorDetail] = useState<UploadErrorDetail | null>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const managerRef = useRef<ResumableUploadManager | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const videoPathRef = useRef<string>('');

  const handleVideoSelect = useCallback(async (file: File) => {
    setErrorDetail(null);
    const ext = getExt(file.name);
    if (!ACCEPTED_VIDEO_EXTS.includes(ext)) {
      setErrorDetail({
        userMessage: `Unsupported video format: .${ext}. Supported: ${ACCEPTED_VIDEO_EXTS.map((e) => `.${e}`).join(', ')}`,
        technicalMessage: `File extension ".${ext}" not in accepted list`,
      });
      return;
    }
    setVideoFile(file);
    setVideoMeta(null);
    try {
      const meta = await getVideoMetadata(file);
      setVideoMeta(meta);
    } catch (e) {
      void e;
    }
  }, []);

  const handleThumbSelect = (file: File) => {
    setErrorDetail(null);
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setErrorDetail({
        userMessage: 'Unsupported image format. Use JPG, PNG, WebP, or GIF.',
        technicalMessage: `MIME type "${file.type}" not in accepted image types`,
      });
      return;
    }
    if (file.size > MAX_THUMBNAIL_SIZE) {
      setErrorDetail({
        userMessage: `Thumbnail too large (${formatBytes(file.size)}). Maximum is ${formatBytes(MAX_THUMBNAIL_SIZE)}.`,
        technicalMessage: `Thumbnail file size ${file.size} bytes exceeds limit ${MAX_THUMBNAIL_SIZE} bytes`,
      });
      return;
    }
    setThumbFile(file);
    setThumbPreview(URL.createObjectURL(file));
  };

  const startUpload = useCallback(async () => {
    if (!user || !videoFile || !title.trim()) return;

    setSubmitting(true);
    setErrorDetail(null);
    setShowTechDetails(false);

    // 1. Upload thumbnail first (small, standard upload)
    let thumbnailUrl: string | null = null;
    let thumbnailPath: string | null = null;
    if (thumbFile) {
      try {
        thumbnailPath = buildThumbnailStoragePath(user.id, thumbFile.name);
        await uploadThumbnail(thumbnailPath, thumbFile);
        thumbnailUrl = getThumbnailPublicUrl(thumbnailPath);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Thumbnail upload failed.';
        setErrorDetail({
          userMessage: msg,
          technicalMessage: e instanceof Error ? e.stack || e.message : String(e),
          bucket: 'thumbnails',
          filePath: thumbnailPath ?? undefined,
        });
        setSubmitting(false);
        return;
      }
    }

    // 2. Build the storage path for the video
    const videoPath = buildVideoStoragePath(user.id, videoFile.name);
    videoPathRef.current = videoPath;

    // 3. Detect content type (browsers sometimes report videos as application/octet-stream)
    const videoExt = getExt(videoFile.name) || 'mp4';
    const mimeType = videoFile.type && videoFile.type !== 'application/octet-stream'
      ? videoFile.type
      : `video/${videoExt}`;

    // 4. Create the resumable upload manager
    const manager = new ResumableUploadManager()
      .onProgress((info) => setProgress(info))
      .onStateChange((state) => setUploadState(state))
      .onError((detail) => {
        setErrorDetail(detail);
        setShowTechDetails(false);
        setSubmitting(false);
      })
      .onComplete(async () => {
        // 5. Upload complete — save metadata to database
        try {
          const videoUrl = getVideoPublicUrl(videoPath);
          await createVideo({
            title: title.trim(),
            description: description.trim(),
            category,
            thumbnail_url: thumbnailUrl,
            thumbnail_path: thumbnailPath,
            video_url: videoUrl,
            video_path: videoPath,
            file_name: videoFile.name,
            file_size: videoFile.size,
            mime_type: mimeType,
            duration: videoMeta?.duration ?? 0,
            status: 'ready',
          });
          toast.success('Upload complete! Your video is now live.');
          nav('/');
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed to save video metadata.';
          setErrorDetail({
            userMessage: msg,
            technicalMessage: e instanceof Error ? e.stack || e.message : String(e),
            bucket: 'videos',
            filePath: videoPath,
            lastUploadedBytes: videoFile.size,
            totalBytes: videoFile.size,
          });
          setUploadState('error');
          setSubmitting(false);
        }
      });

    managerRef.current = manager;
    await manager.start(videoPath, videoFile);
    setSubmitting(false);
  }, [user, videoFile, title, description, category, thumbFile, videoMeta, nav]);

  const handlePause = () => managerRef.current?.pause();
  const handleResume = () => managerRef.current?.resume();
  const handleCancel = () => {
    managerRef.current?.cancel();
    setProgress(null);
    setUploadState('idle');
    setSubmitting(false);
  };
  const handleRetry = () => {
    setErrorDetail(null);
    setShowTechDetails(false);
    managerRef.current?.retry();
  };

  const isUploading = uploadState === 'uploading';
  const isPaused = uploadState === 'paused';
  const isError = uploadState === 'error';
  const isCompleted = uploadState === 'completed';
  const canStart = videoFile && title.trim() && !isUploading && !isPaused && !submitting && !isCompleted;

  const resetAll = () => {
    handleCancel();
    setVideoFile(null);
    setThumbFile(null);
    setThumbPreview(null);
    setVideoMeta(null);
    setTitle('');
    setDescription('');
    setProgress(null);
    setUploadState('idle');
    setErrorDetail(null);
    setShowTechDetails(false);
    videoPathRef.current = '';
  };

  return (
    <div className="mx-auto max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-2xl font-bold">Upload a Video</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Supports large multi-GB video files. Uploads are resumable — if your connection drops, you can resume without losing progress.
          </p>
        </div>

        {/* Error display with technical details */}
        {errorDetail && (
          <div className="space-y-3">
            <ErrorBanner
              message={errorDetail.userMessage}
              onClose={() => setErrorDetail(null)}
            />
            {isError && (
              <div className="rounded-lg border border-error-500/30 bg-error-500/5 p-4">
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleRetry} className="btn-primary text-sm">
                    <RotateCw className="h-4 w-4" /> Retry / Resume
                  </button>
                  <button onClick={handleCancel} className="btn-danger text-sm">
                    <XCircle className="h-4 w-4" /> Cancel
                  </button>
                </div>
                {/* Technical error details */}
                <div className="mt-3 border-t border-error-500/20 pt-3">
                  <button
                    onClick={() => setShowTechDetails(!showTechDetails)}
                    className="flex items-center gap-1 text-xs font-medium text-error-600 dark:text-error-500"
                  >
                    <Server className="h-3.5 w-3.5" />
                    {showTechDetails ? 'Hide' : 'Show'} technical details
                    {showTechDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  <AnimatePresence>
                    {showTechDetails && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 overflow-hidden"
                      >
                        <div className="space-y-1 rounded-md bg-gray-900 p-3 font-mono text-xs text-gray-300 dark:bg-black/50">
                          <DetailRow label="Error Message" value={errorDetail.technicalMessage} />
                          {errorDetail.httpStatus !== undefined && (
                            <DetailRow label="HTTP Status" value={String(errorDetail.httpStatus)} />
                          )}
                          {errorDetail.errorCode && (
                            <DetailRow label="Error Code" value={errorDetail.errorCode} />
                          )}
                          {errorDetail.endpoint && (
                            <DetailRow label="Storage Endpoint" value={errorDetail.endpoint} />
                          )}
                          {errorDetail.bucket && (
                            <DetailRow label="Bucket" value={errorDetail.bucket} />
                          )}
                          {errorDetail.filePath && (
                            <DetailRow label="File Path" value={errorDetail.filePath} />
                          )}
                          {errorDetail.lastUploadedBytes !== undefined && (
                            <DetailRow label="Last Uploaded" value={formatBytes(errorDetail.lastUploadedBytes)} />
                          )}
                          {errorDetail.totalBytes !== undefined && (
                            <DetailRow label="Total Size" value={formatBytes(errorDetail.totalBytes)} />
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Video file drop zone */}
        <div className="card p-6">
          <label className="mb-2 block text-sm font-medium">Video File</label>
          {!videoFile ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleVideoSelect(f);
              }}
              onClick={() => !isUploading && videoInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 transition-colors ${
                dragOver
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-gray-300 hover:border-brand-400 dark:border-gray-700'
              }`}
            >
              <UploadCloud className="h-10 w-10 text-gray-400" />
              <p className="mt-2 text-sm font-medium">Drag & drop your video here</p>
              <p className="mt-1 text-xs text-gray-500">
                or click to browse — supports multi-GB files
              </p>
              <p className="mt-2 text-xs text-gray-400">
                {ACCEPTED_VIDEO_EXTS.map((e) => `.${e}`).join(', ')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                  <Film className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{videoFile.name}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span>{formatBytes(videoFile.size)}</span>
                    {videoMeta && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{Math.floor(videoMeta.duration / 60)}m {videoMeta.duration % 60}s</span>}
                    {videoMeta && <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{videoMeta.width}×{videoMeta.height}</span>}
                  </div>
                </div>
                {!isUploading && !isPaused && (
                  <button
                    onClick={() => { setVideoFile(null); setVideoMeta(null); }}
                    className="rounded p-1 text-gray-400 hover:text-error-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          )}
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleVideoSelect(f);
            }}
          />
        </div>

        {/* Thumbnail upload */}
        <div className="card p-6">
          <label className="mb-2 block text-sm font-medium">Thumbnail (optional)</label>
          <div className="flex items-center gap-4">
            <div
              onClick={() => !isUploading && thumbInputRef.current?.click()}
              className="flex h-28 w-48 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
            >
              {thumbPreview ? (
                <img src={thumbPreview} alt="Thumbnail preview" className="h-full w-full object-cover" />
              ) : (
                <div className="text-center">
                  <ImageIcon className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-1 text-xs text-gray-500">Click to select</p>
                </div>
              )}
            </div>
            {thumbFile && (
              <button
                onClick={() => { setThumbFile(null); setThumbPreview(null); }}
                className="btn-secondary text-sm"
                disabled={isUploading || isPaused}
              >
                <X className="h-4 w-4" /> Remove
              </button>
            )}
          </div>
          <input
            ref={thumbInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleThumbSelect(f);
            }}
          />
        </div>

        {/* Metadata */}
        <div className="card space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="Enter video title"
              disabled={isUploading || isPaused}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="input resize-none"
              placeholder="Describe your video"
              disabled={isUploading || isPaused}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input"
              disabled={isUploading || isPaused}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Upload progress dashboard */}
        <AnimatePresence>
          {(isUploading || isPaused || isError || isCompleted) && progress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="card overflow-hidden p-6"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isUploading && <Loader2 className="h-5 w-5 animate-spin text-brand-500" />}
                  {isPaused && <Pause className="h-5 w-5 text-accent-500" />}
                  {isError && <AlertCircle className="h-5 w-5 text-error-500" />}
                  {isCompleted && <CheckCircle2 className="h-5 w-5 text-success-500" />}
                  <span className="font-medium">
                    {isUploading && 'Uploading video…'}
                    {isPaused && 'Upload paused'}
                    {isError && 'Upload failed'}
                    {isCompleted && 'Upload complete'}
                  </span>
                </div>
                <span className="tabular-nums text-lg font-bold">{progress.pct}%</span>
              </div>

              {/* Progress bar */}
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isError ? 'bg-error-500' : isCompleted ? 'bg-success-500' : 'bg-brand-500'
                  }`}
                  style={{ width: `${progress.pct}%` }}
                />
              </div>

              {/* Stats grid */}
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <Stat label="Uploaded" value={`${formatBytes(progress.loadedBytes)} / ${formatBytes(progress.totalBytes)}`} />
                <Stat label="Speed" value={formatSpeed(progress.speedBps)} />
                <Stat label="Remaining" value={formatEta(progress.etaSeconds)} />
                <Stat label="File" value={videoFile?.name ? truncate(videoFile.name, 18) : '—'} title={videoFile?.name} />
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex flex-wrap gap-2">
                {isUploading && (
                  <button onClick={handlePause} className="btn-secondary text-sm">
                    <Pause className="h-4 w-4" /> Pause
                  </button>
                )}
                {isPaused && (
                  <button onClick={handleResume} className="btn-primary text-sm">
                    <Play className="h-4 w-4 fill-current" /> Resume
                  </button>
                )}
                {isError && (
                  <button onClick={handleRetry} className="btn-primary text-sm">
                    <RotateCw className="h-4 w-4" /> Retry / Resume
                  </button>
                )}
                {(isUploading || isPaused || isError) && (
                  <button onClick={handleCancel} className="btn-danger text-sm">
                    <XCircle className="h-4 w-4" /> Cancel
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <div className="flex items-center gap-3">
          {!isCompleted && (
            <button onClick={startUpload} className="btn-primary" disabled={!canStart}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {submitting ? 'Starting…' : 'Upload video'}
            </button>
          )}
          {isCompleted && (
            <button onClick={resetAll} className="btn-secondary">
              Upload another
            </button>
          )}
          <button onClick={() => nav('/')} className="btn-ghost">Cancel</button>
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="truncate font-medium" title={title}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500">{label}:</span>
      <span className="break-all text-gray-200">{value}</span>
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + '…' : s;
}
