from fastapi import APIRouter, File, UploadFile, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import os
from typing import Optional
import tempfile, os, soundfile as sf
import wave
import io
from backend.services.doppler_processing import DopplerShift
from backend.pretrained_models.doppler_predict import predict_doppler

router = APIRouter(tags=["Doppler"])

# -------------------------------
# Request and Response Models
# -------------------------------
class DopplerRequest(BaseModel):
    frequency: float
    speed: float  # in km/h
    realistic: bool = True
    sampling_rate: int = 22050 


class PredictionResponse(BaseModel):
    speed_kmh: float
    frequency_hz: float
    confidence: str
    filename: str
    sampling_rate: int


# -------------------------------
# GENERATE DOPPLER SIGNAL
# -------------------------------
@router.post("/generate")
def generate_doppler(req: DopplerRequest):
    tmp_path = None
    try:
        # Validation
        if req.frequency <= 0 or req.speed <= 0:
            raise HTTPException(status_code=400, detail="Frequency and speed must be positive")
        if req.sampling_rate < 1600 or req.sampling_rate > 44100:
            raise HTTPException(status_code=400, detail="Sampling rate must be between 1600 and 44100 Hz")
        if req.realistic and req.frequency > 2000:
            raise HTTPException(status_code=400, detail="Frequency must be less than 2kHz for realistic simulation")
        if not req.realistic and req.frequency > 20000:
            raise HTTPException(status_code=400, detail="Frequency must be less than 20kHz for basic simulation")
        if req.realistic and req.speed > 180:
            raise HTTPException(status_code=400, detail="Speed must be less than 180 km/h for realistic simulation")
        if not req.realistic and req.speed > 360:
            raise HTTPException(status_code=400, detail="Speed must be less than 360 km/h for basic simulation")

        # Generate Doppler signal using the slider's sampling rate
        signal, sample_rate, frequency = DopplerShift(
            req.frequency,
            req.speed,
            play_sound=False,
            realistic=req.realistic,
            sampling_rate=req.sampling_rate, 
        )

        # Save to temporary WAV file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmpfile:
            sf.write(tmpfile.name, signal, sample_rate)
            tmp_path = tmpfile.name

        simulation_type = "realistic" if req.realistic else "basic"
        return FileResponse(
            tmp_path,
            media_type="audio/wav",
            filename=f"doppler_{simulation_type}_{int(req.frequency)}Hz_{int(req.speed)}kmh_{sample_rate}Hz.wav"
        )

    except Exception as e:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail=f"Error generating Doppler signal: {str(e)}")


# -------------------------------
# PLAY (LIVE) DOPPLER SIGNAL
# -------------------------------
@router.post("/play")
def play_doppler(req: DopplerRequest):
    """Generate and play Doppler sound without saving"""
    try:
        if req.frequency <= 0 or req.speed <= 0:
            raise HTTPException(status_code=400, detail="Frequency and speed must be positive")
        if req.sampling_rate < 1600 or req.sampling_rate > 44100:
            raise HTTPException(status_code=400, detail="Sampling rate must be between 1600 and 44100 Hz")

        # Generate with sampling rate from slider
        signal, sample_rate, frequency = DopplerShift(
            req.frequency,
            req.speed,
            play_sound=True,
            realistic=req.realistic,
            sampling_rate=req.sampling_rate,  
        )

        simulation_type = "realistic car" if req.realistic else "basic"
        return JSONResponse(content={
            "status": "playing",
            "duration": len(signal) / sample_rate,
            "simulation_type": simulation_type,
            "sampling_rate": sample_rate,
            "message": f"Playing {simulation_type} Doppler: car at {req.speed} km/h with {req.frequency} Hz tone at {sample_rate} Hz"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error playing Doppler signal: {str(e)}")


# -------------------------------
# UPLOAD FILE
# -------------------------------
@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload WAV file and return basic info"""
    try:
        if not file.filename.lower().endswith('.wav'):
            raise HTTPException(status_code=400, detail="Only WAV files are supported")

        # Read file
        content = await file.read()
        file_size = len(content)

        # Extract sample rate
        wav_file = wave.open(io.BytesIO(content), 'rb')
        file_sample_rate = wav_file.getframerate()
        wav_file.close()

        return JSONResponse(content={
            "status": "success",
            "filename": file.filename,
            "size_bytes": file_size,
            "sampling_rate": file_sample_rate,
            "message": "File uploaded successfully"
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


# -------------------------------
# PREDICT FROM UPLOADED FILE
# -------------------------------
@router.post("/predict")
async def predict_uploaded_file(
    file: UploadFile = File(...),
    sampling_rate: int = Query(22050, description="Target sampling rate for prediction (from slider)")
):
    """Run pretrained model on uploaded WAV file to estimate speed and frequency"""
    try:
        if not file.filename.lower().endswith(".wav"):
            raise HTTPException(status_code=400, detail="Only WAV files are supported")
        if sampling_rate < 1600 or sampling_rate > 44100:
            raise HTTPException(status_code=400, detail="Sampling rate must be between 1600 and 44100 Hz")

        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmpfile:
            tmpfile.write(await file.read())
            tmp_path = tmpfile.name

        # Run model using same sampling rate from slider
        preds = predict_doppler(tmp_path, target_sr=sampling_rate)

        os.unlink(tmp_path)
        return JSONResponse(content={
            "status": "success",
            "filename": file.filename,
            "pred_speed_kmh": preds["pred_speed_kmh"],
            "pred_freq_hz": preds["pred_freq_hz"],
            "sampling_rate_used": sampling_rate
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")
