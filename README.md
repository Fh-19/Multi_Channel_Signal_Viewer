# EEG Page:
This page is responsible for classifying between five classes (Dementia, Alzheimer's, Schizophrenia, Epilepsy, and Healthy) using a pre-trained simplified EEGNet model.

<img width="1919" height="977" alt="Image" src="https://github.com/user-attachments/assets/9ce1d555-1aef-4b19-9be9-36c1d2789793" />

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
