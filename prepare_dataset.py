import numpy as np

# Patch numpy for librosa compatibility
if not hasattr(np, "complex"):
    np.complex = np.complex128

import os, shutil, random, glob
import librosa
import soundfile as sf

# Paths
raw_root = "Multiclass_Drone_Audio"   # adjust path if needed
processed_root = "dataset"

# Ensure clean output
if os.path.exists(processed_root):
    shutil.rmtree(processed_root)
os.makedirs(processed_root)

# Create train/val folders
for split in ["train", "val"]:
    for cls in ["drone", "bird", "noise"]:
        os.makedirs(os.path.join(processed_root, split, cls), exist_ok=True)

# Function to ensure .wav format
def convert_to_wav(src, dst, target_sr=32000):
    try:
        wav, sr = librosa.load(src, sr=target_sr, mono=True)
        sf.write(dst, wav, target_sr)
    except Exception as e:
        print(f"Error converting {src}: {e}")

# Process classes
class_map = {"drone": "drone", "birds": "bird", "noise": "noise"}
for folder, label in class_map.items():
    folder_path = os.path.join(raw_root, folder)
    files = []

    # Collect mp3 and wav files
    for ext in ("*.wav", "*.mp3"):
        files.extend(glob.glob(os.path.join(folder_path, ext)))

    # Also check temp_wav
    temp_path = os.path.join(folder_path, "temp_wav")
    if os.path.exists(temp_path):
        files.extend(glob.glob(os.path.join(temp_path, "*.wav")))

    # Shuffle
    random.shuffle(files)

    # Split 80/20
    split_idx = int(0.8 * len(files))
    train_files = files[:split_idx]
    val_files = files[split_idx:]

    # Save train set
    for i, f in enumerate(train_files):
        out = os.path.join(processed_root, "train", label, f"{label}_{i}.wav")
        convert_to_wav(f, out)

    # Save val set
    for i, f in enumerate(val_files):
        out = os.path.join(processed_root, "val", label, f"{label}_{i}.wav")
        convert_to_wav(f, out)

print("✅ Dataset ready in 'dataset/train' and 'dataset/val'")
