import type { AnalysisResponse } from '../../types';
import { NarrativePanel } from './NarrativePanel';
import { ConsensusDashboard } from '../ConsensusDashboard/ConsensusDashboard';
import { CitationDrawer } from './CitationDrawer';
import { ErrorBanner } from '../shared/ErrorBanner';
import { PDFExportButton } from './PDFExportButton';
import { RawLogSplitViewer } from './RawLogSplitViewer';
import { RawLogList } from './RawLogList';
import { useState, useRef } from 'react';

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
  
  // New UI states for tabs, split view width, and log highlighting
  const [activeTab, setActiveTab] = useState<'summary' | 'raw_logs' | 'split'>('split');
  const [leftWidthPercent, setLeftWidthPercent] = useState<number>(50);
  const [highlightedLogId, setHighlightedLogId] = useState<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setLeftWidthPercent(Math.max(25, Math.min(75, newWidth)));
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleLogClick = (logId: number) => {
    setHighlightedLogId(logId);
    if (activeTab === 'summary') {
      setActiveTab('split');
    }
    setTimeout(() => {
      const element = document.getElementById(`raw-log-${logId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Render the narrative panels and consensus dashboard
  const renderSummaryContent = () => (
    <div className="space-y-6">
      <div 
        className={`grid gap-4 ${isEnsemble ? `grid-cols-1 lg:grid-cols-${Math.min(modelIds.length, 3)}` : 'grid-cols-1 max-w-4xl mx-auto'}`}
        style={isEnsemble ? { gridTemplateColumns: `repeat(${Math.min(modelIds.length, 3)}, 1fr)` } : undefined}
      >
        {modelIds.map((modelId) => (
          <NarrativePanel
            key={modelId}
            modelId={modelId}
            narrative={results.narratives[modelId]}
            isPrimary={modelId === results.models_used.primary}
            consensus={results.consensus}
            onCitationClick={handleLogClick}
            onSentenceHover={setHoveredLogIds}
          />
        ))}
      </div>

      {isEnsemble && results.consensus && (
        <ConsensusDashboard consensus={results.consensus} divergences={results.divergences} />
      )}

      <div className="glass-panel p-4">
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
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-80px)] -mt-8 -mx-6 overflow-hidden bg-sybil-bg">
      {/* Main Content Area */}
      <div 
        className={`flex-1 px-6 py-8 relative flex flex-col min-w-0 ${
          activeTab === 'split' ? 'overflow-hidden h-full' : 'overflow-y-auto'
        }`} 
        id="sybil-report-container"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0" data-html2canvas-ignore>
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
          <div className="space-y-2 mb-4 flex-shrink-0">
            {results.warnings.map((w, i) => (
              <ErrorBanner key={i} message={w} type="warning" />
            ))}
          </div>
        )}

        {/* View Tabs */}
        <div className="flex border-b border-sybil-border mb-6 flex-shrink-0 gap-2" data-html2canvas-ignore>
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 font-heading font-bold text-xs rounded-t-lg border-t border-x -mb-px transition-all duration-200 ${
              activeTab === 'summary'
                ? 'border-sybil-border bg-sybil-surface text-sybil-accent'
                : 'border-transparent text-sybil-text3 hover:text-sybil-text'
            }`}
          >
            📄 Summary Narrative
          </button>
          <button
            onClick={() => setActiveTab('raw_logs')}
            className={`px-4 py-2 font-heading font-bold text-xs rounded-t-lg border-t border-x -mb-px transition-all duration-200 ${
              activeTab === 'raw_logs'
                ? 'border-sybil-border bg-sybil-surface text-sybil-accent'
                : 'border-transparent text-sybil-text3 hover:text-sybil-text'
            }`}
          >
            🔍 Original Raw Logs
          </button>
          <button
            onClick={() => setActiveTab('split')}
            className={`px-4 py-2 font-heading font-bold text-xs rounded-t-lg border-t border-x -mb-px transition-all duration-200 ${
              activeTab === 'split'
                ? 'border-sybil-border bg-sybil-surface text-sybil-accent'
                : 'border-transparent text-sybil-text3 hover:text-sybil-text'
            }`}
          >
            🖥️ Split Screen View
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          {activeTab === 'summary' && (
            <div className="h-full overflow-y-auto pr-1">
              {renderSummaryContent()}
            </div>
          )}

          {activeTab === 'raw_logs' && (
            <div className="h-full overflow-y-auto pr-1">
              <RawLogList 
                eventsMap={results.raw_timeline.events_map}
                consensus={results.consensus}
                highlightedLogId={highlightedLogId}
              />
            </div>
          )}

          {activeTab === 'split' && (
            <div 
              ref={containerRef} 
              className="flex w-full h-full border border-sybil-border rounded-xl bg-sybil-surface/30 overflow-hidden select-none"
            >
              {/* Left Pane: Summary Narrative */}
              <div 
                style={{ width: `${leftWidthPercent}%` }} 
                className="h-full overflow-y-auto p-4 custom-scrollbar select-text"
              >
                {renderSummaryContent()}
              </div>

              {/* Draggable Divider */}
              <div
                onMouseDown={handleMouseDown}
                className="w-1.5 h-full bg-sybil-border hover:bg-sybil-accent cursor-col-resize self-stretch transition-colors flex items-center justify-center relative group"
                title="Drag to resize panes"
              >
                <div className="absolute top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-sybil-text3 group-hover:bg-white pointer-events-none" />
              </div>

              {/* Right Pane: Original Raw Logs */}
              <div 
                style={{ width: `${100 - leftWidthPercent}%` }} 
                className="h-full overflow-y-auto p-4 custom-scrollbar select-text"
              >
                <RawLogList 
                  eventsMap={results.raw_timeline.events_map}
                  consensus={results.consensus}
                  highlightedLogId={highlightedLogId}
                />
              </div>
            </div>
          )}
        </div>

        {/* Citation Drawer (remains supported for consensus queries if needed) */}
        {selectedLogId !== null && (
          <CitationDrawer
            logId={selectedLogId}
            consensus={results.consensus}
            rawEvent={results.raw_timeline.events_map[selectedLogId]}
            onClose={() => onSelectLogId(null)}
          />
        )}
      </div>

      {/* Slide-out Sidebar - only shown if not in split view and we have hovered logs */}
      {activeTab !== 'split' && (
        <RawLogSplitViewer 
          logIds={hoveredLogIds} 
          consensus={results.consensus} 
          eventsMap={results.raw_timeline.events_map} 
          onClose={() => setHoveredLogIds([])} 
        />
      )}
    </div>
  );
}
