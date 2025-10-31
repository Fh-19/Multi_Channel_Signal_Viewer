from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from fastapi.responses import JSONResponse
import os
import tempfile
import torch
import numpy as np

from ..pretrained_models.eeg_model import load_trained_model
from ..services.eeg_processing import (
    load_raw,
    preprocess_raw,
    to_microvolts,
    standardize,
    resample_with_aliasing,
)

router = APIRouter()

# ------------------------------------------------------------
#   Load model once at startup
# ------------------------------------------------------------
MODEL_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "pretrained_models", "eeg_model.pth")
)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = load_trained_model(MODEL_PATH, device=device)

CLASS_NAMES = ["Alzheimer", "Dementia", "Epilepsy", "Healthy", "Schizophrenia"]

# ------------------------------------------------------------
#   Upload directory
# ------------------------------------------------------------
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ------------------------------------------------------------
#   Routes
# ------------------------------------------------------------

@router.post("/upload")
async def upload_eeg_file(file: UploadFile = File(...)):
    """
    Upload EEG file and return metadata
    """
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())

    try:
        raw = load_raw(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load EEG file: {e}")

    return {
        "filename": file.filename,
        "sfreq": float(raw.info["sfreq"]),
        "n_channels": len(raw.info["ch_names"]),
        "duration_seconds": raw.n_times / raw.info["sfreq"],
        "channels": raw.info["ch_names"],
    }


@router.get("/segments")
def get_segments(
    filename: str = Query(...),
    channels: list[str] | None = Query(None),
    segment_duration: float = Query(2.0, description="Segment length in seconds"),
    highpass: float = Query(0.5, description="Highpass filter cutoff (Hz)"),
    resample_to: float | None = Query(None, description="Resample frequency (Hz)"),
    max_duration: float = Query(100.0, description="Maximum EEG duration to process (seconds)"),
    use_aliasing: bool = Query(False, description="Use true aliasing resampling for experimental frequencies"),
):
    """
    Return fixed-length EEG segments (in µV) from the uploaded file.
    Limits output to the first `max_duration` seconds to prevent large responses.
    Supports true aliasing for experimental sampling rates.
    Uses the file's actual sampling rate as default.
    """
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    try:
        raw = load_raw(file_path)
        
        # Get the ACTUAL file sampling rate
        actual_fs = raw.info['sfreq']
        
        # If no resample_to provided, use the actual file frequency
        target_fs = resample_to if resample_to is not None else actual_fs
        
        # Apply aliasing resampling if requested and target frequency provided
        if use_aliasing and target_fs != actual_fs:
            raw = resample_with_aliasing(raw, target_fs)
            # Apply minimal preprocessing after aliasing
            current_fs = raw.info['sfreq']
            nyquist = current_fs / 2
            h_freq = min(80.0, nyquist * 0.95)
            raw.filter(l_freq=highpass, h_freq=h_freq)
            raw.set_eeg_reference('average', projection=False)
            resampling_method = "aliasing"
        else:
            # Standard preprocessing - resample only if target is different from actual
            if target_fs != actual_fs:
                raw = preprocess_raw(raw, highpass=highpass, resample_to=target_fs)
                resampling_method = "standard"
            else:
                # Just apply preprocessing without resampling
                raw = preprocess_raw(raw, highpass=highpass, resample_to=None)
                resampling_method = "none"
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to preprocess EEG: {e}")

    if not channels:
        channels = raw.info["ch_names"]

    picks = [ch for ch in channels if ch in raw.info["ch_names"]]
    if not picks:
        raise HTTPException(status_code=400, detail="No valid channels selected")

    # Get data and convert to µV
    data, times = raw.get_data(picks=picks, return_times=True)
    data_uV = to_microvolts(data)
    current_fs = raw.info["sfreq"]  # This is the actual current sampling rate after any processing
    samples_per_segment = int(segment_duration * current_fs)

    # ------------------------------------------------------------
    #   Limit data to the first `max_duration` seconds
    # ------------------------------------------------------------
    max_samples = int(max_duration * current_fs)
    if data_uV.shape[1] > max_samples:
        data_uV = data_uV[:, :max_samples]
        times = times[:max_samples]

    # ------------------------------------------------------------
    #   Create fixed-length segments
    # ------------------------------------------------------------
    segments = []
    segment_times = []

    for start in range(0, data_uV.shape[1], samples_per_segment):
        end = start + samples_per_segment
        if end > data_uV.shape[1]:
            break
        segments.append(data_uV[:, start:end].T.tolist())       # (samples, ch)
        segment_times.append(times[start:end].tolist())

    return {
        "segments": segments,
        "segment_times": segment_times,
        "fs": current_fs,  # Return the ACTUAL sampling rate after processing
        "original_fs": actual_fs,  # Also return the original file sampling rate
        "channels": picks,
        "resampling_method": resampling_method,
        "target_fs": target_fs,
        "note": f"Only first {max_duration} seconds of EEG processed to limit payload size.",
    }



@router.post("/predict")
async def predict(
    file: UploadFile = File(...), 
    model_fs: int = Query(256, description="Model's expected sampling frequency"),
    experiment_fs: float | None = Query(None),
    use_aliasing: bool = Query(False, description="Use true aliasing resampling for experimental frequencies")
):
    """
    Predict EEG class using pretrained model.
    Supports both standard resampling and true aliasing for experimental frequencies.
    Uses the file's actual sampling rate as the default.
    """
    suffix = ".edf" if file.filename.endswith(".edf") else ".set"
    tmp_path = None

    try:
        contents = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        raw = load_raw(tmp_path)
        
        # Get the ACTUAL file sampling rate
        actual_fs = raw.info['sfreq']
        
        # Determine target frequency: experiment_fs → model_fs → actual_fs
        if experiment_fs is not None:
            target_fs = experiment_fs
        else:
            # Use model_fs if provided, otherwise use the file's actual frequency
            target_fs = model_fs if model_fs else actual_fs
        
        # Apply resampling if target frequency is different from actual
        if target_fs != actual_fs:
            if use_aliasing:
                # Use true aliasing for experimental frequencies
                raw = resample_with_aliasing(raw, target_fs)
                # Apply minimal preprocessing after aliasing
                current_fs = raw.info['sfreq']
                nyquist = current_fs / 2
                h_freq = min(80.0, nyquist * 0.95)
                raw.filter(l_freq=0.5, h_freq=h_freq)
                raw.set_eeg_reference('average', projection=False)
                resampling_method = "aliasing"
            else:
                # Use standard processing with anti-aliasing
                raw = preprocess_raw(raw, highpass=0.5, resample_to=target_fs)
                resampling_method = "standard"
        else:
            # Use standard processing without resampling
            raw = preprocess_raw(raw, highpass=0.5, resample_to=None)
            resampling_method = "none"

        data = raw.get_data()            # (channels, samples) in Volts
        if data.shape[0] < 19:
            return JSONResponse(
                {"error": f"File has {data.shape[0]} channels, expected ≥19"},
                status_code=400,
            )

        data = data[:19, :]              # first 19 channels
        data = standardize(data)         # z-score per channel

        # sliding windows
        window_size = 256
        step_size = 128
        n_samples = data.shape[1]

        segments = [
            data[:, start:start + window_size]
            for start in range(0, n_samples - window_size + 1, step_size)
        ]
        if not segments:
            return JSONResponse(
                {"error": f"EEG too short, need at least {window_size} samples"},
                status_code=400,
            )

        batch = torch.tensor(np.stack(segments), dtype=torch.float32).unsqueeze(1)  # (N,1,19,256)

        # inference
        chunk_size = 128
        all_probs = []
        with torch.no_grad():
            for i in range(0, batch.shape[0], chunk_size):
                out = model(batch[i:i+chunk_size].to(device))
                p = torch.nn.functional.softmax(out, dim=1).cpu()
                all_probs.append(p)
        probs = torch.cat(all_probs, dim=0)
        avg_probs = probs.mean(dim=0)
        pred_class = torch.argmax(avg_probs).item()

        return {
            "prediction": CLASS_NAMES[pred_class],
            "confidence": float(avg_probs[pred_class]),
            "probabilities": {CLASS_NAMES[i]: float(avg_probs[i]) for i in range(len(CLASS_NAMES))},
            "file_sampling_rate": actual_fs,  # Original file frequency
            "processed_sampling_rate": raw.info['sfreq'],  # After any resampling
            "target_sampling_rate": target_fs,  # What was requested
            "resampling_method": resampling_method,
            "aliasing_effects": use_aliasing,
            "note": "True aliasing effects present" if use_aliasing and resampling_method == "aliasing" else "Standard anti-alias filtering applied"
        }

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except:
                pass