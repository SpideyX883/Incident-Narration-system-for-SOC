#!/bin/bash

# Update package lists (Recommended before installing packages)
sudo apt-get update

# Install dependencies without prompting
sudo apt-get install -y pciutils zstd

# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh 

# Clone the repository
git clone https://github.com/SpideyX883/Incident-Narration-system-for-SOC

# Install the official Ollama Python library
# Note: Use 'pip3' instead of 'pip' on modern Linux systems
pip3 install ollama


ollama pull deepseek-r1:14b