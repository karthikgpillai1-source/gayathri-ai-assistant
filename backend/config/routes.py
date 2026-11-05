from fastapi import APIRouter, HTTPException, File, UploadFile, Request
from fastapi.responses import FileResponse, JSONResponse
from backend.config.models import CompleteConfiguration
from backend.config.service import ConfigService
from backend.config.validation import validate_config
import os
import shutil

router = APIRouter(prefix="/config")
service = ConfigService()

@router.get("")
def get_configuration():
    return service.config

@router.put("")
def update_configuration(cfg: CompleteConfiguration, request: Request):
    # Validate
    errors = validate_config(cfg)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})
        
    client_ip = request.client.host if request.client else "127.0.0.1"
    
    # Save
    service.save_config(cfg, admin_username="admin", ip_address=client_ip)
    return {"status": "success", "config": service.config}

@router.get("/history")
def get_version_history():
    return service.get_history()

@router.post("/history/restore/{version_id}")
def restore_version(version_id: int, request: Request):
    history = service.get_history()
    target = None
    for h in history:
        if h["version"] == version_id:
            target = h["config"]
            break
            
    if not target:
        raise HTTPException(status_code=404, detail="Version not found.")
        
    client_ip = request.client.host if request.client else "127.0.0.1"
    new_cfg = CompleteConfiguration(**target)
    service.save_config(new_cfg, admin_username="admin", ip_address=client_ip)
    return {"status": "success", "config": service.config}

@router.get("/audit")
def get_audit_logs():
    return service.get_audit_logs()

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
