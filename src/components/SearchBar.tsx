import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';

interface Props {
  initialValue?: string;
  onSearch?: (q: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ initialValue = '', onSearch, placeholder = 'Search videos…', className = '' }: Props) {
  const [q, setQ] = useState(initialValue);
  const [debounced, setDebounced] = useState(initialValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(q), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  useEffect(() => {
    onSearch?.(debounced);
  }, [debounced, onSearch]);

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            nav(`/browse?q=${encodeURIComponent(q)}`);
          }
        }}
        placeholder={placeholder}
        className="input pl-9 pr-8"
      />
      {q && (
        <button
          onClick={() => setQ('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
