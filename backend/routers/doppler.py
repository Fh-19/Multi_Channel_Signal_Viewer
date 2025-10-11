from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import numpy as np
import os
from typing import Optional
import tempfile, io, soundfile as sf
from backend.pretrained_models.doppler_shift import DopplerShift
from backend.pretrained_models.doppler_predict import predict_doppler

# إنشاء الراوتر
router = APIRouter(tags=["Doppler"])

# ====== 1️⃣ Endpoint لتوليد صوت دوبلر ======
class DopplerRequest(BaseModel):
    frequency: float          # تردد البوق (Hz)
    speed: float              # سرعة السيارة (km/h)
    realistic: bool = True    # نوع المحاكاة (واقعي أو بسيط)

@router.post("/generate")
def generate_doppler(req: DopplerRequest):
    """يولّد صوت دوبلر بناءً على التردد والسرعة المُدخلة من المستخدم."""
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
            req.speed,
            play_sound=False,
            realistic=req.realistic
        )

        # حفظ مؤقت كملف WAV
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


# ====== 2️⃣ تحليل ملف واحد ======
@router.post("/analyze")
def analyze_signal(file: UploadFile = File(...)):
    try:
        data, samplerate = sf.read(io.BytesIO(file.file.read()))
        is_doppler, trend, freq_mean, speed_est = check_and_analyze(data)
        return {
            "is_doppler": bool(is_doppler),
            "trend": trend,
            "freq_mean": float(freq_mean),
            "speed_est": float(speed_est)
        }
    except Exception as e:
        return {"error": str(e)}

# ====== 3️⃣ تحليل مجموعة ملفات ======
@router.get("/analyze-dataset")
def analyze_dataset():
    try:
        results = analyze_vehicle_dataset()
        return {"dataset_results": results}

# ====== 4️⃣ تشغيل الصوت مباشرة ======
@router.post("/play")
def play_doppler(req: DopplerRequest):
    try:
        if req.frequency <= 0 or req.speed <= 0:
            raise HTTPException(status_code=400, detail="Frequency and speed must be positive")
        signal, sample_rate, frequency = DopplerShift(
            req.frequency,
            req.speed,
            play_sound=True,
            realistic=req.realistic
        )
        simulation_type = "realistic car" if req.realistic else "basic"
        return JSONResponse(content={
            "status": "playing",
            "duration": len(signal) / sample_rate,
            "simulation_type": simulation_type,
            "message": f"Playing {simulation_type} Doppler: car at {req.speed} km/h with {req.frequency} Hz engine tone"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error playing Doppler signal: {str(e)}")

# ====== 5️⃣ رفع الملفات ======
@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        if not file.filename.lower().endswith('.wav'):
            raise HTTPException(status_code=400, detail="Only WAV files are supported")
        content = await file.read()
        return JSONResponse(content={
            "status": "success",
            "filename": file.filename,
            "size_bytes": len(content),
            "message": "File uploaded successfully"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")

# ====== 6️⃣ التنبؤ باستخدام النموذج ======
@router.post("/predict")
async def predict_uploaded_file(file: UploadFile = File(...)):
    try:
        if not file.filename.lower().endswith(".wav"):
            raise HTTPException(status_code=400, detail="Only WAV files are supported")
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
