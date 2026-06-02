import { LoadingSpinner } from '../shared/LoadingSpinner';

interface ModelStatusCardProps {
  modelId: string;
  displayName: string;
  status: string;
  citations?: number;
  compliance?: number;
  failReason?: string;
  latencyMs?: number;
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  queued: { color: 'text-sybil-text3', bg: 'bg-sybil-surface3', label: 'Queued' },
  running: { color: 'text-sybil-accent', bg: 'bg-sybil-accent/10', label: 'Calling API...' },
  streaming: { color: 'text-cyan-400', bg: 'bg-cyan-400/10', label: 'Streaming Response...' },
  complete: { color: 'text-sybil-green', bg: 'bg-sybil-green/10', label: 'Complete' },
  failed: { color: 'text-sybil-red', bg: 'bg-sybil-red/10', label: 'Failed' },
};

export function ModelStatusCard({ modelId, displayName, status, citations, compliance, failReason, latencyMs }: ModelStatusCardProps) {
  const cfg = statusConfig[status] || statusConfig.queued;

  return (
    <div className={`glass-panel p-4 flex items-center gap-4 transition-all duration-300 ${status === 'complete' ? 'border-sybil-green/30' : status === 'failed' ? 'border-sybil-red/30' : ''}`}>
      {/* Status indicator */}
      <div className={`w-10 h-10 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
        {status === 'running' || status === 'streaming' ? (
          <LoadingSpinner size="sm" />
        ) : status === 'complete' ? (
          <span className="text-sybil-green text-lg">✓</span>
        ) : status === 'failed' ? (
          <span className="text-sybil-red text-lg">✗</span>
        ) : (
          <span className="text-sybil-text3 text-lg">○</span>
        )}
      </div>

      {/* Model info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-heading font-bold text-sm text-sybil-text truncate">{displayName}</span>
          <span className={`text-xs font-mono ${cfg.color}`}>{cfg.label}</span>
        </div>
        {status === 'complete' && (
          <div className="flex items-center gap-3 text-xs font-mono text-sybil-text3">
            <span>{citations} citations found</span>
            <span>•</span>
            <span className={compliance && compliance >= 0.8 ? 'text-sybil-green' : 'text-sybil-amber'}>
              {compliance ? `${(compliance * 100).toFixed(0)}% compliance` : ''}
            </span>
            {latencyMs && (
              <>
                <span>•</span>
                <span>{(latencyMs / 1000).toFixed(1)}s</span>
              </>
            )}
          </div>
        )}
        {status === 'failed' && failReason && (
          <p className="text-xs text-sybil-red/80 font-body">{failReason}</p>
        )}
      </div>
    </div>
  );
}
