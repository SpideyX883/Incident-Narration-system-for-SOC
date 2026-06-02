/* TypeScript Types for Project Sybil */

// ===== Application State =====
export type AppState = 'idle' | 'analyzing' | 'complete' | 'error';

export interface AnalysisState {
  appState: AppState;
  config: RuntimeConfig;
  progressEvents: ProgressEvent[];
  results: AnalysisResponse | null;
  error: string | null;
  selectedLogId: number | null;
}

// ===== Config =====
export interface RuntimeConfig {
  scenarioId: string;
  mode: 'single' | 'ensemble';
  primaryModel: ModelSelection;
  crossValModels: ModelSelection[];
  consensusThreshold: number;
  maxEvents: number;
}

export interface ModelSelection {
  provider: string;
  modelId: string;
}

// ===== Model & Scenario Metadata =====
export interface ModelConfig {
  id: string;
  display_name: string;
  provider: string;
  context_window_tokens: number;
  cost_tier: 'free' | 'paid';
  role: string;
  reasoning_mode?: string;
  temperature: number;
  timeout_seconds: number;
  available: boolean;
}

export interface ScenarioConfig {
  id: string;
  display_name: string;
  description: string;
  event_count_approx: number;
  mitre_techniques: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  file_exists: boolean;
}

// ===== Progress =====
export interface ProgressEvent {
  event: string;
  model?: string;
  display_name?: string;
  timestamp?: string;
  tokens_so_far?: number;
  citations_found?: number;
  compliance?: number;
  reason?: string;
  fallback_attempted?: boolean;
  confidence?: number;
  request_id?: string;
  latency_ms?: number;
}

// ===== Analysis Response =====
export interface AnalysisResponse {
  request_id: string;
  status: 'success' | 'partial_success' | 'all_failed';
  models_used: ModelsUsed;
  narratives: Record<string, NarrativeResult>;
  consensus: ConsensusResult | null;
  divergences: DivergenceItem[];
  raw_timeline: TimelineMetadata;
  token_usage: Record<string, number>;
  warnings: string[];
}

export interface ModelsUsed {
  primary: string;
  cross_val: string[];
  failed: string[];
}

export interface NarrativeResult {
  text: string;
  citations: number[];
  compliance_rate: number;
  sentence_count: number;
  uncited_count: number;
  uncited_sentences: string[];
  latency_ms: number;
  tokens_used: number;
  error?: string;
  partial: boolean;
}

export interface ConsensusResult {
  citation_matrix: Record<string, CitationMatrixEntry>;
  bertscore_pairs: Record<string, number>;
  overall_confidence: number;
  confirmed_log_ids: number[];
  unverified_log_ids: number[];
  phantom_citations: number[];
}

export interface CitationMatrixEntry {
  phase: string;
  cited_by: string[];
  status: 'CONFIRMED' | 'UNVERIFIED' | 'PHANTOM' | 'NOT_CITED';
  agreement_rate: number;
}

export interface DivergenceItem {
  sentence_a: string;
  model_a: string;
  sentence_b: string;
  model_b: string;
  bertscore: number;
  status: 'consensus' | 'partial' | 'divergent';
  log_ids_cited: Record<string, number[]>;
  error_type?: string;
}

export interface TimelineMetadata {
  events_sent: number;
  events_truncated: number;
  truncation_reason?: string;
  total_log_ids: number;
  events_map: Record<string, any>;
}

// ===== API Responses =====
export interface ModelsResponse {
  models: ModelConfig[];
  defaults: {
    primary: string;
    cross_val: string[];
  };
}

export interface ScenariosResponse {
  scenarios: ScenarioConfig[];
}
