# backend/services/eeg_processing.py
import mne
import numpy as np
from sklearn.preprocessing import StandardScaler

def load_raw(file_path: str):
    """Load EEG (.edf or .set) with MNE and return raw object."""
    if file_path.endswith(".set"):
        return mne.io.read_raw_eeglab(file_path, preload=True, verbose=False)
    elif file_path.endswith(".edf"):
        return mne.io.read_raw_edf(file_path, preload=True, verbose=False)
    else:
        raise ValueError("Unsupported file type. Use .edf or .set")

def preprocess_raw(raw, highpass=0.5, resample_to=None):
    raw.load_data()
    # Band-pass filter (e.g., 0.5-40 Hz) removes DC drift and high-freq noise
    raw.filter(l_freq=highpass, h_freq=40.0)
    
    # remove 50 Hz (or 60 Hz) power-line noise
    raw.notch_filter(freqs=[50, 100])  # adjust to your mains frequency

    # common average reference
    raw.set_eeg_reference('average', projection=False)

    # resample to smaller fs to reduce data size
    if resample_to:
        raw.resample(resample_to)

    return raw

def to_microvolts(data_volts: np.ndarray) -> np.ndarray:
    """Convert Volts → microvolts for plotting."""
    return data_volts * 1e6

def standardize(data: np.ndarray) -> np.ndarray:
    """Standard-score each channel separately (like during training)."""
    scaler = StandardScaler()
    return scaler.fit_transform(data.T).T   # keep shape (channels, samples)
