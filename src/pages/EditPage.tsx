import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchVideoById, updateVideo, buildThumbnailStoragePath, getThumbnailPublicUrl } from '@/lib/video-service';
import { uploadThumbnail } from '@/lib/upload-service';
import { CATEGORIES, ACCEPTED_IMAGE_TYPES, MAX_THUMBNAIL_SIZE } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useAuth } from '@/context/AuthContext';
import { formatBytes } from '@/lib/format';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Loader2, Image as ImageIcon, X } from 'lucide-react';

export function EditPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const nav = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [currentThumb, setCurrentThumb] = useState<string | null>(null);
  const [newThumb, setNewThumb] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const v = await fetchVideoById(id);
        if (!v) {
          setError('Video not found');
          return;
        }
        if (user && v.user_id !== user.id) {
          setError('You can only edit your own videos.');
          return;
        }
        setTitle(v.title);
        setDescription(v.description || '');
        setCategory(v.category || CATEGORIES[0]);
        setCurrentThumb(v.thumbnail_url);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load video');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user]);

  const handleThumbSelect = (file: File) => {
    setError(null);
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError('Unsupported image format. Use JPG, PNG, WebP, or GIF.');
      return;
    }
    if (file.size > MAX_THUMBNAIL_SIZE) {
      setError(`Thumbnail too large (${formatBytes(file.size)}). Maximum is ${formatBytes(MAX_THUMBNAIL_SIZE)}.`);
      return;
    }
    setNewThumb(file);
    setThumbPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!id || !user) return;
    if (!title.trim()) {
      setError('Title cannot be empty.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let thumbnailUrl = currentThumb;
      let thumbnailPath: string | null = null;
      if (newThumb) {
        thumbnailPath = buildThumbnailStoragePath(user.id, newThumb.name);
        await uploadThumbnail(thumbnailPath, newThumb);
        thumbnailUrl = getThumbnailPublicUrl(thumbnailPath);
      }
      await updateVideo(id, {
        title: title.trim(),
        description: description.trim(),
        category,
        thumbnail_url: thumbnailUrl,
        thumbnail_path: thumbnailPath,
      });
      toast.success('Video updated successfully');
      nav(`/watch/${id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update video');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
        <Link to={id ? `/watch/${id}` : '/'} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <h1 className="text-2xl font-bold">Edit Video</h1>

        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

        <div className="card space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" disabled={saving} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="input resize-none" disabled={saving} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input" disabled={saving}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Thumbnail</label>
            <div className="flex items-center gap-4">
              <div
                onClick={() => thumbInputRef.current?.click()}
                className="flex h-24 w-40 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
              >
                {thumbPreview || currentThumb ? (
                  <img src={thumbPreview || currentThumb || ''} alt="Thumbnail" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-gray-400" />
                )}
              </div>
              {newThumb && (
                <button
                  onClick={() => { setNewThumb(null); setThumbPreview(null); }}
                  className="btn-secondary text-sm"
                  disabled={saving}
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
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleSave} className="btn-primary" disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <Link to={id ? `/watch/${id}` : '/'} className="btn-ghost">Cancel</Link>
        </div>
      </motion.div>
    </div>
  );
}
