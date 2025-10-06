
from fastapi import FastAPI, File, UploadFile, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import numpy as np
import io
import soundfile as sf
import uvicorn
import tempfile
import os

from doppler_shift import DopplerShift, check_and_analyze


app = FastAPI(
    title="Doppler API",
    description="واجهة API لتوليد وتحليل تأثير دوبلر",
    version="1.1"
)

# السماح باتصال الواجهة (React)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DopplerRequest(BaseModel):
    frequency: float
    speed: float


@app.post("/generate")
def generate_doppler(req: DopplerRequest):
    """
    يستقبل تردد وسرعة ويولّد إشارة دوبلر، 
    ثم يعيدها كملف صوتي WAV قابل للتحميل.
    """
    try:
        signal = DopplerShift(req.frequency, req.speed)
        sample_rate = 44100

        # حفظ الإشارة في ملف WAV مؤقت
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmpfile:
            sf.write(tmpfile.name, signal, sample_rate)
            tmp_path = tmpfile.name

        # إعادة الملف كاستجابة للتحميل
        return FileResponse(
            tmp_path,
            media_type="audio/wav",
            filename=f"doppler_{int(req.frequency)}Hz_{int(req.speed)}mps.wav"
        )

    except Exception as e:
        return {"error": str(e)}



@app.post("/analyze")
def analyze_signal(file: UploadFile = File(...)):
    """
    يستقبل ملف صوتي (WAV أو MP3) ويحلله باستخدام check_and_analyze().
    """
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


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)