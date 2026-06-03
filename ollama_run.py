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
            if "not found" in str(e).lower():
                print(f"\nModel '{model_name}' not found locally. Attempting to pull it...")
                try:
                    for progress_chunk in ollama.pull(model_name, stream=True):
                        # You can print progress here if desired
                        if 'total' in progress_chunk:
                            current = progress_chunk.get('completed', 0)
                            total = progress_chunk['total']
                            percent = (current / total) * 100
                            sys.stdout.write(f"\rDownloading {model_name}: {percent:.2f}% ({current}/{total})")
                            sys.stdout.flush()
                        elif 'status' in progress_chunk:
                            sys.stdout.write(f"\r{progress_chunk['status']} ")
                            sys.stdout.flush()
                    print(f"\nModel '{model_name}' pulled successfully! Please try your prompt again.")
                except ollama.ResponseError as pull_e:
                    print(f"\nError pulling model '{model_name}': {pull_e.error}")
                except Exception as pull_e:
                    print(f"\nAn unexpected error occurred during model pull: {pull_e}")
            else:
                print(f"\nOllama Error: {e.error}")
            break # Exit the loop after handling the error
        except Exception as e:
            print(f"\nAn unexpected error occurred: {e}")
            break

if __name__ == "__main__":
    run_ollama_cli()