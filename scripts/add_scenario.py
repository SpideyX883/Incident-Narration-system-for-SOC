#!/usr/bin/env python3
"""
Project Sybil — Add Scenario Script
Utility to ingest a new JSONL file, filter it, and add it to config.json.
"""

import json
import os
import sys
from pathlib import Path

# Add backend to path so we can import its modules
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from core.data_loader import filter_dataset_robust, load_jsonl

def main():
    print("=== Project Sybil: Scenario Ingestion Tool ===")
    
    if len(sys.argv) < 2:
        print("Usage: python add_scenario.py <path_to_jsonl>")
        sys.exit(1)
        
    input_path = Path(sys.argv[1])
    if not input_path.exists():
        print(f"Error: File not found -> {input_path}")
        sys.exit(1)
        
    print(f"\n1. Reading {input_path.name}...")
    try:
        raw_events = load_jsonl(input_path)
        print(f"   Loaded {len(raw_events)} raw events.")
    except Exception as e:
        print(f"   Error reading file: {e}")
        sys.exit(1)
        
    print("\n2. Filtering dataset...")
    filtered = filter_dataset_robust(raw_events)
    print(f"   Filtered down to {len(filtered)} events.")
    
    if len(filtered) == 0:
        print("   Warning: 0 events remain after filtering. Aborting.")
        sys.exit(1)
        
    print("\n3. Scenario Metadata")
    scenario_id = input("   Enter Scenario ID (e.g., pt_apt29_eval): ").strip()
    display_name = input("   Enter Display Name (e.g., APT29 Evaluation): ").strip()
    description = input("   Enter Description: ").strip()
    techniques = input("   Enter MITRE Techniques (comma separated, e.g., T1059, T1003): ").strip()
    difficulty = input("   Enter Difficulty (easy/medium/hard): ").strip().lower()
    
    if difficulty not in ['easy', 'medium', 'hard']:
        difficulty = 'medium'
        
    technique_list = [t.strip() for t in techniques.split(",")] if techniques else []
    
    # Save filtered dataset
    output_filename = f"{scenario_id}_filtered.jsonl"
    output_dir = backend_dir / "data" / "scenarios"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / output_filename
    
    print(f"\n4. Saving filtered dataset to {output_path.name}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        for event in filtered:
            f.write(json.dumps(event) + '\n')
            
    # Update config.json
    config_path = backend_dir / "config.json"
    print(f"\n5. Updating {config_path.name}...")
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config_data = json.load(f)
        
    new_scenario = {
        "id": scenario_id,
        "display_name": display_name,
        "description": description,
        "file_path": f"data/scenarios/{output_filename}",
        "event_count_approx": len(filtered),
        "mitre_techniques": technique_list,
        "difficulty": difficulty
    }
    
    # Check if scenario already exists
    existing = [s for s in config_data.get("scenarios", []) if s["id"] == scenario_id]
    if existing:
        print("   Scenario ID already exists! Overwriting...")
        config_data["scenarios"] = [s if s["id"] != scenario_id else new_scenario for s in config_data["scenarios"]]
    else:
        config_data.setdefault("scenarios", []).append(new_scenario)
        
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config_data, f, indent=4)
        
    print("\n✅ Scenario added successfully!")
    print("   You can now select it in the Sybil dashboard.")

if __name__ == "__main__":
    main()
