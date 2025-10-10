# backend/routers/doppler.py

from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import numpy as np
import os
from typing import Optional
import tempfile, os, soundfile as sf
from backend.pretrained_models.doppler_shift import DopplerShift
from backend.pretrained_models.doppler_predict import predict_doppler

router = APIRouter(tags=["Doppler"])

class DopplerRequest(BaseModel):
    frequency: float
    speed: float  # in km/h
    realistic: bool = True

class PredictionResponse(BaseModel):
    speed_kmh: float
    frequency_hz: float
    confidence: str
    filename: str

@router.post("/generate")
def generate_doppler(req: DopplerRequest):
    tmp_path = None
    try:
        if req.frequency <= 0 or req.speed <= 0:
            raise HTTPException(status_code=400, detail="Frequency and speed must be positive")
        if req.realistic and req.frequency > 2000:
            raise HTTPException(status_code=400, detail="Frequency must be less than 2kHz for realistic simulation")
        if not req.realistic and req.frequency > 20000:
            raise HTTPException(status_code=400, detail="Frequency must be less than 20kHz for basic simulation")
        if req.realistic and req.speed > 180:  # ~50 m/s in km/h
            raise HTTPException(status_code=400, detail="Speed must be less than 180 km/h for realistic simulation")
        if not req.realistic and req.speed > 360:  # ~100 m/s in km/h
            raise HTTPException(status_code=400, detail="Speed must be less than 360 km/h for basic simulation")
        
        # Generate Doppler signal
        signal, sample_rate, frequency = DopplerShift(
            req.frequency, 
            req.speed,  # in km/h
            play_sound=False,  # Don't play sound automatically in API
            realistic=req.realistic
        )

        # Save to a temporary WAV file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmpfile:
            sf.write(tmpfile.name, signal, sample_rate)
            tmp_path = tmpfile.name

        simulation_type = "realistic" if req.realistic else "basic"
        return FileResponse(
            tmp_path,
            media_type="audio/wav",
            filename=f"doppler_{simulation_type}_{int(req.frequency)}Hz_{int(req.speed)}kmh.wav"
        )
    except Exception as e:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail=f"Error generating Doppler signal: {str(e)}")

@router.post("/play")
def play_doppler(req: DopplerRequest):
    """Generate and play Doppler sound without saving"""
    try:
        if req.frequency <= 0 or req.speed <= 0:
            raise HTTPException(status_code=400, detail="Frequency and speed must be positive")
        
        # Generate and play Doppler signal
        signal, sample_rate, frequency = DopplerShift(
            req.frequency, 
            req.speed,  # in km/h
            play_sound=True, 
            realistic=req.realistic
        )
        
        simulation_type = "realistic car" if req.realistic else "basic"
        return JSONResponse(content={
            "status": "playing", 
            "duration": len(signal)/sample_rate,
            "simulation_type": simulation_type,
            "message": f"Playing {simulation_type} Doppler: car at {req.speed} km/h with {req.frequency} Hz engine tone"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error playing Doppler signal: {str(e)}")

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload file and return basic info"""
    try:
        if not file.filename.lower().endswith('.wav'):
            raise HTTPException(status_code=400, detail="Only WAV files are supported")
        
        # Read file content to get size
        content = await file.read()
        file_size = len(content)
        
        return JSONResponse(content={
            "status": "success",
            "filename": file.filename,
            "size_bytes": file_size,
            "message": "File uploaded successfully"
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


@router.post("/predict")
async def predict_uploaded_file(file: UploadFile = File(...)):
    """Run pretrained model on uploaded WAV file to estimate speed and frequency"""
    try:
        if not file.filename.lower().endswith(".wav"):
            raise HTTPException(status_code=400, detail="Only WAV files are supported")

        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmpfile:
            tmpfile.write(await file.read())
            tmp_path = tmpfile.name

        preds = predict_doppler(tmp_path)

        os.unlink(tmp_path)
        return JSONResponse(content={
            "status": "success",
            "filename": file.filename,
            "pred_speed_kmh": preds["pred_speed_kmh"],
            "pred_freq_hz": preds["pred_freq_hz"]
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")
