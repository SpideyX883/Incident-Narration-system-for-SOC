interface EnsembleToggleProps {
  mode: 'single' | 'ensemble';
  onChange: (mode: 'single' | 'ensemble') => void;
}

export function EnsembleToggle({ mode, onChange }: EnsembleToggleProps) {
  return (
    <div className="flex gap-3">
      <button
        onClick={() => onChange('single')}
        className={`flex-1 py-4 px-6 rounded-xl border-2 transition-all duration-300 text-center ${
          mode === 'single'
            ? 'border-sybil-accent bg-sybil-accent/10 glow-accent'
            : 'border-sybil-border bg-sybil-surface hover:border-sybil-border2'
        }`}
      >
        <div className={`text-lg font-heading font-bold mb-1 ${mode === 'single' ? 'text-sybil-accent' : 'text-sybil-text2'}`}>
          SINGLE
        </div>
        <div className="text-xs text-sybil-text3 font-body">One model, fastest analysis</div>
      </button>

      <button
        onClick={() => onChange('ensemble')}
        className={`flex-1 py-4 px-6 rounded-xl border-2 transition-all duration-300 text-center ${
          mode === 'ensemble'
            ? 'border-sybil-accent bg-sybil-accent/10 glow-accent'
            : 'border-sybil-border bg-sybil-surface hover:border-sybil-border2'
        }`}
      >
        <div className={`text-lg font-heading font-bold mb-1 ${mode === 'ensemble' ? 'text-sybil-accent' : 'text-sybil-text2'}`}>
          ENSEMBLE
        </div>
        <div className="text-xs text-sybil-text3 font-body">Multi-model consensus analysis</div>
      </button>
    </div>
  );
}
