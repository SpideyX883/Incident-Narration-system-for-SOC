"""
Project Sybil — Response Models
Pydantic models for API response structure.
"""

from typing import Any, Optional

from pydantic import BaseModel, Field


class NarrativeResult(BaseModel):
    """A single model's narrative output."""
    text: str = ""
    citations: list[int] = Field(default_factory=list)
    compliance_rate: float = 0.0
    sentence_count: int = 0
    uncited_count: int = 0
    uncited_sentences: list[str] = Field(default_factory=list)
    latency_ms: int = 0
    tokens_used: int = 0
    error: Optional[str] = None
    partial: bool = False


class CitationMatrixEntry(BaseModel):
    """A single LOG_ID's consensus status."""
    phase: str = ""
    cited_by: list[str] = Field(default_factory=list)
    status: str = "NOT_CITED"  # CONFIRMED, UNVERIFIED, PHANTOM, NOT_CITED
    agreement_rate: float = 0.0


class DivergenceItem(BaseModel):
    """A divergence between model outputs."""
    sentence_a: str = ""
    model_a: str = ""
    sentence_b: str = ""
    model_b: str = ""
    bertscore: float = 0.0
    status: str = "divergent"  # consensus, partial, divergent
    log_ids_cited: dict[str, list[int]] = Field(default_factory=dict)
    error_type: Optional[str] = None  # Type A/B/C/D


class ConsensusResult(BaseModel):
    """Full consensus analysis results."""
    citation_matrix: dict[str, CitationMatrixEntry] = Field(default_factory=dict)
    bertscore_pairs: dict[str, float] = Field(default_factory=dict)
    overall_confidence: float = 0.0
    confirmed_log_ids: list[int] = Field(default_factory=list)
    unverified_log_ids: list[int] = Field(default_factory=list)
    phantom_citations: list[int] = Field(default_factory=list)


class TimelineMetadata(BaseModel):
    """Metadata about the timeline sent to models."""
    events_sent: int = 0
    events_truncated: int = 0
    truncation_reason: Optional[str] = None
    total_log_ids: int = 0
    events_map: dict[str, dict] = Field(default_factory=dict, description="Map of LOG_ID string to raw event dict")


class ModelsUsed(BaseModel):
    """Which models were actually used in the analysis."""
    primary: str = ""
    cross_val: list[str] = Field(default_factory=list)
    failed: list[str] = Field(default_factory=list)


class AnalysisResponse(BaseModel):
    """Full analysis response payload to frontend."""
    request_id: str = ""
    status: str = "success"  # success, partial_success, all_failed
    models_used: ModelsUsed = Field(default_factory=ModelsUsed)
    narratives: dict[str, NarrativeResult] = Field(default_factory=dict)
    consensus: Optional[ConsensusResult] = None
    divergences: list[DivergenceItem] = Field(default_factory=list)
    raw_timeline: TimelineMetadata = Field(default_factory=TimelineMetadata)
    token_usage: dict[str, int] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
