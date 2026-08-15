import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Home, Film } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-600 text-white">
          <Film className="h-10 w-10" />
        </div>
        <h1 className="text-6xl font-bold tracking-tight text-brand-600">404</h1>
        <p className="mt-2 text-xl font-semibold">Page not found</p>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link to="/" className="btn-primary mt-6">
          <Home className="h-4 w-4" /> Back to home
        </Link>
      </motion.div>
    </div>
  );
}
