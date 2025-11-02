from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse
import torch
import torch.nn as nn
import librosa
import soundfile as sf
import numpy as np
import matplotlib.pyplot as plt
import os
from uuid import uuid4

router = APIRouter()
#folder to save audio files
UPLOAD_FOLDER = "uploads"
SPEC_FOLDER = "uploads/specs"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(SPEC_FOLDER, exist_ok=True)

# -----------------------
# MODEL DEFINITION
# -----------------------
class AudioClassifier(nn.Module):
    def __init__(self):
        super(AudioClassifier, self).__init__()
        self.fc1 = nn.Linear(40, 128)
        self.fc2 = nn.Linear(128, 64)
        self.fc3 = nn.Linear(64, 2)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.3)

    def forward(self, x):
        if x.ndim == 1:
            x = x.unsqueeze(0)
        x = self.relu(self.fc1(x))
        x = self.dropout(self.relu(self.fc2(x)))
        x = self.fc3(x)
        return x

# -----------------------
# LOAD MODEL
# -----------------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = AudioClassifier()
model.load_state_dict(torch.load("backend/pretrained_models/model.pth", map_location=device))
model.to(device)
model.eval()

label_map = {0: "Noise", 1: "Drone"}

# take the middle of all frames to form one vector
# FEATURE EXTRACTION
# -----------------------
def extract_features(file_path):
    y, sr = librosa.load(file_path, sr=16000)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=40)
    mfcc_scaled = np.mean(mfcc.T, axis=0)
    return torch.tensor(mfcc_scaled, dtype=torch.float32)
#to draw spectrogram as image PNG
def save_spectrogram(y, sr, out_path, title):
    plt.figure(figsize=(6, 3))
    S = librosa.feature.melspectrogram(y=y, sr=sr)
    S_dB = librosa.power_to_db(S, ref=np.max)
    librosa.display.specshow(S_dB, sr=sr, x_axis='time', y_axis='mel')
    plt.title(title)
    plt.colorbar(format="%+2.0f dB")
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()

# -----------------------
# PREDICTION
# -----------------------
def predict_audio(path):
    features = extract_features(path).unsqueeze(0).to(device)
    with torch.no_grad():
        outputs = model(features)
        probs = torch.softmax(outputs, dim=1)[0]
    idx = int(torch.argmax(probs))
    label = label_map[idx]
    confidence = float(probs[idx] * 100)
    return label, round(confidence, 2)

# to play audio
# ROUTES
# -----------------------
@router.get("/play/{filename}")
def play_audio(filename: str):
    path = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(path):
        return FileResponse(path, media_type="audio/wav")
    return JSONResponse(content={"error": "File not found"}, status_code=404)
#to view spectrogram
@router.get("/spec/{filename}")
def get_spec(filename: str):
    path = os.path.join(SPEC_FOLDER, filename)
    if os.path.exists(path):
        return FileResponse(path, media_type="image/png")
    return JSONResponse(content={"error": "Spectrogram not found"}, status_code=404)
#to upload file and predict the result + view spectrogram
@router.post("/predict")
async def predict(file: UploadFile = File(...)):
    filename = f"{uuid4().hex}.wav"
    path = os.path.join(UPLOAD_FOLDER, filename)
    with open(path, "wb") as f:
        f.write(await file.read())

    try:
        y, sr = librosa.load(path, sr=None)
        spec_path = os.path.join(SPEC_FOLDER, f"spec_{filename}.png")
        save_spectrogram(y, sr, spec_path, "Original Audio")

        label, conf = predict_audio(path)

        return {
            "predicted_label": label,
            "confidence": conf,
            "file_url": f"http://127.0.0.1:8000/api/play/{filename}",
            "spec_url": f"http://127.0.0.1:8000/api/spec/spec_{filename}.png",
            "sample_rate": sr
        }
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
#upload file and change the aliasing sample rate + predict the result
@router.post("/alias")
async def alias_audio(file: UploadFile = File(...), rate: int = Form(...)):
    filename = f"{uuid4().hex}.wav"
    orig_path = os.path.join(UPLOAD_FOLDER, filename)
    alias_path = os.path.join(UPLOAD_FOLDER, f"alias_{filename}")

    with open(orig_path, "wb") as f:
        f.write(await file.read())

    try:
        y, sr = librosa.load(orig_path, sr=None)
        y_alias = librosa.resample(y, orig_sr=sr, target_sr=rate)
        sf.write(alias_path, y_alias, rate)

        alias_spec_path = os.path.join(SPEC_FOLDER, f"alias_spec_{filename}.png")
        save_spectrogram(y_alias, rate, alias_spec_path, f"Aliased Audio ({rate} Hz)")

        label, conf = predict_audio(alias_path)

        return {
            "predicted_label": label,
            "confidence": conf,
            "alias_file_url": f"http://127.0.0.1:8000/api/play/alias_{filename}",
            "alias_spec_url": f"http://127.0.0.1:8000/api/spec/alias_spec_{filename}.png",
            "sample_rate": rate
        }
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
  