import os
import wfdb
import numpy as np
from scipy.signal import find_peaks, butter, filtfilt, iirnotch

# -----------------------
# DSP / ECG Processing
# -----------------------

def bandpass_filter(signal, fs, lowcut=0.5, highcut=30.0, order=2):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype="band")
    return filtfilt(b, a, signal)

def notch_filter(signal, fs, freq=50.0, quality=30):
    nyq = 0.5 * fs
    w0 = freq / nyq
    b, a = iirnotch(w0, quality)
    return filtfilt(b, a, signal)

def load_ecg_record_from_path(file_path: str):
    # WFDB reads by base name (no extension)
    base, _ = os.path.splitext(file_path)
    record = wfdb.rdrecord(base)

    signals = record.p_signal
    fs = record.fs
    leads = record.sig_name  # list of lead names, e.g. ["I", "II", "III", ..., "V6"]

    filtered_signals = np.zeros_like(signals)
    for i in range(signals.shape[1]):
        sig = signals[:, i]
        sig = bandpass_filter(sig, fs)
        sig = notch_filter(sig, fs, freq=50.0)
        filtered_signals[:, i] = sig

    return filtered_signals, fs, leads

def get_r_peaks_per_lead(signals, fs, leads=[0, 1, 2]):
    """
    Detect R-peaks for each selected lead.
    If the negative deflection is taller (larger amplitude),
    treat those as the R-peaks instead of positive ones.
    Returns {lead_index: [peak_positions]}.
    """
    peaks_dict = {}
    distance = int(0.6 * fs)  # ~600 ms between beats

    for lead in leads:
        signal = signals[:, lead]

        # Positive peaks
        pos_peaks, pos_props = find_peaks(
            signal,
            distance=distance,
            height=np.mean(signal) + 0.5 * np.std(signal)
        )

        # Negative peaks (detect on inverted signal)
        neg_peaks, neg_props = find_peaks(
            -signal,
            distance=distance,
            height=np.mean(-signal) + 0.5 * np.std(-signal)
        )

        # Check amplitude dominance
        pos_height = np.max(pos_props["peak_heights"]) if len(pos_peaks) else 0
        neg_height = np.max(neg_props["peak_heights"]) if len(neg_peaks) else 0

        if neg_height > pos_height:
            # Negative R-waves dominate
            peaks_dict[lead] = neg_peaks.tolist()
        else:
            # Positive R-waves dominate
            peaks_dict[lead] = pos_peaks.tolist()

    return peaks_dict

def extract_cycles(signals, r_peaks_dict, selected_leads=[0, 1, 2]):
    """
    Extract heartbeat cycles between R-peaks.
    """
    cycles = {}
    for lead, r_peaks in r_peaks_dict.items():
        lead_cycles = []
        for i in range(len(r_peaks) - 1):
            start = r_peaks[i]
            end = r_peaks[i + 1]
            cycle = signals[start:end, lead]
            lead_cycles.append(cycle.tolist())
        cycles[lead] = lead_cycles
    return cycles
