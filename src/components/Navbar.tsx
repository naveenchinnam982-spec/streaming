import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { SearchBar } from '@/components/SearchBar';
import {
  LogOut, Moon, Sun, Upload, User as UserIcon, Film, Home, Search,
} from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Film className="h-5 w-5" />
          </div>
          <span className="hidden sm:inline">StreamFlix</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          <NavLink to="/" end className={linkClass}>
            <Home className="h-4 w-4" /> Home
          </NavLink>
          <NavLink to="/browse" className={linkClass}>
            <Film className="h-4 w-4" /> Browse
          </NavLink>
          {user && (
            <NavLink to="/profile" className={linkClass}>
              <UserIcon className="h-4 w-4" /> Profile
            </NavLink>
          )}
        </nav>

        <div className="ml-auto hidden max-w-xs flex-1 lg:block">
          <SearchBar />
        </div>

        <div className="ml-auto flex items-center gap-1 lg:ml-2">
          <button
            onClick={() => setMobileSearchOpen((v) => !v)}
            className="btn-ghost p-2 lg:hidden"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>

          <button
            onClick={toggle}
            className="btn-ghost p-2"
            aria-label="Toggle theme"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {user ? (
            <>
              <Link to="/upload" className="btn-primary hidden sm:inline-flex">
                <Upload className="h-4 w-4" /> Upload
              </Link>
              <button
                onClick={async () => {
                  await signOut();
                  nav('/');
                }}
                className="btn-ghost p-2"
                title="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-secondary hidden sm:inline-flex">Log in</Link>
              <Link to="/signup" className="btn-primary">Sign up</Link>
            </>
          )}
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="border-t border-gray-200 p-3 dark:border-gray-800 lg:hidden">
          <SearchBar />
        </div>
      )}

      <nav className="flex items-center gap-1 overflow-x-auto border-t border-gray-200 px-4 py-2 dark:border-gray-800 md:hidden">
        <NavLink to="/" end className={linkClass}>
          <Home className="h-4 w-4" /> Home
        </NavLink>
        <NavLink to="/browse" className={linkClass}>
          <Film className="h-4 w-4" /> Browse
        </NavLink>
        {user && (
          <>
            <NavLink to="/upload" className={linkClass}>
              <Upload className="h-4 w-4" /> Upload
            </NavLink>
            <NavLink to="/profile" className={linkClass}>
              <UserIcon className="h-4 w-4" /> Profile
            </NavLink>
          </>
        )}
      </nav>
    </header>
  );
}
