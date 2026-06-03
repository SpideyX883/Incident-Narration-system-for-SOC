import { useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import type { NarrativeResult, ConsensusResult } from '../../types';
import { Badge } from '../shared/Badge';

interface NarrativePanelProps {
  modelId: string;
  narrative: NarrativeResult;
  isPrimary: boolean;
  consensus: ConsensusResult | null;
  onCitationClick: (logId: number) => void;
  onSentenceHover?: (logIds: number[]) => void;
}

export function NarrativePanel({ modelId, narrative, isPrimary, consensus, onCitationClick, onSentenceHover }: NarrativePanelProps) {
  const shortName = modelId.includes('/') ? modelId.split('/').pop()?.split(':')[0] || modelId : modelId;
  const hoverTimeoutRef = useRef<any>();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const handleMouseEnter = (idx: number, logIds: number[]) => {
    if (!onSentenceHover || logIds.length === 0) return;
    setHoveredIdx(idx);
    hoverTimeoutRef.current = setTimeout(() => {
      onSentenceHover(logIds);
    }, 2000); // 2 second hover to trigger logs
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  // Parse narrative text and inject clickable citation tags
  const renderedText = useMemo(() => {
    if (!narrative.text) return null;

    // Split text into lines, then extract sentences to wrap
    const lines = narrative.text.split('\n');
    
    return lines.map((line, i) => {
      if (line.startsWith('### ')) {
        return <h3 key={i} className="text-lg font-heading font-bold text-sybil-accent mb-3 mt-6">{line.slice(4)}</h3>;
      }
      
      if (!line.trim()) {
        return <br key={i} />;
      }

      // Instead of complex sentence splitting which might break markdown lists, 
      // we'll treat lines/bullets as the "sentence" block if they contain LOG_IDs
      const matchIterator = line.matchAll(/(?:LOG_ID[s]?_?\s*:?\s*(\d+))/gi);
      const logIdsInLine = Array.from(matchIterator).map(m => parseInt(m[1]));
      
      const isHovered = hoveredIdx === i;

      // Split by any form of LOG_ID reference (e.g. LOG_ID 5, [LOG_ID: 5], LOG_ID: 5)
      const elements = line.split(/(\[LOG_ID:\s*\d+\]|LOG_ID:\s*\d+|LOG_ID\s+\d+|LOG_ID_\d+)/gi).map((part, k) => {
        const match = part.match(/(?:LOG_ID[s]?_?\s*:?\s*(\d+))/i);
        if (match) {
          const logId = parseInt(match[1]);
          const isPhantom = consensus?.phantom_citations.includes(logId);
          return (
            <button
              key={k}
              onClick={(e) => {
                e.stopPropagation();
                onCitationClick(logId);
              }}
              className={isPhantom ? 'citation-tag-phantom relative z-10' : 'citation-tag relative z-10'}
              title={isPhantom ? `PHANTOM — LOG_ID ${logId} does not exist in timeline` : `View LOG_ID ${logId}`}
            >
              LOG_ID: {logId}
            </button>
          );
        }
        return <span key={k}>{part}</span>;
      });

      return (
        <span
          key={i}
          className={`relative block rounded-md transition-colors duration-300 ${isHovered ? 'bg-sybil-accent/5' : ''}`}
          onMouseEnter={() => handleMouseEnter(i, logIdsInLine)}
          onMouseLeave={handleMouseLeave}
        >
          {elements}
        </span>
      );
    });
  }, [narrative.text, consensus, onCitationClick, hoveredIdx]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-panel-elevated flex flex-col h-full ${isPrimary ? 'ring-1 ring-sybil-accent/30 shadow-[0_0_15px_rgba(0,229,255,0.05)]' : ''}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-sybil-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isPrimary && (
              <span className="px-2 py-0.5 bg-sybil-accent/10 text-sybil-accent text-[10px] font-mono rounded border border-sybil-accent/20">
                PRIMARY
              </span>
            )}
            <h3 className="font-heading font-bold text-sybil-text text-sm">{shortName}</h3>
          </div>
          {narrative.error && <Badge status="PHANTOM">{narrative.partial ? 'PARTIAL' : 'ERROR'}</Badge>}
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-sybil-text3">
          <span className={narrative.compliance_rate >= 0.8 ? 'text-sybil-green' : 'text-sybil-amber'}>
            {(narrative.compliance_rate * 100).toFixed(0)}% cited
          </span>
          <span>•</span>
          <span>{narrative.citations.length} LOG_IDs</span>
          <span>•</span>
          <span>{narrative.sentence_count} sentences</span>
          <span>•</span>
          <span>{(narrative.latency_ms / 1000).toFixed(1)}s</span>
        </div>
      </div>

      {/* Narrative body */}
      <div className="p-4 flex-1 overflow-y-auto max-h-[600px]">
        <div className="narrative-text whitespace-pre-wrap">
          {renderedText}
        </div>
      </div>

      {/* Uncited sentences warning */}
      {narrative.uncited_count > 0 && (
        <div className="p-3 border-t border-sybil-border bg-sybil-amber/5">
          <p className="text-xs text-sybil-amber font-mono">
            ⚠ {narrative.uncited_count} sentence{narrative.uncited_count > 1 ? 's' : ''} without citations
          </p>
        </div>
      )}
    </motion.div>
  );
}
