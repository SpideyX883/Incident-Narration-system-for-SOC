import asyncio
import json
import logging
import os
import sys
from pathlib import Path

# Add backend to path so we can import its modules
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from core.config import settings
from core.data_loader import filter_dataset_robust, load_jsonl
from core.model_router import ModelRouter
from core.prompt_builder import build_system_prompt
from core.timeline_builder import assemble_timeline
from models.request_models import RuntimeConfig
from core.consensus_engine import citation_matrix, bertscore_pairwise, divergence_annotator, calculate_overall_confidence

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sybil.evaluate")

async def noop_progress(event):
    pass

async def evaluate():
    logger.info("Starting offline evaluation...")
    
    scenario = settings.get_scenarios()[0]
    if not scenario.file_exists:
        logger.error(f"Scenario file not found: {scenario.file_path}")
        return

    raw_events = load_jsonl(scenario.file_path)
    filtered = filter_dataset_robust(raw_events, max_events=200)
    timeline_str, meta = assemble_timeline(filtered, max_events=200)
    prompt = build_system_prompt(timeline_str)

    config = RuntimeConfig(
        scenario_id=scenario.id,
        mode="ensemble",
        primary_model_id=settings.default_primary_model,
        cross_val_model_ids=settings.default_cross_val_models,
        max_events=200,
        request_id="eval_run",
    )

    router = ModelRouter()
    
    logger.info("Running models in parallel...")
    results = await router.run_ensemble(prompt, config, noop_progress)
    
    successful = {k: v for k, v in results.items() if v.text and not v.error}
    logger.info(f"Models succeeded: {len(successful)}/{len(results)}")

    if len(successful) >= 2:
        cm = citation_matrix(successful, meta["total_log_ids"])
        bs = bertscore_pairwise(successful, use_fast=True)
        conf = calculate_overall_confidence(cm, bs)
        
        logger.info("--- Consensus Metrics ---")
        logger.info(f"Overall Confidence: {conf:.2%}")
        logger.info(f"Confirmed LOG_IDs: {sum(1 for v in cm.values() if v['status'] == 'CONFIRMED')}")
        logger.info(f"Phantom Citations: {sum(1 for v in cm.values() if v['status'] == 'PHANTOM')}")
        logger.info(f"BERTScore Pairs: {json.dumps(bs, indent=2)}")
        
    logger.info("Evaluation complete.")

if __name__ == "__main__":
    asyncio.run(evaluate())
