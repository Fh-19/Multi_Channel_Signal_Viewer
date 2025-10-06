# mfcc.py
import os
import numpy as np
import librosa

DATA_DIR = "data_fixed/train"
OUTPUT_DIR = "features"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def extract_features(file_path):
    y, sr = librosa.load(file_path, sr=16000)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=40)
    mfcc_scaled = np.mean(mfcc.T, axis=0)
    return mfcc_scaled

def prepare_dataset(split):
    X, y = [], []
    classes = {"drone": 1, "noise": 0}
    for label, idx in classes.items():
        folder = os.path.join(DATA_DIR, split, label)
        for file in os.listdir(folder):
            if file.endswith(".wav"):
                path = os.path.join(folder, file)
                try:
                    features = extract_features(path)
                    X.append(features)
                    y.append(idx)
                except Exception as e:
                    print(f"Error with {path}: {e}")
    return np.array(X), np.array(y)

print("Extracting train features...")
X_train, y_train = prepare_dataset("train")
np.save(os.path.join(OUTPUT_DIR, "X_train.npy"), X_train)
np.save(os.path.join(OUTPUT_DIR, "y_train.npy"), y_train)



print("✅ Features saved in", OUTPUT_DIR)
