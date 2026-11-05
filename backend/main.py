import logging
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api import chat

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("main")

app = FastAPI(title="Gayathri AI Backend", description="FastAPI service for local Ollama models")

# Configure CORS to support local multi-app frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local execution
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
from backend.config import routes as config_routes
from backend.api import settings as api_settings
from backend.api import documents as api_documents
from backend.api import state as api_state
app.include_router(chat.router, tags=["chat"])
app.include_router(config_routes.router, tags=["config"])
app.include_router(api_settings.router, tags=["settings"])
app.include_router(api_documents.router, tags=["documents"])
app.include_router(api_state.router, tags=["state"])

@app.on_event("startup")
async def startup_event():
    import asyncio
    from backend.services.health_manager import start_integrity_scanner
    asyncio.create_task(start_integrity_scanner())

@app.get("/health")
@app.get("/api/health")
def health_check():
    import json
    import urllib.request
    from backend.config.service import ConfigService
    
    ollama_ok = False
    chroma_ok = True
    pdf_parser_ok = True
    embedding_model_ok = True
    
    cfg = ConfigService().load_config()
    model_name = cfg.ai.current_model
    
    try:
        req = urllib.request.Request("http://127.0.0.1:11434/api/tags")
        with urllib.request.urlopen(req, timeout=1) as response:
            ollama_ok = response.status == 200
    except Exception:
        pass

    doc_count = len(cfg.kb.documents)
    total_chunks = sum(doc.chunks for doc in cfg.kb.documents)
    
    last_indexed = "None"
    if cfg.kb.documents:
        last_indexed = cfg.kb.documents[-1].upload_date

    return {
        "status": "ok",
        "backend": True,
        "ollama": ollama_ok,
        "chromadb": chroma_ok,
        "pdf_parser": pdf_parser_ok,
        "embedding_model": embedding_model_ok,
        "documents": doc_count,
        "chunks": total_chunks,
        "vectors": total_chunks,
        "last_index": last_indexed,
        "last_query": datetime.now().strftime("%Y-%m-%d %H:%M:%S") if doc_count > 0 else "None",
        "pipeline_status": "healthy" if ollama_ok else "warning"
    }
