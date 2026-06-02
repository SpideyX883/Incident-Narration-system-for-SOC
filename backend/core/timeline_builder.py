"""
Project Sybil — Timeline Builder
Transforms raw events into the structured timeline string the AI receives.
"""

import json
import logging
from typing import Optional

from core.config import settings

logger = logging.getLogger("sybil.timeline_builder")


def prune_log_for_ai(event: dict) -> dict:
    """
    Strip an event to only the fields the AI needs.
    Uses the fields_to_include list from config.
    """
    fields = settings.fields_to_include
    pruned = {}
    for key in fields:
        if key in event:
            pruned[key] = event[key]
    return pruned


def inject_log_ids(events: list[dict]) -> list[dict]:
    """
    Add a sequential LOG_ID field to each event (1, 2, 3...).
    Returns a new list with LOG_IDs injected.
    """
    result = []
    for idx, event in enumerate(events, start=1):
        enriched = {"LOG_ID": idx}
        enriched.update(event)
        result.append(enriched)
    return result


def estimate_token_count(text: str) -> int:
    """
    Estimate token count using ~4 characters per token approximation.
    This avoids needing to load tiktoken for every estimate.
    """
    return len(text) // 4


def format_log_entry(event: dict) -> str:
    """
    Format a single event into the timeline string format:
    [LOG_ID: X] field=value | field=value | ...
    """
    log_id = event.get("LOG_ID", 0)
    parts = []
    for key, value in event.items():
        if key == "LOG_ID":
            continue
        # Clean up the value for readability
        if isinstance(value, str):
            val_str = value
        else:
            val_str = str(value)
        parts.append(f"{key}={val_str}")

    fields_str = " | ".join(parts)
    return f"[LOG_ID: {log_id}] {fields_str}"


def assemble_timeline(
    events: list[dict],
    max_events: Optional[int] = None,
    context_limit: Optional[int] = None,
) -> tuple[str, dict]:
    """
    Build the final timeline string from a list of events.

    Steps:
    1. Prune each event to AI-relevant fields
    2. Inject sequential LOG_IDs
    3. Format into timeline string
    4. Estimate tokens and truncate if needed

    Returns:
        tuple of (timeline_string, metadata_dict)
        metadata includes events_included, events_truncated, total_log_ids, etc.
    """
    if max_events is None:
        max_events = settings.max_events_default

    # Step 1: Prune fields
    pruned = [prune_log_for_ai(e) for e in events]

    # Step 2: Truncate to max_events before injecting IDs
    events_truncated = 0
    truncation_reason = None
    if len(pruned) > max_events:
        events_truncated = len(pruned) - max_events
        pruned = pruned[:max_events]
        truncation_reason = f"Truncated to {max_events} events (removed {events_truncated})"

    # Step 3: Inject LOG_IDs
    with_ids = inject_log_ids(pruned)

    # Step 4: Format each entry
    lines = [format_log_entry(e) for e in with_ids]

    # Step 5: Check token budget if context limit provided
    if context_limit:
        timeline_str = "\n".join(lines)
        estimated_tokens = estimate_token_count(timeline_str)

        # Reserve ~30% of context for system prompt + response
        available_tokens = int(context_limit * 0.7)

        if estimated_tokens > available_tokens:
            # Progressively remove entries from the end until we fit
            while lines and estimate_token_count("\n".join(lines)) > available_tokens:
                lines.pop()
                events_truncated += 1

            truncation_reason = (
                f"Token budget exceeded: truncated to {len(lines)} events "
                f"(~{estimate_token_count(chr(10).join(lines))} tokens of {available_tokens} available)"
            )

    timeline_string = "\n".join(lines)
    total_log_ids = len(lines)

    events_map = {}
    # Build events_map from the with_ids array (only those that weren't truncated in step 5)
    for event in with_ids[:total_log_ids]:
        log_id = event.get("LOG_ID")
        if log_id:
            events_map[str(log_id)] = event

    metadata = {
        "events_included": total_log_ids,
        "events_truncated": events_truncated,
        "truncation_reason": truncation_reason,
        "estimated_tokens": estimate_token_count(timeline_string),
        "total_log_ids": total_log_ids,
        "events_map": events_map,
    }

    logger.info(
        f"Timeline assembled: {total_log_ids} events, "
        f"~{metadata['estimated_tokens']} tokens"
    )

    return timeline_string, metadata
