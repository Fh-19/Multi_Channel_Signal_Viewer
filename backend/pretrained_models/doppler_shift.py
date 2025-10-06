import numpy as np
import sounddevice as sd
from scipy.fft import rfft, rfftfreq
from scipy.signal import hilbert, windows
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
    sample_rate=44100
    v_wave=343.0
    rel_change_thresh=0.01
    slope_pval_thresh=1e-3
    seg_frac=0.1
    x = np.real(np.asarray(signal, dtype=float))
    x = x - np.mean(x)
    N = len(x)
    if N < 10:
        raise ValueError("signal is too short")
    analytic = hilbert(x)
    phase = np.unwrap(np.angle(analytic))
    inst_freq = np.diff(phase) * sample_rate / (2*np.pi) 
    inst_freq = np.clip(inst_freq, 0.0, np.percentile(inst_freq, 99.5))
    t_inst = np.arange(len(inst_freq)) / sample_rate
    seg = max(1, int(seg_frac * len(inst_freq)))
    f_start = np.mean(inst_freq[:seg])
    f_end   = np.mean(inst_freq[-seg:])
    freq_mean = np.mean(inst_freq)
    slope, intercept, r_value, p_value, std_err = linregress(t_inst, inst_freq)
    rel_change = (f_end - f_start) / f_start if f_start > 0 else 0.0
    slope_significant = (p_value < slope_pval_thresh)
    is_doppler = False
    trend = None
    if abs(rel_change) >= rel_change_thresh and slope_significant:
        is_doppler = True
        if rel_change > 0 or slope > 0:
            trend = 'approaching'   
        elif rel_change < 0 or slope < 0:
            trend = 'receding'     

    speed_est = 0.0
    if is_doppler and f_end != 0 and f_start > 0:
        speed_est = v_wave * (1.0 - (f_start / f_end))
    else:
        speed_est = 0.0

    t = np.linspace(0, 5, int(sample_rate * 5), endpoint=False)
    original_signal = np.sin(2 * np.pi * 600 * t)
    plt.figure(figsize=(12, 6))
    plt.subplot(2, 1, 1)
    plt.plot(t[:2000], original_signal[:2000], color='blue')
    plt.title("orIginal signal")
    plt.xlabel("time")
    plt.grid(True)
    plt.subplot(2, 1, 2)
    plt.plot(t[:2000], x[:2000], color='red')
    plt.title("Doppler signal")
    plt.xlabel("time")
    plt.grid(True)
    plt.tight_layout()
    plt.show()
    plt.figure(figsize=(12, 6))
    plt.plot(t[:2000], original_signal[:2000], label='Original Signal', color='blue')
    plt.plot(t[:2000], signal[:2000], label='Doppler Signal', color='red', alpha=0.7)
    plt.title("Original vs Doppler-Shifted Signal (Overlay)")
    plt.xlabel("Time [s]")
    plt.ylabel("Amplitude")
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.show()
    return is_doppler, trend, freq_mean,speed_est


if __name__ == "__main__":
    # Parameters
    f = 600       # Hz
    v = 20        # m/s

    print("---- Generating Doppler signal ----")
    doppler_signal = DopplerShift(f, v)

    print("---- Analyzing signal ----")
    is_doppler, trend, freq_mean, speed_est = check_and_analyze(doppler_signal)

    print(f"Is Doppler effect detected? {is_doppler}")
    print(f"Trend: {trend}")
    print(f"Mean frequency: {freq_mean:.2f} Hz")
    print(f"Estimated speed: {speed_est:.2f} m/s")



