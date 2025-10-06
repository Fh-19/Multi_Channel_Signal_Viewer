# backend/routers/doppler.py
from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import numpy as np
import io
import soundfile as sf
import tempfile
import os

from backend.pretrained_models.doppler_shift import DopplerShift, check_and_analyze

router = APIRouter(tags=["Doppler"])

class DopplerRequest(BaseModel):
    frequency: float
    speed: float

@router.post("/generate")
def generate_doppler(req: DopplerRequest):
    tmp_path = None
    try:
        if req.frequency <= 0 or req.speed <= 0:
            raise HTTPException(status_code=400, detail="Frequency and speed must be positive")
        
        signal = DopplerShift(req.frequency, req.speed)
        sample_rate = 44100

        # Save to a temporary WAV file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmpfile:
            sf.write(tmpfile.name, signal, sample_rate)
            tmp_path = tmpfile.name

        return FileResponse(
            tmp_path,
            media_type="audio/wav",
            filename=f"doppler_{int(req.frequency)}Hz_{int(req.speed)}mps.wav"
        )
    except Exception as e:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail=f"Error generating Doppler signal: {str(e)}")

@router.post("/analyze")
async def analyze_signal(file: UploadFile = File(...)):  # Added async here
    try:
        if not file.filename.lower().endswith('.wav'):
            raise HTTPException(status_code=400, detail="Only WAV files are supported")
        
        # Read and process audio file
        file_content = await file.read()  # This now works with async function
        data, samplerate = sf.read(io.BytesIO(file_content))
        
        # Handle stereo files by converting to mono
        if len(data.shape) > 1:
            data = np.mean(data, axis=1)
        
        result = check_and_analyze(data)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing signal: {str(e)}")