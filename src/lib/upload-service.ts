import * as tus from 'tus-js-client';
import { supabase, THUMBNAIL_BUCKET } from '@/lib/supabase';

export interface UploadProgressInfo {
  pct: number;
  loadedBytes: number;
  totalBytes: number;
  speedBps: number;
  etaSeconds: number;
}

export type UploadState = 'idle' | 'uploading' | 'paused' | 'completed' | 'error' | 'cancelled';

export interface UploadErrorDetail {
  userMessage: string;
  technicalMessage: string;
  httpStatus?: number;
  errorCode?: string;
  endpoint?: string;
  bucket?: string;
  filePath?: string;
  lastUploadedBytes?: number;
  totalBytes?: number;
}

/**
 * Map an HTTP status code or error string to a human-readable message.
 */
function mapErrorToMessage(status: number | undefined, rawMsg: string): string {
  if (!status && rawMsg) {
    const lower = rawMsg.toLowerCase();
    if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
      return 'Network error: Could not reach Supabase Storage. Check your internet connection and try again.';
    }
    if (lower.includes('cors')) {
      return 'CORS error: The browser blocked the request to Supabase Storage. This may be a configuration issue.';
    }
    if (lower.includes('timeout')) {
      return 'The upload timed out. You can retry or resume to continue from where it left off.';
    }
  }
  switch (status) {
    case 401:
      return 'Authentication required (401). Your session may have expired — please sign in again, then resume the upload.';
    case 403:
      return 'Permission denied (403). You do not have permission to upload to this bucket. Check that you are signed in and the storage policies allow uploads.';
    case 404:
      return 'Upload endpoint not found (404). The resumable upload URL may have expired (they last 24 hours). Start a new upload.';
    case 409:
      return 'Conflict (409). Another upload to the same file path is already in progress, or the file already exists. Use a different file name or cancel the other upload.';
    case 413:
      return 'File too large (413). The file exceeds the Supabase Storage plan\'s per-file size limit. Check your Supabase project\'s storage limits.';
    case 429:
      return 'Rate limited (429). Too many upload requests. Wait a moment, then resume the upload.';
    case 500:
    case 502:
    case 503:
      return `Server error (${status}). Supabase Storage had a temporary issue. You can retry or resume to continue from where it left off.`;
    default:
      return rawMsg || 'Upload failed. You can retry or resume to continue from where it left off.';
  }
}

/**
 * Extract HTTP status code from a tus-js-client DetailedError or regular Error.
 * tus-js-client errors may contain an `originalResponse` property with a status code.
 */
function extractHttpStatus(error: unknown): { status?: number; rawMsg: string } {
  const err = error as any;
  const rawMsg = err?.message || String(error || 'Upload failed');
  // tus-js-client sometimes wraps the original response
  const status =
    err?.originalResponse?.getStatus?.() ??
    err?.status ??
    err?.response?.status ??
    err?.originalError?.status;
  return { status: typeof status === 'number' ? status : undefined, rawMsg };
}

/**
 * ResumableUploadManager wraps tus-js-client to provide a resumable upload
 * to Supabase Storage's TUS endpoint. It supports:
 *   - real-time progress (percentage, bytes, speed, ETA)
 *   - pause and resume (resumes from where it left off)
 *   - cancel (aborts and discards the upload)
 *   - automatic retry on network errors (via tus retryDelays)
 *   - detailed error diagnostics (HTTP status, endpoint, bucket, etc.)
 *
 * The file is sent directly from the browser to Supabase Storage in 6MB
 * chunks. It is never loaded entirely into memory, never converted to
 * Base64, and never proxied through an application server.
 */
export class ResumableUploadManager {
  private upload: tus.Upload | null = null;
  private state: UploadState = 'idle';
  private onProgressCb?: (info: UploadProgressInfo) => void;
  private onStateChangeCb?: (state: UploadState) => void;
  private onErrorCb?: (detail: UploadErrorDetail) => void;
  private onCompleteCb?: () => void;

  private lastTime = 0;
  private lastLoaded = 0;
  private speedSamples: number[] = [];
  private endpoint = '';
  private bucket = 'videos';
  private filePath = '';
  private totalBytes = 0;
  private lastUploadedBytes = 0;

  onProgress(cb: (info: UploadProgressInfo) => void): this {
    this.onProgressCb = cb;
    return this;
  }

  onStateChange(cb: (state: UploadState) => void): this {
    this.onStateChangeCb = cb;
    return this;
  }

  onError(cb: (detail: UploadErrorDetail) => void): this {
    this.onErrorCb = cb;
    return this;
  }

  onComplete(cb: () => void): this {
    this.onCompleteCb = cb;
    return this;
  }

  getState(): UploadState {
    return this.state;
  }

  private setState(state: UploadState) {
    this.state = state;
    this.onStateChangeCb?.(state);
  }

  /**
   * Start a resumable upload to Supabase Storage.
   *
   * @param path     Storage path inside the videos bucket
   * @param file     The File object from the file input
   */
  async start(path: string, file: File): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const projectIdMatch = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
    const projectId = projectIdMatch?.[1] ?? '';

    if (!projectId) {
      const detail: UploadErrorDetail = {
        userMessage: 'Supabase configuration error: could not extract the project ID from the Supabase URL.',
        technicalMessage: `VITE_SUPABASE_URL does not match expected pattern: ${supabaseUrl}`,
        bucket: this.bucket,
        filePath: path,
      };
      this.setState('error');
      this.onErrorCb?.(detail);
      return;
    }

    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      const detail: UploadErrorDetail = {
        userMessage: 'Could not get your authentication session. Please sign in again.',
        technicalMessage: sessionError.message,
        endpoint: this.endpoint,
        bucket: this.bucket,
        filePath: path,
      };
      this.setState('error');
      this.onErrorCb?.(detail);
      return;
    }

    const accessToken = data.session?.access_token ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string);

    this.endpoint = `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`;
    this.filePath = path;
    this.totalBytes = file.size;
    this.lastUploadedBytes = 0;
    this.lastTime = performance.now();
    this.lastLoaded = 0;
    this.speedSamples = [];

    // Detect the actual content type — browsers sometimes report videos as
    // application/octet-stream, which Supabase may reject. Default to mp4
    // for common video extensions when the browser doesn't provide a type.
    const ext = path.split('.').pop()?.toLowerCase() ?? 'mp4';
    const contentType = file.type && file.type !== 'application/octet-stream'
      ? file.type
      : guessContentTypeFromExt(ext);

    this.upload = new tus.Upload(file, {
      endpoint: this.endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: this.bucket,
        objectName: path,
        contentType,
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024, // MUST be 6MB for Supabase
      onError: (error) => {
        if (this.state === 'cancelled') return;
        const { status, rawMsg } = extractHttpStatus(error);
        const userMessage = mapErrorToMessage(status, rawMsg);
        const detail: UploadErrorDetail = {
          userMessage,
          technicalMessage: rawMsg,
          httpStatus: status,
          errorCode: (error as any)?.originalResponse?.getBody?.()?.code,
          endpoint: this.endpoint,
          bucket: this.bucket,
          filePath: this.filePath,
          lastUploadedBytes: this.lastUploadedBytes,
          totalBytes: this.totalBytes,
        };
        this.setState('error');
        this.onErrorCb?.(detail);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        if (this.state !== 'uploading') return;
        this.lastUploadedBytes = bytesUploaded;
        const now = performance.now();
        const dt = (now - this.lastTime) / 1000;
        const db = bytesUploaded - this.lastLoaded;
        if (dt > 0 && db >= 0) {
          this.speedSamples.push(db / dt);
          if (this.speedSamples.length > 10) this.speedSamples.shift();
          this.lastTime = now;
          this.lastLoaded = bytesUploaded;
        }
        const avgSpeed =
          this.speedSamples.reduce((a, b) => a + b, 0) / Math.max(1, this.speedSamples.length);
        const remaining = bytesTotal - bytesUploaded;
        const eta = avgSpeed > 0 ? remaining / avgSpeed : 0;
        // Use 1 decimal place for small percentages so 6MB/2.4GB shows
        // as 0.3% instead of rounding to 0%.
        const ratio = bytesUploaded / bytesTotal;
        const pct = ratio >= 1 ? 100 : Math.round(ratio * 1000) / 10;
        this.onProgressCb?.({
          pct,
          loadedBytes: bytesUploaded,
          totalBytes: bytesTotal,
          speedBps: avgSpeed,
          etaSeconds: eta,
        });
      },
      onSuccess: () => {
        this.setState('completed');
        this.onCompleteCb?.();
      },
    });

    // Check for an existing resumable upload (fingerprint) — if found,
    // resume it rather than creating a new upload URL.
    try {
      const previousUploads = await this.upload.findPreviousUploads();
      if (previousUploads.length > 0) {
        this.upload.resumeFromPreviousUpload(previousUploads[0]);
      }
    } catch {
      // If fingerprint lookup fails (e.g. localStorage unavailable),
      // proceed with a fresh upload.
    }

    this.setState('uploading');
    this.upload.start();
  }

  /**
   * Pause the current upload. Can be resumed later with resume().
   */
  pause(): void {
    if (this.upload && this.state === 'uploading') {
      this.upload.abort();
      this.setState('paused');
    }
  }

  /**
   * Resume a paused or failed upload. Continues from where it left off.
   */
  resume(): void {
    if (this.upload && (this.state === 'paused' || this.state === 'error')) {
      this.lastTime = performance.now();
      this.lastLoaded = 0;
      this.speedSamples = [];
      this.setState('uploading');
      this.upload.start();
    }
  }

  /**
   * Cancel the upload and discard all progress.
   */
  cancel(): void {
    if (this.upload) {
      this.setState('cancelled');
      this.upload.abort(true);
      this.upload = null;
    }
  }

  /**
   * Retry the upload from where it left off (same as resume for TUS).
   */
  retry(): void {
    this.resume();
  }
}

/**
 * Guess a MIME content type from a file extension when the browser
 * doesn't provide one (or provides application/octet-stream).
 */
function guessContentTypeFromExt(ext: string): string {
  const map: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    mpeg: 'video/mpeg',
    mpg: 'video/mpeg',
    m4v: 'video/x-m4v',
    flv: 'video/x-flv',
    '3gp': 'video/3gpp',
    wmv: 'video/x-ms-wmv',
  };
  return map[ext] || 'video/mp4';
}

/**
 * Upload a thumbnail image to the thumbnails bucket.
 * Thumbnails are small, so a standard (non-resumable) upload is fine.
 */
export async function uploadThumbnail(path: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from(THUMBNAIL_BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
}

/**
 * Read video metadata (duration, dimensions) by loading the file into a
 * hidden <video> element. This only reads the file header, not the entire
 * file — the browser streams from the blob URL.
 */
export function getVideoMetadata(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const meta = {
        duration: Math.round(video.duration) || 0,
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
      };
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read video metadata. The file may be corrupted or in an unsupported format.'));
    };
    video.src = url;
  });
}
