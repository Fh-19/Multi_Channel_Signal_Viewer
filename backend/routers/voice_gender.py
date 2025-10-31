from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from backend.pretrained_models.voice_gender_model import predict_gender_from_file
import os, shutil
import librosa, soundfile as sf
import numpy as np
from scipy.signal import butter, filtfilt, windows
from scipy.ndimage import convolve1d

router = APIRouter()
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

print("=== Voice Gender Router Loaded ===")

# Model import
try:
    from backend.pretrained_models.voice_gender_model import predict_gender_from_file
    MODEL_AVAILABLE = True
    print(">>> Voice gender model import successful")
except Exception as e:
    MODEL_AVAILABLE = False
    print(f">>> Model import failed: {e}")

def safe_predict_gender(file_path):
    if not MODEL_AVAILABLE:
        return "Model not available"
    try:
        return predict_gender_from_file(file_path)
    except Exception as e:
        return f"Prediction error: {str(e)}"

# ---------------- 1. Original prediction ----------------
@router.post("/predict")
async def predict_voice_gender(file: UploadFile = File(...)):
    try:
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        waveform, sr = librosa.load(file_path, sr=None, mono=True)
        duration = librosa.get_duration(y=waveform, sr=sr)
        #computes (frequency spectrum)of waveform
        fft = np.fft.fft(waveform)
        freqs = np.fft.fftfreq(len(fft), 1 / sr)
        magnitude = np.abs(fft)[: len(freqs)//2]
        freqs = freqs[: len(freqs)//2]
        gender = safe_predict_gender(file_path)

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
    except Exception as e:
        print(f">>> ERROR in predict_voice_gender: {e}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    

# ---------------- 2. Aliasing effect ----------------
@router.post("/aliasing")
async def aliasing_effect(filename: str = Form(...), new_sr: int = Form(...)):
    try:
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        if not os.path.exists(file_path):
            return {"error": "File not found!"}

        waveform, sr = librosa.load(file_path, sr=None, mono=True)

        # Calculate Nyquist frequency (maximum representable frequency)
        nyquist_freq = sr // 2
        
        # Remove the bug that prevents upsampling - allow any sampling rate
        # The original code incorrectly limited new_sr to nyquist_freq, which prevented upsampling
        print(f">>> Original SR: {sr} Hz, Target SR: {new_sr} Hz, Nyquist: {nyquist_freq} Hz")

        # Manual downsampling and upsampling without librosa
        # Step 1: Downsample (decimate) if target rate is lower
        if new_sr < sr:
            # Downsampling - this is where aliasing can occur
            downsample_ratio = sr / new_sr
            # Manual downsampling by taking every nth sample
            indices = np.round(np.arange(0, len(waveform), downsample_ratio)).astype(int)
            indices = indices[indices < len(waveform)]  # Ensure we don't go out of bounds
            waveform_resampled = waveform[indices]
        elif new_sr > sr:
            # Upsampling - interpolate to higher rate
            t_original = np.arange(len(waveform)) / sr
            t_target = np.arange(0, len(waveform)/sr, 1/new_sr)
            waveform_resampled = np.interp(t_target, t_original, waveform)
        else:
            # Same sampling rate
            waveform_resampled = waveform

        # Step 2: Always resample back to original sample rate to demonstrate aliasing effects
        if len(waveform_resampled) > 0:
            t_resampled = np.arange(len(waveform_resampled)) / new_sr
            t_final = np.arange(len(waveform)) / sr
            aliased_waveform = np.interp(t_final, t_resampled, waveform_resampled)
        else:
            aliased_waveform = waveform

        aliased_filename = f"aliased_{new_sr}_{filename}"
        aliased_path = os.path.join(UPLOAD_FOLDER, aliased_filename)
        sf.write(aliased_path, aliased_waveform, sr)

        gender_after_alias = safe_predict_gender(aliased_path)

        fft = np.fft.fft(aliased_waveform)
        freqs = np.fft.fftfreq(len(fft), 1 / sr)
        magnitude = np.abs(fft)[: len(freqs)//2]
        freqs = freqs[: len(freqs)//2]

        # Add information about the sampling scenario
        scenario = "upsampling" if new_sr > sr else "downsampling" if new_sr < sr else "same_rate"
        aliasing_risk = "HIGH" if new_sr < 2 * nyquist_freq else "LOW"

        return {
            "filename": aliased_filename,
            "original_sr": sr,
            "new_sr": new_sr,
            "nyquist_freq": nyquist_freq,
            "scenario": scenario,
            "aliasing_risk": aliasing_risk,
            "gender": gender_after_alias,
            "file_url": f"http://127.0.0.1:8000/uploads/{aliased_filename}",
            "spectrum": {
                "freqs": freqs.tolist()[::20],
                "magnitude": magnitude.tolist()[::20]
            }
        }
    except Exception as e:
        print(f">>> ERROR in aliasing_effect: {e}")
        raise HTTPException(status_code=500, detail=f"Aliasing processing failed: {str(e)}")
    
# ---------------- 3. Anti-aliasing recovery ----------------
@router.post("/recover")
async def recover_with_dsp(filename: str = Form(...)):
    try:
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        if not os.path.exists(file_path):
            return {"error": "File not found!"}

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
        cutoff = sr / 3 
        order = 6
        b, a = butter(order, cutoff / (up_sr / 2), btype='low')
        filtered_stage1 = filtfilt(b, a, upsampled)

        # ---------- Step 3: Gaussian smoothing ----------
        window = windows.gaussian(101, std=15)
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
        recovered_gender = safe_predict_gender(recovered_path)

        # Spectrum after recovery
        fft_after = np.fft.fft(recovered)
        freqs_after = np.fft.fftfreq(len(fft_after), 1 / sr)
        magnitude_after = np.abs(fft_after)[: len(freqs_after)//2]
        freqs_after = freqs_after[: len(freqs_after)//2]

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
        print(f" DSP Recovery error: {e}")
        return {"error": str(e)}

# ---------------- Test endpoint ----------------
@router.get("/test")
async def test_endpoint():
    return {
        "message": "Voice gender router is working!",
        "model_available": MODEL_AVAILABLE,
        "model_loaded_on_demand": True,
        "timestamp": "Server is responding correctly"
    }