interface BERTScoreChartProps {
  pairs: Record<string, number>;
}

export function BERTScoreChart({ pairs }: BERTScoreChartProps) {
  const entries = Object.entries(pairs);

  if (entries.length === 0) {
    return <p className="text-sybil-text3 text-sm text-center font-body">No BERTScore data</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map(([pair, score]) => {
        const pct = Math.round(score * 100);
        const color = pct >= 85 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444';
        return (
          <div key={pair}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-mono text-sybil-text2">{pair.replace(/_vs_/g, ' ↔ ')}</span>
              <span className="font-mono" style={{ color }}>{(score * 100).toFixed(1)}%</span>
            </div>
            <div className="progress-bar-track">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </div>
        );
      })}

      {/* Reference line info */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-sybil-border">
        <div className="w-3 h-0.5 bg-sybil-text3" />
        <span className="text-[10px] font-mono text-sybil-text3">
          {'>'} 85% = High Agreement | 70-85% = Partial | {'<'} 70% = Divergent
        </span>
      </div>
    </div>
  );
}
