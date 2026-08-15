import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchVideos } from '@/lib/video-service';
import { Video, SortOption } from '@/lib/types';
import { VideoCard, VideoCardSkeleton } from '@/components/VideoCard';
import { SearchBar } from '@/components/SearchBar';
import { FilterBar } from '@/components/FilterBar';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Film } from 'lucide-react';

export function BrowsePage() {
  const [params] = useSearchParams();
  const initialSearch = params.get('q') || '';

  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<SortOption>('newest');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVideos({ search, category, sort, limit: 100 });
      setVideos(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, [search, category, sort]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Browse Videos</h1>
        <div className="w-full sm:max-w-sm">
          <SearchBar initialValue={search} onSearch={setSearch} />
        </div>
      </div>

      <FilterBar
        category={category}
        sort={sort}
        onCategoryChange={setCategory}
        onSortChange={setSort}
      />

      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <VideoCardSkeleton key={i} />)}
        </div>
      ) : videos.length === 0 ? (
        <EmptyState
          title="No videos found"
          description="Try adjusting your search or filters."
          icon={<Film className="h-12 w-12" />}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {videos.map((v, i) => <VideoCard key={v.id} video={v} index={i} />)}
        </div>
      )}

      {!loading && videos.length > 0 && (
        <p className="text-center text-sm text-gray-500">{videos.length} video{videos.length !== 1 ? 's' : ''}</p>
      )}
    </div>
  );
}
