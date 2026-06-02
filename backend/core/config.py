"""
Project Sybil — Configuration Manager
Loads config.json and environment variables into a typed settings object.
"""

import json
import os
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv

# Load .env from backend directory
_backend_dir = Path(__file__).resolve().parent.parent
load_dotenv(_backend_dir / ".env", override=True)


class ModelConfig:
    """Represents a single AI model's configuration."""

    def __init__(self, data: dict):
        self.id: str = data["id"]
        self.display_name: str = data["display_name"]
        self.provider: str = data["provider"]
        self.context_window_tokens: int = data["context_window_tokens"]
        self.cost_tier: str = data["cost_tier"]
        self.role: str = data.get("role", "fallback")
        self.reasoning_mode: Optional[str] = data.get("reasoning_mode")
        self.api_key_env_var: str = data["api_key_env_var"]
        self.base_url: Optional[str] = data.get("base_url")
        self.temperature: float = data.get("temperature", 0.0)
        self.timeout_seconds: int = data.get("timeout_seconds", 60)
        self.cost_per_1m_input: Optional[float] = data.get("cost_per_1m_input")
        self.cost_per_1m_output: Optional[float] = data.get("cost_per_1m_output")

    @property
    def api_key(self) -> Optional[str]:
        """Retrieve API key from environment."""
        key = os.getenv(self.api_key_env_var, "")
        if key and not key.startswith("your_") and not key.endswith("_here") and key != "optional_paid_key":
            return key
        return None

    @property
    def available(self) -> bool:
        """Check if this model's API key is configured."""
        if self.provider == "ollama":
            return True
        return self.api_key is not None

    def to_dict(self) -> dict:
        """Serialize for API response."""
        return {
            "id": self.id,
            "display_name": self.display_name,
            "provider": self.provider,
            "context_window_tokens": self.context_window_tokens,
            "cost_tier": self.cost_tier,
            "role": self.role,
            "reasoning_mode": self.reasoning_mode,
            "temperature": self.temperature,
            "timeout_seconds": self.timeout_seconds,
            "available": self.available,
        }


class ScenarioConfig:
    """Represents a single log scenario's configuration."""

    def __init__(self, data: dict, base_dir: Path):
        self.id: str = data["id"]
        self.display_name: str = data["display_name"]
        self.file: str = data["file"]
        self.description: str = data["description"]
        self.event_count_approx: int = data["event_count_approx"]
        self.mitre_techniques: list[str] = data["mitre_techniques"]
        self.difficulty: str = data["difficulty"]
        self._base_dir = base_dir

    @property
    def file_path(self) -> Path:
        return self._base_dir / self.file

    @property
    def file_exists(self) -> bool:
        return self.file_path.exists()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "display_name": self.display_name,
            "description": self.description,
            "event_count_approx": self.event_count_approx,
            "mitre_techniques": self.mitre_techniques,
            "difficulty": self.difficulty,
            "file_exists": self.file_exists,
        }


class Settings:
    """Central settings object loaded from config.json + environment."""

    def __init__(self):
        self._backend_dir = _backend_dir
        self._config = self._load_config()

        # Server settings
        server = self._config["server"]
        self.host: str = server["host"]
        self.port: int = server["port"]
        self.reload: bool = server["reload"]
        self.cors_origins: list[str] = server["cors_origins"]
        self.websocket_timeout_seconds: int = server["websocket_timeout_seconds"]

        # Analysis settings
        analysis = self._config["analysis"]
        self.default_mode: str = analysis["default_mode"]
        self.default_primary_model: str = analysis["default_primary_model"]
        self.default_cross_val_models: list[str] = analysis["default_cross_val_models"]
        self.consensus_threshold_default: float = analysis["consensus_threshold_default"]
        self.consensus_threshold_min: float = analysis["consensus_threshold_min"]
        self.consensus_threshold_max: float = analysis["consensus_threshold_max"]
        self.max_events_default: int = analysis["max_events_default"]
        self.max_events_for_128k_context: int = analysis["max_events_for_128k_context"]
        self.max_events_for_1m_context: int = analysis["max_events_for_1m_context"]
        self.citation_compliance_minimum: float = analysis["citation_compliance_minimum"]
        self.citation_compliance_retry_threshold: float = analysis["citation_compliance_retry_threshold"]
        self.max_citation_retries: int = analysis["max_citation_retries"]
        self.model_timeout_seconds: int = analysis["model_timeout_seconds"]
        self.parallel_calls: bool = analysis["parallel_calls"]

        # Consensus engine settings
        ce = self._config["consensus_engine"]
        self.bertscore_model_fast: str = ce["bertscore_model_fast"]
        self.bertscore_model_accurate: str = ce["bertscore_model_accurate"]
        self.bertscore_consensus_threshold: float = ce["bertscore_consensus_threshold"]
        self.bertscore_partial_threshold: float = ce["bertscore_partial_threshold"]
        self.citation_confirmed_min_models: int = ce["citation_confirmed_min_models"]
        self.use_fast_model_in_ui: bool = ce["use_fast_model_in_ui"]

        # Data processing settings
        dp = self._config["data_processing"]
        self.priority_event_ids: list[int] = dp["priority_event_ids"]
        self.low_priority_event_ids: list[int] = dp["low_priority_event_ids"]
        self.fields_to_include: list[str] = dp["fields_to_include"]
        self.fields_to_exclude: list[str] = dp["fields_to_exclude"]

        # Export settings
        export = self._config["export"]
        self.pdf_enabled: bool = export["pdf_enabled"]
        self.json_enabled: bool = export["json_enabled"]
        self.include_raw_logs_in_export: bool = export["include_raw_logs_in_export"]
        self.include_consensus_metrics: bool = export["include_consensus_metrics"]

        # Logging
        self.log_level: str = self._config["logging"]["level"]
        self.log_api_calls: bool = self._config["logging"]["log_api_calls"]
        self.log_token_usage: bool = self._config["logging"]["log_token_usage"]
        self.log_consensus_scores: bool = self._config["logging"]["log_consensus_scores"]

        # Build model configs
        self._all_models: list[ModelConfig] = []
        for m in self._config["models"]["primary_tier"]:
            self._all_models.append(ModelConfig(m))
        for m in self._config["models"].get("paid_tier", []):
            self._all_models.append(ModelConfig(m))

        self._fallback_chains: dict[str, list[str]] = self._config["models"]["fallback_chains"]

        # Build scenario configs
        self._scenarios: list[ScenarioConfig] = []
        for s in self._config["scenarios"]:
            self._scenarios.append(ScenarioConfig(s, self._backend_dir))

    def _load_config(self) -> dict:
        config_path = self._backend_dir / "config.json"
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def get_model(self, model_id: str) -> Optional[ModelConfig]:
        """Get a model config by ID."""
        for m in self._all_models:
            if m.id == model_id:
                return m
        return None

    def get_all_models(self) -> list[ModelConfig]:
        """Get all configured models."""
        return self._all_models

    def get_available_models(self) -> list[ModelConfig]:
        """Get models that have API keys configured."""
        return [m for m in self._all_models if m.available]

    def get_fallback_chain(self, role: str, requested_model_id: str) -> list[str]:
        """
        Get the fallback chain for a given role, starting with the requested model.
        """
        chain_key = role if role in self._fallback_chains else "primary"
        chain = self._fallback_chains.get(chain_key, [])

        # Ensure requested model is first in chain
        if requested_model_id in chain:
            idx = chain.index(requested_model_id)
            return chain[idx:] + chain[:idx]
        else:
            return [requested_model_id] + chain

    def get_scenarios(self) -> list[ScenarioConfig]:
        """Get all configured scenarios."""
        return self._scenarios

    def get_scenario(self, scenario_id: str) -> Optional[ScenarioConfig]:
        """Get a scenario config by ID."""
        for s in self._scenarios:
            if s.id == scenario_id:
                return s
        return None


# Singleton instance
settings = Settings()
