import type { CitationMatrixEntry } from '../../types';

interface CitationHeatmapProps {
  matrix: Record<string, CitationMatrixEntry>;
}

const statusColors: Record<string, string> = {
  CONFIRMED: 'bg-sybil-accent',
  UNVERIFIED: 'bg-sybil-amber',
  PHANTOM: 'bg-sybil-red',
  NOT_CITED: 'bg-sybil-surface3',
};

export function CitationHeatmap({ matrix }: CitationHeatmapProps) {
  const entries = Object.entries(matrix)
    .filter(([_, v]) => v.status !== 'NOT_CITED')
    .sort((a, b) => {
      const order = { PHANTOM: 0, UNVERIFIED: 1, CONFIRMED: 2, NOT_CITED: 3 };
      return (order[a[1].status] || 3) - (order[b[1].status] || 3);
    })
    .slice(0, 30);

  if (entries.length === 0) {
    return <p className="text-sybil-text3 text-sm text-center font-body">No citations to display</p>;
  }

  return (
    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-2">
      {entries.map(([key, entry]) => {
        const logId = key.replace('LOG_ID_', '');
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-sybil-text3 w-8 text-right shrink-0">{logId}</span>
            <div className="flex-1 flex gap-0.5">
              {entry.cited_by.length > 0 ? (
                entry.cited_by.map((model, i) => (
                  <div
                    key={i}
                    className={`h-4 flex-1 rounded-sm ${statusColors[entry.status]} opacity-80`}
                    title={`${model} — ${entry.status}`}
                  />
                ))
              ) : (
                <div className="h-4 flex-1 rounded-sm bg-sybil-surface3 opacity-30" />
              )}
            </div>
            <span className={`text-[10px] font-mono w-16 ${
              entry.status === 'CONFIRMED' ? 'text-sybil-accent' :
              entry.status === 'UNVERIFIED' ? 'text-sybil-amber' :
              entry.status === 'PHANTOM' ? 'text-sybil-red' : 'text-sybil-text3'
            }`}>
              {entry.status}
            </span>
          </div>
        );
      })}
      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-sybil-border">
        {['CONFIRMED', 'UNVERIFIED', 'PHANTOM'].map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${statusColors[s]}`} />
            <span className="text-[10px] font-mono text-sybil-text3">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
