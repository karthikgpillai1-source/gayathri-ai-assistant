import os
import re
from fastapi import APIRouter, HTTPException, Request, File, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from backend.config.service import ConfigService
from backend.config.models import CompleteConfiguration

router = APIRouter(prefix="/api/settings")
service = ConfigService()

class SystemSettingsSchema(BaseModel):
    institution_name: str
    virtual_companion_name: str
    admin_contact_email: str

@router.get("")
def get_settings():
    cfg = service.load_config()
    return {
        "institution_name": cfg.general.institution_name,
        "virtual_companion_name": cfg.general.ai_companion_name,
        "admin_contact_email": cfg.general.contact_email
    }

@router.put("")
def update_settings(schema: SystemSettingsSchema, request: Request):
    if not schema.institution_name.strip():
        raise HTTPException(status_code=400, detail="Institution Name is required.")
    if not schema.virtual_companion_name.strip():
        raise HTTPException(status_code=400, detail="Virtual Companion Name is required.")
        
    email_pattern = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    if not re.match(email_pattern, schema.admin_contact_email.strip()):
        raise HTTPException(status_code=400, detail="Invalid email format.")

    cfg = service.load_config()
    
    cfg.general.institution_name = schema.institution_name.strip()
    cfg.general.ai_companion_name = schema.virtual_companion_name.strip()
    cfg.general.contact_email = schema.admin_contact_email.strip()
    
    client_ip = request.client.host if request.client else "127.0.0.1"
    service.save_config(cfg, admin_username="admin", ip_address=client_ip)
    
    try:
        from backend.api.state import broadcast_state_update
        broadcast_state_update()
    except Exception:
        pass
        
    return {"status": "success", "message": "Settings saved successfully."}

@router.post("/backup")
def trigger_backup():
    try:
        backup_path = service.create_backup()
        return FileResponse(
            backup_path, 
            media_type="application/octet-stream", 
            filename=os.path.basename(backup_path)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create backup: {e}")

@router.post("/restore")
async def trigger_restore(file: UploadFile = File(...)):
    try:
        content = await file.read()
        success, message = service.restore_backup(content)
        if not success:
            raise HTTPException(status_code=400, detail=message)
        return {"status": "success", "message": message}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
