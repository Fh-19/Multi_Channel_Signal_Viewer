from fastapi import APIRouter, UploadFile, File, Form
from backend.pretrained_models.voice_gender_model import predict_gender_from_file
import os, shutil
import librosa, soundfile as sf
import numpy as np
from scipy.signal import butter, filtfilt, windows
from scipy.ndimage import convolve1d

router = APIRouter()
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# ✅ 1. تصنيف الصوت الأصلي
@router.post("/predict")
async def predict_voice_gender(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    waveform, sr = librosa.load(file_path, sr=None, mono=True)
    duration = librosa.get_duration(y=waveform, sr=sr)
    fft = np.fft.fft(waveform)
    freqs = np.fft.fftfreq(len(fft), 1 / sr)
    magnitude = np.abs(fft)[: len(freqs)//2]
    freqs = freqs[: len(freqs)//2]
    gender = predict_gender_from_file(file_path)

    return {
        "filename": file.filename,
        "gender": gender,
        "sampling_rate": sr,
        "duration": duration,
        "spectrum": {
            "freqs": freqs.tolist()[::200],
            "magnitude": magnitude.tolist()[::200]
        }
    }


# ✅ 2. Aliasing effect (Down + Up Sampling)
@router.post("/aliasing")
async def aliasing_effect(filename: str = Form(...), new_sr: int = Form(...)):
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(file_path):
        return {"error": "File not found!"}

    waveform, sr = librosa.load(file_path, sr=None, mono=True)

    if new_sr < sr:
        waveform_down = librosa.resample(waveform, orig_sr=sr, target_sr=new_sr)
    else:
        waveform_down = waveform

    aliased_waveform = librosa.resample(waveform_down, orig_sr=new_sr, target_sr=sr)
    aliased_filename = f"aliased_{new_sr}_{filename}"
    aliased_path = os.path.join(UPLOAD_FOLDER, aliased_filename)
    sf.write(aliased_path, aliased_waveform, sr)

    gender_after_alias = predict_gender_from_file(aliased_path)

    fft = np.fft.fft(aliased_waveform)
    freqs = np.fft.fftfreq(len(fft), 1 / sr)
    magnitude = np.abs(fft)[: len(freqs)//2]
    freqs = freqs[: len(freqs)//2]

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


# ✅ 3. Anti-Aliasing Recovery + Spectrum before & after
@router.post("/recover")
async def recover_with_dsp(filename: str = Form(...)):
    try:
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        if not os.path.exists(file_path):
            return {"error": "File not found!"}

        print(f"🎧 DSP Recovery running for: {filename}")

        waveform, sr = librosa.load(file_path, sr=None, mono=True)

        # Spectrum before recovery
        fft_before = np.fft.fft(waveform)
        freqs_before = np.fft.fftfreq(len(fft_before), 1 / sr)
        magnitude_before = np.abs(fft_before)[: len(freqs_before)//2]
        freqs_before = freqs_before[: len(freqs_before)//2]

        # ---------- Step 1: Oversample ----------
        up_sr = sr * 4
        upsampled = librosa.resample(waveform, orig_sr=sr, target_sr=up_sr)

        # ---------- Step 2: Low-pass filter ----------
        cutoff = sr / 2.3
        order = 10
        b, a = butter(order, cutoff / (up_sr / 2), btype='low')
        filtered_stage1 = filtfilt(b, a, upsampled)

        # ---------- Step 3: Gaussian smoothing ----------
        window = windows.gaussian(51, std=7)
        window /= np.sum(window)
        filtered_stage2 = convolve1d(filtered_stage1, window, mode='reflect')

        # ---------- Step 4: Downsample ----------
        recovered = librosa.resample(filtered_stage2, orig_sr=up_sr, target_sr=sr)

        # ---------- Step 5: Normalize ----------
        recovered = recovered / np.max(np.abs(recovered) + 1e-8)

        # ---------- Step 6: Save ----------
        recovered_filename = f"recovered_{filename}"
        recovered_path = os.path.join(UPLOAD_FOLDER, recovered_filename)
        sf.write(recovered_path, recovered, sr)

        # ---------- Step 7: Predict gender ----------
        recovered_gender = predict_gender_from_file(recovered_path)

        # Spectrum after recovery
        fft_after = np.fft.fft(recovered)
        freqs_after = np.fft.fftfreq(len(fft_after), 1 / sr)
        magnitude_after = np.abs(fft_after)[: len(freqs_after)//2]
        freqs_after = freqs_after[: len(freqs_after)//2]

        print("✅ Enhanced DSP Recovery completed successfully")

        return {
            "filename": recovered_filename,
            "gender": recovered_gender,
            "original_sr": sr,
            "recovered_sr": sr,
            "message": f"Recovered Frequency: {sr} Hz",
            "file_url": f"http://127.0.0.1:8000/uploads/{recovered_filename}",
            "spectrum_before": {
                "freqs": freqs_before.tolist()[::200],
                "magnitude": magnitude_before.tolist()[::200]
            },
            "spectrum_after": {
                "freqs": freqs_after.tolist()[::200],
                "magnitude": magnitude_after.tolist()[::200]
            }
        }

    except Exception as e:
        print(f"⚠️ DSP Recovery error: {e}")
        return {"error": str(e)}
