# file: services/ecg_processing.py
import os
import wfdb
import numpy as np
from scipy.signal import find_peaks, butter, filtfilt, iirnotch, resample
import matplotlib.pyplot as plt

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

# existing helper used by websocket endpoint (kept)
def load_ecg_record(record_number: str):
    """
    Attempts to load a record by base name from uploaded_data.
    """
    base = os.path.join(os.path.dirname(__file__), "../uploaded_data", record_number)
    base_noext, _ = os.path.splitext(base)
    rec = wfdb.rdrecord(base_noext)
    signals = rec.p_signal
    fs = rec.fs
    return signals, fs

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

def get_r_peaks_per_lead(signals, fs, leads=[0, 1, 2], min_rr_s=0.5):
    """
    Simple, reliable R-peak detection - similar to what was working before
    """
    peaks_dict = {}
    distance = int(min_rr_s * fs)

    for lead in leads:
        sig = bandpass_filter(signals[:, lead], fs)
        
        # Simple approach: detect peaks on the absolute signal
        # This handles both positive and negative R-waves naturally
        abs_sig = np.abs(sig)
        
        # Adaptive prominence based on signal characteristics
        prominence = max(0.3 * np.std(abs_sig), 0.1 * np.max(abs_sig))
        
        # Find peaks on absolute signal
        peaks, properties = find_peaks(
            abs_sig, 
            distance=distance, 
            prominence=prominence,
            height=0.2 * np.max(abs_sig)  # Minimum height threshold
        )
        
        # Refine peak positions to actual signal extrema
        refined_peaks = []
        search_window = int(0.04 * fs)  # 40ms search window
        
        for peak in peaks:
            start = max(0, peak - search_window)
            end = min(len(sig) - 1, peak + search_window)
            
            # Find actual maximum in the original signal (not absolute)
            segment = sig[start:end + 1]
            if len(segment) == 0:
                continue
                
            # Find whether positive or negative deflection is stronger
            max_idx = np.argmax(segment)
            min_idx = np.argmin(segment)
            max_val = segment[max_idx]
            min_val = segment[min_idx]
            
            # Choose the larger absolute deflection
            if abs(min_val) > abs(max_val):
                actual_peak = min_idx + start
            else:
                actual_peak = max_idx + start
                
            refined_peaks.append(int(actual_peak))
        
        # Remove duplicates and sort
        refined_peaks = sorted(set(refined_peaks))
        
        # Final refractory period enforcement
        final_peaks = []
        for peak in refined_peaks:
            if not final_peaks or (peak - final_peaks[-1]) >= distance:
                final_peaks.append(peak)
        
        peaks_dict[int(lead)] = final_peaks
    
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
            if end > start:
                cycle = signals[start:end, lead]
                lead_cycles.append(cycle.tolist())
        cycles[lead] = lead_cycles
    return cycles
