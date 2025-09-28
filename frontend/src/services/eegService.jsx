// eegService.jsx
import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000/api/eeg";

export const uploadEegFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const fetchEegSegments = async (filename, channels) => {
  const params = new URLSearchParams();
  params.append("filename", filename);
  channels.forEach((ch) => params.append("channels", ch));

  const response = await axios.get(`${API_BASE_URL}/segments`, { params });
  return response.data;
};
