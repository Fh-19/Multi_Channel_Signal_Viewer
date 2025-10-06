import numpy as np
from scipy.signal import resample

BINARY_TARGET_LEN = 300 * 30 

# Preprocessing for the 6-class model
def preprocess_ecg_with_mapping_from_record(record,
                                            target_fs=400,
                                            target_length=4096,
                                            plot_signal=False):
    """
    Preprocess a WFDB record object (rdrecord result) and return an input tensor
    shaped (1, target_length, 12) ready for model.predict.
    Steps:
      - Map lead names to model expected names
      - Reorder leads to model order
      - Resample to target_fs
      - Crop or pad to target_length
      - Per-lead normalization (zero mean, unit variance)
      - Returns numpy array dtype=float32
    """
    signals = record.p_signal
    fs = record.fs
    orig_leads = record.sig_name

    # Mapping from incoming WFDB names to model expected names (as in your test script)
    mapping = {
        'i': 'DI',
        'ii': 'DII',
        'iii': 'DIII',
        'avr': 'AVR',
        'avl': 'AVL',
        'avf': 'AVF',
        'v1': 'V1',
        'v2': 'V2',
        'v3': 'V3',
        'v4': 'V4',
        'v5': 'V5',
        'v6': 'V6'
    }

    mapped_leads = [mapping.get(lead.lower(), None) for lead in orig_leads]

    model_leads = ['DI', 'DII', 'DIII', 'AVR', 'AVL', 'AVF',
                   'V1', 'V2', 'V3', 'V4', 'V5', 'V6']

    # Ensure all model leads present
    indices = []
    for lead in model_leads:
        if lead in mapped_leads:
            indices.append(mapped_leads.index(lead))
        else:
            raise ValueError(f"Lead {lead} is missing in the ECG record! Found leads: {orig_leads}")

    signals_selected = signals[:, indices]  # shape (n_samples, 12)

    # Resample if needed
    if fs != target_fs:
        num_samples = int(round(signals_selected.shape[0] * target_fs / fs))
        signals_selected = resample(signals_selected, num_samples, axis=0)
        fs = target_fs

    # Crop or pad to target_length
    curr_len = signals_selected.shape[0]
    if curr_len > target_length:
        signals_selected = signals_selected[:target_length, :]
    elif curr_len < target_length:
        padding = np.zeros((target_length - curr_len, signals_selected.shape[1]))
        signals_selected = np.vstack([signals_selected, padding])

    # Normalize leads to zero mean and unit variance (per-lead)
    signals_norm = (signals_selected - np.mean(signals_selected, axis=0)) / (np.std(signals_selected, axis=0) + 1e-8)


    # Add batch dimension
    input_tensor = np.expand_dims(signals_norm, axis=0).astype(np.float32)  # (1, target_length, 12)
    return input_tensor

# Preprocessing for the binary model
def preprocess_for_binary_model(rec, target_fs=300, target_len=300*30):
    """
    Preprocess ECG record for binary (normal vs abnormal) model.
    - Use Lead I (first channel)
    - Resample to 300 Hz
    - Pad/crop to 9000 samples (30 seconds)
    - Normalize (zero mean, unit variance)
    - Return shape (1, 9000, 1)
    """
    x = rec.p_signal[:, 0]
    fs = rec.fs

    # Resample to 300 Hz if needed
    if fs != target_fs:
        num_samples = int(round(len(x) * target_fs / fs))
        x = resample(x, num_samples)
        fs = target_fs

    # Pad or truncate to target length
    if len(x) > target_len:
        x = x[:target_len]
    elif len(x) < target_len:
        pad = np.zeros(target_len - len(x))
        x = np.concatenate([x, pad])

    # Normalize
    x = (x - np.mean(x)) / (np.std(x) + 1e-8)

    # Reshape for model
    return x.reshape(1, target_len, 1).astype(np.float32)

