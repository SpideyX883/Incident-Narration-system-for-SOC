interface ErrorBannerProps {
  message: string;
  type?: 'error' | 'warning' | 'info';
  onDismiss?: () => void;
}

export function ErrorBanner({ message, type = 'error', onDismiss }: ErrorBannerProps) {
  const colors = {
    error: 'bg-sybil-red/10 border-sybil-red/30 text-sybil-red',
    warning: 'bg-sybil-amber/10 border-sybil-amber/30 text-sybil-amber',
    info: 'bg-sybil-accent/10 border-sybil-accent/30 text-sybil-accent',
  };

  const icons = {
    error: '✗',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border rounded-lg ${colors[type]} animate-fade-in`}>
      <span className="text-lg">{icons[type]}</span>
      <p className="flex-1 text-sm font-body">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-current opacity-60 hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      )}
    </div>
  );
}
