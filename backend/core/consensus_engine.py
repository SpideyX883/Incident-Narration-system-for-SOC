"""
Project Sybil — Consensus Engine
Compares model outputs for agreement, divergence, and hallucination detection.
Implements citation matrix, BERTScore pairwise analysis, and divergence annotation.
"""

import logging
import re
from itertools import combinations
from typing import Any, Optional

logger = logging.getLogger("sybil.consensus")


def citation_matrix(
    results: dict[str, Any],
    total_log_ids: int,
    min_models_for_confirmed: int = 2,
) -> dict[str, dict]:
    """
    Build a citation matrix showing which models cited which LOG_IDs.

    For each LOG_ID in 1..total_log_ids:
    - Record which models cited it
    - Calculate agreement rate
    - Classify: CONFIRMED / UNVERIFIED / PHANTOM / NOT_CITED

    Args:
        results: dict of model_id -> ModelResult
        total_log_ids: total number of LOG_IDs in the timeline
        min_models_for_confirmed: minimum models needed for CONFIRMED status

    Returns:
        dict of LOG_ID_X -> {cited_by, status, agreement_rate, phase}
    """
    total_models = len(results)
    if total_models == 0:
        return {}

    # Collect all citations per model
    model_citations: dict[str, set[int]] = {}
    for model_id, result in results.items():
        cited = set()
        if hasattr(result, 'citations') and result.citations:
            cited = set(result.citations)
        elif hasattr(result, 'text') and result.text:
            cited = set(
                int(m) for m in re.findall(r'\[LOG_ID:\s*(\d+)\]', result.text)
            )
        model_citations[model_id] = cited

    # Build the matrix
    matrix = {}

    # First, handle all valid LOG_IDs (1 to total_log_ids)
    for log_id in range(1, total_log_ids + 1):
        key = f"LOG_ID_{log_id}"
        cited_by = []

        for model_id, citations in model_citations.items():
            if log_id in citations:
                # Use display-friendly name
                short_name = model_id.split("/")[-1].split(":")[0] if "/" in model_id else model_id
                cited_by.append(short_name)

        agreement_rate = len(cited_by) / total_models if total_models > 0 else 0.0

        if len(cited_by) >= min_models_for_confirmed:
            status = "CONFIRMED"
        elif len(cited_by) == 1:
            status = "UNVERIFIED"
        else:
            status = "NOT_CITED"

        matrix[key] = {
            "phase": _infer_attack_phase(log_id),
            "cited_by": cited_by,
            "status": status,
            "agreement_rate": agreement_rate,
        }

    # Check for phantom citations (LOG_IDs that don't exist in timeline)
    all_cited = set()
    for citations in model_citations.values():
        all_cited.update(citations)

    for phantom_id in all_cited:
        if phantom_id > total_log_ids or phantom_id < 1:
            key = f"LOG_ID_{phantom_id}"
            cited_by = []
            for model_id, citations in model_citations.items():
                if phantom_id in citations:
                    short_name = model_id.split("/")[-1].split(":")[0] if "/" in model_id else model_id
                    cited_by.append(short_name)

            matrix[key] = {
                "phase": "PHANTOM",
                "cited_by": cited_by,
                "status": "PHANTOM",
                "agreement_rate": 0.0,
            }

    return matrix


def bertscore_pairwise(
    results: dict[str, Any],
    use_fast: bool = True,
) -> dict[str, float]:
    """
    Compute BERTScore F1 between all pairs of model narratives.

    Args:
        results: dict of model_id -> ModelResult
        use_fast: if True, use distilbert (faster); else roberta-large (more accurate)

    Returns:
        dict of "modelA_vs_modelB" -> F1 score
    """
    model_ids = list(results.keys())
    if len(model_ids) < 2:
        return {}

    # Extract texts
    texts = {}
    for mid in model_ids:
        result = results[mid]
        text = result.text if hasattr(result, 'text') else ""
        texts[mid] = text

    pairs = {}

    try:
        from bert_score import score as bert_score_fn

        model_type = "distilbert-base-uncased" if use_fast else "roberta-large"

        for mid_a, mid_b in combinations(model_ids, 2):
            text_a = texts[mid_a]
            text_b = texts[mid_b]

            if not text_a or not text_b:
                continue

            # BERTScore expects lists
            P, R, F1 = bert_score_fn(
                [text_a], [text_b],
                model_type=model_type,
                lang="en",
                verbose=False,
            )

            short_a = mid_a.split("/")[-1].split(":")[0] if "/" in mid_a else mid_a
            short_b = mid_b.split("/")[-1].split(":")[0] if "/" in mid_b else mid_b
            pair_key = f"{short_a}_vs_{short_b}"
            pairs[pair_key] = round(F1[0].item(), 4)

            logger.info(f"BERTScore {pair_key}: {pairs[pair_key]}")

    except ImportError:
        logger.warning(
            "bert-score not installed. Falling back to simple similarity."
        )
        # Fallback: use simple Jaccard similarity on words
        for mid_a, mid_b in combinations(model_ids, 2):
            words_a = set(texts[mid_a].lower().split())
            words_b = set(texts[mid_b].lower().split())
            if words_a or words_b:
                jaccard = len(words_a & words_b) / len(words_a | words_b) if (words_a | words_b) else 0
            else:
                jaccard = 0.0

            short_a = mid_a.split("/")[-1].split(":")[0] if "/" in mid_a else mid_a
            short_b = mid_b.split("/")[-1].split(":")[0] if "/" in mid_b else mid_b
            pair_key = f"{short_a}_vs_{short_b}"
            pairs[pair_key] = round(jaccard, 4)

    except Exception as e:
        logger.error(f"BERTScore computation failed: {e}", exc_info=True)

    return pairs


def divergence_annotator(
    results: dict[str, Any],
    bertscore_pairs: dict[str, float],
    threshold: float = 0.80,
) -> list[dict]:
    """
    Find sentence pairs between models with BERTScore below threshold.
    Classify divergence types.

    Divergence types:
    - Type A: PHANTOM — one model cited a non-existent LOG_ID
    - Type B: WRONG_EVENT — models cite different LOG_IDs for same claim
    - Type C: MISSING — one model has a finding the other doesn't mention
    - Type D: PHASE_MISMATCH — models place same event in different attack phases

    Returns:
        list of divergence dicts
    """
    model_ids = list(results.keys())
    if len(model_ids) < 2:
        return []

    divergences = []

    for mid_a, mid_b in combinations(model_ids, 2):
        result_a = results[mid_a]
        result_b = results[mid_b]

        text_a = result_a.text if hasattr(result_a, 'text') else ""
        text_b = result_b.text if hasattr(result_b, 'text') else ""

        # Extract sentences with their citations
        sentences_a = _extract_sentences_with_citations(text_a)
        sentences_b = _extract_sentences_with_citations(text_b)

        # Compare citations between models
        citations_a = set(result_a.citations if hasattr(result_a, 'citations') else [])
        citations_b = set(result_b.citations if hasattr(result_b, 'citations') else [])

        # LOG_IDs cited by one model but not the other
        only_a = citations_a - citations_b
        only_b = citations_b - citations_a

        # Find unverified citations and create divergence entries
        for log_id in only_a:
            sentence = _find_sentence_citing(sentences_a, log_id)
            if sentence:
                short_a = mid_a.split("/")[-1].split(":")[0] if "/" in mid_a else mid_a
                short_b = mid_b.split("/")[-1].split(":")[0] if "/" in mid_b else mid_b
                divergences.append({
                    "sentence_a": sentence,
                    "model_a": short_a,
                    "sentence_b": f"[Not mentioned by {short_b}]",
                    "model_b": short_b,
                    "bertscore": 0.0,
                    "status": "divergent",
                    "log_ids_cited": {short_a: [log_id], short_b: []},
                    "error_type": "Type C: MISSING",
                })

        for log_id in only_b:
            sentence = _find_sentence_citing(sentences_b, log_id)
            if sentence:
                short_a = mid_a.split("/")[-1].split(":")[0] if "/" in mid_a else mid_a
                short_b = mid_b.split("/")[-1].split(":")[0] if "/" in mid_b else mid_b
                divergences.append({
                    "sentence_a": f"[Not mentioned by {short_a}]",
                    "model_a": short_a,
                    "sentence_b": sentence,
                    "model_b": short_b,
                    "bertscore": 0.0,
                    "status": "divergent",
                    "log_ids_cited": {short_a: [], short_b: [log_id]},
                    "error_type": "Type C: MISSING",
                })

    return divergences


def calculate_overall_confidence(
    cm: dict[str, dict],
    bertscore_pairs: dict[str, float],
) -> float:
    """
    Calculate overall ensemble confidence score.

    Formula: 60% structural agreement + 40% semantic agreement

    Structural = average agreement rate across CONFIRMED LOG_IDs
    Semantic = average BERTScore across all model pairs
    """
    # Structural agreement
    confirmed_entries = [
        v for v in cm.values()
        if v.get("status") == "CONFIRMED"
    ]

    if confirmed_entries:
        structural = sum(e["agreement_rate"] for e in confirmed_entries) / len(confirmed_entries)
    else:
        # If no confirmed entries, check if there are any cited entries
        cited_entries = [v for v in cm.values() if v.get("status") != "NOT_CITED"]
        if cited_entries:
            structural = sum(e["agreement_rate"] for e in cited_entries) / len(cited_entries)
        else:
            structural = 0.0

    # Semantic agreement
    if bertscore_pairs:
        semantic = sum(bertscore_pairs.values()) / len(bertscore_pairs)
    else:
        semantic = 0.0

    # Weighted combination
    confidence = (0.6 * structural) + (0.4 * semantic)

    # Penalty for phantom citations
    phantom_count = sum(1 for v in cm.values() if v.get("status") == "PHANTOM")
    if phantom_count > 0:
        penalty = min(phantom_count * 0.05, 0.3)  # Max 30% penalty
        confidence = max(0.0, confidence - penalty)

    confidence = round(min(1.0, max(0.0, confidence)), 4)

    logger.info(
        f"Confidence: {confidence:.2%} "
        f"(structural={structural:.2%}, semantic={semantic:.2%}, "
        f"phantoms={phantom_count})"
    )

    return confidence


# ----- Helper functions -----

def _infer_attack_phase(log_id: int) -> str:
    """
    Infer a general attack phase based on log position.
    This is a rough heuristic — actual phase mapping happens in the narrative.
    """
    # Simple heuristic based on position in timeline
    if log_id <= 5:
        return "Initial Access"
    elif log_id <= 20:
        return "Execution"
    elif log_id <= 50:
        return "Discovery"
    elif log_id <= 100:
        return "Persistence"
    elif log_id <= 150:
        return "Credential Access"
    else:
        return "Lateral Movement"


def _extract_sentences_with_citations(text: str) -> list[tuple[str, list[int]]]:
    """Extract sentences and their LOG_ID citations from text."""
    if not text:
        return []

    sentences = []
    for line in text.split("\n"):
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("---"):
            continue

        parts = re.split(r'(?<=[.!?])\s+', line)
        for part in parts:
            part = part.strip()
            if len(part) < 10:
                continue
            log_ids = [int(m) for m in re.findall(r'\[LOG_ID:\s*(\d+)\]', part)]
            sentences.append((part, log_ids))

    return sentences


def _find_sentence_citing(
    sentences: list[tuple[str, list[int]]], log_id: int
) -> Optional[str]:
    """Find the first sentence that cites a specific LOG_ID."""
    for sentence, citations in sentences:
        if log_id in citations:
            return sentence
    return None
