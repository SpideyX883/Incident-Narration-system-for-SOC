import type { ScenarioConfig } from '../../types';

interface ScenarioSelectorProps {
  scenarios: ScenarioConfig[];
  selectedId: string;
  onChange: (id: string) => void;
}

export function ScenarioSelector({ scenarios, selectedId, onChange }: ScenarioSelectorProps) {
  const selected = scenarios.find((s) => s.id === selectedId);

  return (
    <div>
      <select
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
        id="scenario-selector"
      >
        <option value="">Select a scenario...</option>
        {scenarios.map((s) => (
          <option key={s.id} value={s.id} disabled={!s.file_exists}>
            {s.display_name} ({s.event_count_approx} events) — {s.difficulty}
          </option>
        ))}
      </select>

      {selected && (
        <div className="mt-4 p-4 bg-sybil-surface2 rounded-lg border border-sybil-border animate-fade-in">
          <p className="text-sm text-sybil-text2 mb-2">{selected.description}</p>
          <div className="flex flex-wrap gap-2">
            {selected.mitre_techniques.map((t) => (
              <span key={t} className="px-2 py-0.5 bg-sybil-purple/10 text-sybil-purple text-xs font-mono rounded border border-sybil-purple/20">
                {t}
              </span>
            ))}
            <span className={`px-2 py-0.5 text-xs font-mono rounded border ${
              selected.difficulty === 'hard' ? 'bg-sybil-red/10 text-sybil-red border-sybil-red/20'
              : selected.difficulty === 'medium' ? 'bg-sybil-amber/10 text-sybil-amber border-sybil-amber/20'
              : 'bg-sybil-green/10 text-sybil-green border-sybil-green/20'
            }`}>
              {selected.difficulty.toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
