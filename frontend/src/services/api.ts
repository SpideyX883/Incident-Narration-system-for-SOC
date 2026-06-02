/**
 * Project Sybil — API Service
 * All fetch() calls to the backend.
 */

const API_BASE = '/api';

export async function fetchModels() {
  const res = await fetch(`${API_BASE}/models`);
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  return res.json();
}

export async function fetchScenarios() {
  const res = await fetch(`${API_BASE}/scenarios`);
  if (!res.ok) throw new Error(`Failed to fetch scenarios: ${res.status}`);
  return res.json();
}

export async function healthCheck() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export async function submitAnalysis(payload: {
  scenario_id: string;
  mode: string;
  primary_model: { provider: string; model_id: string };
  cross_val_models: { provider: string; model_id: string }[];
  consensus_threshold: number;
  max_events: number;
  request_id: string;
}) {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Analysis failed: ${res.status}`);
  }
  return res.json();
}

export function generateRequestId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  return `sybil_${ts}`;
}
