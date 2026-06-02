import { useEffect } from 'react';
import { useAnalysis } from './hooks/useAnalysis';
import { ConfigPanel } from './components/ConfigPanel/ConfigPanel';
import { ProgressFeed } from './components/ProgressFeed/ProgressFeed';
import { ResultsView } from './components/ResultsView/ResultsView';
import { ErrorBanner } from './components/shared/ErrorBanner';
import { LoadingSpinner } from './components/shared/LoadingSpinner';

export default function App() {
  const analysis = useAnalysis();

  useEffect(() => {
    analysis.loadInitialData();
  }, []);

  return (
    <div className="min-h-screen bg-sybil-bg">
      {/* Background gradient effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-sybil-accent/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-sybil-purple/[0.03] rounded-full blur-[120px]" />
      </div>

      {/* Main content */}
      <div className="relative z-10">
        {/* Nav bar */}
        <nav className="border-b border-sybil-border/50 bg-sybil-bg/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sybil-accent to-cyan-400 flex items-center justify-center">
                <span className="text-sybil-bg font-heading font-bold text-sm">S</span>
              </div>
              <span className="font-heading font-bold text-sybil-text">SYBIL</span>
              <span className="text-xs font-mono text-sybil-text3 hidden sm:inline">v2.0.0</span>
            </div>
            <div className="flex items-center gap-4">
              {analysis.appState !== 'idle' && (
                <button
                  onClick={analysis.resetToIdle}
                  className="text-sm text-sybil-text3 hover:text-sybil-text transition-colors font-body"
                >
                  ← Back to Config
                </button>
              )}
              <div className={`w-2 h-2 rounded-full ${
                analysis.appState === 'analyzing' ? 'bg-sybil-accent animate-pulse' :
                analysis.appState === 'complete' ? 'bg-sybil-green' :
                analysis.appState === 'error' ? 'bg-sybil-red' : 'bg-sybil-text3'
              }`} />
            </div>
          </div>
        </nav>

        {/* Content area */}
        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* Global error banner */}
          {analysis.error && analysis.appState === 'error' && (
            <div className="mb-6">
              <ErrorBanner
                message={analysis.error}
                type="error"
                onDismiss={analysis.resetToIdle}
              />
            </div>
          )}

          {/* State screens */}
          {analysis.appState === 'idle' && (
            <ConfigPanel
              models={analysis.models}
              scenarios={analysis.scenarios}
              scenarioId={analysis.scenarioId}
              mode={analysis.mode}
              primaryModel={analysis.primaryModel}
              crossValModels={analysis.crossValModels}
              consensusThreshold={analysis.consensusThreshold}
              maxEvents={analysis.maxEvents}
              onScenarioChange={analysis.setScenarioId}
              onModeChange={analysis.setMode}
              onPrimaryModelChange={analysis.setPrimaryModel}
              onToggleCrossVal={analysis.toggleCrossValModel}
              onConsensusThresholdChange={analysis.setConsensusThreshold}
              onMaxEventsChange={analysis.setMaxEvents}
              onAnalyze={analysis.startAnalysis}
            />
          )}

          {analysis.appState === 'analyzing' && (
            <ProgressFeed events={analysis.progressEvents} />
          )}

          {analysis.appState === 'complete' && analysis.results && (
            <ResultsView
              results={analysis.results}
              selectedLogId={analysis.selectedLogId}
              onSelectLogId={analysis.setSelectedLogId}
              onNewAnalysis={analysis.resetToIdle}
            />
          )}

          {analysis.appState === 'error' && !analysis.error && (
            <div className="text-center py-20">
              <h2 className="text-2xl font-heading font-bold text-sybil-red mb-4">Analysis Failed</h2>
              <p className="text-sybil-text2 mb-6">All models failed to produce results.</p>
              <button onClick={analysis.resetToIdle} className="btn-primary">Try Again</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
