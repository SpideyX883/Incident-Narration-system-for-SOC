import type { ModelConfig } from '../../types';
import { Badge } from '../shared/Badge';

interface ModelSelectorProps {
  models: ModelConfig[];
  primaryModel: string;
  crossValModels: string[];
  mode: 'single' | 'ensemble';
  onPrimaryChange: (id: string) => void;
  onToggleCrossVal: (id: string) => void;
}

const providerColors: Record<string, string> = {
  google: 'text-blue-400',
  openrouter: 'text-emerald-400',
  anthropic: 'text-orange-400',
  openai: 'text-green-400',
};

export function ModelSelector({
  models, primaryModel, crossValModels, mode,
  onPrimaryChange, onToggleCrossVal,
}: ModelSelectorProps) {
  return (
    <div className="space-y-5">
      {/* Primary Model */}
      <div>
        <label className="block text-sm text-sybil-text2 mb-2 font-body">Primary Model</label>
        <select
          value={primaryModel}
          onChange={(e) => onPrimaryChange(e.target.value)}
          className="input-field"
          id="primary-model-selector"
        >
          <option value="">Select primary model...</option>
          {models.map((m) => (
            <option key={m.id} value={m.id} disabled={!m.available}>
              {m.display_name} ({m.provider}) {m.available ? '' : '— No API key'} [{m.cost_tier.toUpperCase()}]
            </option>
          ))}
        </select>
      </div>

      {/* Cross-validation Models (ensemble only) */}
      {mode === 'ensemble' && (
        <div>
          <label className="block text-sm text-sybil-text2 mb-2 font-body">
            Cross-Validation Models <span className="text-sybil-text3">(select up to 3)</span>
          </label>
          <div className="grid gap-2">
            {models
              .filter((m) => m.id !== primaryModel)
              .map((m) => {
                const isSelected = crossValModels.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => m.available && onToggleCrossVal(m.id)}
                    disabled={!m.available || (!isSelected && crossValModels.length >= 3)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 text-left ${
                      isSelected
                        ? 'border-sybil-accent/50 bg-sybil-accent/5'
                        : 'border-sybil-border bg-sybil-surface hover:border-sybil-border2'
                    } ${!m.available ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'border-sybil-accent bg-sybil-accent' : 'border-sybil-border2'
                      }`}>
                        {isSelected && <span className="text-sybil-bg text-xs">✓</span>}
                      </div>
                      <div>
                        <span className={`font-heading font-medium text-sm ${isSelected ? 'text-sybil-text' : 'text-sybil-text2'}`}>
                          {m.display_name}
                        </span>
                        <span className={`ml-2 text-xs ${providerColors[m.provider] || 'text-sybil-text3'}`}>
                          {m.provider}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-sybil-text3 font-mono">
                        {m.context_window_tokens >= 1000000 ? '1M ctx' : `${m.context_window_tokens / 1000}K ctx`}
                      </span>
                      <Badge status={m.cost_tier as 'free' | 'paid'} />
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
