# backend/routers/eeg.py
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, UploadFile, File
import os
import json
import asyncio
import mne

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def load_eeg_file(file_path: str):
    """Load EEG file (.set or .edf) using mne."""
    if file_path.endswith(".set"):
        return mne.io.read_raw_eeglab(file_path, preload=True, verbose=False)
    elif file_path.endswith(".edf"):
        return mne.io.read_raw_edf(file_path, preload=True, verbose=False)
    else:
        raise ValueError("Unsupported file type")

@router.post("/upload")
async def upload_eeg_file(file: UploadFile = File(...)):
    """Upload an EEG file and return metadata."""
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
    channels: list[str] = Query([]),
    segment_duration: float = Query(2.0)
):
    """Return EEG segments from a previously uploaded file."""
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
