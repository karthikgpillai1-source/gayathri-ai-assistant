import os
import json
import time
import zipfile
import base64
from datetime import datetime
from backend.config.models import CompleteConfiguration

CONFIG_DIR = os.path.dirname(__file__)
SETTINGS_FILE = os.path.join(CONFIG_DIR, "settings.json")
AUDIT_LOG_FILE = os.path.join(CONFIG_DIR, "audit_log.json")
HISTORY_FILE = os.path.join(CONFIG_DIR, "history.json")
UPLOADS_DIR = os.path.join(os.path.dirname(CONFIG_DIR), "uploads")
BACKUP_DIR = os.path.join(os.path.dirname(CONFIG_DIR), "backups")

os.makedirs(BACKUP_DIR, exist_ok=True)

def encrypt_decrypt_bytes(data: bytes, key: str = "GSIP_SECRET_KEY") -> bytes:
    key_bytes = key.encode("utf-8")
    key_len = len(key_bytes)
    # Simple fast XOR cipher
    return bytes([b ^ key_bytes[i % key_len] for i, b in enumerate(data)])

class ConfigService:
    def __init__(self):
        self.config = self.load_config()

    def load_config(self) -> CompleteConfiguration:
        if os.path.exists(SETTINGS_FILE):
            try:
                with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return CompleteConfiguration(**data)
            except Exception:
                pass
        # Default fallback
        return CompleteConfiguration()

    def save_config(self, new_cfg: CompleteConfiguration, admin_username: str = "admin", ip_address: str = "127.0.0.1") -> None:
        old_data = self.config.dict()
        new_data = new_cfg.dict()
        
        # Log Audit Changes
        self._audit_changes(old_data, new_data, admin_username, ip_address)
        
        # Write Settings
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(new_data, f, indent=2)
            
        # Add to history
        self._add_to_history(new_data, admin_username)
        
        self.config = new_cfg

    def _audit_changes(self, old: dict, new: dict, admin: str, ip: str):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        logs = []
        if os.path.exists(AUDIT_LOG_FILE):
            try:
                with open(AUDIT_LOG_FILE, "r", encoding="utf-8") as f:
                    logs = json.load(f)
            except Exception:
                pass

        # Detect differences
        diffs = []
        for section in ["general", "ai", "kb", "security", "branding"]:
            o_sec = old.get(section, {})
            n_sec = new.get(section, {})
            for k in n_sec.keys():
                if o_sec.get(k) != n_sec.get(k):
                    diffs.append({
                        "module": section,
                        "setting": k,
                        "old_value": str(o_sec.get(k)),
                        "new_value": str(n_sec.get(k))
                    })
                    
        for d in diffs:
            logs.append({
                "administrator": admin,
                "timestamp": timestamp,
                "ip_address": ip,
                "module": d["module"],
                "setting": d["setting"],
                "old_value": d["old_value"],
                "new_value": d["new_value"]
            })
            
        with open(AUDIT_LOG_FILE, "w", encoding="utf-8") as f:
            json.dump(logs[-1000:], f, indent=2) # Keep last 1000 logs

    def _add_to_history(self, new_data: dict, admin: str):
        history = []
        if os.path.exists(HISTORY_FILE):
            try:
                with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                    history = json.load(f)
            except Exception:
                pass
                
        version_id = len(history) + 1
        history.append({
            "version": version_id,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "saved_by": admin,
            "config": new_data
        })
        
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2)

    def get_history(self) -> list:
        if os.path.exists(HISTORY_FILE):
            try:
                with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return []

    def get_audit_logs(self) -> list:
        if os.path.exists(AUDIT_LOG_FILE):
            try:
                with open(AUDIT_LOG_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return []

    def create_backup(self) -> str:
        # Create a ZIP file of the config files and uploads
        backup_filename = f"backup_{int(time.time())}.gsip"
        backup_path = os.path.join(BACKUP_DIR, backup_filename)
        temp_zip = backup_path + ".tmp.zip"
        
        with zipfile.ZipFile(temp_zip, 'w') as zipf:
            # Add config files
            for f in [SETTINGS_FILE, AUDIT_LOG_FILE, HISTORY_FILE]:
                if os.path.exists(f):
                    zipf.write(f, os.path.basename(f))
            # Add uploads
            if os.path.exists(UPLOADS_DIR):
                for root, dirs, files in os.walk(UPLOADS_DIR):
                    for file in files:
                        fpath = os.path.join(root, file)
                        zipf.write(fpath, os.path.join("uploads", file))
                        
        # Read the temp ZIP, encrypt it, and write to final destination
        with open(temp_zip, "rb") as f:
            raw_data = f.read()
        encrypted_data = encrypt_decrypt_bytes(raw_data)
        
        with open(backup_path, "wb") as f:
            f.write(encrypted_data)
            
        os.remove(temp_zip)
        return backup_path

    def restore_backup(self, file_bytes: bytes) -> tuple:
        # Decrypt incoming bytes
        decrypted = encrypt_decrypt_bytes(file_bytes)
        
        # Write to a temp zip file
        temp_zip = os.path.join(BACKUP_DIR, "temp_restore.zip")
        with open(temp_zip, "wb") as f:
            f.write(decrypted)
            
        try:
            with zipfile.ZipFile(temp_zip, 'r') as zipf:
                # Basic validation: check if settings.json exists inside ZIP
                if "settings.json" not in zipf.namelist():
                    os.remove(temp_zip)
                    return False, "Invalid backup format: settings.json is missing."
                    
                # Restore config files
                zipf.extractall(CONFIG_DIR, members=[
                    m for m in zipf.namelist() if not m.startswith("uploads/")
                ])
                
                # Restore uploads
                os.makedirs(UPLOADS_DIR, exist_ok=True)
                for m in zipf.namelist():
                    if m.startswith("uploads/"):
                        # Extract manually to uploads folder
                        data = zipf.read(m)
                        fname = os.path.basename(m)
                        with open(os.path.join(UPLOADS_DIR, fname), "wb") as dest:
                            dest.write(data)
                            
            os.remove(temp_zip)
            # Reload currently loaded configuration
            self.config = self.load_config()
            return True, "System restored successfully."
        except Exception as e:
            if os.path.exists(temp_zip):
                os.remove(temp_zip)
            return False, f"Failed to parse backup archive: {e}"
