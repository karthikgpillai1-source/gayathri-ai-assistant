import time
import logging
import os
import json
from typing import List, Dict, Optional
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from backend.ollama.ollama_service import OllamaService

logger = logging.getLogger("api.chat")
router = APIRouter()
ollama_service = OllamaService()

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "settings.json")

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = None
    request_id: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str

class SettingsModel(BaseModel):
    allow_general_knowledge: bool

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    req_id = req.request_id or "REQ-UNKNOWN"
    start_time = time.time()
    logger.info(f"[{req_id}] Processing request using model: {ollama_service.ollama_url}")
    print(f"[{req_id}] Backend endpoint /chat actually invoked")
    print(f"[{req_id}] Python function chat_endpoint entered")
    
    response_text = ollama_service.generate_chat_response(req.message, req.history, request_id=req_id)
    
    duration = time.time() - start_time
    logger.info(f"[{req_id}] Response completed in {duration:.3f} seconds.")
    print(f"[{req_id}] Response returned to frontend")
    return ChatResponse(answer=response_text)

@router.post("/chat/stream")
async def chat_stream_endpoint(req: ChatRequest):
    req_id = req.request_id or "REQ-UNKNOWN"
    logger.info(f"[{req_id}] Processing streaming request")
    print(f"[{req_id}] Backend endpoint /chat/stream actually invoked")
    print(f"[{req_id}] Python function chat_stream_endpoint entered")
    
    def generate():
        for chunk in ollama_service.generate_chat_stream(req.message, req.history, request_id=req_id):
            yield chunk

    return StreamingResponse(generate(), media_type="text/plain")

@router.get("/settings", response_model=SettingsModel)
def get_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                data = json.load(f)
                return SettingsModel(allow_general_knowledge=data.get("allow_general_knowledge", True))
        except Exception:
            pass
    return SettingsModel(allow_general_knowledge=True)

@router.post("/settings")
def update_settings(settings: SettingsModel):
    try:
        with open(SETTINGS_FILE, "w") as f:
            json.dump(settings.dict(), f)
    except Exception:
        pass
    return {"status": "success"}
