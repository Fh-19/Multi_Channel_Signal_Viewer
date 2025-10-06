import numpy as np
from scipy import signal

def estimate_frequency_from_signal(sig, fs, fmin=1.0, fmax=None, zero_pad=8):
    """
    يقدر التردد الأساسي للإشارة mono (sinusoid) باستخدام FFT مع تحسين ذروة (parabolic interpolation).
    - sig: 1D numpy array (الإشارة الزمنية)
    - fs: sampling rate (Hz)
    - fmin: أقل تردد نهتم به (Hz)
    - fmax: أعلى تردد نهتم به (Hz) (لو None => يستخدم Nyquist)
    - zero_pad: عامل زيادة طول الـ FFT لرفع الدقة (قوة 2 multiplier)
    Returns: estimated frequency (Hz)
    """
    # إزالة DC و window
    sig = sig - np.mean(sig)
    N = len(sig)
    # نافذة (Hann) لتخفيف التسرب الطيفي
    w = np.hanning(N)
    sigw = sig * w

    # FFT length (zero padding to get finer freq resolution)
    nfft = int(2**(int(np.ceil(np.log2(N))) + zero_pad))
    # compute real FFT (positive freqs)
    S = np.fft.rfft(sigw, n=nfft)
    freqs = np.fft.rfftfreq(nfft, 1.0/fs)
    mag = np.abs(S)

    # freq bounds
    if fmax is None:
        fmax = fs / 2.0

    # limit search to [fmin, fmax]
    idx_min = np.searchsorted(freqs, fmin)
    idx_max = np.searchsorted(freqs, fmax)
    if idx_max <= idx_min:
        raise ValueError("fmax must be > fmin and within Nyquist")

    search_mag = mag[idx_min:idx_max]
    if search_mag.size == 0:
        raise ValueError("No spectrum in requested band")

    # peak index relative and absolute
    rel_peak = np.argmax(search_mag)
    peak_idx = rel_peak + idx_min

    # parabolic interpolation around peak for better accuracy
    # ensure we are not on boundary
    if peak_idx <= 0 or peak_idx >= len(mag) - 1:
        peak_freq = freqs[peak_idx]
    else:
        # magnitudes at bins k-1, k, k+1
        alpha = mag[peak_idx - 1]
        beta  = mag[peak_idx]
        gamma = mag[peak_idx + 1]
        # vertex offset formula (parabolic) dx = 0.5*(alpha-gamma)/(alpha - 2*beta + gamma)
        denom = (alpha - 2*beta + gamma)
        if denom == 0:
            dx = 0
        else:
            dx = 0.5 * (alpha - gamma) / denom
        peak_bin = peak_idx + dx
        peak_freq = peak_bin * fs / nfft

    return peak_freq

def solve_doppler_from_signal(signal, fs, c=343.0, f_known=None, v_known=None, fmin=1.0, fmax=None):
    """
    دالة شاملة:
    - تقدّر f_obs من السيجنال
    - بناءً على ما هو معروف (f_known أو v_known) تحسب القيمة المساقة
    Returns: dict { 'f_obs':..., 'f':..., 'v':... }
    قواعد:
    - إذا f_known معطاة: تحسب v
    - إذا v_known معطاة: تحسب f
    - إذا لا شيء معطى: تُرجع فقط f_obs
    """
    # 1) estimate observed frequency from signal
    f_obs = estimate_frequency_from_signal(signal, fs, fmin=fmin, fmax=fmax)

    result = {'f_obs': f_obs, 'f': None, 'v': None}

    # 2) if f_known => compute v
    if f_known is not None and v_known is None:
        # v = c * (1 - f / f_obs)
        v = c * (1.0 - (f_known / f_obs))
        result['f'] = f_known
        result['v'] = v
        return result

    # 3) if v_known => compute f
    if v_known is not None and f_known is None:
        f = f_obs * (c - v_known) / c
        result['f'] = f
        result['v'] = v_known
        return result

    # 4) if both given -> validate consistency (compute v from f and f_obs and compare to v_known)
    if f_known is not None and v_known is not None:
        v_calc = c * (1.0 - (f_known / f_obs))
        result['f'] = f_known
        result['v'] = v_known
        result['v_from_fobs'] = v_calc
        return result

    # 5) if neither known -> only f_obs
    return result
def demo():
    fs = 44100       # معدل أخذ العينات
    duration = 1.0   # ثانية
    f_true = 1000.0  # التردد الأصلي للمصدر Hz
    v_true = 20.0    # السرعة m/s
    c = 343.0        # سرعة الصوت m/s

    # ===== توليد إشارة فيها دوبلر =====
    # معادلة دوبلر: f_obs = f * c / (c - v)
    f_obs = f_true * (c / (c - v_true))
    t = np.arange(int(duration * fs)) / fs
    sig = np.sin(2*np.pi * f_obs * t).astype(np.float32)

    # ===== استخدام الدالة اللي عندك =====
    res1 = solve_doppler_from_signal(sig, fs, f_known=f_true)  # نحسب السرعة إذا نعرف f
    res2 = solve_doppler_from_signal(sig, fs, v_known=v_true)  # نحسب f إذا نعرف v
    res3 = solve_doppler_from_signal(sig, fs)                  # بس نجيب f_obs

    # ===== طباعة النتائج =====
    print("---- من الإشارة ----")
    print("f_obs (من السيجنال):", res3['f_obs'])
    print("---- إذا كنا عارفين f ----")
    print("f:", res1['f'], "Hz")
    print("v المحسوبة:", res1['v'], "m/s")
    print("---- إذا كنا عارفين v ----")
    print("v:", res2['v'], "m/s")
    print("f المحسوبة:", res2['f'], "Hz")
demo()
