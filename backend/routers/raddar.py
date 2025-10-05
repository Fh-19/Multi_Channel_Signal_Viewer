# backend/routers/raddar.py
from fastapi import APIRouter
from fastapi.responses import FileResponse
import os

router = APIRouter()

@router.get("/sentinel-map")
def get_sentinel_map():
   cwd = os.getcwd()
   map_path = os.path.join(cwd, "sentinel_map.html")
   print("🔍 Current working directory:", cwd)
   print("🔍 Looking for file at:", map_path)

   if os.path.exists(map_path):
        return FileResponse(map_path, media_type="text/html")
   return {"error": f"Map not found at {map_path}"}