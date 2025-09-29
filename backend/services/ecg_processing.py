import os
import wfdb
import numpy as np
from scipy.signal import find_peaks

# LUDB data path
LUDB_FOLDER = os.path.join(os.path.dirname(__file__), "data")

# -----------------------
# DSP / ECG Processing
# -----------------------
def load_ecg_record(record_number: str):
    """
    Load ECG record from LUDB folder by record_number (e.g., "98").
    """
    record_path = os.path.join(LUDB_FOLDER, f"{record_number}")
    if not os.path.exists(record_path + ".iii"):  # check one lead file exists
        raise FileNotFoundError(f"Record {record_number} not found in {LUDB_FOLDER}")
    record = wfdb.rdrecord(record_path)
    signals = record.p_signal  # shape (num_samples, 12)
    fs = record.fs
    return signals, fs


from scipy.signal import find_peaks

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
