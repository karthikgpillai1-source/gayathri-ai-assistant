import os
import json
import numpy as np
import urllib.request
import re

INDEX_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "knowledge", "vector_index.json")

class VectorDBService:
    def __init__(self):
        self.index_path = INDEX_PATH
        self.load_index()

    def load_index(self):
        if os.path.exists(self.index_path):
            try:
                with open(self.index_path, "r", encoding="utf-8") as f:
                    self.chunks = json.load(f)
            except Exception:
                self.chunks = []
        else:
            self.chunks = []

    def save_index(self):
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        with open(self.index_path, "w", encoding="utf-8") as f:
            json.dump(self.chunks, f, indent=2)

    def get_embedding(self, text: str, model_name: str = "llama3.2:latest") -> list:
        # Call Ollama API
        for endpoint in ["/api/embeddings", "/api/embed"]:
            try:
                req = urllib.request.Request(
                    f"http://127.0.0.1:11434{endpoint}",
                    data=json.dumps({"model": model_name, "prompt": text}).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=5) as response:
                    data = json.loads(response.read().decode())
                    emb = data.get("embedding") or data.get("embeddings", [None])[0]
                    if emb:
                        return emb
            except Exception:
                pass
        
        # Fallback hash-based embedding vectors
        h = hash(text)
        np.random.seed(abs(h) % 5000)
        return np.random.uniform(-0.1, 0.1, 128).tolist()

    def index_document(self, filename: str, text: str, model_name: str = "llama3.2:latest"):
        # Remove existing chunks for this document
        self.chunks = [c for c in self.chunks if c.get("source_filename") != filename]
        
        # Chunk text
        lines = text.split("\n")
        raw_chunks = []
        current_chunk = []
        current_len = 0
        current_section = "General"
        start_char = 0
        
        for line in lines:
            line_stripped = line.strip()
            if not line_stripped:
                continue
                
            if len(line_stripped) < 60 and not line_stripped.endswith((".", ",", ";")) and (line_stripped.isupper() or any(line_stripped.startswith(prefix) for prefix in ["Grade", "Month", "Roll", "Class", "Section", "Annual"])):
                current_section = line_stripped
                
            line_len = len(line_stripped)
            if current_len + line_len > 800 and current_chunk:
                chunk_text = " ".join(current_chunk)
                raw_chunks.append({
                    "chunk_id": f"{filename}_chunk_{len(raw_chunks)}",
                    "document_id": filename,
                    "source_filename": filename,
                    "page_number": 1,
                    "section_title": current_section,
                    "character_range": [start_char, start_char + len(chunk_text)],
                    "text": chunk_text
                })
                # Overlap
                overlap_len = 0
                overlap_chunk = []
                for item in reversed(current_chunk):
                    if overlap_len + len(item) < 150:
                        overlap_chunk.insert(0, item)
                        overlap_len += len(item)
                    else:
                        break
                current_chunk = overlap_chunk
                current_len = overlap_len
                start_char += (len(chunk_text) - overlap_len)
                
            current_chunk.append(line_stripped)
            current_len += line_len
            
        if current_chunk:
            chunk_text = " ".join(current_chunk)
            raw_chunks.append({
                "chunk_id": f"{filename}_chunk_{len(raw_chunks)}",
                "document_id": filename,
                "source_filename": filename,
                "page_number": 1,
                "section_title": current_section,
                "character_range": [start_char, start_char + len(chunk_text)],
                "text": chunk_text
            })
            
        # Generate embeddings
        for chunk in raw_chunks:
            chunk["embedding"] = self.get_embedding(chunk["text"], model_name)
            self.chunks.append(chunk)
            
        self.save_index()
        try:
            from backend.services.hybrid_engine import HybridKnowledgeEngine
            HybridKnowledgeEngine().analyze_and_index(filename, text)
        except Exception as e:
            print(f"[HYBRID INDEX ERROR] {e}")
            
        return len(raw_chunks)

    def delete_document(self, filename: str):
        self.chunks = [c for c in self.chunks if c.get("source_filename") != filename]
        self.save_index()
        try:
            from backend.services.hybrid_engine import HybridKnowledgeEngine
            engine = HybridKnowledgeEngine()
            if filename in engine.db:
                del engine.db[filename]
                engine.save_db()
        except Exception:
            pass

    def search(self, query: str, top_k: int = 3, threshold: float = 0.1, model_name: str = "llama3.2:latest", document_filter: str = None) -> list:
        if not self.chunks:
            return []
            
        query_vector = np.array(self.get_embedding(query, model_name))
        results = []
        
        roll_match = re.search(r'(\d+[a-eA-E]-\d+)', query)
        q_roll = roll_match.group(1).lower() if roll_match else None

        for chunk in self.chunks:
            if document_filter and chunk.get("source_filename") != document_filter:
                continue
                
            chunk_vector = np.array(chunk["embedding"])
            # Cosine similarity
            dot = np.dot(query_vector, chunk_vector)
            norm_q = np.linalg.norm(query_vector)
            norm_c = np.linalg.norm(chunk_vector)
            sim = dot / (norm_q * norm_c) if norm_q > 0 and norm_c > 0 else 0.0
            
            # Simple keyword boost
            q_words = [w.lower() for w in re.sub(r'[^\w\s]', '', query).split() if len(w) > 3]
            boost = 0.0
            if q_words:
                matches = sum(1 for w in q_words if w in chunk["text"].lower())
                boost = (matches / len(q_words)) * 0.2
                
            final_sim = float(sim + boost)
            if q_roll and q_roll in chunk["text"].lower():
                final_sim += 2.0
                
            if final_sim >= threshold:
                results.append((final_sim, chunk))
                
        results.sort(key=lambda x: x[0], reverse=True)
        return results[:top_k]
