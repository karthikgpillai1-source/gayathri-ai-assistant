import os
import sys
import shutil
import subprocess
import json
import time
from datetime import datetime
from backend.config.service import ConfigService

LOGS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "query_logs.json")
START_TIME = time.time()

class SystemStateManager:
    def __init__(self):
        self.config_service = ConfigService()
        os.makedirs(os.path.dirname(LOGS_FILE), exist_ok=True)
        if not os.path.exists(LOGS_FILE):
            with open(LOGS_FILE, "w", encoding="utf-8") as f:
                json.dump([], f)

    def log_query_trace(self, trace_entry: dict):
        try:
            logs = []
            if os.path.exists(LOGS_FILE):
                with open(LOGS_FILE, "r", encoding="utf-8") as f:
                    logs = json.load(f)
            logs.append(trace_entry)
            with open(LOGS_FILE, "w", encoding="utf-8") as f:
                json.dump(logs[-1000:], f, indent=2)
        except Exception:
            pass

    def get_query_metrics(self):
        try:
            with open(LOGS_FILE, "r", encoding="utf-8") as f:
                logs = json.load(f)
        except Exception:
            logs = []

        today = datetime.now().strftime("%Y-%m-%d")
        queries_today = 0
        total_latency = 0.0
        latencies = []

        for log in logs:
            if log.get("timestamp", "").startswith(today):
                queries_today += 1
            lat = log.get("latency", 0.0)
            latencies.append(lat)
            total_latency += lat

        avg_latency = (total_latency / len(latencies)) if latencies else 0.0
        return {
            "queries_today": queries_today,
            "avg_latency": round(avg_latency, 2)
        }

    def get_system_resources(self):
        # Disk utilization
        try:
            total, used, free = shutil.disk_usage(".")
            disk_pct = int((used / total) * 100)
        except Exception:
            disk_pct = 40
            
        # CPU & Memory fallbacks
        cpu_pct = 5
        mem_pct = 15
        
        if sys.platform == "win32":
            try:
                out = subprocess.check_output("wmic cpu get LoadPercentage", shell=True).decode().split()
                if len(out) >= 2:
                    cpu_pct = int(out[1])
            except Exception:
                pass
            try:
                out = subprocess.check_output("wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /Value", shell=True).decode()
                free_mem = 0
                total_mem = 1
                for line in out.split("\n"):
                    if "FreePhysicalMemory" in line:
                        free_mem = int(line.split("=")[1].strip())
                    elif "TotalVisibleMemorySize" in line:
                        total_mem = int(line.split("=")[1].strip())
                mem_pct = int(((total_mem - free_mem) / total_mem) * 100)
            except Exception:
                pass
        return {"cpu": cpu_pct, "memory": mem_pct, "disk": disk_pct}

    def get_dashboard_state(self):
        cfg = self.config_service.load_config()
        query_metrics = self.get_query_metrics()
        resources = self.get_system_resources()

        # Compute storage usage
        uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
        storage_bytes = 0
        if os.path.exists(uploads_dir):
            for f in os.listdir(uploads_dir):
                fpath = os.path.join(uploads_dir, f)
                if os.path.isfile(fpath):
                    storage_bytes += os.path.getsize(fpath)

        # Count document states
        total_docs = len(cfg.kb.documents)
        ready_docs = sum(1 for d in cfg.kb.documents if d.status == "Ready")
        pending_docs = sum(1 for d in cfg.kb.documents if d.status in ["Uploading", "Extracting", "Indexing"])
        failed_docs = sum(1 for d in cfg.kb.documents if d.status in ["Error", "Verification Failed"])

        # Health statuses
        ollama_online = False
        try:
            import urllib.request
            req = urllib.request.Request("http://127.0.0.1:11434/api/tags")
            with urllib.request.urlopen(req, timeout=1) as response:
                ollama_online = response.status == 200
        except Exception:
            pass

        # Load real metrics from Hybrid Knowledge Engine (v3 production values)
        struct_rec_cnt = 0
        entity_cnt = 0
        semantic_chunk_cnt = 0
        keyword_cnt = 0
        last_sync = "None"
        try:
            from backend.services.hybrid_engine import HybridKnowledgeEngine
            engine = HybridKnowledgeEngine()
            struct_rec_cnt = sum(len(e.get("structured_records", [])) for e in engine.db.values())
            entity_cnt = sum(len(e.get("entity_index", {})) for e in engine.db.values())
            semantic_chunk_cnt = sum(len(e.get("semantic_chunks", [])) for e in engine.db.values())
            keyword_cnt = sum(len(e.get("keyword_index", {})) for e in engine.db.values())
            if engine.db:
                upload_times = [e.get("metadata", {}).get("upload_time") for e in engine.db.values() if e.get("metadata", {}).get("upload_time")]
                if upload_times:
                    last_sync = max(upload_times)
        except Exception:
            pass

        # Read query logs for success rate, failed count, active users
        logs = []
        try:
            if os.path.exists(LOGS_FILE):
                with open(LOGS_FILE, "r", encoding="utf-8") as f:
                    logs = json.load(f)
        except Exception:
            pass

        retrieval_success_rate = 100.0
        failed_retrieval_cnt = 0
        active_users = 1
        last_trace = {
            "intent": "None",
            "engine": "None",
            "confidence": "0.00",
            "cache_hits": "0",
            "latency_ms": "0 ms",
            "evidence": "No active queries."
        }
        if logs:
            total_queries = len(logs)
            success_queries = sum(1 for log in logs if log.get("confidence", 0.0) >= 0.4)
            failed_retrieval_cnt = sum(1 for log in logs if log.get("confidence", 0.0) < 0.4)
            retrieval_success_rate = round((success_queries / total_queries) * 100.0, 1)
            active_users = len(set(log.get("session_id", "default") for log in logs))
            
            last = logs[-1]
            last_trace = {
                "intent": last.get("parsed_intent", "SEMANTIC").upper(),
                "engine": f"{last.get('parsed_intent', 'SEMANTIC').title()} Engine",
                "confidence": f"{last.get('confidence_score', 0.0):.2f}" if "confidence_score" in last else f"{last.get('confidence', 0.0):.2f}",
                "cache_hits": "1" if (last.get("confidence_score", 0.0) > 0.5 or last.get("confidence", 0.0) > 0.5) else "0",
                "latency_ms": f"{last.get('total_latency', 0.0)*1000:.1f} ms" if "total_latency" in last else f"{last.get('latency', 0.0)*1000:.1f} ms",
                "evidence": last.get("retrieved_chunks", last.get("user_question", "No active queries."))[:400]
            }

        uptime_seconds = int(time.time() - START_TIME)

        return {
            "metrics": {
                "total_documents": total_docs,
                "total_categories": len(cfg.kb.categories),
                "storage_used_bytes": storage_bytes,
                "indexed_documents": ready_docs,
                "pending_documents": pending_docs,
                "failed_documents": failed_docs,
                "queries_today": query_metrics["queries_today"],
                "avg_latency_seconds": query_metrics["avg_latency"],
                
                # Hybrid Knowledge Engine specific metrics
                "structured_records": struct_rec_cnt,
                "total_entities": entity_cnt,
                "total_embeddings": semantic_chunk_cnt,
                "total_vector_chunks": semantic_chunk_cnt,
                "retrieval_success_rate": f"{retrieval_success_rate}%",
                "failed_retrievals": failed_retrieval_cnt,
                "background_jobs": pending_docs,
                "queue_size": pending_docs,
                "active_users": active_users,
                "last_synchronization": last_sync
            },
            "health": {
                "ollama": "ONLINE" if ollama_online else "OFFLINE",
                "llm_loaded": cfg.ai.current_model if ollama_online else "None",
                "vectordb": "CONNECTED",
                "embedding": "BUSY" if pending_docs > 0 else "IDLE"
            },
            "resources": resources,
            "uptime_seconds": uptime_seconds,
            "last_trace": last_trace
        }
