# backend/pretrained_models/doppler_shift.py
import numpy as np
import sounddevice as sd
from scipy.signal import hilbert
from scipy.stats import linregress
import matplotlib.pyplot as plt

def DopplerShift(frequency, speed):
    v = 343  
    sample_rate = 44100
    t = np.linspace(0, 5, int(sample_rate * 5), endpoint=False)
    speeds = np.linspace(0, speed, len(t))
    freqs = frequency * (v / (v - speeds))
    phase = 2 * np.pi * np.cumsum(freqs) / sample_rate
    signal = np.sin(phase)
    sd.play(signal, sample_rate)
    sd.wait()
    return signal

def check_and_analyze(signal):
    sample_rate = 44100
    v_wave = 343.0
    rel_change_thresh = 0.01
    slope_pval_thresh = 1e-3
    seg_frac = 0.1
    
    # Ensure signal is proper format
    if isinstance(signal, list):
        signal = np.array(signal)
    
    x = np.real(np.asarray(signal, dtype=float))
    x = x - np.mean(x)
    N = len(x)
    
    if N < 10:
        raise ValueError("Signal is too short")
    
    # Analytic signal and instantaneous frequency
    analytic = hilbert(x)
    phase = np.unwrap(np.angle(analytic))
    inst_freq = np.diff(phase) * sample_rate / (2 * np.pi) 
    inst_freq = np.clip(inst_freq, 0.0, np.percentile(inst_freq, 99.5))
    t_inst = np.arange(len(inst_freq)) / sample_rate
    
    # Segment analysis
    seg = max(1, int(seg_frac * len(inst_freq)))
    f_start = np.mean(inst_freq[:seg])
    f_end = np.mean(inst_freq[-seg:])
    freq_mean = np.mean(inst_freq)
    
    # Linear regression for trend
    slope, intercept, r_value, p_value, std_err = linregress(t_inst, inst_freq)
    rel_change = (f_end - f_start) / f_start if f_start > 0 else 0.0
    slope_significant = (p_value < slope_pval_thresh)
    
    # Doppler detection
    is_doppler = False
    trend = None
    
    if abs(rel_change) >= rel_change_thresh and slope_significant:
        is_doppler = True
        if rel_change > 0 or slope > 0:
            trend = 'approaching'   
        elif rel_change < 0 or slope < 0:
            trend = 'receding'     

    # Speed estimation
    speed_est = 0.0
    if is_doppler and f_end != 0 and f_start > 0:
        speed_est = v_wave * (1.0 - (f_start / f_end))
    
    # Prepare data for frontend visualization
    # Sample the frequency series to avoid sending too much data
    sample_step = max(1, len(inst_freq) // 1000)  # Sample to ~1000 points
    freq_series_sampled = inst_freq[::sample_step].tolist()
    time_series_sampled = t_inst[::sample_step].tolist()
    
    return {
        "is_doppler": is_doppler,
        "trend": trend,
        "freq_mean": float(freq_mean),
        "speed_est": float(speed_est),
        "freq_series": freq_series_sampled,
        "time_series": time_series_sampled
    }

if __name__ == "__main__":
    # Parameters
    f = 600       # Hz
    v = 20        # m/s

    print("---- Generating Doppler signal ----")
    doppler_signal = DopplerShift(f, v)

    print("---- Analyzing signal ----")
    result = check_and_analyze(doppler_signal)

    print(f"Is Doppler effect detected? {result['is_doppler']}")
    print(f"Trend: {result['trend']}")
    print(f"Mean frequency: {result['freq_mean']:.2f} Hz")
    print(f"Estimated speed: {result['speed_est']:.2f} m/s")