"""
Project Sybil — API Routes
All REST API route definitions.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from api.websocket import create_progress_callback, send_progress
from core.config import settings
from core.data_loader import filter_dataset_robust, get_available_scenarios, load_jsonl
from core.model_router import ModelRouter
from core.consensus_engine import (
    bertscore_pairwise,
    calculate_overall_confidence,
    citation_matrix,
    divergence_annotator,
)
from core.prompt_builder import build_system_prompt
from core.timeline_builder import assemble_timeline
from models.request_models import AnalysisRequest, RuntimeConfig
from models.response_models import (
    AnalysisResponse,
    ConsensusResult,
    DivergenceItem,
    ModelsUsed,
    NarrativeResult,
    TimelineMetadata,
)

logger = logging.getLogger("sybil.routes")
router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "version": "2.0.0", "project": "Project Sybil"}


@router.get("/models")
async def get_models():
    """
    Returns list of all available models with metadata.
    Models without configured API keys are marked as unavailable.
    """
    all_models = settings.get_all_models()
    return {
        "models": [m.to_dict() for m in all_models],
        "defaults": {
            "primary": settings.default_primary_model,
            "cross_val": settings.default_cross_val_models,
        },
    }


@router.get("/scenarios")
async def get_scenarios():
    """
    Returns list of available log scenarios.
    Includes event count, MITRE techniques, difficulty.
    """
    scenarios = get_available_scenarios()
    return {"scenarios": scenarios}


@router.post("/analyze", response_model=AnalysisResponse)
async def run_analysis(request: AnalysisRequest):
    """
    Main analysis endpoint.
    Accepts full analysis config, runs models, returns structured results.
    """
    logger.info(f"Analysis request received: {request.request_id}")

    # ----- Step 1: Validate scenario -----
    scenario = settings.get_scenario(request.scenario_id)
    if not scenario:
        raise HTTPException(
            status_code=404,
            detail=f"Scenario not found: {request.scenario_id}",
        )
    if not scenario.file_exists:
        raise HTTPException(
            status_code=404,
            detail=f"Scenario file not found: {scenario.file}",
        )

    # ----- Step 2: Validate models -----
    primary_config = settings.get_model(request.primary_model.model_id)
    if not primary_config:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model: {request.primary_model.model_id}",
        )
    if not primary_config.available:
        raise HTTPException(
            status_code=400,
            detail=f"API key not configured for {primary_config.display_name}",
        )

    cross_val_ids = []
    if request.mode == "ensemble":
        for cv in request.cross_val_models:
            cv_config = settings.get_model(cv.model_id)
            if cv_config and cv_config.available:
                cross_val_ids.append(cv.model_id)

    # ----- Step 3: Load and process data -----
    progress_callback = await create_progress_callback(request.request_id)

    await progress_callback({
        "event": "data_loading",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    raw_events = load_jsonl(scenario.file_path)
    filtered_events = filter_dataset_robust(
        raw_events,
        max_events=request.max_events,
    )

    # ----- Step 4: Build timeline -----
    context_limit = primary_config.context_window_tokens
    timeline_string, timeline_meta = assemble_timeline(
        filtered_events,
        max_events=request.max_events,
        context_limit=context_limit,
    )

    # ----- Step 5: Build prompt -----
    system_prompt = build_system_prompt(timeline_string)

    # ----- Step 6: Run models -----
    model_router = ModelRouter()
    runtime_config = RuntimeConfig(
        scenario_id=request.scenario_id,
        mode=request.mode,
        primary_model_id=request.primary_model.model_id,
        cross_val_model_ids=cross_val_ids,
        consensus_threshold=request.consensus_threshold,
        max_events=request.max_events,
        request_id=request.request_id,
    )

    if request.mode == "ensemble":
        model_results = await model_router.run_ensemble(
            system_prompt, runtime_config, progress_callback
        )
    else:
        single_result = await model_router.run_single(
            system_prompt, runtime_config, progress_callback
        )
        model_results = {request.primary_model.model_id: single_result}

    # ----- Step 7: Build response -----
    narratives = {}
    failed_models = []
    token_usage = {}
    warnings = []

    for model_id, result in model_results.items():
        if result.error and not result.text:
            failed_models.append(model_id)
            warnings.append(
                f"{model_id} failed: {result.error} — excluded from consensus."
            )
            continue

        narratives[model_id] = NarrativeResult(
            text=result.text,
            citations=result.citations,
            compliance_rate=result.compliance_rate,
            sentence_count=result.sentence_count,
            uncited_count=len(result.uncited_sentences),
            uncited_sentences=result.uncited_sentences,
            latency_ms=result.latency_ms,
            tokens_used=result.tokens_used,
            error=result.error,
            partial=result.partial,
        )
        token_usage[model_id] = result.tokens_used

    # Determine status
    if not narratives:
        status = "all_failed"
    elif failed_models:
        status = "partial_success"
    else:
        status = "success"

    # ----- Step 8: Consensus analysis (ensemble mode) -----
    consensus = None
    divergences = []

    if request.mode == "ensemble" and len(narratives) >= 2:
        await progress_callback({"event": "consensus_started"})

        try:
            # Citation matrix
            successful_results = {
                mid: model_results[mid]
                for mid in narratives.keys()
            }
            total_log_ids = timeline_meta["total_log_ids"]

            cm = citation_matrix(successful_results, total_log_ids)

            # BERTScore
            bs_pairs = bertscore_pairwise(
                successful_results,
                use_fast=settings.use_fast_model_in_ui,
            )

            # Divergence analysis
            divs = divergence_annotator(
                successful_results,
                bs_pairs,
                threshold=request.consensus_threshold,
            )

            # Overall confidence
            confidence = calculate_overall_confidence(cm, bs_pairs)

            # Build consensus result
            from models.response_models import CitationMatrixEntry

            citation_matrix_entries = {}
            confirmed_ids = []
            unverified_ids = []
            phantom_ids = []

            for lid, info in cm.items():
                entry = CitationMatrixEntry(
                    phase=info.get("phase", ""),
                    cited_by=info.get("cited_by", []),
                    status=info.get("status", "NOT_CITED"),
                    agreement_rate=info.get("agreement_rate", 0.0),
                )
                citation_matrix_entries[lid] = entry

                if entry.status == "CONFIRMED":
                    confirmed_ids.append(int(lid.replace("LOG_ID_", "")))
                elif entry.status == "UNVERIFIED":
                    unverified_ids.append(int(lid.replace("LOG_ID_", "")))
                elif entry.status == "PHANTOM":
                    phantom_ids.append(int(lid.replace("LOG_ID_", "")))

            consensus = ConsensusResult(
                citation_matrix=citation_matrix_entries,
                bertscore_pairs=bs_pairs,
                overall_confidence=confidence,
                confirmed_log_ids=confirmed_ids,
                unverified_log_ids=unverified_ids,
                phantom_citations=phantom_ids,
            )

            divergences = [
                DivergenceItem(
                    sentence_a=d.get("sentence_a", ""),
                    model_a=d.get("model_a", ""),
                    sentence_b=d.get("sentence_b", ""),
                    model_b=d.get("model_b", ""),
                    bertscore=d.get("bertscore", 0.0),
                    status=d.get("status", "divergent"),
                    log_ids_cited=d.get("log_ids_cited", {}),
                    error_type=d.get("error_type"),
                )
                for d in divs
            ]

            await progress_callback({
                "event": "consensus_complete",
                "confidence": confidence,
            })

        except Exception as e:
            logger.error(f"Consensus analysis failed: {e}", exc_info=True)
            warnings.append(f"Consensus analysis failed: {str(e)}")

    # Determine actual primary model used
    actual_primary = request.primary_model.model_id
    actual_cross_val = [
        mid for mid in cross_val_ids if mid in narratives and mid != actual_primary
    ]

    models_used = ModelsUsed(
        primary=actual_primary,
        cross_val=actual_cross_val,
        failed=failed_models,
    )

    raw_timeline = TimelineMetadata(
        events_sent=timeline_meta["events_included"],
        events_truncated=timeline_meta["events_truncated"],
        truncation_reason=timeline_meta.get("truncation_reason"),
        total_log_ids=timeline_meta["total_log_ids"],
    )

    # Send completion event
    await progress_callback({
        "event": "analysis_complete",
        "request_id": request.request_id,
    })

    response = AnalysisResponse(
        request_id=request.request_id,
        status=status,
        models_used=models_used,
        narratives=narratives,
        consensus=consensus,
        divergences=divergences,
        raw_timeline=raw_timeline,
        token_usage=token_usage,
        warnings=warnings,
    )

    logger.info(f"Analysis complete: {request.request_id} — status={status}")
    return response
