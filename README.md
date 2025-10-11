# Multi-Channel Signal Viewer:
## Project Overview
This project provides an integrated platform for handling 1D medical and non-medical signals. It performs advanced digital signal processing, offers multi-modal visualization tools, and integrates AI-driven classification models for intelligent inference and analysis.
- Medical Signals: Electrocardiography (ECG) and Electroencephalography (EEG) signals, with tools for preprocessing, visualization, and deep learning-based classification.
- Non-medical Signals: Acoustic and radar-related signals including drone sound detection, Doppler signal generation and classification, and SAR (Synthetic Aperture Radar) signal visualization.

**To run our website:**
- Navigate to the project directory and run:
`concurrently "uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000" "cd frontend && npm run dev"`

# ECG Signal Analysis Module:
THE ECG Sigal Analysis Module provides advanced processing, visualization, and AI-powered interpretation of Electrocardiography (ECG) signals. This page integrates a two-stage classifier. The first classifier is a multiclass classifier identifying six cardiac abnormalities in ECG signals, the second is a finetuned binary classifier that is activated if the first classifier detected none of the six abnormalities in the ECG record. The binary classifier identifies if the ECG signal is a normal ECG or if there are other cardiac abnormalities.
- The pretrained six-class model: https://zenodo.org/records/3625027
- The finetuned binary class model: https://drive.google.com/drive/folders/1gHLrDYc_wD8a-gDqaJAP7gDXjteVa2yW?usp=sharing 
<img width="1886" height="869" alt="image" src="https://github.com/user-attachments/assets/c1fc8e6d-2f1b-477b-8128-5d5d583999b3" />

## Backend API Endpoints:
`POST /upload`
- Purpose: Uploads and validates ECG files.
- Input: Multipart form-data containing .dat and .hea files
- Output: "filename": "record_name"

`GET /ecg`
- Purpose: Loads an uploaded ECG record and returns: ECG signals, sampling rate, r-peak locations, extracted heart cycles, lead names.
- Input: filename, leads.
- Output: {
  `signals`: [[...], [...]],         // ECG samples
  `fs`: 400.0,                       // Sampling frequency
  `r_peaks`: { "0": [100, 350, ...] },
  `cycles`: { "0": [[...], [...]] }, // Extracted heartbeat segments
  `lead_names`: ["I", "II", "III"]}

`POST /classify`
- Purpose: Classifies an uploaded ECG record as: one of six cardiac abnormalities using a 6-class deep learning model, or normal / other abnormalities using a       binary fallback model
- Process:
    1. Load ECG record with wfdb.rdrecord.
    2. Preprocess for the 6-class model (resampling, padding/truncating).
    3. Predict probabilities across six classes: "1dAVb", "RBBB", "LBBB", "SB", "AF", "ST"
    4. If top-class confidence ≥ 0.3 → return that class.
    5. Otherwise, preprocess for binary model and classify as: "Normal ECG" or "Other Cardiac Abnormalities"
- Output: Prediction probabilities for all classes.

## Signal Processing Pipeline:
### Signal Viewer Preprocessing Steps:
- **Band-pass filtering**: 0.5-30 Hz to remove baseline wander, high-frequency muscle noise, powerline interference (50 Hz).
- **Notch filter**: 50 Hz to remove AC hum.
- **R-Peak detection**: Find R-peak indices (for dynamic cycle classification).
- **Heartbeat Segmentation**: Use R-Peak indices to segment the ECG signal into individual heartbeat cycles.  
### Abnormality Classification Preprocessing Steps:  
The pretrained models are trained on raw ECG signals.  
#### **6-Class Model** (expects 12 leads):  
  - Resample all signals to 400 Hz.
  - Crop/pad exactly 4096 samples (10.24s).
  - Normalize each lead separately (zero mean, unit variance).  
#### **Binary Class Model** (expects lead I only):  
  - Resample signals to 300 Hz.
  - Pad/truncate to 9000 samples (30s).
  - Normalize lead (zero mean, unit variance).
## Visualization Features:
- Multi-lead selection (max 3 leads).
- Overlapping plot of all selected leads for effective comparison.
- Continuous signal viewing mode and cycle-by-cycle signal viewing mode.
- Adjustable window sizes: 1-5s for the continuous signal viewer, 0.5-1.5 x R-R interval for the cycle-by-cycle signal viewer (to take into account the variability between cycle periods).
- Play/Pause with speed adjustment (0.5-1.5x).
- Zoom in/out.

<img width="1096" height="748" alt="image" src="https://github.com/user-attachments/assets/3937a04b-91b6-4759-bcb1-b3b573f8b185" />
<img width="1149" height="780" alt="image" src="https://github.com/user-attachments/assets/1b50bf77-5e3d-4eeb-9dab-2d9a22798fc6" />

## Predictions:
- The output of the 6-class model is displayed along with the probability of each class, the predicted disease is the one with the highest probability.
- If the highest probability is less than 30%, the predicted disease is the fallback binary model's output (Normal ECG or Other Cardiac Abnormalities).
<img width="1860" height="856" alt="image" src="https://github.com/user-attachments/assets/1733ce9b-be7b-420e-91b9-81b56bedec90" />
<img width="1861" height="859" alt="image" src="https://github.com/user-attachments/assets/94140aff-ac5f-490b-9b38-920cf1fcd86e" />
<img width="1848" height="856" alt="image" src="https://github.com/user-attachments/assets/c2cd721e-2613-4684-8945-b71b7652e2f0" />

## Advanced Visualizations:
- User can switch between visualization modes using the dropdown and configure parameters specific to each one while monitoring real-time updates as data streams.
- All advanced modes depend on the cycle-by-cycle viewer (they update cycle by cycle).
1. `XOR Graph`:
 - Purpose: Highlight irregularities and differences between consecutive cycles, making it easier to detect abnormal or inconsistent cardiac patterns.
 - Mechanism: Compares signal chunks using mean absolute difference.
 - Controls:
   - XOR tolerance (V) for similarity detection.
   - Window size (xR-R).
   - Lead Selection (Single lead).
   - Reset plot.
   <img width="1026" height="645" alt="image" src="https://github.com/user-attachments/assets/a1ff4c9e-4c17-429b-b2f4-3628f6339d63" />
  
2. `Recurrence Graph`:
  - Purpose: Analyze cross-lead relationships (Only two leads can be selected for this mode).
  - Mechanism: Compares two different leads using Cross Recurrence Plot (CRP) analysis.
  - Two display types:
     - Heatmap (matrix showing recurrence density).
     - Scatter Plot (Points where signals are similar with color illustration).
  - Controls:
     - Color Scale.
     - Clear Recurrence Matrix.
      <img width="877" height="638" alt="image" src="https://github.com/user-attachments/assets/3900dbbe-961e-4ab5-99d1-66b8eab1957d" /> 
      <img width="877" height="639" alt="image" src="https://github.com/user-attachments/assets/c4cc5f00-c54d-4393-830f-c54a384fd827" />

3. `Polar Graph`:
   - Purpose: Create circular patterns that reveal rhythm abnormalities.
   - Mechanism: Interpolate and normalize ECG cycles to 200 points, convert all cycles into polar coordinates for circular visualization (time (θ) to angle (0-    
   360°) and amplitude (r) to radial distance).
   - Two display types:
     - Cumulative (accumulated signals over time).
     - Latest Window (Current signal only).
   - Controls:
     - Clear polar plot.
     <img width="877" height="634" alt="image" src="https://github.com/user-attachments/assets/efcbe67e-1245-4c0c-99e6-99ef3b41df34" />
     <img width="877" height="636" alt="image" src="https://github.com/user-attachments/assets/d5b822a9-501f-4a2c-928f-54287c310e32" />

# EEG Signal Analysis Module:
The EEG Signal Analysis Module is a comprehensive neuroinformatics platform that provides advanced processing, visualization, and AI-powered interpretation of electroencephalography (EEG) signals. This page is responsible for classifying between five classes (Dementia, Alzheimer's, Schizophrenia, Epilepsy, and Healthy) using a pre-trained simplified EEGNet model.

<img width="1919" height="977" alt="Image" src="https://github.com/user-attachments/assets/9ce1d555-1aef-4b19-9be9-36c1d2789793" />

**Any details about the trained model can be found in the notebook `final_eeg_model.ipynb`**

## Backend API Endpoints:
`POST /upload`
- Purpose: uploads and validates EEG files
- Input: EDF/ .set files
- Output: File metadata including sampling frequency, channels, and duration.

`GET /segments`
- Purpose: Retrieve processed EEG segments
- Parameters:

`filename`: Target file

`channels`: Selected channel(s)

`segment_duration`: Window size in seconds

`highpass`: Filter cutoff frequency

`resample_to`: Target sampling rate

- Output: Standardized signal segments in microvolts.

`POST /predict`
- Purpose: Disease classification using the pretrained model

- Processing Pipeline:

     1. Signal preprocessing (bandpass filtering, notch filtering)

     2. Channel selection (first 19 channels)

     3. Standardization (z-score normalization)

     4. Sliding window segmentation (256 samples, 128 steps)

     5. Batch inference with ensemble averaging

- Output: Prediction probabilities for all classes.

## Signal Processing Pipeline
- Preprocessing steps
1. **Band-pass Filtering:** 0.5-40 Hz to remove DC drift and high-frequency noise
2. **Notch Filtering:** 50/100 Hz for power-line noise removal
3. **Common Average Reference:** Spatial filtering
4. **Resampling:** Optional downsampling to reduce computational load
5. **Standardization:** Per-channel z-score normalization

## Visualization Features
- Multi-channel Traces: Real-time scrolling display of selected channels
- Adjustable Window: Configurable time window (1-60 seconds)
- Playback Controls: Play/pause with speed adjustment (0.25x-4x)
- Channel Selection: Interactive toggle for up to 5 channels
- Zoom in/out
<img width="1254" height="831" alt="Image" src="https://github.com/user-attachments/assets/4c38d7be-77a4-4207-b728-6f3b82be61d0" />
<img width="1281" height="782" alt="Image" src="https://github.com/user-attachments/assets/fac48173-7603-4033-adc4-f3a01256b2b7" />

## Predictions and Bandpower Section:
- FFT-based power spectral density calculation of the 5 frequency bands and display of the relative power percentages of the selected channel per window.
- Real-time Classification of the uploaded file via a probability visualization, a horizontal bar chart with color coding, and confidence scoring.
   <img width="648" height="886" alt="Image" src="https://github.com/user-attachments/assets/b32b2788-b325-4573-8b36-78387b72c0c7" />
  
## Advanced Visualizations:
- User can switch between visualization modes using the dropdown and configure parameters specific to each one while monitoring real-time updates as data streams 
1. `XOR Overlay`
- Purpose: Pattern similarity detection across time segments
- Mechanism: Compares signal chunks using mean absolute difference
- Controls:
     - Tolerance threshold (µV) for similarity detection
     - Channel selection for analysis
     - Manual reset capability
- Use Case: Identifying recurrent pathological patterns
  <img width="963" height="612" alt="Image" src="https://github.com/user-attachments/assets/9314b27b-b129-4df4-a5e5-8f4057836261" />

2. `Polar Plot`
- Modes:
     - **Latest window**: Current signal segment.

  <img width="1269" height="621" alt="Image" src="https://github.com/user-attachments/assets/f9d71d27-52a9-4a4c-bd06-ca5c6ac0d98d" />
  
     - **Cumulative**: Accumulated signal over time
  
  <img width="1288" height="618" alt="Image" src="https://github.com/user-attachments/assets/a0395667-5bf9-42a3-b9f7-0a1e0af54e2d" />
  
- Visualization: Radial display of signal amplitude vs. phase
- Applications: Cyclic pattern analysis and signal morphology
 
3. `Recurrence Plot`
- Types:
     - **Scatter Plot**: Point-cloud representation of channel relationships
       
  <img width="1300" height="671" alt="Image" src="https://github.com/user-attachments/assets/e7a1be92-9427-4390-9033-b04906de6a03" />
  
     - **Heatmap**: Density visualization of signal correlations
  
  <img width="1285" height="661" alt="Image" src="https://github.com/user-attachments/assets/39b6191e-5f5f-40db-bde7-ea20ff17d47f" />
  
- Configuration: Select any two channels for cross-channel analysis
- Insights: Non-linear dynamics and inter-channel dependencies

  # Doppler Shift Analysis Module
The Doppler Shift Simulator is a sophisticated web application that demonstrates and analyzes the Doppler effect, a phenomenon where the frequency of a wave changes for an observer moving relative to the wave source. This module provides both simulation and analysis capabilities for Doppler shift phenomena, with a focus on realistic vehicle pass-by scenarios.

**Any details about the trained model can be found in the notebook `doppler_model.ipynb`**

## Physics Principle:
     `f_observed = f_source × (v_sound / (v_sound ± v_relative))`
where: 
`f_observed` = Frequency heard by observer
`f_source` = Original Frequency emitted
`v_sound` = Speed of sound
`v_relative` = Relative velocity between source and observer

<img width="1915" height="876" alt="Image" src="https://github.com/user-attachments/assets/6a5dd458-948a-406f-a5df-d1c513778aaf" />

## Realistic simulation Components:
- **Engine Harmonics**: Multiple frequency components with proper ratios
- **Distance Attenuation**: Inverse-square law intensity variation
- **Spatial Audio**: Stereo panning based on vehicle position
- **Environmental Effects**: Road noise, reverberation, vibration
- **RPM Variation**: Realistic engine acceleration/deceleration profiles

## Audio Processing
- Sample Rate: 44.1 kHz
- Format: Mono WAV files
- Duration: 8 seconds (realistic simulation)
- Dynamic Range: Normalized to prevent clipping
  
## Module Features:
1. Dual Simulation Modes:
     - **Realistic Car Simulation**:
               - Multi-layered audio synthesis
               - Environmental acoustics
               - Spatial positioning effects
               - Limited to 2kHz (human hearing range)
     - **Basic Doppler Tone**:
               - Pure frequency demonstration
               - Extended frequency range (up to 20kHz)
               - Higher speed simulations
2. Waveform Display representing the amplitude of the audio signal over time
     - X-axis: Time domain (sample index)
     - Y-axis: Amplitude (normalized between -1.0 and +1.0)
     - Visual Pattern: Shows the characteristic "Doppler sweep" where frequency changes as the sound source moves.
4. Prediction Dashboard
   <img width="1919" height="881" alt="Image" src="https://github.com/user-attachments/assets/fcb0719e-414b-465f-a38a-5948ec19a8af" />
- Approaching Phase: Waveform shows higher frequency (closer spacing between peaks)
- Passing Point: Maximum frequency at closest approach
- Receding Phase: Lower frequency (wider spacing between peaks)
- Amplitude Envelope: Louder when closer, quieter when farther due to distance attenuation




    
