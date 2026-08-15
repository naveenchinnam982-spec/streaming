import { CATEGORIES, SortOption } from '@/lib/types';
import { Filter, ArrowDownWideNarrow, Tag } from 'lucide-react';

interface Props {
  category: string;
  sort: SortOption;
  onCategoryChange: (c: string) => void;
  onSortChange: (s: SortOption) => void;
}

export function FilterBar({ category, sort, onCategoryChange, onSortChange }: Props) {
  const sorts: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'trending', label: 'Trending' },
    { value: 'views', label: 'Most Viewed' },
  ];

  return (
    <div className="card flex flex-wrap items-center gap-3 p-3">
      <span className="flex items-center gap-1 text-sm font-medium text-gray-500">
        <Filter className="h-4 w-4" /> Filters:
      </span>
      <div className="flex items-center gap-1">
        <Tag className="h-4 w-4 text-gray-400" />
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="input max-w-[160px] py-1.5 text-sm"
        >
          <option value="All">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <ArrowDownWideNarrow className="h-4 w-4 text-gray-400" />
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="input max-w-[160px] py-1.5 text-sm"
        >
          {sorts.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
