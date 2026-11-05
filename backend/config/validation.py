import re
import urllib.request
import json
import logging
from backend.config.models import CompleteConfiguration

logger = logging.getLogger("config.validation")

def validate_phone(phone: str) -> bool:
    # Basic phone format validation (+ followed by digits, length 10-15)
    pattern = r"^\+?[1-9]\d{1,14}$"
    return bool(re.match(pattern, phone))

def get_available_ollama_models() -> list:
    try:
        req = urllib.request.Request("http://localhost:11434/api/tags")
        with urllib.request.urlopen(req, timeout=2) as response:
            data = json.loads(response.read().decode())
            return [m["name"] for m in data.get("models", [])]
    except Exception as e:
        logger.warning(f"Could not connect to Ollama during model validation: {e}")
        return []

def validate_config(cfg: CompleteConfiguration) -> list:
    errors = []
    
    # Validate Phone
    if not validate_phone(cfg.general.contact_phone):
        errors.append("Invalid phone number format. Must match international formats (e.g. +919876543210)")
        
    # Validate Ollama Model
    models = get_available_ollama_models()
    if models:
        target = cfg.ai.current_model
        if target not in models and f"{target}:latest" not in models and target.split(":")[0] not in [m.split(":")[0] for m in models]:
            errors.append(f"Model '{target}' does not exist inside local Ollama registry.")
            
    # Validate Welcome Message
    welcome = cfg.branding.welcome_message.strip()
    if not welcome:
        errors.append("Welcome greeting cannot be empty.")
    elif len(welcome) > 1000:
        errors.append("Welcome greeting cannot exceed 1000 characters.")

    return errors
