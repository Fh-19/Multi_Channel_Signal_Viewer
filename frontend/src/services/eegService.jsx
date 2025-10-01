// frontend/src/services/eegService.jsx
import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000/api/eeg";

export async function uploadEegFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await axios.post(`${API_BASE_URL}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function fetchEegSegments(filename, channels) {
  const res = await axios.get(`${API_BASE_URL}/segments`, {
    params: { filename, channels }, // axios encodes array -> ?channels=a&channels=b
  });
  return res.data;
}

export async function predictEegFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await axios.post(`${API_BASE_URL}/predict`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
