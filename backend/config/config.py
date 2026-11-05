import os

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL_NAME = os.getenv("MODEL_NAME", "llama3.2:latest")
TIMEOUT = int(os.getenv("TIMEOUT", "30"))
STREAMING = os.getenv("STREAMING", "true").lower() == "true"
