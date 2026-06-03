interface ConfidenceMeterProps {
  confidence: number;
}

export function ConfidenceMeter({ confidence }: ConfidenceMeterProps) {
  const pct = Math.round(confidence * 100);
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (confidence * circumference);
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Track */}
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border2)" strokeWidth="6" />
          {/* Fill */}
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-heading font-bold" style={{ color }}>{pct}</span>
          <span className="text-xs text-sybil-text3 font-mono">%</span>
        </div>
      </div>
      <p className="text-sm text-sybil-text2 font-body mt-2">
        {pct >= 80 ? 'High Agreement' : pct >= 60 ? 'Partial Agreement' : 'Low Agreement'}
      </p>
    </div>
  );
}
