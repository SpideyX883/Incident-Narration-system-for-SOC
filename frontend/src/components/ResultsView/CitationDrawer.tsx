import type { ConsensusResult } from '../../types';
import { Badge } from '../shared/Badge';

interface CitationDrawerProps {
  logId: number;
  consensus: ConsensusResult | null;
  rawEvent?: any;
  onClose: () => void;
}

export function CitationDrawer({ logId, consensus, rawEvent, onClose }: CitationDrawerProps) {
  const key = `LOG_ID_${logId}`;
  const entry = consensus?.citation_matrix?.[key];
  const status = entry?.status || 'NOT_CITED';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-sybil-surface border-l border-sybil-border z-50 animate-slide-in-right overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-heading font-bold text-sybil-accent font-mono">LOG_ID: {logId}</span>
              <Badge status={status as any} />
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-sybil-surface2 border border-sybil-border flex items-center justify-center text-sybil-text3 hover:text-sybil-text hover:border-sybil-border2 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Consensus info */}
          {entry && (
            <div className="space-y-4">
              <div className="glass-panel p-4">
                <h4 className="text-xs font-mono text-sybil-text3 uppercase tracking-wider mb-2">Attack Phase</h4>
                <p className="text-sybil-text font-heading font-medium">{entry.phase || 'Unknown'}</p>
              </div>

              <div className="glass-panel p-4">
                <h4 className="text-xs font-mono text-sybil-text3 uppercase tracking-wider mb-2">Cited By</h4>
                {entry.cited_by.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {entry.cited_by.map((model) => (
                      <span key={model} className="px-3 py-1 bg-sybil-accent/10 text-sybil-accent text-sm font-mono rounded border border-sybil-accent/20">
                        {model}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sybil-text3 text-sm">No models cited this LOG_ID</p>
                )}
              </div>

              <div className="glass-panel p-4">
                <h4 className="text-xs font-mono text-sybil-text3 uppercase tracking-wider mb-2">Agreement Rate</h4>
                <div className="flex items-center gap-3">
                  <div className="flex-1 progress-bar-track">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${entry.agreement_rate * 100}%`,
                        background: entry.agreement_rate >= 0.8 ? 'var(--accent3)' : entry.agreement_rate >= 0.5 ? 'var(--accent4)' : 'var(--accent5)',
                      }}
                    />
                  </div>
                  <span className="text-sm font-mono text-sybil-text">{(entry.agreement_rate * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}

          {!entry && (
            <div className="glass-panel p-6 text-center">
              <p className="text-sybil-text3 font-body">No consensus data available for this LOG_ID</p>
            </div>
          )}

          {/* Raw Event Data */}
          {rawEvent && (
            <div className="mt-6">
              <h4 className="text-sm font-heading font-bold text-sybil-text mb-3 uppercase tracking-wider flex items-center gap-2">
                <span className="text-sybil-purple">{'{}'}</span> Raw Log Event
              </h4>
              <div className="glass-panel p-4 bg-sybil-bg overflow-x-auto">
                <pre className="text-xs font-mono text-sybil-text2 leading-relaxed">
                  {JSON.stringify(rawEvent, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
