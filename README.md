
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

-Centered Card: holds the map and descriptive text.
-Iframe Container: ensures map fills available space.
-Responsive Design: adapts to different screen sizes.
