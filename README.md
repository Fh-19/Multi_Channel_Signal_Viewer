
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
## Backend API Endpoints:
`POST /upload`
- Purpose: Uploads and validates ECG files.
- Input: Multipart form-data containing .dat and .hea files
- Output: "filename": "record_name"

`GET /ecg`
- Purpose: Loads an uploaded ECG record and returns: ECG signals, sampling rate, r-peak locations, extracted heart cycles, lead names.
- Input: filename, leads.
- Output: {
  "signals": [[...], [...]],         // ECG samples
  "fs": 400.0,                       // Sampling frequency
  "r_peaks": { "0": [100, 350, ...] },
  "cycles": { "0": [[...], [...]] }, // Extracted heartbeat segments
  "lead_names": ["I", "II", "III"]}

`POST /classify`
- Purpose: Classifies an uploaded ECG record as: one of six cardiac abnormalities using a 6-class deep learning model, or normal / other abnormalities using a       binary fallback model
- Process:
    1. Load ECG record with wfdb.rdrecord.
    2. Preprocess for the 6-class model (resampling, padding/truncating).
    3. Predict probabilities across six classes: "1dAVb", "RBBB", "LBBB", "SB", "AF", "ST"
    4. If top-class confidence ≥ 0.3 → return that class.
    5. Otherwise, preprocess for binary model and classify as: "Normal ECG" or "Other Cardiac Abnormalities"

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

<img width="1908" height="881" alt="Image" src="https://github.com/user-attachments/assets/e80dc493-7d94-44c1-bd3b-08a322885eaf" />

**Any details about the trained model can be found in the notebook `final_eeg_model.ipynb`**

## Backend API Endpoints:
`POST /upload`
- Purpose: uploads and validates EEG files
- Input: EDF/ .set files
- Output: File metadata including sampling frequency, channels, and duration.

`GET /segments`
- Purpose: Retrieve processed EEG segments
- Expected paraeters:

`filename`: Target file

`channels`: Selected channel(s)

`segment_duration`: Window size in seconds

`highpass`: Filter cutoff frequency

`resample_to`: Target sampling rate

`use_aliasing`: boolean indicating whether to use aliasing or not.

- Output: Standardized signal segments in microvolts.
- If the user requested aliasing, `resample_with_aliasing` is called from the processing file, and after minimal processing is applied

`POST /predict`
- Purpose: Disease classification using the pretrained model

- Processing Pipeline:

     1. Signal preprocessing (bandpass filtering, notch filtering)

     2. Channel selection (first 19 channels)
    
     3. Same pattern as `/segments`: either aliasing-decimate then minimal filtering (intentionally preserving aliasing artifacts), or perform full `preprocess_raw`.

     4. Standardization (z-score normalization)

     5. Sliding window segmentation (256 samples, 128 steps)

     6. Batch inference with ensemble averaging

- Output: Prediction probabilities for all classes.

## Signal Processing Pipeline
- Preprocessing steps
1. **Band-pass Filtering:** applies a band-pass between `highpass` and `h_freq` (which is decided according to the sampling frequency) to remove DC drift and high-frequency noise
2. **Notch Filtering:** 50/100 Hz for power-line noise removal
3. **Common Average Reference:** sets an average reference across the channels.
4. **Resampling:** Optional resampling 
5. **Standardization:** Per-channel z-score normalization

## `resample_with_aliasing(raw, target_fs: float)`:
- Works on a copy to avoid mutating the input. If target_fs equals current_fs, return unchanged.
- calculates a `decimation_factor` to determmine how many samples correspond to one new sample, designed to downsample by decimating without filtering
- Upsampling is handled by the predefined function `resample_to` in MNE, which can automatically interpolate missing values.
  
## Visualization Features
- Multi-channel Traces: Real-time scrolling display of selected channels
- Adjustable Window: Configurable time window (1-60 seconds)
- Playback Controls: Play/pause with speed adjustment (0.25x-4x)
- Channel Selection: Interactive toggle for up to 5 channels
- Zoom in/out.
- Recording information: displayed below the prediction and bandpower graphs.
  
<img width="1275" height="817" alt="image" src="https://github.com/user-attachments/assets/ca55c424-e831-4632-b587-3004c0a18ef7" />
<img width="559" height="232" alt="image" src="https://github.com/user-attachments/assets/4e720a3b-80b3-48c2-bc73-56daf7c44668" />

## Predictions and Bandpower Section:
- FFT-based power spectral density calculation of the 5 frequency bands and display of the relative power percentages of the selected channel per window.
- Real-time Classification of the uploaded file via a probability visualization, a horizontal bar chart with color coding, and confidence scoring.
- Recording information showing the `Sampling Rate`, `Selected Channels`, `Window Size` and `Status`.  
   <img width="550" height="575" alt="Image" src="https://github.com/user-attachments/assets/be55901b-cb14-4be1-b297-a231aa7b45fb" />
   <img width="565" height="661" alt="image" src="https://github.com/user-attachments/assets/1ca56988-4ad1-4aef-998a-ae0398085d8f" />

## Advanced Visualizations:
- User can switch between visualization modes using the dropdown and configure parameters specific to each one while monitoring real-time updates as data streams 
1. `XOR Overlay`
- Purpose: Detect unique abnormalities across time segments.
- Mechanism:
    - Point-wise comparison using a set similarity threshold.
    - Number of chunks are calculated based on the duration of the file itself. 
- Controls:
     - Tolerance threshold (µV) for similarity detection.
     - Channel selection for analysis.
     - Manual reset capability.
- Use Case: Identifying recurrent pathological patterns.
  
  <img width="846" height="830" alt="image" src="https://github.com/user-attachments/assets/4b6fc571-dedf-43dd-9cb0-f56ea18b5ba3" />

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

## Sampling frequency control:

<img width="618" height="201" alt="image" src="https://github.com/user-attachments/assets/dc32d2e1-a7e7-433e-93b7-f9cd5d7cff54" />

- available preset buttons and a slider for precise control to demonstarate and experiment with different sampling frequencies
- when using a lower than normal sample rate (lower than Nyquist frequency) the predictions and displayed signal change, the graphs has less points to plot causing the predictions to be wrong/has lower confidence than it used to and the bandpowers to not be accurate.

<img width="1909" height="886" alt="image" src="https://github.com/user-attachments/assets/e619b1b3-bf05-4851-892a-937c96a52ba2" />

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

<img width="1915" height="889" alt="image" src="https://github.com/user-attachments/assets/b29d71c2-baec-4569-98d5-856ddea2d1ee" />

## Realistic simulation Components:
- **Engine Harmonics**: Multiple frequency components with proper ratios
- **Distance Attenuation**: Inverse-square law intensity variation
- **Spatial Audio**: Stereo panning based on vehicle position
- **Environmental Effects**: Road noise and vibration.
- **RPM Variation**: Realistic engine acceleration/deceleration profiles

## Audio Processing
- Sample Rate: default is 22.05 kHz unless specified.
- Format: Mono WAV files.
- Duration: 8 seconds (realistic simulation).
- Dynamic Range: Normalized to prevent clipping.

## Sampling frequency control
- A slider is provided to choose a sampling frequency in the range of 1.6 KHz to 44.1 KHz along with preset value buttons.
- Choosing a frequency lower than the nyquist frequency or uploading a file with a much higher sampling frequency than the sampling frequency set for the prediction pipeline will cause inaccurate predictions.
- an example file whose original sampling rate is 22.05 KHz and was generated with a frequency of 300 Hz and a speed of 100 Km/hr, is set to be predicted using a sampling frequency of 1.6 KHz :

<img width="989" height="826" alt="image" src="https://github.com/user-attachments/assets/2be4f96b-ab09-48ad-a79c-d546dc6fd13e" />

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
     - horizontal and vertical zooming.
  <img width="996" height="612" alt="image" src="https://github.com/user-attachments/assets/0d78c563-7bbb-42aa-84ce-9efdc35d7ec8" />

4. Prediction Dashboard
   <img width="994" height="835" alt="image" src="https://github.com/user-attachments/assets/41c6e7d3-ae64-4fba-b0ee-5d8cee47c905" />
- Approaching Phase: Waveform shows higher frequency (closer spacing between peaks)
- Passing Point: Maximum frequency at closest approach
- Receding Phase: Lower frequency (wider spacing between peaks)
- Amplitude Envelope: Louder when closer, quieter when farther due to distance attenuation
- A preview of `Current Sampling Rate`, `Uploaded File Sample Rate` and `Prediction Sample Rate`

#  Drone vs Noise Audio Classification System

This project is an  detecting whether an input audio file represents a **Drone** or **Noise**.  
It combines **MFCC-based audio feature extraction**, a **PyTorch neural network**, a **FastAPI backend**, and a **React frontend** for real-time interaction.

---

##  Overview

###  Objective
To build a deep learning pipeline that can classify audio files into two categories:
- **Drone**
- **Noise**

## core technologies

-feature Extraction
-Model training
-API backend
-User interface


##  Project Workflow

### 1️ Feature Extraction (`mfcc.py`)

This stage converts raw `.wav` audio files into numerical MFCC (Mel-Frequency Cepstral Coefficient) features.

#### Process:
1. Load `.wav` files from `data_fixed/train/`.
2. Compute **40 MFCC coefficients** per file using `librosa`.
3. Take the mean of all MFCC frames to produce a fixed 40-dimensional vector.
4. Save the features and labels into `.npy` files.

### 2 model training ('model.py')
This script defines and trains a fully connected neural network that classifies MFCC features as either Drone or Noise.

### 3 backend API ('backend/router/api.py)
The backend provides endpoints to upload an audio file, extract features, and make predictions using the trained model.

 Components:

-Model Loader — loads model.pth weights.

-Feature Extractor — same MFCC logic used in training.

-Prediction Endpoint — takes an uploaded .wav file, runs inference, and returns label + confidence.

### frontend ('ApiPage.jsx)
The React-based frontend allows users to upload an audio file and view the prediction in real time.

Features:

-Upload .wav files
-Send audio to backend using fetch()
-Display predicted label and confidence
-Audio playback (Play / Pause)

Example User Flow:

-Select .wav file → Click Upload & Predict
-FastAPI backend analyzes and responds with a label + confidence
-The result appears on screen and user can play the sound

 Example UI Sections:

-Left Panel: Audio upload & playback
-Right Panel: Prediction result display


# SAR Land Classification System

This project performs land classification using **Sentinel-1 SAR images**.It classifies regions into Urban, Vegetation, or Water using VV and VH polarization bands.
The system combines SAR image preprocessing, K-Means clustering, a FastAPI backend, and a React frontend for interactive visualization.




 ## Overview
 ### Objective

To classify SAR images into three main land-cover categories:

-Urban / Man-made areas
-Vegetation / Natural areas
-Water bodies / Low backscatter regions

### Core Technologies

-SAR Image Preprocessing
-Feature Extraction (VV/VH, backscatter, ratio)
-K-Means Clustering
-FastAPI Backend
-React Frontend   

## Project Workflow
### 1 Feature Preparation (scripts/sar_viewer.py)

This stage allows local testing and visualization of SAR images.

Process:

-Load VV and VH .tiff polarization bands.
-Downsample images to reduce computation (e.g., 20% of original size).
-Convert intensity values to dB scale.
-Compute:
   VV-VH ratio (highlights urban areas)
   Mean backscatter (average of VV and VH)
-Combine features into a 2D array for clustering.
-Optional: visualize the classification result locally with RGB colors.

### 2 Land Classification (backend/routers/sar_classifier.py)

The backend provides an API endpoint to classify SAR images.

Components:

-File Upload Handler — receives VV and VH files from the frontend.
-Image Preprocessing — same as the local script (downsample, dB conversion, feature extraction).
-K-Means Clustering — classifies pixels into 3 clusters.
-Cluster Identification — maps clusters to Urban, Vegetation, and Water based on mean backscatter and ratio.
-RGB Composite Generator — builds a colored output image:
 Red = Urban
 Green = Vegetation
 Blue = Water
-Result Endpoint — returns the processed classification image for frontend display.

### 3 Frontend (SARPage.jsx)

The React frontend allows users to upload SAR polarization files and view the classification results.

Features:

-Upload .tiff files for VV and VH bands.
-Send files to backend via Axios POST request.
-Display classification result image.
-Provide color legend for Urban, Vegetation, Water.

Example User Flow:

-User uploads VV and VH files.
-Click Classify button.
-FastAPI backend processes files and generates classification image.
-Result appears on the frontend with color-coded land types.

UI Layout:
<img width="1901" height="1011" alt="Screenshot 2025-10-11 234903" src="https://github.com/user-attachments/assets/18e3cefb-cb6a-4894-a91f-cdc210609381" />


-Left Panel: File upload & classification result display.
-Right Panel: Instructions, color legend, and additional info.

# Sentinel-1 Map Visualization System

This project automates the download, processing, and visualization of **Sentinel-1 satellite imagery**.
It allows users to explore VV/VH polarization bands on an interactive map, with image enhancement for better visualization.
The system combines Sentinelsat API, raster image processing, a FastAPI backend, and a React frontend.

## Overview
### Objective

To provide an automated workflow that:

-Downloads Sentinel-1 SAR products for a given area and date range.
-Processes VV and VH bands into an enhanced RGB composite.
-Displays the result as an interactive map in a web interface.

Core Technologies

-Sentinelsat API — download Sentinel-1 GRD products using area GeoJSON.
-SAR Image Processing — resampling, dB conversion, normalization, and RGB enhancement using OpenCV and Rasterio.
-Interactive Mapping — Folium for web map visualization.
-FastAPI Backend — serves the processed map HTML file.
-React Frontend — displays the interactive map in an iframe.

## Project Workflow
### 1 Product Download (cdse_download.py)

This script queries the Copernicus Open Access Hub and downloads Sentinel-1 products for a specific area and date range.

Process:

-Load area of interest from a GeoJSON file (area.geojson).
-Connect to the Sentinel API using a username and password.
-Query products with retry logic to handle network failures.
-Download the selected product to a local directory (data/).

### 2 Image Processing (view_sentinel.py)

This stage converts SAR polarization bands into an enhanced RGB composite for visualization.

Process:

-Load VV and VH .tiff bands using Rasterio.
-Downsample the images to reduce computational load.
-Convert intensity values to dB scale.
-Normalize values to 0–1 range using percentiles.
-Construct an RGB composite:
  Red = VV
  Green = VH
  Blue = √(VV × VH)
-Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) to enhance contrast.
-Save the enhanced image locally (sentinel_rgb_enhanced.png).

### 3 Map Generation
Process:

-Compute the geographic bounds of the downsampled image.
-Create an interactive map using Folium centered on the image.
-Overlay the enhanced RGB image with partial opacity.
-Add layer control for interactive display.
-Save the map as HTML (sentinel_map_enhanced.html).

### 4 Backend API (backend/routers/radar.py)

The FastAPI backend provides an endpoint to serve the generated Sentinel map.

Components:

-/sentinel-map Endpoint — returns the saved map HTML file.
-Automatically checks file existence and handles errors gracefully.

### 5 Frontend (SentinelMap.jsx)

The React frontend displays the interactive map in an iframe.

Features:

-Embedded map in a responsive card layout.
-Displays title and subtitle.
-Fully interactive map using Folium.
-Can be integrated into a larger dashboard or application.

UI Layout:

<img width="1906" height="1017" alt="Screenshot 2025-10-11 235052" src="https://github.com/user-attachments/assets/e92a64f1-42f1-4e47-8c6f-4d9726d7645b" />

-Centered Card: holds the map and descriptive text.
-Iframe Container: ensures map fills available space.
-Responsive Design: adapts to different screen sizes.
