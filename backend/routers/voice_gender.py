from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import os
import shutil
import librosa
import soundfile as sf
import numpy as np

router = APIRouter()
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

print("=== Voice Gender Router Loaded ===")

# Import the model function (but model won't load until predict is called)
try:
    from backend.pretrained_models.voice_gender_model import predict_gender_from_file
    MODEL_AVAILABLE = True
    print(">>> Voice gender model import successful")
except Exception as e:
    MODEL_AVAILABLE = False
    print(f">>> Model import failed: {e}")

def safe_predict_gender(file_path):
    """Safe wrapper that handles model loading errors"""
    if not MODEL_AVAILABLE:
        return "Model not available"
    
    try:
        return predict_gender_from_file(file_path)
    except Exception as e:
        return f"Prediction error: {str(e)}"

# ✅ 1. تصنيف الصوت الأصلي + إرسال معلومات إضافية
@router.post("/predict")
async def predict_voice_gender(file: UploadFile = File(...)):
    """Receives a .wav file, predicts gender, and returns audio info"""
    print(f">>> Predict endpoint called with file: {file.filename}")
    
    # Validate file type
    if not file.filename.lower().endswith('.wav'):
        raise HTTPException(status_code=400, detail="Only WAV files are supported")
    
    try:
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)

        # حفظ الملف
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f">>> File saved: {file_path}")

        # قراءة البيانات
        waveform, sr = librosa.load(file_path, sr=None, mono=True)
        duration = librosa.get_duration(y=waveform, sr=sr)
        print(f">>> Audio loaded - SR: {sr}, Duration: {duration}")

        # حساب الطيف (Fourier)
        fft = np.fft.fft(waveform)
        freqs = np.fft.fftfreq(len(fft), 1 / sr)
        magnitude = np.abs(fft)[: len(freqs) // 2]
        freqs = freqs[: len(freqs) // 2]

        # Predict gender (model loads here if needed)
        gender = safe_predict_gender(file_path)
        print(f">>> Gender prediction: {gender}")

        return {
            "filename": file.filename,
            "gender": gender,
            "sampling_rate": sr,
            "duration": duration,
            "spectrum": {
                "freqs": freqs.tolist()[::200],  # تقليل البيانات للرسم
                "magnitude": magnitude.tolist()[::200]
            },
            "model_available": MODEL_AVAILABLE
        }

    except Exception as e:
        print(f">>> ERROR in predict_voice_gender: {e}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


# 2. تطبيق aliasing (down + up sampling)
@router.post("/aliasing")
async def aliasing_effect(
    filename: str = Form(...),
    new_sr: int = Form(...)
):
    """
    Apply aliasing by under-sampling the signal and upsampling again.
    """
    print(f">>> Aliasing endpoint called - File: {filename}, New SR: {new_sr}")
    
    try:
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        if not os.path.exists(file_path):
            return {"error": "File not found!"}

        waveform, sr = librosa.load(file_path, sr=None, mono=True)
        print(f">>> Original audio loaded - SR: {sr}")

        # ↓ Step 1: Downsample
        if new_sr < sr:
            waveform_down = librosa.resample(waveform, orig_sr=sr, target_sr=new_sr)
            print(f">>> Downsampled to {new_sr}Hz")
        else:
            waveform_down = waveform  # no aliasing if same or higher rate
            print(f">>> No downsampling - new SR >= original")

        # ↑ Step 2: Upsample (creates aliasing)
        aliased_waveform = librosa.resample(waveform_down, orig_sr=new_sr, target_sr=sr)
        print(f">>> Upsampled back to {sr}Hz")

        # Step 3: Save aliased version
        aliased_filename = f"aliased_{new_sr}_{filename}"
        aliased_path = os.path.join(UPLOAD_FOLDER, aliased_filename)
        sf.write(aliased_path, aliased_waveform, sr)
        print(f">>> Aliased file saved: {aliased_filename}")

        # Step 4: Predict gender (model loads here if needed)
        gender_after_alias = safe_predict_gender(aliased_path)
        print(f">>> Gender prediction after aliasing: {gender_after_alias}")

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
            },
            "model_available": MODEL_AVAILABLE
        }

    except Exception as e:
        print(f">>> ERROR in aliasing_effect: {e}")
        return {"error": str(e)}


# 3. Test endpoint (doesn't load model)
@router.get("/test")
async def test_endpoint():
    """Test endpoint that doesn't load the model"""
    return {
        "message": "Voice gender router is working!",
        "model_available": MODEL_AVAILABLE,
        "model_loaded_on_demand": True,
        "timestamp": "Server is responding correctly"
    }