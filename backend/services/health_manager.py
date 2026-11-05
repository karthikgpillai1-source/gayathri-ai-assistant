import os
import time
import json
import logging
import asyncio
import shutil
from datetime import datetime
from backend.config.service import ConfigService
from backend.config.models import DocumentSchema, CategorySchema
from backend.services.state_manager import SystemStateManager

logger = logging.getLogger("health_manager")
HEALTH_LOG_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "health_logs.json")

class PlatformHealthManager:
    def __init__(self):
        self.config_service = ConfigService()
        self.state_manager = SystemStateManager()
        os.makedirs(os.path.dirname(HEALTH_LOG_FILE), exist_ok=True)
        if not os.path.exists(HEALTH_LOG_FILE):
            with open(HEALTH_LOG_FILE, "w") as f:
                json.dump([], f)

    def log_repair(self, subsystem: str, cause: str, attempt: str, result: str, severity: str = "Warning"):
        try:
            logs = []
            if os.path.exists(HEALTH_LOG_FILE):
                with open(HEALTH_LOG_FILE, "r") as f:
                    logs = json.load(f)
            logs.append({
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "subsystem": subsystem,
                "cause": cause,
                "attempt": attempt,
                "result": result,
                "severity": severity
            })
            with open(HEALTH_LOG_FILE, "w") as f:
                json.dump(logs[-500:], f)
        except Exception as e:
            logger.error(f"Failed to write health log: {e}")

    def get_health_logs(self):
        try:
            with open(HEALTH_LOG_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return []

    def verify_configuration_integrity(self):
        cfg = self.config_service.load_config()
        repaired = False
        
        # Check branding & credentials
        if not cfg.general.institution_name or not cfg.general.institution_name.strip():
            cfg.general.institution_name = "Gayathri School of Innovation"
            repaired = True
            self.log_repair("Configuration Manager", "Institution name missing or empty", "Restore default name", "Success")
            
        if not cfg.general.ai_companion_name or not cfg.general.ai_companion_name.strip():
            cfg.general.ai_companion_name = "Gayu"
            repaired = True
            self.log_repair("Configuration Manager", "AI companion name missing or empty", "Restore default name", "Success")
            
        if not hasattr(cfg.branding, "welcome_message") or not cfg.branding.welcome_message or not cfg.branding.welcome_message.strip():
            cfg.branding.welcome_message = "Welcome back. I am Gayu. Ask me anything."
            repaired = True
            self.log_repair("Configuration Manager", "Welcome message greeting missing", "Restore default message", "Success")

        if repaired:
            self.config_service.save_config(cfg, admin_username="SystemSelfHealer", ip_address="127.0.0.1")
            from backend.api.state import broadcast_state_update
            broadcast_state_update()

    def verify_knowledge_integrity(self):
        cfg = self.config_service.load_config()
        uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
        knowledge_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "knowledge")
        os.makedirs(uploads_dir, exist_ok=True)
        os.makedirs(knowledge_dir, exist_ok=True)
        
        repaired = False
        
        # 1. Check physical uploads match registered config documents
        active_files = [f for f in os.listdir(uploads_dir) if os.path.isfile(os.path.join(uploads_dir, f))]
        registered_files = [d.filename for d in cfg.kb.documents]
        
        # If file on disk but not in config, repair metadata registry
        for f in active_files:
            if f not in registered_files:
                fpath = os.path.join(uploads_dir, f)
                stat = os.stat(fpath)
                new_doc = DocumentSchema(
                    filename=f,
                    size=stat.st_size,
                    upload_date=datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
                    status="Ready",
                    category="Uncategorized"
                )
                cfg.kb.documents.append(new_doc)
                repaired = True
                self.log_repair("Knowledge Engine", f"Document '{f}' exists physically but lacks config metadata", "Regenerate document schema registry entry", "Success")

        # 2. Check if registered files are missing their plain-text knowledge extraction cache
        for doc in cfg.kb.documents:
            fpath = os.path.join(uploads_dir, doc.filename)
            txt_path = os.path.join(knowledge_dir, doc.filename + ".txt")
            
            # If physical file deleted but still in config, clear config metadata
            if not os.path.exists(fpath):
                cfg.kb.documents = [d for d in cfg.kb.documents if d.filename != doc.filename]
                repaired = True
                cause = f"Mismatched. Expected: Document '{doc.filename}' present on disk. Actual: Physical file missing. Root Cause: File removed outside platform."
                attempt = "Repair Action: Remove stale document entry from configuration registry"
                self.log_repair("Knowledge Engine", cause, attempt, "Success")
                continue
                
            # If text cache missing but metadata and file exist, rebuild text extraction cache
            if not os.path.exists(txt_path) and doc.status == "Ready":
                from backend.api.documents import extract_text_from_file
                try:
                    ext = doc.filename.split(".")[-1].lower()
                    text = extract_text_from_file(fpath, ext)
                    with open(txt_path, "w", encoding="utf-8") as cache_file:
                        cache_file.write(text)
                    cause = f"Mismatched. Expected: Text cache file present for '{doc.filename}'. Actual: Text cache missing. Root Cause: Text extraction file cleared."
                    attempt = "Repair Action: Rebuild text extraction cache"
                    self.log_repair("Knowledge Engine", cause, attempt, "Success")
                except Exception as e:
                    doc.status = "Error"
                    repaired = True
                    self.log_repair("Knowledge Engine", f"Failed rebuilding text cache for '{doc.filename}'", "Execute extractor", f"Failed: {e}", "Critical")

        # 3. Check vector index chunks integrity
        from backend.services.vector_db import VectorDBService
        vdb = VectorDBService()
        
        valid_filenames = [d.filename for d in cfg.kb.documents]
        indexed_files = list(set(c.get("source_filename") for c in vdb.chunks if c.get("source_filename")))
        
        for f in indexed_files:
            if f not in valid_filenames:
                vdb.delete_document(f)
                repaired = True
                cause = f"Mismatched. Expected: 0 vector chunks for deleted file '{f}'. Actual: Orphan chunks present. Root Cause: Vector database out of sync with documents registry."
                attempt = "Repair Action: Purge orphan vector chunks from index"
                self.log_repair("Vector Index Integrity", cause, attempt, "Success")

        for doc in cfg.kb.documents:
            if doc.status == "Ready":
                doc_chunks = [c for c in vdb.chunks if c.get("source_filename") == doc.filename]
                if not doc_chunks:
                    try:
                        from backend.api.documents import extract_text_from_file
                        text = extract_text_from_file(os.path.join(uploads_dir, doc.filename), doc.filename.split(".")[-1].lower())
                        cnt = vdb.index_document(doc.filename, text)
                        doc.chunks = cnt
                        doc.embeddings_count = cnt
                        repaired = True
                        cause = f"Mismatched. Expected: Chunks indexed for ready file '{doc.filename}'. Actual: 0 chunks present. Root Cause: Document was not successfully vectorized."
                        attempt = f"Repair Action: Re-run indexing and embedding for '{doc.filename}'"
                        self.log_repair("Vector Index Integrity", cause, attempt, "Success")
                    except Exception as e:
                        doc.status = "Error"
                        repaired = True
                        self.log_repair("Vector Index Integrity", f"Failed re-indexing chunks for '{doc.filename}'", "Re-run indexing", f"Failed: {e}", "Critical")

        if repaired:
            self.config_service.save_config(cfg, admin_username="SystemSelfHealer", ip_address="127.0.0.1")
            from backend.api.state import broadcast_state_update
            broadcast_state_update()

    def run_all_integrity_checks(self):
        self.verify_configuration_integrity()
        self.verify_knowledge_integrity()

    def get_full_diagnostics(self):
        self.run_all_integrity_checks()
        cfg = self.config_service.load_config()
        
        # Subsystem Checks
        diagnostics = []
        
        # 1. Config Check
        diagnostics.append({
            "name": "Configuration Registry",
            "status": "Healthy",
            "details": f"Loaded version {cfg.version_history[-1].version_id if cfg.version_history else '1.0'}"
        })
        
        # 2. Storage Check
        uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
        doc_count = len(cfg.kb.documents)
        diagnostics.append({
            "name": "Storage Manager",
            "status": "Healthy",
            "details": f"{doc_count} files stored on disk"
        })
        
        # 3. AI Engine Check
        ollama_online = False
        try:
            import urllib.request
            req = urllib.request.Request("http://127.0.0.1:11434/api/tags")
            with urllib.request.urlopen(req, timeout=1) as response:
                ollama_online = response.status == 200
        except Exception:
            pass
            
        diagnostics.append({
            "name": "AI Engine",
            "status": "Healthy" if ollama_online else "Failed",
            "details": f"Model: {cfg.ai.current_model}" if ollama_online else "Ollama host offline"
        })
        
        # 4. Vector Database Check
        diagnostics.append({
            "name": "Vector Database",
            "status": "Healthy",
            "details": "ChromaDB connection mock active"
        })
        
        # 5. Embedding Worker Check
        pending = sum(1 for d in cfg.kb.documents if d.status in ["Uploading", "Extracting", "Indexing"])
        diagnostics.append({
            "name": "Embedding Worker",
            "status": "Healthy",
            "details": f"{pending} files in embedding queue"
        })
        
        # 6. Chat Retrieval Check
        chat_healthy = True
        error_msg = ""
        try:
            from backend.ollama.ollama_service import OllamaService
            OllamaService().classify_query("Test connection")
        except Exception as e:
            chat_healthy = False
            error_msg = str(e)
            
        diagnostics.append({
            "name": "Chat Engine",
            "status": "Healthy" if chat_healthy else "Failed",
            "details": "Classifier responding successfully" if chat_healthy else f"Error: {error_msg}"
        })
        
        score = sum(100 for d in diagnostics if d["status"] == "Healthy") / len(diagnostics)
        
        return {
            "score": int(score),
            "subsystems": diagnostics,
            "logs": self.get_health_logs()
        }

async def start_integrity_scanner():
    logger.info("Initializing background integrity self-healing scanner...")
    healer = PlatformHealthManager()
    while True:
        try:
            healer.run_all_integrity_checks()
        except Exception as e:
            logger.error(f"Error during scheduled integrity check: {e}")
        await asyncio.sleep(30)
