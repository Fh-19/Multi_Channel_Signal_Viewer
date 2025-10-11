# EEG Page:
This page is responsible for classifying between 5 classes (Dementia, Alzheimer, Schizophrenia, Epiepsy and Healthy) by using a pretrained simplified EEGNet model.


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



