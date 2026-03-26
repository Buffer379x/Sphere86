from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import os
import asyncio
import logging
from ..config import get_settings
from ..auth import decode_token

router = APIRouter(prefix="/api/logs", tags=["logs"])
settings = get_settings()
log = logging.getLogger("Sphere86.logs")

@router.websocket("/stream")
async def stream_logs(
    websocket: WebSocket,
    log_type: str = Query(...), # "panel", "engine", or "vm"
    vm_id: str = Query(None),
    token: str = Query(...)
):
    # Auth check via token in query param
    token_data = decode_token(token)
    if not token_data or not token_data.is_admin:
        # Logs are admin-only
        await websocket.close(code=1008) # Policy Violation
        return

    await websocket.accept()
    
    # Map log type to file path
    if log_type == "panel":
        file_path = os.path.join(settings.log_dir, "panel.log")
    elif log_type == "engine":
        file_path = os.path.join(settings.log_dir, "engine.log")
    elif log_type == "vm" and vm_id:
        file_path = os.path.join(settings.log_dir, f"vm_{vm_id}.log")
    else:
        await websocket.send_text("--- Invalid log type or missing VM ID ---")
        await websocket.close(code=1003)
        return

    try:
        if not os.path.exists(file_path):
            await websocket.send_text(f"--- Log file not found: {os.path.basename(file_path)} ---")
            # Wait up to 30s for file to be created (e.g. if VM just started)
            found = False
            for _ in range(15):
                await asyncio.sleep(2)
                if os.path.exists(file_path):
                    found = True
                    break
            if not found:
                await websocket.close(code=1000)
                return
        
        # Initial tail (last 100 lines)
        # Using a small buffer read for efficiency
        with open(file_path, "r") as f:
            # Simple way to get last 100 lines
            lines = f.readlines()
            for line in lines[-100:]:
                await websocket.send_text(line.rstrip())
        
        # Follow tail
        with open(file_path, "r") as f:
            f.seek(0, os.SEEK_END)
            while True:
                line = f.readline()
                if not line:
                    await asyncio.sleep(0.5)
                    continue
                await websocket.send_text(line.rstrip())

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(f"--- Error streaming logs: {e} ---")
        except:
            pass
    finally:
        try:
            await websocket.close()
        except:
            pass
