import os
import numpy as np
from fastapi import APIRouter, HTTPException, Query, WebSocket, File, UploadFile
from typing import List
import asyncio
import wfdb
from pydantic import BaseModel
from keras.models import load_model
from ..services import ecg_processing as dsp 

FS = 300  # sampling rate of model
MAXLEN = 30 * FS
MODEL_PATH = os.path.join(os.path.dirname(__file__), "../pretrained_models/ResNet_30s_34lay_16conv.hdf5")
CLASSES = ['Atrial Fibrillation', 'Normal Sinus Rythm', 'Other Cardiac Rythms', 'noise']

router = APIRouter()
model = load_model(MODEL_PATH, compile=False)


class ClassifyRequest(BaseModel):
    record_number: str
    data_folder: str = "services/data"


UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "../uploaded_data")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- ECG data retrieval endpoint ---
@router.get("/ecg")
def get_ecg(
    filename: str = Query(..., description="Uploaded ECG base name"),
    leads: List[int] = Query([0, 1, 2], description="List of lead indices"),
):
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    signals, fs, lead_names = dsp.load_ecg_record_from_path(file_path)

    r_peaks_dict = dsp.get_r_peaks_per_lead(signals, fs, leads=leads)
    cycles = dsp.extract_cycles(signals, r_peaks_dict, selected_leads=leads)

    return {
        "signals": signals[:, leads].tolist(),
        "fs": fs,
        "r_peaks": r_peaks_dict,
        "cycles": cycles,
        "lead_names": lead_names,
    }


# --- WebSocket streaming ECG samples ---
@router.websocket("/ws/ecg/{record_number}")
async def stream_ecg(websocket: WebSocket, record_number: str):
    await websocket.accept()
    try:
        signals, fs = dsp.load_ecg_record(record_number)
        r_peaks = dsp.get_r_peaks(signals, fs, lead=0)

        window_size = 50  # send samples in chunks
        for i in range(0, len(signals), window_size):
            chunk = signals[i:i+window_size, :3].tolist()  # first 3 leads for now
            chunk_peaks = [p for p in r_peaks if i <= p < i + window_size]

            await websocket.send_json({
                "samples": chunk,
                "start_index": i,
                "fs": fs,
                "peaks": chunk_peaks
            })

            await asyncio.sleep(window_size / fs)
    finally:
        await websocket.close()


# --- ECG classification endpoint ---
@router.post("/classify")
def classify_record(req: ClassifyRequest):
    file_path = os.path.join(UPLOAD_FOLDER, req.record_number)
    signals, _ = dsp.load_ecg_record_from_path(file_path)
    data = signals[:, 0]  # lead I, filtered
    data = np.nan_to_num(data)
    data = data[:MAXLEN]
    data = (data - np.mean(data)) / np.std(data)

    X = np.zeros((1, MAXLEN, 1))
    X[0, :len(data), 0] = data

    prob = model.predict(X)
    label_idx = int(np.argmax(prob))
    label = CLASSES[label_idx]
    confidence = float(prob[0, label_idx])

    abnormal_segments = []
    if label != 'Normal Sinus Rythm':
        segment_len = FS  # 1-second segments
        for i in range(0, len(data), segment_len):
            abnormal_segments.append([i / FS, min(i + segment_len, len(data)) / FS])

    return {"label": label, "confidence": confidence, "abnormal_segments": abnormal_segments}


# --- ECG file upload endpoint ---
@router.post("/upload")
async def upload_ecg_files(files: List[UploadFile] = File(...)):
    if len(files) != 2:
        raise HTTPException(status_code=400, detail="Please upload both .dat and .hea files.")

    base_names = set()
    for file in files:
        filename = file.filename
        base, ext = os.path.splitext(filename)
        if ext.lower() not in [".dat", ".hea"]:
            raise HTTPException(status_code=400, detail="Only .dat and .hea files are allowed.")
        base_names.add(base)
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        with open(file_path, "wb") as f:
            f.write(await file.read())

    if len(base_names) != 1:
        raise HTTPException(status_code=400, detail="Both files must have the same base name.")

    base = base_names.pop()
    dat_file = os.path.join(UPLOAD_FOLDER, base + ".dat")
    hea_file = os.path.join(UPLOAD_FOLDER, base + ".hea")

    if os.path.exists(dat_file) and os.path.exists(hea_file):
        return {"filename": base}
    else:
        return {"message": "Upload failed, both files are required."}
