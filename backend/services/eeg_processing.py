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
    
    # Get current sampling rate for adaptive filtering
    current_fs = raw.info['sfreq']
    nyquist = current_fs / 2
    
    # Adaptive band-pass filter based on available bandwidth
    h_freq = min(80.0, nyquist * 0.95)  # Don't exceed Nyquist
    raw.filter(l_freq=highpass, h_freq=h_freq)
    
    # Remove power-line noise only if frequencies are valid
    notch_freqs = []
    for freq in [50, 100]:
        if freq < nyquist * 0.95:  # Only add if below 95% of Nyquist
            notch_freqs.append(freq)
    
    if notch_freqs:
        raw.notch_filter(freqs=notch_freqs)

    # Common average reference
    raw.set_eeg_reference('average', projection=False)

    # Resample to smaller fs to reduce data size (with anti-aliasing)
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

def resample_with_aliasing(raw, target_fs: float):
    """
    Resample raw EEG data to target frequency WITHOUT anti-aliasing filter.
    This creates true aliasing effects for experiments.
    Returns a copy of the raw object with new sampling rate.
    """
    raw_copy = raw.copy()
    current_fs = raw_copy.info['sfreq']
    
    if target_fs == current_fs:
        return raw_copy
    
    # Calculate decimation factor - handle non-integer ratios
    decimation_factor = current_fs / target_fs
    
    if decimation_factor < 1:
        raise ValueError(f"Cannot upsample from {current_fs}Hz to {target_fs}Hz with aliasing")
    
    # Get the original data
    data = raw_copy.get_data()  # (n_channels, n_times)
    
    # Calculate new number of samples
    n_original = data.shape[1]
    n_new = int(n_original / decimation_factor)
    
    # Create time indices for the new sampling rate
    original_indices = np.linspace(0, n_original - 1, n_new, dtype=int)
    
    # Simple decimation without filtering - THIS CREATES ALIASING
    decimated_data = data[:, original_indices]
    
    # Create new Raw object with decimated data
    from mne.io import RawArray
    from mne import create_info
    
    # Create new info with target sampling rate
    new_info = create_info(
        ch_names=raw_copy.ch_names,
        sfreq=target_fs,
        ch_types=['eeg'] * len(raw_copy.ch_names)
    )
    
    # Create new Raw object
    new_raw = RawArray(decimated_data, new_info)
    
    # Copy relevant metadata
    new_raw.info['bads'] = raw_copy.info['bads'][:]
    if raw_copy.info.get('description'):
        new_raw.info['description'] = raw_copy.info['description']
    
    return new_raw