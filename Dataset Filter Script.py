import json
import os

def filter_dataset_robust(input_filepath, output_filepath, target_event_ids):
    """
    Filters a JSONL dataset for specific Sysmon Event IDs.
    Handles both flat OTRF JSON arrays and deeply nested Windows EVTX schemas.
    """
    if not os.path.exists(input_filepath):
        print(f"Error: Could not find {input_filepath}")
        return False

    kept_count = 0
    total_count = 0

    print(f"Processing dataset: {input_filepath}...")
    
    with open(input_filepath, 'r', encoding='utf-8') as infile, \
         open(output_filepath, 'w', encoding='utf-8') as outfile:
        
        for line in infile:
            if not line.strip():
                continue
            
            total_count += 1
            
            try:
                event = json.loads(line)
                event_id = None
                
                # ATTEMPT 1: Check for flat structure
                if 'EventID' in event:
                    event_id = event.get('EventID')
                
                # ATTEMPT 2: Check for nested Winlogbeat/EVTX structure
                elif 'Event' in event and 'System' in event['Event']:
                    event_id = event.get('Event', {}).get('System', {}).get('EventID')
                
                # ATTEMPT 3: Check for Elastic ECS structure
                elif 'winlog' in event:
                    event_id = event.get('winlog', {}).get('event_id')

                # Ensure the extracted ID is an integer for accurate matching
                if event_id is not None:
                    try:
                        event_id = int(event_id)
                    except ValueError:
                        pass # Ignore if it somehow can't be cast to an int

                # If the ID matches our high-value targets, save the exact original string
                if event_id in target_event_ids:
                    outfile.write(line)
                    kept_count += 1
                    
            except json.JSONDecodeError:
                print(f"Warning: Skipping invalid JSON at line {total_count}")
                continue

    reduction = 100 - ((kept_count / total_count) * 100) if total_count > 0 else 0

    print("\n--- Filtering Complete ---")
    print(f"Total events analyzed: {total_count}")
    print(f"High-value alerts kept: {kept_count}")
    print(f"Noise events removed:  {total_count - kept_count} ({reduction:.2f}% reduction)")
    print(f"Filtered dataset saved to: {output_filepath}")
    return True


def prune_log_for_ai(raw_log_json):
    """
    Strips unnecessary fields from the raw Sysmon log to save LLM tokens
    and reduce hallucination noise.
    """
    raw_log = json.loads(raw_log_json)
    
    # Define only the keys the AI actually needs to write the story
    keys_to_keep = [
        "UtcTime", "EventID", "ProcessId", "ParentProcessId", 
        "Image", "ParentImage", "CommandLine", "TargetImage", 
        "GrantedAccess", "TargetObject", "DestinationIp", "DestinationPort"
    ]
    
    # Create a new, skinny dictionary
    skinny_log = {key: raw_log[key] for key in keys_to_keep if key in raw_log}
    
    return skinny_log


def generate_sybil_prompt(filtered_logs_filepath):
    """
    Reads the filtered dataset, prunes each log, and formats them 
    into a single text block with assigned LOG_IDs for verifiable provenance.
    """
    batched_telemetry = ""
    
    with open(filtered_logs_filepath, 'r', encoding='utf-8') as file:
        for index, line in enumerate(file):
            if not line.strip():
                continue
                
            # Prune the log before adding it to the batch
            optimized_log = prune_log_for_ai(line)
            
            # Inject the citation ID
            batched_telemetry += f"--- LOG_ID: {index + 1} ---\n"
            batched_telemetry += json.dumps(optimized_log) + "\n\n"
            
    return batched_telemetry


if __name__ == "__main__":
    # 1 = Process Create, 3 = Network, 10 = Process Access (LSASS), 11 = File Create, 12/13 = Registry
    TARGET_IDS = [1, 3, 10, 11, 12, 13] 
    

        # Define your input and output paths
    INPUT_FILE = "./empire_mimikatz_logonpasswords_2020-08-07103224.json"
    OUTPUT_FILE = "./empire_mimikatz_logonpasswords_2020-08-07103224_filtered.json"
    # Step 1: Filter the noisy dataset down to high-value alerts
    success = filter_dataset_robust(INPUT_FILE, OUTPUT_FILE, TARGET_IDS)
    
    # Step 2: If filtering worked, generate the token-optimized batch for the AI
    if success:
        print("\n--- Generating Sybil LLM Payload ---")
        final_prompt_payload = generate_sybil_prompt(OUTPUT_FILE)
        
        # Print a small preview to the terminal
        print("Preview of formatted data for the AI:\n")
        print(final_prompt_payload[:500] + "\n\n... [DATA TRUNCATED FOR PREVIEW] ...\n")
        
        # Save the final text block to a file so you can inspect it manually
        payload_output_path = "./final_prompt_payload.txt"
        with open(payload_output_path, "w", encoding='utf-8') as f:
            f.write(final_prompt_payload)
            
        print(f"Full token-optimized prompt payload saved to: {payload_output_path}")
    

    
    filter_dataset_robust(INPUT_FILE, OUTPUT_FILE, TARGET_IDS)