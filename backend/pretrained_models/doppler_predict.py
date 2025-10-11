# backend/pretrained_models/doppler_predict.py
import torch
import torch.nn as nn
import librosa
import numpy as np
import os

# -------------------------------
# Define same model architecture
# -------------------------------
class DopplerNet(nn.Module):
    def __init__(self, n_mels=64, max_frames=400):
        super(DopplerNet, self).__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(),
            nn.MaxPool2d((2, 2)),

            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d((2, 2)),

            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d((2, 2)),

            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d((4, 4))
        )
        self.fc = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128 * 4 * 4, 256),
            nn.ReLU(),
            nn.Dropout(0.4),
            nn.Linear(256, 2)
        )

    def forward(self, x):
        return self.fc(self.cnn(x))

# -------------------------------
# Load model and metadata
# -------------------------------
MODEL_PATH = "backend/pretrained_models/doppler_model_regression.pth"

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
checkpoint = torch.load(MODEL_PATH, map_location=device, weights_only=False)
n_mels = checkpoint.get("n_mels", 64)
max_frames = checkpoint.get("max_frames", 400)

model = DopplerNet(n_mels=n_mels, max_frames=max_frames).to(device)
model.load_state_dict(checkpoint["model_state_dict"])
model.eval()

target_mean = checkpoint["target_mean"]
target_std = checkpoint["target_std"]

# -------------------------------
# Prediction function
# -------------------------------
def predict_doppler(file_path: str):
    y, sr = librosa.load(file_path, sr=22050)

    # compute mel spectrogram
    mel = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=n_mels)
    mel_db = librosa.power_to_db(mel, ref=np.max)
    mel_db = (mel_db - mel_db.min()) / (mel_db.max() - mel_db.min() + 1e-9)

    # pad/trim
    if mel_db.shape[1] < max_frames:
        pad = max_frames - mel_db.shape[1]
        mel_db = np.pad(mel_db, ((0, 0), (0, pad)), mode="constant", constant_values=0.0)
    else:
        mel_db = mel_db[:, :max_frames]

    mel_tensor = torch.tensor(mel_db, dtype=torch.float32).unsqueeze(0).unsqueeze(0).to(device)
    with torch.no_grad():
        pred_norm = model(mel_tensor).cpu().numpy().squeeze()

    pred = pred_norm * target_std + target_mean
    speed_pred, freq_pred = pred.tolist()
    return {"pred_speed_kmh": float(speed_pred), "pred_freq_hz": float(freq_pred)}
