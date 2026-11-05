# Gayathri AI Assistant

A local personal conversational assistant providing streaming responses from local Ollama language models with ChromaDB vector memory.

## Features
- **Streaming Chat:** Real-time token streaming with local Ollama models.
- **Vector Memory:** ChromaDB vector storage for persistent conversational context.
- **Zero Cloud Dependence:** Complete data privacy running locally on localhost.

## Prerequisites
- Python 3.10+
- [Ollama](https://ollama.com/) running locally:
  ```bash
  ollama pull qwen2.5
  ```

## Setup

1. **Install dependencies:**
   ```bash
   python install_dependencies.py
   ```

2. **Configure environment:**
   Copy `.env.example` to `.env` and adjust port or model settings if needed.

3. **Start the assistant:**
   ```bash
   python launcher.py
   ```
