"""
Project Sybil — Data Loader
Loads and filters Mordor JSONL datasets for analysis.
Refactored from the original Dataset Filter Script.py.
"""

import json
import logging
from pathlib import Path
from typing import Optional

from core.config import settings

logger = logging.getLogger("sybil.data_loader")


def load_jsonl(file_path: str | Path) -> list[dict]:
    """
    Read a JSONL file line by line and return a list of event dicts.
    Handles both JSONL (one JSON per line) and JSON array formats.
    """
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"Dataset file not found: {file_path}")

    events = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
                events.append(event)
            except json.JSONDecodeError:
                logger.warning(f"Skipping invalid JSON at line {line_num} in {file_path.name}")
                continue

    logger.info(f"Loaded {len(events)} events from {file_path.name}")
    return events


def extract_event_id(event: dict) -> Optional[int]:
    """
    Extract the EventID from an event dict.
    Handles flat, nested Winlogbeat/EVTX, and Elastic ECS structures.
    """
    event_id = None

    # Flat structure (most Mordor datasets)
    if "EventID" in event:
        event_id = event["EventID"]
    # Nested Winlogbeat/EVTX structure
    elif "Event" in event and isinstance(event.get("Event"), dict):
        system = event["Event"].get("System", {})
        if isinstance(system, dict):
            event_id = system.get("EventID")
    # Elastic ECS structure
    elif "winlog" in event and isinstance(event.get("winlog"), dict):
        event_id = event["winlog"].get("event_id")

    if event_id is not None:
        try:
            return int(event_id)
        except (ValueError, TypeError):
            pass

    return None


def filter_dataset_robust(
    events: list[dict],
    target_event_ids: Optional[list[int]] = None,
    max_events: Optional[int] = None,
) -> list[dict]:
    """
    Filter and deduplicate the dataset.

    1. Remove events missing key fields (EventID, UtcTime)
    2. Filter to target event IDs if specified
    3. Remove exact duplicates based on key field hashing
    4. Remove low-priority events if over budget
    5. Truncate to max_events
    """
    if target_event_ids is None:
        target_event_ids = settings.priority_event_ids

    if max_events is None:
        max_events = settings.max_events_default

    # Step 1: Filter to valid events with target EventIDs
    filtered = []
    for event in events:
        eid = extract_event_id(event)
        if eid is None:
            continue
        if eid not in target_event_ids:
            continue
        # Must have UtcTime
        if "UtcTime" not in event and "utctime" not in str(event).lower():
            continue
        filtered.append(event)

    logger.info(f"After EventID filter: {len(filtered)} events (from {len(events)})")

    # Step 2: Deduplicate based on key fields
    seen_hashes = set()
    deduped = []
    for event in filtered:
        # Build a dedup key from critical fields
        key_parts = [
            str(event.get("UtcTime", "")),
            str(extract_event_id(event)),
            str(event.get("Image", event.get("SourceImage", ""))),
            str(event.get("TargetImage", "")),
            str(event.get("CommandLine", "")),
            str(event.get("TargetObject", "")),
            str(event.get("DestinationIp", "")),
            str(event.get("GrantedAccess", "")),
        ]
        key_hash = hash(tuple(key_parts))
        if key_hash not in seen_hashes:
            seen_hashes.add(key_hash)
            deduped.append(event)

    logger.info(f"After deduplication: {len(deduped)} events")

    # Step 3: If still over budget, remove low-priority events
    truncation_reason = None
    if len(deduped) > max_events:
        low_priority = settings.low_priority_event_ids
        high_priority = [e for e in deduped if extract_event_id(e) not in low_priority]
        removed_count = len(deduped) - len(high_priority)

        if len(high_priority) <= max_events:
            deduped = high_priority
            truncation_reason = (
                f"Token budget: {removed_count} low-priority "
                f"EventID {low_priority} events removed"
            )
            logger.info(f"Removed {removed_count} low-priority events")
        else:
            deduped = high_priority

    # Step 4: Sort by timestamp
    deduped.sort(key=lambda e: str(e.get("UtcTime", "")))

    # Step 5: Truncate to max
    events_truncated = 0
    if len(deduped) > max_events:
        events_truncated = len(deduped) - max_events
        deduped = deduped[:max_events]
        if truncation_reason is None:
            truncation_reason = f"Truncated to {max_events} events (removed {events_truncated})"

    logger.info(f"Final filtered dataset: {len(deduped)} events")

    return deduped


def get_available_scenarios() -> list[dict]:
    """
    Get all configured scenarios with file existence status.
    """
    return [s.to_dict() for s in settings.get_scenarios()]
