import { AlertTriangle, X } from 'lucide-react';

interface Props {
  message: string;
  onClose?: () => void;
  className?: string;
}

export function ErrorBanner({ message, onClose, className = '' }: Props) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border border-error-500/30 bg-error-500/10 px-3 py-2 text-sm text-error-600 dark:text-error-500 ${className}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} className="rounded p-0.5 hover:bg-error-500/20">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
