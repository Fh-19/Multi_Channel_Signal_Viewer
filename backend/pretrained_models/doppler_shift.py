# backend/pretrained_models/doppler_shift.py
import numpy as np
import soundfile as sf
import sounddevice as sd
from scipy.signal import butter, filtfilt, iirpeak, fftconvolve

def realistic_car_passby(velocity=30.0, base_freq=300.0, duration=8.0, sr=44100):
    """
    Realistic car pass-by simulation with multiple audio components
    """
    c = 343.0  # speed of sound
    t = np.linspace(0, duration, int(sr*duration), endpoint=False)
    dt = 1/sr
    pass_time = duration/2.0  # midpoint = closest approach

    # Convert velocity from km/h to m/s for calculations
    velocity_ms = velocity / 3.6
    
    # ---------------------------
    # Doppler-shifted engine frequency
    # ---------------------------
    v_rel = np.where(t <= pass_time, velocity_ms, -velocity_ms)
    rpm_curve = base_freq * (1 + 0.2 * (t/duration))  # Gentle RPM ramp
    base_inst_freq = rpm_curve * (c / (c - v_rel))    # Doppler effect

    jitter = 1.0 + 0.003*np.random.randn(len(t))  # subtle vibration
    inst_freq = base_inst_freq * jitter
    inst_phase = np.cumsum(2*np.pi*inst_freq*dt)

    # Engine harmonics (simpler version for web app)
    orders = [1, 2, 3, 4]
    amps   = [1.0, 0.5, 0.3, 0.15]
    harmonics = sum(a*np.sin(k*inst_phase) for k, a in zip(orders, amps))

    # Low engine rumble
    rumble = 0.2*np.sin(2*np.pi*25*t + 0.3*np.sin(2*np.pi*1.5*t))

    # Road noise (low/mid broadband)
    road_noise = np.random.randn(len(t)) * 0.01 * (np.abs(v_rel)/velocity_ms)
    b, a = butter(4, 400/(sr/2), btype="low")
    road_noise = filtfilt(b, a, road_noise)

    # Combine components
    engine = harmonics + rumble + road_noise

    # Simple resonance shaping
    for f0 in [200, 800]:
        b, a = iirpeak(f0/(sr/2), Q=8)
        engine = filtfilt(b, a, engine)

    # ---------------------------
    # Distance attenuation
    # ---------------------------
    forward_dist = np.where(t <= pass_time,
                            velocity_ms*(pass_time - t),
                            velocity_ms*(t - pass_time))
    lateral_offset = 5.0  # meters - car passes 5m away
    dist = np.sqrt(forward_dist**2 + lateral_offset**2)

    att = 1.0 / (0.3 + dist/6.0)
    engine *= att

    # ---------------------------
    # Stereo panning
    # ---------------------------
    pan = np.tanh((t - pass_time) / (duration/8))
    left = engine * np.sqrt(0.5*(1 - pan))
    right = engine * np.sqrt(0.5*(1 + pan))

    stereo = np.vstack([left, right]).T

    # ---------------------------
    # Light reverb
    # ---------------------------
    ir = np.zeros(int(sr*0.15))
    ir[0] = 1
    ir[int(sr*0.03)] = 0.2
    ir[int(sr*0.08)] = 0.1
    
    for ch in range(2):
        reverb = fftconvolve(stereo[:,ch], ir)[:len(stereo)]
        stereo[:,ch] = 0.8*stereo[:,ch] + 0.2*reverb

    # Normalize and convert to mono for simpler handling
    stereo /= np.max(np.abs(stereo)) + 1e-6
    mono_signal = np.mean(stereo, axis=1) * 0.8  # Convert to mono
    
    return mono_signal, sr, base_freq

def DopplerShift(frequency, speed, play_sound=False, realistic=True):
    """
    Generate Doppler shift - now with realistic car simulation option
    speed: in km/h
    """
    if realistic:
        # Use realistic car pass-by simulation
        signal, sample_rate, base_freq = realistic_car_passby(
            velocity=speed,  # Already in km/h for the function
            base_freq=frequency, 
            duration=8.0, 
            sr=44100
        )
    else:
        # Fallback to simple Doppler for comparison
        v_sound = 343
        sample_rate = 44100
        duration = 6
        t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
        
        t_closest = duration / 2
        d_min = 5.0
        # Convert speed from km/h to m/s
        speed_ms = speed / 3.6
        x_pos = speed_ms * (t - t_closest)
        distance = np.sqrt(x_pos**2 + d_min**2)
        relative_speed = -speed_ms * x_pos / distance
        freqs = frequency * (v_sound / (v_sound - relative_speed))
        phase = 2 * np.pi * np.cumsum(freqs) / sample_rate
        signal = 0.5 * np.sin(phase)
        base_freq = frequency

    # Play sound immediately if requested
    if play_sound:
        try:
            sd.play(signal, sample_rate)
        except Exception as e:
            print(f"Could not play sound: {e}")
    
    return signal, sample_rate, base_freq