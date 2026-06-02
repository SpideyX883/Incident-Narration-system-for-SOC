import { useState, useEffect } from 'react';
import type { ModelConfig, ScenarioConfig } from '../../types';
import { ScenarioSelector } from './ScenarioSelector';

interface ConfigPanelProps {
  models: ModelConfig[];
  scenarios: ScenarioConfig[];
  scenarioId: string;
  mode: 'single' | 'ensemble';
  primaryModel: string;
  crossValModels: string[];
  consensusThreshold: number;
  maxEvents: number;
  onScenarioChange: (id: string) => void;
  onModeChange: (mode: 'single' | 'ensemble') => void;
  onPrimaryModelChange: (id: string) => void;
  onToggleCrossVal: (id: string) => void;
  onConsensusThresholdChange: (val: number) => void;
  onMaxEventsChange: (val: number) => void;
  onAnalyze: (primary: string, crossVals: string[]) => void;
}

const providerColors: Record<string, string> = {
  google: 'text-blue-400',
  openrouter: 'text-emerald-400',
  anthropic: 'text-orange-400',
  openai: 'text-green-400',
  ollama: 'text-purple-400'
};

export function ConfigPanel({
  models, scenarios, scenarioId,
  consensusThreshold, maxEvents,
  onScenarioChange,
  onConsensusThresholdChange, onMaxEventsChange, onAnalyze,
}: ConfigPanelProps) {
  
  // UI Specific State for the wizard flow
  const [generatingMode, setGeneratingMode] = useState<'single' | 'multi'>('single');
  const [generatingModels, setGeneratingModels] = useState<string[]>([]);
  const [wantsEval, setWantsEval] = useState<boolean>(false);
  const [evalModels, setEvalModels] = useState<string[]>([]);

  // Sync initial models if empty
  useEffect(() => {
    if (generatingModels.length === 0 && models.some(m => m.available)) {
      setGeneratingModels([models.find(m => m.available)?.id || '']);
    }
  }, [models]);

  const availableModels = models.filter((m) => m.available);
  const canAnalyze = generatingModels.length > 0 && scenarioId && availableModels.length > 0;

  const thresholdLabel = consensusThreshold >= 0.90 ? 'Strict' : consensusThreshold >= 0.75 ? 'Balanced' : 'Lenient';

  const handleAnalyzeClick = () => {
    if (generatingModels.length === 0) return;
    const primary = generatingModels[0];
    const crossVals = [
      ...generatingModels.slice(1), 
      ...(wantsEval ? evalModels : [])
    ];
    // We filter unique just in case they picked the same one in both places
    const uniqueCrossVals = Array.from(new Set(crossVals));
    onAnalyze(primary, uniqueCrossVals);
  };

  const toggleGenModel = (id: string) => {
    if (generatingMode === 'single') {
      setGeneratingModels([id]);
    } else {
      setGeneratingModels(prev => 
        prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
      );
    }
  };

  const toggleEvalModel = (id: string) => {
    setEvalModels(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-20">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-sybil-accent/10 border border-sybil-accent/20 rounded-full mb-4">
          <div className="w-2 h-2 bg-sybil-accent rounded-full animate-pulse" />
          <span className="text-sybil-accent font-mono text-xs tracking-wider">ANALYSIS CONFIGURATION</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-heading font-bold mb-3">
          <span className="text-gradient">PROJECT SYBIL</span>
        </h1>
        <p className="text-sybil-text2 text-lg max-w-2xl mx-auto">
          Multi-LLM Ensemble Forensic Narrative Engine — Zero-Hallucination SOC Analysis
        </p>
      </div>

      <div className="grid gap-6">
        {/* Scenario Selection */}
        <div className="glass-panel p-6 border-l-2 border-sybil-accent/50">
          <h2 className="text-lg font-heading font-bold text-sybil-text mb-4 flex items-center gap-2">
            <span className="text-sybil-accent font-mono">01</span> Select Incident Scenario
          </h2>
          <ScenarioSelector
            scenarios={scenarios}
            selectedId={scenarioId}
            onChange={onScenarioChange}
          />
        </div>

        {/* Model Workflow Selection */}
        <div className="glass-panel p-6 border-l-2 border-sybil-accent/50">
          <h2 className="text-lg font-heading font-bold text-sybil-text mb-6 flex items-center gap-2">
            <span className="text-sybil-accent font-mono">02</span> AI Analysis & Evaluation Setup
          </h2>
          
          {/* Question 1: Single or Multi Analysis */}
          <div className="mb-8">
            <label className="block text-sybil-text mb-3 font-heading font-medium">
              Do you want to analyze the logs using a single AI, or multiple AIs simultaneously?
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setGeneratingMode('single')}
                className={`flex-1 p-3 rounded-lg border transition-all duration-200 font-heading tracking-wide ${
                  generatingMode === 'single'
                    ? 'border-sybil-accent bg-sybil-accent/10 text-sybil-accent shadow-[0_0_15px_rgba(0,229,255,0.1)]'
                    : 'border-sybil-border bg-sybil-surface text-sybil-text2 hover:border-sybil-border2 hover:text-sybil-text'
                }`}
              >
                Single AI Model
              </button>
              <button
                onClick={() => setGeneratingMode('multi')}
                className={`flex-1 p-3 rounded-lg border transition-all duration-200 font-heading tracking-wide ${
                  generatingMode === 'multi'
                    ? 'border-sybil-accent bg-sybil-accent/10 text-sybil-accent shadow-[0_0_15px_rgba(0,229,255,0.1)]'
                    : 'border-sybil-border bg-sybil-surface text-sybil-text2 hover:border-sybil-border2 hover:text-sybil-text'
                }`}
              >
                Multiple AI Models
              </button>
            </div>
          </div>

          {/* Question 2: Which models for analysis */}
          <div className="mb-8 p-4 bg-sybil-surface rounded-xl border border-sybil-border/50">
            <label className="block text-sybil-text mb-3 font-heading font-medium">
              {generatingMode === 'single' ? 'Which AI model should analyze the logs?' : 'Select the AI models you want to use for analysis:'}
            </label>
            <div className="grid md:grid-cols-2 gap-3">
              {models.map((m) => {
                const isSelected = generatingModels.includes(m.id);
                return (
                  <button
                    key={`gen-${m.id}`}
                    onClick={() => m.available && toggleGenModel(m.id)}
                    disabled={!m.available}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 text-left ${
                      isSelected
                        ? 'border-sybil-accent/50 bg-sybil-accent/5'
                        : 'border-sybil-border bg-[#0a0d12] hover:border-sybil-border2'
                    } ${!m.available ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'border-sybil-accent bg-sybil-accent' : 'border-sybil-border2'
                      }`}>
                        {isSelected && <span className="text-sybil-bg text-xs">✓</span>}
                      </div>
                      <div>
                        <span className={`font-heading font-medium text-sm block ${isSelected ? 'text-sybil-text' : 'text-sybil-text2'}`}>
                          {m.display_name}
                        </span>
                        <span className={`text-xs ${providerColors[m.provider] || 'text-sybil-text3'} uppercase tracking-wider`}>
                          {m.provider}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question 3: Cross Evaluation */}
          <div className="mb-8">
            <label className="block text-sybil-text mb-3 font-heading font-medium">
              Would you like the final response(s) to be fact-checked and evaluated by another AI?
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setWantsEval(true)}
                className={`flex-1 p-3 rounded-lg border transition-all duration-200 font-heading tracking-wide ${
                  wantsEval
                    ? 'border-sybil-purple bg-sybil-purple/10 text-sybil-purple shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                    : 'border-sybil-border bg-sybil-surface text-sybil-text2 hover:border-sybil-border2 hover:text-sybil-text'
                }`}
              >
                Yes, Enable Consensus Evaluator
              </button>
              <button
                onClick={() => { setWantsEval(false); setEvalModels([]); }}
                className={`flex-1 p-3 rounded-lg border transition-all duration-200 font-heading tracking-wide ${
                  !wantsEval
                    ? 'border-sybil-border2 bg-sybil-surface2 text-sybil-text'
                    : 'border-sybil-border bg-sybil-surface text-sybil-text2 hover:border-sybil-border2 hover:text-sybil-text'
                }`}
              >
                No, Skip Evaluation
              </button>
            </div>
          </div>

          {/* Question 4: Which models for evaluation */}
          {wantsEval && (
            <div className="p-4 bg-sybil-purple/5 rounded-xl border border-sybil-purple/20 animate-fade-in">
              <label className="block text-sybil-text mb-3 font-heading font-medium">
                Which AI model(s) should perform the fact-checking?
              </label>
              <div className="grid md:grid-cols-2 gap-3">
                {models.map((m) => {
                  const isSelected = evalModels.includes(m.id);
                  const isAlreadyGenerating = generatingModels.includes(m.id);
                  return (
                    <button
                      key={`eval-${m.id}`}
                      onClick={() => m.available && !isAlreadyGenerating && toggleEvalModel(m.id)}
                      disabled={!m.available || isAlreadyGenerating}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 text-left ${
                        isSelected
                          ? 'border-sybil-purple/50 bg-sybil-purple/10'
                          : 'border-sybil-border bg-[#0a0d12] hover:border-sybil-border2'
                      } ${(!m.available || isAlreadyGenerating) ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected ? 'border-sybil-purple bg-sybil-purple' : 'border-sybil-border2'
                        }`}>
                          {isSelected && <span className="text-sybil-bg text-xs">✓</span>}
                        </div>
                        <div>
                          <span className={`font-heading font-medium text-sm block ${isSelected ? 'text-sybil-text' : 'text-sybil-text2'}`}>
                            {m.display_name}
                          </span>
                          {isAlreadyGenerating && (
                            <span className="text-xs text-sybil-amber">Currently analyzing</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Advanced Settings */}
        <div className="glass-panel p-6">
          <h2 className="text-lg font-heading font-bold text-sybil-text mb-4 flex items-center gap-2">
            <span className="text-sybil-accent font-mono">03</span> Advanced Settings
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-sybil-text2 mb-2 font-body">
                Max Events: <span className="text-sybil-accent font-mono">{maxEvents}</span>
              </label>
              <input
                type="range"
                min={50}
                max={800}
                step={10}
                value={maxEvents}
                onChange={(e) => onMaxEventsChange(Number(e.target.value))}
                className="w-full accent-sybil-accent"
              />
              <div className="flex justify-between text-xs text-sybil-text3 mt-1 font-mono">
                <span>50</span>
                <span>~{Math.round(maxEvents * 225)} tokens</span>
                <span>800</span>
              </div>
            </div>

            {(generatingMode === 'multi' || wantsEval) && (
              <div>
                <label className="block text-sm text-sybil-text2 mb-2 font-body">
                  Consensus Threshold:{' '}
                  <span className="text-sybil-accent font-mono">{(consensusThreshold * 100).toFixed(0)}%</span>
                  <span className={`ml-2 text-xs ${consensusThreshold >= 0.90 ? 'text-sybil-red' : consensusThreshold >= 0.75 ? 'text-sybil-amber' : 'text-sybil-green'}`}>
                    ({thresholdLabel})
                  </span>
                </label>
                <input
                  type="range"
                  min={60}
                  max={95}
                  step={5}
                  value={consensusThreshold * 100}
                  onChange={(e) => onConsensusThresholdChange(Number(e.target.value) / 100)}
                  className="w-full accent-sybil-accent"
                />
                <div className="flex justify-between text-xs text-sybil-text3 mt-1 font-mono">
                  <span>60% Lenient</span>
                  <span>95% Strict</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Analyze Button */}
        <div className="text-center py-4">
          <button
            onClick={handleAnalyzeClick}
            disabled={!canAnalyze}
            className="btn-primary text-lg px-12 py-4 relative group"
          >
            <span className="relative z-10 flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              ANALYZE INCIDENT
            </span>
            {canAnalyze && (
              <div className="absolute inset-0 bg-gradient-to-r from-sybil-accent to-cyan-400 rounded-lg blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
            )}
          </button>
          {!canAnalyze && (
            <p className="text-sybil-text3 text-sm mt-2 font-body">
              {availableModels.length === 0
                ? 'No models available — configure API keys in backend .env'
                : 'Please select an analyzing AI to begin'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
