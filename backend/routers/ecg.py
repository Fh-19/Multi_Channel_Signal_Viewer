import os
import numpy as np
from fastapi import APIRouter, HTTPException, Query, WebSocket, File, UploadFile
from typing import List, Optional
import asyncio
import wfdb
from pydantic import BaseModel
from keras.models import load_model
from ..services import ecg_processing as dsp
from ..services import models_processing as dsp_models

# -------------------
# NOTE: changed constants for multiclass pretrained model
# -------------------
TARGET_FS = 400            # model expected sampling frequency from your test script
TARGET_LENGTH = 4096       # model expected input length (samples) from test script
MODEL_FILENAME = "model.hdf5"  # path to the 6-class pretrained model (update name/path if needed)
MODEL_PATH = os.path.join(os.path.dirname(__file__), "../pretrained_models", MODEL_FILENAME)
BINARY_MODEL_FILENAME = "ResNet_finetuned_binary2.h5"
BINARY_MODEL_PATH = os.path.join(os.path.dirname(__file__), "../pretrained_models", BINARY_MODEL_FILENAME)

# 6-class abnormalities (as in your test script)
CLASSES = ["1dAVb", "RBBB", "LBBB", "SB", "AF", "ST"]

router = APIRouter()

# Load model once at module import
if not os.path.exists(MODEL_PATH):
    raise RuntimeError(f"Pretrained model not found at: {MODEL_PATH}")
model = load_model(MODEL_PATH, compile=False)

if not os.path.exists(BINARY_MODEL_PATH):
    raise RuntimeError(f"Binary model not found at: {BINARY_MODEL_PATH}")

binary_model = load_model(BINARY_MODEL_PATH, compile=False)

class ClassifyRequest(BaseModel):
    record_number: str
    data_folder: str = "services/data"
    target_fs: Optional[int] = None  # NEW: Allow target_fs in request body

class ResampleRequest(BaseModel):
    record_number: str
    target_fs: int

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "../uploaded_data")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- ECG data retrieval endpoint (MODIFIED to include original_fs) ---
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
        "signals": signals[:, leads].astype(float).tolist(),
        "fs": float(fs),
        "original_fs": float(fs), 
        "r_peaks": {int(k): [int(x) for x in v] for k, v in r_peaks_dict.items()},
        "cycles": {int(k): [[float(x) for x in cycle] for cycle in v] for k, v in cycles.items()},
        "lead_names": [str(name) for name in lead_names],
    }

# --- NEW: Universal resampling endpoint for both upsampling and downsampling ---
@router.post("/resample")
def resample_ecg(req: ResampleRequest):
    """
    Universal resampling endpoint - handles both upsampling and downsampling.
 
    - Downsampling (target_fs < original_fs): Shows aliasing effects
    - Upsampling (target_fs > original_fs): Shows interpolation effects
    - Same frequency: No change
    """
    file_path = os.path.join(UPLOAD_FOLDER, req.record_number)
    
    try:
        signals, original_fs, lead_names = dsp.load_ecg_record_from_path(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load ECG record: {e}")
    
    # Apply appropriate resampling
    if req.target_fs < original_fs:
        # Downsampling - will cause aliasing
        resampled_signals = dsp.downsample_signals(signals, original_fs, req.target_fs)
        resampling_type = "downsampling"
        aliasing_occurs = True
    elif req.target_fs > original_fs:
        # Upsampling - interpolation, no aliasing
        resampled_signals = dsp.upsample_signals(signals, original_fs, req.target_fs)
        resampling_type = "upsampling" 
        aliasing_occurs = False
    else:
        # No change
        resampled_signals = signals
        resampling_type = "none"
        aliasing_occurs = False
    
    # Recalculate R-peaks on resampled signals
    r_peaks_dict = dsp.get_r_peaks_per_lead(resampled_signals, req.target_fs, leads=list(range(len(lead_names))))
    
    return {
        "signals": resampled_signals.astype(float).tolist(),
        "fs": float(req.target_fs),
        "original_fs": float(original_fs),
        "r_peaks": {int(k): [int(x) for x in v] for k, v in r_peaks_dict.items()},
        "lead_names": [str(name) for name in lead_names],
        "resampling_type": resampling_type,
        "aliasing_warning": aliasing_occurs,
        "educational_info": {
            "operation": f"{original_fs} Hz → {req.target_fs} Hz",
            "nyquist_original": original_fs / 2,
            "nyquist_target": req.target_fs / 2,
            "max_representable_freq": req.target_fs / 2,
            "explanation": get_resampling_explanation(original_fs, req.target_fs)
        }
    }

def get_resampling_explanation(original_fs, target_fs):
    """Generate educational explanation for the resampling operation."""
    if target_fs < original_fs:
        return f" DOWNSAMPLING: {target_fs} Hz < {original_fs} Hz. High frequencies above {target_fs/2} Hz will alias (fold back as distortion)."
    elif target_fs > original_fs:
        return f" UPSAMPLING: {target_fs} Hz > {original_fs} Hz. Signal becomes smoother through interpolation, but no new information is added."
    else:
        return f" NO CHANGE: Sampling rate remains at {original_fs} Hz."

# --- WebSocket streaming ECG samples (unchanged) ---
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

# --- ECG classification endpoint (MODIFIED to use resampled data) ---
@router.post("/classify")
def classify_record(req: ClassifyRequest):
    file_path = os.path.join(UPLOAD_FOLDER, req.record_number)

    try:
        # Load and optionally resample based on request
        signals, original_fs, lead_names = dsp.load_ecg_record_from_path(file_path)
        
        # NEW: Apply resampling if target_fs is provided in request body
        if req.target_fs and req.target_fs != original_fs:
            if req.target_fs < original_fs:
                resampled_signals = dsp.downsample_signals(signals, original_fs, req.target_fs)
                aliasing_warning = True
            else:
                resampled_signals = dsp.upsample_signals(signals, original_fs, req.target_fs)
                aliasing_warning = False
            
            # Create a mock record with resampled signals for preprocessing
            class MockRecord:
                def __init__(self, signals, fs, sig_name):
                    self.p_signal = signals
                    self.fs = fs
                    self.sig_name = sig_name
                    
            rec = MockRecord(resampled_signals, req.target_fs, lead_names)
            used_fs = req.target_fs
        else:
            # Use original signals
            rec = wfdb.rdrecord(file_path)
            used_fs = original_fs
            aliasing_warning = False

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read record: {e}")

    # --- Preprocess for 6-class model ---
    try:
        X_multi = dsp_models.preprocess_ecg_with_mapping_from_record(
            rec,
            target_fs=TARGET_FS,
            target_length=TARGET_LENGTH,
            plot_signal=False
        ).astype(np.float32)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preprocessing failed: {e}")

    # --- Run 6-class model ---
    probs = model.predict(X_multi).flatten().tolist()
    label_idx = int(np.argmax(probs))
    label = CLASSES[label_idx]
    confidence = float(probs[label_idx])
    probabilities = {cls: float(p) for cls, p in zip(CLASSES, probs)}

    # --- Decision logic ---
    if confidence >= 0.3:
        return {
            "label": label,
            "confidence": confidence,
            "probabilities": probabilities,
            "model_input_shape": X_multi.shape,
            "used_fs": used_fs,  # Return which FS was used
            "original_fs": original_fs,  # Return original FS
            "aliasing_warning": aliasing_warning  # Aliasing warning
        }

    # --- Preprocess for binary model ---
    X_binary = dsp_models.preprocess_for_binary_model(rec)

    # --- Run binary model ---
    binary_prob = binary_model.predict(X_binary).flatten()
    if binary_prob.shape[0] == 1:  
        # sigmoid output
        prob_abnormal = float(binary_prob[0])
    else:
        # softmax output [p_normal, p_abnormal]
        prob_abnormal = float(binary_prob[1])

    if prob_abnormal < 0.5:
        return {
            "label": "Normal ECG",
            "confidence": float(1 - prob_abnormal),
            "probabilities": probabilities,  # still return 6-class probs
            "model_input_shape": X_multi.shape,
            "used_fs": used_fs,
            "original_fs": original_fs,
            "aliasing_warning": aliasing_warning
        }
    else:
        return {
            "label": "Other Cardiac Abnormalities",
            "confidence": prob_abnormal,
            "probabilities": probabilities,  # still return 6-class probs
            "model_input_shape": X_multi.shape,
            "used_fs": used_fs,
            "original_fs": original_fs,
            "aliasing_warning": aliasing_warning
        }

# --- ECG file upload endpoint (unchanged) ---
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