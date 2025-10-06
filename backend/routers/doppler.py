# backend/routers/doppler.py
from fastapi import APIRouter, File, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
import numpy as np
import io
import soundfile as sf
import tempfile

from backend.pretrained_models.doppler_shift import DopplerShift, check_and_analyze

router = APIRouter(tags=["Doppler"])

class DopplerRequest(BaseModel):
    frequency: float
    speed: float

@router.post("/generate")
def generate_doppler(req: DopplerRequest):
    try:
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
        return {"error": str(e)}


@router.post("/analyze")
def analyze_signal(file: UploadFile = File(...)):
    try:
        data, samplerate = sf.read(io.BytesIO(file.file.read()))
        is_doppler, trend, freq_mean, speed_est = check_and_analyze(data)

        return {
            "is_doppler": is_doppler,
            "trend": trend,
            "freq_mean": float(freq_mean),
            "speed_est": float(speed_est)
        }
    except Exception as e:
        return {"error": str(e)}
