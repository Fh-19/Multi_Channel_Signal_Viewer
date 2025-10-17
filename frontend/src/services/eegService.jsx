// frontend/src/services/eegService.jsx
import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000/api/eeg";

export async function uploadEegFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  console.log(' Uploading file:', file.name);
  
  try {
    const res = await axios.post(`${API_BASE_URL}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    console.log(' Upload successful:', res.data);
    return res.data;
  } catch (error) {
    console.error(' Upload failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.detail || 'Upload failed');
  }
}

export async function fetchEegSegments(filename, channels, resample_fs = null) {
  const params = {
    filename,
    channels, // axios automatically handles array encoding
  };
  
  // Add resample_to parameter if provided
  if (resample_fs) {
    params.resample_to = resample_fs;
  }

  console.log(' Fetching segments with params:', params);
  
  try {
    const res = await axios.get(`${API_BASE_URL}/segments`, { params });
    console.log(' Segments received:', res.data.segments?.length || 0, 'segments');
    return res.data;
  } catch (error) {
    console.error(' Fetch segments failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.detail || 'Failed to fetch segments');
  }
}

export async function predictEegFile(file, model_fs = 256) {
  const formData = new FormData();
  formData.append("file", file);

  console.log(' Making prediction with model_fs:', model_fs);
  
  try {
    const res = await axios.post(`${API_BASE_URL}/predict?model_fs=${model_fs}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    console.log(' Prediction successful:', res.data);
    return res.data;
  } catch (error) {
    console.error(' Prediction failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.detail || 'Prediction failed');
  }
}
