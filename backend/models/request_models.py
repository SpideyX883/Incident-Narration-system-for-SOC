"""
Project Sybil — Request Models
Pydantic models for API request validation.
"""

from typing import Optional

from pydantic import BaseModel, Field


class ModelSelection(BaseModel):
    """A selected model for analysis."""
    provider: str = Field(..., description="Model provider: google, openrouter, anthropic, openai")
    model_id: str = Field(..., description="Model identifier string")


class AnalysisRequest(BaseModel):
    """Full analysis request payload from frontend."""
    scenario_id: str = Field(..., description="ID of the log scenario to analyze")
    mode: str = Field(default="ensemble", description="Analysis mode: 'ensemble' or 'single'")
    primary_model: ModelSelection = Field(
        ..., description="Primary model selection"
    )
    cross_val_models: list[ModelSelection] = Field(
        default_factory=list,
        description="Cross-validation model selections (ensemble mode only)",
    )
    consensus_threshold: float = Field(
        default=0.80,
        ge=0.60,
        le=0.95,
        description="Consensus threshold for ensemble agreement",
    )
    max_events: int = Field(
        default=200,
        ge=50,
        le=800,
        description="Maximum events to include in timeline",
    )
    anonymize: bool = Field(
        default=False,
        description="Whether to anonymize logs before analysis"
    )
    request_id: str = Field(..., description="Unique request identifier from frontend")


class RuntimeConfig(BaseModel):
    """Resolved runtime configuration for an analysis run."""
    scenario_id: str
    mode: str
    primary_model_id: str
    cross_val_model_ids: list[str] = Field(default_factory=list)
    consensus_threshold: float = 0.80
    max_events: int = 200
    anonymize: bool = False
    request_id: str = ""
