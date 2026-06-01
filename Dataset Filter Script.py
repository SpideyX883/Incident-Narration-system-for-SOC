import json
import os

def filter_dataset_robust(input_filepath, output_filepath, target_event_ids):
    """
    Filters a JSONL dataset for specific Sysmon Event IDs.
    Handles both flat OTRF JSON arrays and deeply nested Windows EVTX schemas.
    """
    if not os.path.exists(input_filepath):
        print(f"Error: Could not find {input_filepath}")
        return

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
                
                # ATTEMPT 1: Check for flat structure (like your provided snippet)
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


if __name__ == "__main__":
    # 1 = Process Create, 3 = Network, 10 = Process Access (LSASS), 11 = File Create, 12/13 = Registry
    TARGET_IDS = [1, 3, 10, 11, 12, 13] 
    
    # Define your input and output paths
    INPUT_FILE = "./empire_mimikatz_logonpasswords_2020-08-07103224.json"
    OUTPUT_FILE = "./empire_mimikatz_logonpasswords_2020-08-07103224_filtered.json"
    
    filter_dataset_robust(INPUT_FILE, OUTPUT_FILE, TARGET_IDS)