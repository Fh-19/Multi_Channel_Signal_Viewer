import os
import numpy as np
import soundfile as sf
from backend.pretrained_models.doppler_shift import check_and_analyze

DATASET_DIR = "backend/datasets/vehicle_sounds"

def analyze_vehicle_dataset():
    """
    Loop over all .wav files in the dataset and estimate the frequency + speed
    using check_and_analyze().
    """
    results = []
    for file_name in os.listdir(DATASET_DIR):
        if not file_name.lower().endswith(".wav"):
            continue
        file_path = os.path.join(DATASET_DIR, file_name)
        try:
            data, samplerate = sf.read(file_path)
            is_doppler, trend, freq_mean, speed_est = check_and_analyze(data)
            results.append({
                "file": file_name,
                "is_doppler": bool(is_doppler),
                "trend": trend,
                "freq_mean": float(freq_mean),
                "speed_est": float(speed_est),
            })
        except Exception as e:
            results.append({"file": file_name, "error": str(e)})
    return results
