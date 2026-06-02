/**
 * Project Sybil — Analysis Hook
 * Main application state management.
 */

import { useCallback, useState } from 'react';
import type {
  AnalysisResponse,
  AppState,
  ModelConfig,
  ModelSelection,
  ProgressEvent,
  ScenarioConfig,
} from '../types';
import { fetchModels, fetchScenarios, generateRequestId, submitAnalysis } from '../services/api';
import { useWebSocket } from './useWebSocket';

export function useAnalysis() {
  // App state
  const [appState, setAppState] = useState<AppState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Data from backend
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioConfig[]>([]);
  const [defaults, setDefaults] = useState<{ primary: string; cross_val: string[] }>({
    primary: '',
    cross_val: [],
  });

  // Config
  const [scenarioId, setScenarioId] = useState('');
  const [mode, setMode] = useState<'single' | 'ensemble'>('ensemble');
  const [primaryModel, setPrimaryModel] = useState<string>('');
  const [crossValModels, setCrossValModels] = useState<string[]>([]);
  const [consensusThreshold, setConsensusThreshold] = useState(0.80);
  const [maxEvents, setMaxEvents] = useState(200);

  // Progress & Results
  const [requestId, setRequestId] = useState<string | null>(null);
  const [progressEvents, setProgressEvents] = useState<ProgressEvent[]>([]);
  const [results, setResults] = useState<AnalysisResponse | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);

  // WebSocket
  const handleProgressEvent = useCallback((event: ProgressEvent) => {
    setProgressEvents((prev) => [...prev, event]);
  }, []);

  const handleComplete = useCallback(() => {
    // Results will come from the HTTP response
  }, []);

  useWebSocket({
    requestId: appState === 'analyzing' ? requestId : null,
    onEvent: handleProgressEvent,
    onComplete: handleComplete,
  });

  // Load initial data
  const loadInitialData = useCallback(async () => {
    try {
      const [modelsData, scenariosData] = await Promise.all([
        fetchModels(),
        fetchScenarios(),
      ]);

      setModels(modelsData.models);
      setDefaults(modelsData.defaults);
      setScenarios(scenariosData.scenarios);

      // Set defaults
      if (modelsData.defaults.primary) {
        setPrimaryModel(modelsData.defaults.primary);
      }
      if (modelsData.defaults.cross_val) {
        setCrossValModels(modelsData.defaults.cross_val);
      }
      if (scenariosData.scenarios.length > 0) {
        setScenarioId(scenariosData.scenarios[0].id);
      }
    } catch (e) {
      console.error('Failed to load initial data:', e);
      setError('Failed to connect to backend. Is the server running?');
    }
  }, []);

  // Start analysis
  const startAnalysis = useCallback(async (selectedPrimary: string, selectedCrossVals: string[]) => {
    setError(null);
    setProgressEvents([]);
    setResults(null);

    const reqId = generateRequestId();
    setRequestId(reqId);
    setAppState('analyzing');

    // Update hook state with UI selections
    setPrimaryModel(selectedPrimary);
    setCrossValModels(selectedCrossVals);
    
    // Dynamically set mode based on selections
    const isEnsemble = selectedCrossVals.length > 0;
    setMode(isEnsemble ? 'ensemble' : 'single');

    try {
      const primaryModelConfig = models.find((m) => m.id === selectedPrimary);
      const crossValModelConfigs = selectedCrossVals
        .map((id) => models.find((m) => m.id === id))
        .filter(Boolean) as ModelConfig[];

      const payload = {
        scenario_id: scenarioId,
        mode: isEnsemble ? 'ensemble' : 'single',
        primary_model: {
          provider: primaryModelConfig?.provider || 'google',
          model_id: selectedPrimary,
        },
        cross_val_models: isEnsemble
          ? crossValModelConfigs.map((m) => ({
              provider: m.provider,
              model_id: m.id,
            }))
          : [],
        consensus_threshold: consensusThreshold,
        max_events: maxEvents,
        request_id: reqId,
      };

      const response = await submitAnalysis(payload);
      setResults(response);
      setAppState('complete');
    } catch (e: any) {
      setError(e.message || 'Analysis failed');
      setAppState('error');
    }
  }, [models, scenarioId, consensusThreshold, maxEvents]);

  // Reset to idle
  const resetToIdle = useCallback(() => {
    setAppState('idle');
    setError(null);
    setProgressEvents([]);
    setResults(null);
    setRequestId(null);
    setSelectedLogId(null);
  }, []);

  // Toggle cross-val model
  const toggleCrossValModel = useCallback((modelId: string) => {
    setCrossValModels((prev) => {
      if (prev.includes(modelId)) {
        return prev.filter((id) => id !== modelId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, modelId];
    });
  }, []);

  return {
    // State
    appState,
    error,
    models,
    scenarios,
    defaults,
    requestId,
    progressEvents,
    results,
    selectedLogId,

    // Config
    scenarioId,
    mode,
    primaryModel,
    crossValModels,
    consensusThreshold,
    maxEvents,

    // Setters
    setScenarioId,
    setMode,
    setPrimaryModel,
    setCrossValModels,
    toggleCrossValModel,
    setConsensusThreshold,
    setMaxEvents,
    setSelectedLogId,

    // Actions
    loadInitialData,
    startAnalysis,
    resetToIdle,
  };
}
