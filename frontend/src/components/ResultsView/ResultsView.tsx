import type { AnalysisResponse } from '../../types';
import { NarrativePanel } from './NarrativePanel';
import { ConsensusDashboard } from '../ConsensusDashboard/ConsensusDashboard';
import { CitationDrawer } from './CitationDrawer';
import { ErrorBanner } from '../shared/ErrorBanner';
import { PDFExportButton } from './PDFExportButton';
import { RawLogSplitViewer } from './RawLogSplitViewer';
import { useState } from 'react';

interface ResultsViewProps {
  results: AnalysisResponse;
  selectedLogId: number | null;
  onSelectLogId: (id: number | null) => void;
  onNewAnalysis: () => void;
}

export function ResultsView({ results, selectedLogId, onSelectLogId, onNewAnalysis }: ResultsViewProps) {
  const modelIds = Object.keys(results.narratives);
  const isEnsemble = modelIds.length > 1;
  const [hoveredLogIds, setHoveredLogIds] = useState<number[]>([]);

  return (
    <div className="flex h-[calc(100vh-80px)] -mt-8 -mx-6 overflow-hidden bg-sybil-bg">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar relative" id="sybil-report-container">
        {/* Header */}
      <div className="flex items-center justify-between mb-6" data-html2canvas-ignore>
        <div>
          <h2 className="text-2xl font-heading font-bold text-sybil-text">Analysis Results</h2>
          <p className="text-sm text-sybil-text3 font-mono mt-1">
            Request: {results.request_id} • Status:{' '}
            <span className={results.status === 'success' ? 'text-sybil-green' : results.status === 'partial_success' ? 'text-sybil-amber' : 'text-sybil-red'}>
              {results.status.toUpperCase()}
            </span>
          </p>
        </div>
        <div className="flex gap-3">
          <PDFExportButton 
            elementId="sybil-report-container" 
            filename={`sybil_report_${results.request_id}.pdf`} 
          />
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `sybil_results_${results.request_id}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="btn-secondary text-sm"
          >
            Export JSON
          </button>
          <button onClick={onNewAnalysis} className="btn-secondary text-sm">
            New Analysis
          </button>
        </div>
      </div>

      {/* Warnings */}
      {results.warnings.length > 0 && (
        <div className="space-y-2 mb-6">
          {results.warnings.map((w, i) => (
            <ErrorBanner key={i} message={w} type="warning" />
          ))}
        </div>
      )}

      {/* Narrative Panels */}
      <div className={`grid gap-4 mb-8 ${isEnsemble ? `grid-cols-1 lg:grid-cols-${Math.min(modelIds.length, 3)}` : 'grid-cols-1 max-w-4xl mx-auto'}`}
        style={isEnsemble ? { gridTemplateColumns: `repeat(${Math.min(modelIds.length, 3)}, 1fr)` } : undefined}
      >
        {modelIds.map((modelId) => (
          <NarrativePanel
            key={modelId}
            modelId={modelId}
            narrative={results.narratives[modelId]}
            isPrimary={modelId === results.models_used.primary}
            consensus={results.consensus}
            onCitationClick={onSelectLogId}
            onSentenceHover={setHoveredLogIds}
          />
        ))}
      </div>

      {/* Consensus Dashboard */}
      {isEnsemble && results.consensus && (
        <ConsensusDashboard consensus={results.consensus} divergences={results.divergences} />
      )}

      {/* Timeline metadata */}
      <div className="glass-panel p-4 mt-6">
        <div className="flex items-center gap-6 text-sm font-mono text-sybil-text3">
          <span>Events analyzed: <span className="text-sybil-text">{results.raw_timeline.events_sent}</span></span>
          <span>•</span>
          <span>LOG_IDs: <span className="text-sybil-text">{results.raw_timeline.total_log_ids}</span></span>
          {results.raw_timeline.events_truncated > 0 && (
            <>
              <span>•</span>
              <span className="text-sybil-amber">Truncated: {results.raw_timeline.events_truncated}</span>
            </>
          )}
        </div>
      </div>

      {/* Citation Drawer */}
      {selectedLogId !== null && (
        <CitationDrawer
          logId={selectedLogId}
          consensus={results.consensus}
          rawEvent={results.raw_timeline.events_map[selectedLogId]}
          onClose={() => onSelectLogId(null)}
        />
      )}
      </div>

      {/* Split View Panel for Hover Logging */}
      <RawLogSplitViewer 
        logIds={hoveredLogIds} 
        consensus={results.consensus} 
        eventsMap={results.raw_timeline.events_map} 
        onClose={() => setHoveredLogIds([])} 
      />
    </div>
  );
}
