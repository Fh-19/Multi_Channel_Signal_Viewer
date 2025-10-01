# backend/routers/eeg.py
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from fastapi.responses import JSONResponse
import os
import tempfile
import torch
import mne
import numpy as np
from sklearn.preprocessing import StandardScaler

from ..services.eeg_model import load_trained_model

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
#   Utility: load EEG file
# ------------------------------------------------------------
def load_eeg_file(file_path: str):
    """Load EEG file (.set or .edf) using MNE."""
    if file_path.endswith(".set"):
        return mne.io.read_raw_eeglab(file_path, preload=True, verbose=False)
    elif file_path.endswith(".edf"):
        return mne.io.read_raw_edf(file_path, preload=True, verbose=False)
    else:
        raise ValueError("Unsupported file type. Only .edf or .set supported.")


# ------------------------------------------------------------
#   Routes
# ------------------------------------------------------------
@router.post("/upload")
async def upload_eeg_file(file: UploadFile = File(...)):
    """Upload an EEG file and return basic metadata."""
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())

    try:
        raw = load_eeg_file(file_path)
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
    segment_duration: float = Query(2.0),
):
    """Return fixed-length EEG segments from a previously uploaded file."""
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    try:
        raw = load_eeg_file(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load EEG file: {e}")

    if not channels:
        channels = raw.info["ch_names"]

    data, _ = raw.get_data(picks=channels, return_times=True)
    fs = raw.info["sfreq"]
    samples_per_segment = int(segment_duration * fs)

    segments = []
    for start in range(0, data.shape[1], samples_per_segment):
        end = start + samples_per_segment
        if end > data.shape[1]:
            break
        segments.append(data[:, start:end].T.tolist())

    return {"segments": segments, "fs": fs}


@router.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    Predict EEG class using the pretrained model.
    Performs same preprocessing as used in training.
    """
    suffix = ".edf" if file.filename.endswith(".edf") else ".set"
    tmp_path = None
    try:
        # -----------------------
        # Save temp file
        # -----------------------
        contents = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        # -----------------------
        # Load EEG
        # -----------------------
        if file.filename.endswith(".edf"):
            raw = mne.io.read_raw_edf(tmp_path, preload=True, verbose=False)
        elif file.filename.endswith(".set"):
            raw = mne.io.read_raw_eeglab(tmp_path, preload=True, verbose=False)
        else:
            return JSONResponse(
                {"error": "Unsupported file format. Only .edf and .set are allowed."},
                status_code=400,
            )

        data = raw.get_data()  # (channels, samples)

        # Ensure 19-channel input
        if data.shape[0] < 19:
            return JSONResponse(
                {"error": f"File has {data.shape[0]} channels, expected at least 19"},
                status_code=400,
            )
        data = data[:19, :]

        # -----------------------
        # Match training: per-file StandardScaler normalization
        # -----------------------
        scaler = StandardScaler()
        data = scaler.fit_transform(data.T).T  # shape still (19, n_samples)

        # -----------------------
        # Sliding window
        # -----------------------
        window_size = 256   # samples
        step_size = 128     # overlap
        n_samples = data.shape[1]

        segments = []
        for start in range(0, n_samples - window_size + 1, step_size):
            seg = data[:, start:start + window_size]
            segments.append(seg)

        if not segments:
            return JSONResponse(
                {"error": f"EEG recording too short, need at least {window_size} samples"},
                status_code=400,
            )

        batch = torch.tensor(np.stack(segments), dtype=torch.float32).unsqueeze(1)  # (N,1,19,256)

        # -----------------------
        # Inference (chunked to avoid OOM)
        # -----------------------
        chunk_size = 128
        all_probs = []
        with torch.no_grad():
            for i in range(0, batch.shape[0], chunk_size):
                chunk = batch[i:i + chunk_size].to(device)
                out = model(chunk)
                p = torch.nn.functional.softmax(out, dim=1).cpu()
                all_probs.append(p)
        probs = torch.cat(all_probs, dim=0)
        avg_probs = probs.mean(dim=0)
        predicted_class = torch.argmax(avg_probs).item()

        return {
            "prediction": CLASS_NAMES[predicted_class],
            "confidence": float(avg_probs[predicted_class].item()),
            "all_probabilities": {CLASS_NAMES[i]: float(avg_probs[i].item()) for i in range(len(CLASS_NAMES))},
        }

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

    finally:
        # Clean up temp file
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
