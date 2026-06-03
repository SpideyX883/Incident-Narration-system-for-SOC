import { useEffect, useRef } from 'react';
import type { ConsensusResult } from '../../types';
import { Badge } from '../shared/Badge';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';

interface RawLogBlockProps {
  logId: number;
  rawEvent: any;
  status: string;
  isHighlighted: boolean;
}

function RawLogBlock({ logId, rawEvent, status, isHighlighted }: RawLogBlockProps) {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [rawEvent]);

  return (
    <div
      id={`raw-log-${logId}`}
      className={`p-4 rounded-xl border transition-all duration-500 ${
        isHighlighted
          ? 'border-sybil-accent bg-sybil-accent/5 ring-2 ring-sybil-accent/20 shadow-[0_0_15px_rgba(2,132,199,0.15)] scale-[1.01]'
          : 'border-sybil-border bg-sybil-surface hover:border-sybil-border2'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sybil-accent bg-sybil-accent/10 px-2.5 py-1 rounded text-xs border border-sybil-accent/20">
            LOG_ID: {logId}
          </span>
        </div>
        <Badge status={status as any} />
      </div>

      {rawEvent ? (
        <div className="rounded-lg overflow-hidden border border-sybil-border bg-sybil-surface2 text-xs">
          <pre className="p-4 overflow-x-auto m-0 !bg-transparent custom-scrollbar">
            <code ref={codeRef} className="language-json">
              {JSON.stringify(rawEvent, null, 2)}
            </code>
          </pre>
        </div>
      ) : (
        <div className="p-4 text-center border border-dashed border-sybil-border rounded-lg bg-sybil-surface2">
          <span className="text-sybil-text3 font-mono text-sm">Event data not available</span>
        </div>
      )}
    </div>
  );
}

interface RawLogListProps {
  eventsMap: Record<string, any>;
  consensus: ConsensusResult | null;
  highlightedLogId: number | null;
}

export function RawLogList({ eventsMap, consensus, highlightedLogId }: RawLogListProps) {
  const sortedLogIds = Object.keys(eventsMap)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-4 border-b border-sybil-border pb-3">
        <h3 className="font-heading font-bold text-sybil-text text-lg">
          Raw Timeline Logs ({sortedLogIds.length} entries)
        </h3>
        <p className="text-xs text-sybil-text3 font-mono">
          Ordered by LOG_ID
        </p>
      </div>

      <div className="space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto pr-2 custom-scrollbar">
        {sortedLogIds.map((logId) => {
          const rawEvent = eventsMap[logId];
          const entry = consensus?.citation_matrix?.[`LOG_ID_${logId}`];
          const status = entry?.status || 'NOT_CITED';

          return (
            <RawLogBlock
              key={logId}
              logId={logId}
              rawEvent={rawEvent}
              status={status}
              isHighlighted={logId === highlightedLogId}
            />
          );
        })}
      </div>
    </div>
  );
}
