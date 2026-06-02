import type { ProgressEvent } from '../../types';
import { ModelStatusCard } from './ModelStatusCard';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface ProgressFeedProps {
  events: ProgressEvent[];
  onCancel?: () => void;
}

export function ProgressFeed({ events, onCancel }: ProgressFeedProps) {
  // Group events by model
  const modelStatuses = new Map<string, { displayName: string; status: string; citations?: number; compliance?: number; reason?: string; latency?: number }>();

  for (const ev of events) {
    const model = ev.model || ev.display_name || '';
    if (!model) continue;

    const current = modelStatuses.get(model) || { displayName: ev.display_name || model, status: 'queued' };

    if (ev.event === 'model_started') current.status = 'running';
    else if (ev.event === 'model_streaming') current.status = 'streaming';
    else if (ev.event === 'model_complete') {
      current.status = 'complete';
      current.citations = ev.citations_found;
      current.compliance = ev.compliance;
      current.latency = ev.latency_ms;
    }
    else if (ev.event === 'model_failed') {
      current.status = 'failed';
      current.reason = ev.reason;
    }

    modelStatuses.set(model, current);
  }

  const totalModels = modelStatuses.size || 1;
  const completedModels = Array.from(modelStatuses.values()).filter((s) => s.status === 'complete' || s.status === 'failed').length;
  const consensusStarted = events.some((e) => e.event === 'consensus_started');
  const consensusComplete = events.some((e) => e.event === 'consensus_complete');

  const overallProgress = consensusComplete ? 100 : consensusStarted ? 90 : (completedModels / totalModels) * 80;

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 mb-4">
          <LoadingSpinner size="md" />
          <h2 className="text-2xl font-heading font-bold text-sybil-text">Analyzing Incident</h2>
        </div>
        <p className="text-sybil-text2 font-body">Running AI models in parallel — comparing outputs for consensus</p>
      </div>

      {/* Overall progress */}
      <div className="glass-panel p-4 mb-6">
        <div className="flex justify-between text-sm text-sybil-text2 mb-2 font-mono">
          <span>Overall Progress</span>
          <span>{Math.round(overallProgress)}%</span>
        </div>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${overallProgress}%` }} />
        </div>
      </div>

      {/* Model status cards */}
      <div className="grid gap-3 mb-6">
        {Array.from(modelStatuses.entries()).map(([model, info]) => (
          <ModelStatusCard
            key={model}
            modelId={model}
            displayName={info.displayName}
            status={info.status}
            citations={info.citations}
            compliance={info.compliance}
            failReason={info.reason}
            latencyMs={info.latency}
          />
        ))}
      </div>

      {/* Consensus status */}
      {consensusStarted && (
        <div className="glass-panel p-4 flex items-center gap-3 animate-fade-in">
          {consensusComplete ? (
            <>
              <span className="text-sybil-green text-lg">✓</span>
              <span className="text-sybil-text font-heading font-medium">Consensus Analysis Complete</span>
            </>
          ) : (
            <>
              <LoadingSpinner size="sm" />
              <span className="text-sybil-text2 font-body">Running consensus analysis (BERTScore + Citation Matrix)...</span>
            </>
          )}
        </div>
      )}

      {onCancel && (
        <div className="text-center mt-6">
          <button onClick={onCancel} className="btn-secondary text-sm">Cancel Analysis</button>
        </div>
      )}
    </div>
  );
}
