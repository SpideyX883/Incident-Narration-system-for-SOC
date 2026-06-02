import { motion, AnimatePresence } from 'framer-motion';
import type { ConsensusResult } from '../../types';
import { Badge } from '../shared/Badge';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import { useEffect, useRef } from 'react';

interface RawLogSplitViewerProps {
  logIds: number[];
  consensus: ConsensusResult | null;
  eventsMap: Record<string, any>;
  onClose: () => void;
}

export function RawLogSplitViewer({ logIds, consensus, eventsMap, onClose }: RawLogSplitViewerProps) {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [logIds, eventsMap]);

  if (!logIds || logIds.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, x: 20, width: 0 }}
        animate={{ opacity: 1, x: 0, width: '400px' }}
        exit={{ opacity: 0, x: 20, width: 0 }}
        className="hidden lg:flex flex-col border-l border-sybil-border/50 bg-sybil-surface2 overflow-y-auto h-full shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]"
      >
        <div className="p-4 border-b border-sybil-border/50 flex items-center justify-between sticky top-0 bg-sybil-surface2/90 backdrop-blur-md z-10">
          <h3 className="font-heading font-bold text-sybil-text flex items-center gap-2">
            <span className="text-sybil-accent animate-pulse">●</span> Log Inspector
          </h3>
          <button 
            onClick={onClose}
            className="text-sybil-text3 hover:text-sybil-text transition-colors w-6 h-6 flex items-center justify-center rounded bg-sybil-surface border border-sybil-border"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-6">
          {logIds.map((logId) => {
            const rawEvent = eventsMap[logId];
            const entry = consensus?.citation_matrix?.[`LOG_ID_${logId}`];
            const status = entry?.status || 'NOT_CITED';

            return (
              <motion.div 
                key={logId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sybil-accent bg-sybil-accent/10 px-2 py-0.5 rounded border border-sybil-accent/20">
                    LOG_ID: {logId}
                  </span>
                  <Badge status={status as any} />
                </div>
                
                {rawEvent ? (
                  <div className="rounded-lg overflow-hidden border border-sybil-border bg-[#0d1117] text-xs">
                    <pre className="p-4 overflow-x-auto m-0 !bg-transparent custom-scrollbar">
                      <code ref={codeRef} className="language-json">
                        {JSON.stringify(rawEvent, null, 2)}
                      </code>
                    </pre>
                  </div>
                ) : (
                  <div className="p-4 text-center border border-dashed border-sybil-border rounded-lg bg-sybil-surface">
                    <span className="text-sybil-text3 font-mono text-sm">Event data not available</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
