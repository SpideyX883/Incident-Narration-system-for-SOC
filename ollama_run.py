import sys
import ollama
import socket

def check_ollama_status():
    """Checks if the Ollama service is reachable on the default port."""
    try:
        # Default Ollama port is 11434
        with socket.create_connection(("localhost", 11434), timeout=1):
            return True
    except (socket.timeout, ConnectionRefusedError):
        return False

def run_ollama_cli():
    print("--- Local Ollama CLI Runner ---")
    
    # 1. Pre-flight check: Verify Ollama is actually running
    if not check_ollama_status():
        print("\n[!] Error: Connection Refused.")
        print("The Ollama service is not running on localhost:11434.")
        print("Fix: Open the Ollama app or run 'ollama serve' in your terminal.")
        return

    # 2. Select the model
    print("Available models configured for this script:")
    print("1. llama3")
    print("2. gemma4")
    
    choice = input("Select a model (1 or 2): ").strip()
    if choice == "1":
        model_name = "llama3"
    elif choice == "2":
        model_name = "gemma4"
    else:
        print("Invalid choice. Defaulting to gemma4.")
        model_name = "gemma4"
        
    print(f"\nInitializing {model_name}... (Press Ctrl+C to exit)")
    
    # 3. Main interactive CLI loop
    while True:
        try:
            user_prompt = input("\n>>> ")
            
            if not user_prompt.strip():
                continue
                
            if user_prompt.strip().lower() in ["/exit", "exit", "quit"]:
                print("Exiting session.")
                break
                
            print("\nResponse:")
            
            # Stream the response chunks in real-time
            stream = ollama.generate(
                model=model_name,
                prompt=user_prompt,
                stream=True
            )
            
            for chunk in stream:
                print(chunk['response'], end='', flush=True)
            print() 
            
        except KeyboardInterrupt:
            print("\n\nSession interrupted. Exiting.")
            break
        except ollama.ResponseError as e:
            print(f"\nOllama Error: {e.error}")
            break
        except Exception as e:
            print(f"\nAn unexpected error occurred: {e}")
            break

if __name__ == "__main__":
    run_ollama_cli()