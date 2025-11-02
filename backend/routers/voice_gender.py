from fastapi import APIRouter, UploadFile, File, Form, HTTPException
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
    """Safely predict gender with error handling"""
    if not MODEL_AVAILABLE:
        return "Model not available"
    try:
        return predict_gender_from_file(file_path)
    except Exception as e:
        return f"Prediction error: {str(e)}"

def compute_fft_spectrum(waveform, sr, downsample_factor=200, max_frequency=None):
    """
    Compute FFT spectrum with configurable downsampling and frequency range
    
    Args:
        waveform: Audio signal as numpy array
        sr: Sampling rate in Hz
        downsample_factor: Factor to reduce data points for efficient transmission
        max_frequency: Maximum frequency to include (None for full spectrum)
    
    Returns:
        Dictionary with frequency and magnitude arrays
    """
    # Compute FFT
    fft = np.fft.fft(waveform)
    freqs = np.fft.fftfreq(len(fft), 1 / sr)
    
    # Take only positive frequencies (real signal symmetry)
    positive_mask = freqs >= 0
    freqs = freqs[positive_mask]
    magnitude = np.abs(fft)[positive_mask]
    
    # Apply frequency range limit if specified
    if max_frequency is not None:
        freq_mask = freqs <= max_frequency
        freqs = freqs[freq_mask]
        magnitude = magnitude[freq_mask]
    
    # Downsample for efficient transmission while preserving spectral shape
    if downsample_factor > 1 and len(freqs) > downsample_factor:
        # Use max magnitude in each chunk to preserve spectral peaks
        num_chunks = len(freqs) // downsample_factor
        downsampled_freqs = []
        downsampled_magnitude = []
        
        for i in range(num_chunks):
            start_idx = i * downsample_factor
            end_idx = start_idx + downsample_factor
            
            chunk_freqs = freqs[start_idx:end_idx]
            chunk_magnitude = magnitude[start_idx:end_idx]
            
            # Average frequencies, but keep peak magnitude to preserve spectral features
            avg_freq = np.mean(chunk_freqs)
            peak_magnitude = np.max(chunk_magnitude)
            
            downsampled_freqs.append(float(avg_freq))
            downsampled_magnitude.append(float(peak_magnitude))
        
        # Handle remaining samples if any
        remaining_start = num_chunks * downsample_factor
        if remaining_start < len(freqs):
            downsampled_freqs.append(float(np.mean(freqs[remaining_start:])))
            downsampled_magnitude.append(float(np.max(magnitude[remaining_start:])))
        
        freqs = downsampled_freqs
        magnitude = downsampled_magnitude
    else:
        # Convert to Python native types
        freqs = freqs.tolist()
        magnitude = magnitude.tolist()
    
    return {
        "freqs": freqs,
        "magnitude": magnitude
    }

def apply_aliasing_resampling(waveform, original_sr, target_sr):
    """
    Apply manual resampling to create aliasing effects
    
    Args:
        waveform: Original audio signal
        original_sr: Original sampling rate
        target_sr: Target sampling rate for resampling
    
    Returns:
        Resampled waveform at original_sr with aliasing effects
    """
    # Manual resampling without anti-aliasing filters
    if target_sr < original_sr:
        # Downsampling - causes aliasing
        downsample_ratio = original_sr / target_sr
        indices = np.round(np.arange(0, len(waveform), downsample_ratio)).astype(int)
        indices = indices[indices < len(waveform)]  # Ensure bounds
        waveform_resampled = waveform[indices]
    elif target_sr > original_sr:
        # Upsampling - causes imaging
        t_original = np.arange(len(waveform)) / original_sr
        t_target = np.arange(0, len(waveform)/original_sr, 1/target_sr)
        waveform_resampled = np.interp(t_target, t_original, waveform)
    else:
        # Same sampling rate
        waveform_resampled = waveform

    # Resample back to original rate for comparison
    if len(waveform_resampled) > 0:
        t_resampled = np.arange(len(waveform_resampled)) / target_sr
        t_final = np.arange(len(waveform)) / original_sr
        aliased_waveform = np.interp(t_final, t_resampled, waveform_resampled)
    else:
        aliased_waveform = waveform
    
    return aliased_waveform

def apply_anti_aliasing_recovery(waveform, sr):
    """
    Apply DSP recovery pipeline to remove aliasing artifacts
    
    Args:
        waveform: Aliased audio signal
        sr: Sampling rate
    
    Returns:
        Recovered waveform with reduced aliasing
    """
    # ---------- Step 1: Oversample ----------
    up_sr = sr * 4  # 4x oversampling
    upsampled = librosa.resample(waveform, orig_sr=sr, target_sr=up_sr)

    # ---------- Step 2: Low-pass filter ----------
    cutoff = sr / 3  # Conservative cutoff
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

    return recovered

# ---------------- 1. Original prediction ----------------
@router.post("/predict")
async def predict_voice_gender(file: UploadFile = File(...)):
    """Analyze voice gender and compute frequency spectrum"""
    try:
        # Save uploaded file
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Load and analyze audio
        waveform, sr = librosa.load(file_path, sr=None, mono=True)
        duration = librosa.get_duration(y=waveform, sr=sr)
        
        # Compute frequency spectrum
        spectrum = compute_fft_spectrum(waveform, sr, downsample_factor=200, max_frequency=5000)
        
        # Predict gender
        gender = safe_predict_gender(file_path)

        return {
            "filename": file.filename,
            "gender": gender,
            "sampling_rate": sr,
            "duration": duration,
            "spectrum": spectrum
        }
    except Exception as e:
        print(f">>> ERROR in predict_voice_gender: {e}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

# ---------------- 2. Aliasing effect ----------------
@router.post("/aliasing")
async def aliasing_effect(filename: str = Form(...), new_sr: int = Form(...)):
    """Apply aliasing effects through manual resampling"""
    try:
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found!")

        # Load original audio
        waveform, sr = librosa.load(file_path, sr=None, mono=True)

        # Calculate Nyquist frequency and aliasing risk
        nyquist_freq = sr // 2
        print(f">>> Original SR: {sr} Hz, Target SR: {new_sr} Hz, Nyquist: {nyquist_freq} Hz")

        # Apply aliasing resampling
        aliased_waveform = apply_aliasing_resampling(waveform, sr, new_sr)

        # Save aliased audio
        aliased_filename = f"aliased_{new_sr}_{filename}"
        aliased_path = os.path.join(UPLOAD_FOLDER, aliased_filename)
        sf.write(aliased_path, aliased_waveform, sr)

        # Analyze aliased result
        gender_after_alias = safe_predict_gender(aliased_path)
        
        # Compute spectrum of aliased signal
        spectrum = compute_fft_spectrum(aliased_waveform, sr, downsample_factor=20, max_frequency=5000)

        # Determine scenario and risk
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
            "spectrum": spectrum
        }
    except Exception as e:
        print(f">>> ERROR in aliasing_effect: {e}")
        raise HTTPException(status_code=500, detail=f"Aliasing processing failed: {str(e)}")

# ---------------- 3. Anti-aliasing recovery ----------------
@router.post("/recover")
async def recover_with_dsp(filename: str = Form(...)):
    """Apply anti-aliasing recovery using DSP techniques"""
    try:
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found!")

        # Load aliased audio
        waveform, sr = librosa.load(file_path, sr=None, mono=True)

        # Compute spectrum before recovery
        spectrum_before = compute_fft_spectrum(waveform, sr, downsample_factor=200, max_frequency=5000)

        # Apply anti-aliasing recovery pipeline
        recovered_waveform = apply_anti_aliasing_recovery(waveform, sr)

        # Save recovered audio
        recovered_filename = f"recovered_{filename}"
        recovered_path = os.path.join(UPLOAD_FOLDER, recovered_filename)
        sf.write(recovered_path, recovered_waveform, sr)

        # Analyze recovered result
        recovered_gender = safe_predict_gender(recovered_path)

        # Compute spectrum after recovery
        spectrum_after = compute_fft_spectrum(recovered_waveform, sr, downsample_factor=200, max_frequency=5000)

        return {
            "filename": recovered_filename,
            "gender": recovered_gender,
            "original_sr": sr,
            "recovered_sr": sr,
            "message": f"Recovered with anti-aliasing filters",
            "file_url": f"http://127.0.0.1:8000/uploads/{recovered_filename}",
            "spectrum_before": spectrum_before,
            "spectrum_after": spectrum_after
        }

    except Exception as e:
        print(f">>> DSP Recovery error: {e}")
        raise HTTPException(status_code=500, detail=f"Recovery failed: {str(e)}")

# ---------------- Test endpoint ----------------
@router.get("/test")
async def test_endpoint():
    """Test endpoint to verify router functionality"""
    return {
        "message": "Voice gender router is working!",
        "model_available": MODEL_AVAILABLE,
        "endpoints": ["/predict", "/aliasing", "/recover"],
        "timestamp": "Server is responding correctly"
    }