// frontend/src/services/dopplerService.js
import axios from "axios";

const API_BASE_URL = "http://localhost:8000/api";

export const generateDoppler = async (frequency, speed, realistic = true) => {
  const response = await axios.post(`${API_BASE_URL}/doppler/generate`, {
    frequency, speed, realistic
  }, { responseType: "blob" });
  return response.data;
};

export const playDoppler = async (frequency, speed, realistic = true) => {
  const response = await axios.post(`${API_BASE_URL}/doppler/play`, {
    frequency, speed, realistic
  });
  return response.data;
};

export const uploadDopplerFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axios.post(`${API_BASE_URL}/doppler/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const predictDopplerFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axios.post(`${API_BASE_URL}/doppler/predict`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};
