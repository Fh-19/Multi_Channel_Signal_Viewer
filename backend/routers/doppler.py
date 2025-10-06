# backend/routers/doppler.py

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
import numpy as np
import io
import soundfile as sf
import tempfile

# استيراد دوال توليد وتحليل الدوبلر
from backend.pretrained_models.doppler_shift import DopplerShift, check_and_analyze
# استيراد تحليل مجموعة البيانات (Dataset)
from backend.pretrained_models.doppler_dataset_analyzer import analyze_vehicle_dataset

# إنشاء الراوتر
router = APIRouter(tags=["Doppler"])


# ====== 1️⃣ Endpoint لتوليد صوت دوبلر ======
class DopplerRequest(BaseModel):
    frequency: float  # تردد البوق (Hz)
    speed: float      # سرعة السيارة (m/s)


@router.post("/generate")
def generate_doppler(req: DopplerRequest):
    """
    يولّد صوت دوبلر بناءً على التردد والسرعة المُدخلة من المستخدم.
    """
    try:
        # توليد الإشارة
        signal = DopplerShift(req.frequency, req.speed)
        sample_rate = 44100

        # حفظ مؤقت كملف WAV
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmpfile:
            sf.write(tmpfile.name, signal, sample_rate)
            tmp_path = tmpfile.name

        # إرسال الملف الناتج للتحميل
        return FileResponse(
            tmp_path,
            media_type="audio/wav",
            filename=f"doppler_{int(req.frequency)}Hz_{int(req.speed)}mps.wav"
        )

    except Exception as e:
        return {"error": str(e)}


# ====== 2️⃣ Endpoint لتحليل ملف صوتي واحد ======
@router.post("/analyze")
def analyze_signal(file: UploadFile = File(...)):
    """
    يحلل ملف صوتي واحد لتقدير ما إذا كان يحتوي على تأثير دوبلر،
    واتجاه الحركة، والتردد المتوسط، وسرعة السيارة.
    """
    try:
        # قراءة الملف الصوتي
        data, samplerate = sf.read(io.BytesIO(file.file.read()))

        # تحليل البيانات باستخدام الدالة الجاهزة
        is_doppler, trend, freq_mean, speed_est = check_and_analyze(data)

        # إرجاع النتائج
        return {
            "is_doppler": bool(is_doppler),
            "trend": trend,
            "freq_mean": float(freq_mean),
            "speed_est": float(speed_est)
        }

    except Exception as e:
        return {"error": str(e)}


# ====== 3️⃣ Endpoint لتحليل مجموعة كاملة من الملفات (Dataset) ======
@router.get("/analyze-dataset")
def analyze_dataset():
    """
    يحلل جميع ملفات WAV الموجودة داخل مجلد dataset
    (مثل HornBase أو أي مجلد صوتيات سيارات).
    ويُرجع النتائج على شكل قائمة JSON.
    """
    try:
        results = analyze_vehicle_dataset()
        return {"dataset_results": results}

    except Exception as e:
        return {"error": str(e)}
