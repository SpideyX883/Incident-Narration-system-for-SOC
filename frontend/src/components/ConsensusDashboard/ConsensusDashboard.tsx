import type { ConsensusResult, DivergenceItem } from '../../types';
import { ConfidenceMeter } from './ConfidenceMeter';
import { CitationHeatmap } from './CitationHeatmap';
import { BERTScoreChart } from './BERTScoreChart';

interface ConsensusDashboardProps {
  consensus: ConsensusResult;
  divergences: DivergenceItem[];
}

export function ConsensusDashboard({ consensus, divergences }: ConsensusDashboardProps) {
  const totalCited = consensus.confirmed_log_ids.length + consensus.unverified_log_ids.length;
  const totalEntries = Object.keys(consensus.citation_matrix).length;

  return (
    <div className="animate-fade-in">
      <div className="divider mb-8" />

      <h2 className="text-2xl font-heading font-bold text-sybil-text mb-6 flex items-center gap-3">
        <span className="text-sybil-accent">◆</span> Ensemble Consensus Dashboard
      </h2>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total LOG_IDs', value: totalEntries, color: 'text-sybil-text' },
          { label: 'Confirmed', value: consensus.confirmed_log_ids.length, color: 'text-sybil-accent' },
          { label: 'Unverified', value: consensus.unverified_log_ids.length, color: 'text-sybil-amber' },
          { label: 'Phantom', value: consensus.phantom_citations.length, color: 'text-sybil-red' },
          { label: 'Not Cited', value: totalEntries - totalCited - consensus.phantom_citations.length, color: 'text-sybil-text3' },
        ].map((stat) => (
          <div key={stat.label} className="glass-panel p-4 text-center">
            <div className={`text-2xl font-heading font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-sybil-text3 font-mono mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Main visualizations */}
      <div className="grid md:grid-cols-3 gap-6 mb-6">
        {/* Confidence Meter */}
        <div className="glass-panel p-6">
          <h3 className="text-sm font-heading font-bold text-sybil-text2 mb-4 uppercase tracking-wider">
            Ensemble Confidence
          </h3>
          <ConfidenceMeter confidence={consensus.overall_confidence} />
        </div>

        {/* BERTScore Chart */}
        <div className="glass-panel p-6">
          <h3 className="text-sm font-heading font-bold text-sybil-text2 mb-4 uppercase tracking-wider">
            Semantic Similarity (BERTScore)
          </h3>
          <BERTScoreChart pairs={consensus.bertscore_pairs} />
        </div>

        {/* Citation Heatmap */}
        <div className="glass-panel p-6">
          <h3 className="text-sm font-heading font-bold text-sybil-text2 mb-4 uppercase tracking-wider">
            Citation Agreement
          </h3>
          <CitationHeatmap matrix={consensus.citation_matrix} />
        </div>
      </div>

      {/* Divergences */}
      {divergences.length > 0 && (
        <div className="glass-panel p-6">
          <h3 className="text-sm font-heading font-bold text-sybil-text2 mb-4 uppercase tracking-wider">
            Divergences ({divergences.length})
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {divergences.slice(0, 10).map((d, i) => (
              <div key={i} className="p-3 bg-sybil-surface2 rounded-lg border border-sybil-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                    d.status === 'divergent' ? 'bg-sybil-red/10 text-sybil-red' : 'bg-sybil-amber/10 text-sybil-amber'
                  }`}>
                    {d.error_type || d.status}
                  </span>
                </div>
                <p className="text-xs text-sybil-text2 font-body mb-1">
                  <span className="text-sybil-accent font-mono">{d.model_a}:</span> {d.sentence_a.slice(0, 120)}...
                </p>
                <p className="text-xs text-sybil-text2 font-body">
                  <span className="text-sybil-purple font-mono">{d.model_b}:</span> {d.sentence_b.slice(0, 120)}...
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
