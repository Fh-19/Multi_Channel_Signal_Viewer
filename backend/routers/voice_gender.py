from fastapi import APIRouter, UploadFile, File, Form
from backend.pretrained_models.voice_gender_model import predict_gender_from_file
import os
import shutil
import librosa
import soundfile as sf
import numpy as np
import json

router = APIRouter()
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# ✅ 1. تصنيف الصوت الأصلي + إرسال معلومات إضافية
@router.post("/predict")
async def predict_voice_gender(file: UploadFile = File(...)):
    """Receives a .wav file, predicts gender, and returns audio info"""
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)

    # حفظ الملف
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # قراءة البيانات
    waveform, sr = librosa.load(file_path, sr=None, mono=True)
    duration = librosa.get_duration(y=waveform, sr=sr)

    # حساب الطيف (Fourier)
    fft = np.fft.fft(waveform)
    freqs = np.fft.fftfreq(len(fft), 1 / sr)
    magnitude = np.abs(fft)[: len(freqs) // 2]
    freqs = freqs[: len(freqs) // 2]

    gender = predict_gender_from_file(file_path)

    return {
        "filename": file.filename,
        "gender": gender,
        "sampling_rate": sr,
        "duration": duration,
        "spectrum": {
            "freqs": freqs.tolist()[::200],  # تقليل البيانات للرسم
            "magnitude": magnitude.tolist()[::200]
        }
    }


# ✅ 2. تطبيق aliasing (down + up sampling)
@router.post("/aliasing")
async def aliasing_effect(
    filename: str = Form(...),
    new_sr: int = Form(...)
):
    """
    Apply aliasing by under-sampling the signal and upsampling again.
    """
    try:
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        if not os.path.exists(file_path):
            return {"error": "File not found!"}

        waveform, sr = librosa.load(file_path, sr=None, mono=True)

        # ↓ Step 1: Downsample
        if new_sr < sr:
            waveform_down = librosa.resample(waveform, orig_sr=sr, target_sr=new_sr)
        else:
            waveform_down = waveform  # no aliasing if same or higher rate

        # ↑ Step 2: Upsample (creates aliasing)
        aliased_waveform = librosa.resample(waveform_down, orig_sr=new_sr, target_sr=sr)

        # Step 3: Save aliased version
        aliased_filename = f"aliased_{new_sr}_{filename}"
        aliased_path = os.path.join(UPLOAD_FOLDER, aliased_filename)
        sf.write(aliased_path, aliased_waveform, sr)

        # Step 4: Predict gender
        gender_after_alias = predict_gender_from_file(aliased_path)

        # Step 5: Spectrum analysis
        fft = np.fft.fft(aliased_waveform)
        freqs = np.fft.fftfreq(len(fft), 1 / sr)
        magnitude = np.abs(fft)[: len(freqs) // 2]
        freqs = freqs[: len(freqs) // 2]

        return {
            "filename": aliased_filename,
            "original_sr": sr,
            "new_sr": new_sr,
            "gender": gender_after_alias,
            "file_url": f"http://127.0.0.1:8000/uploads/{aliased_filename}",
            "spectrum": {
                "freqs": freqs.tolist()[::200],
                "magnitude": magnitude.tolist()[::200]
            }
        }

    except Exception as e:
        return {"error": str(e)}
