import axios from "axios";

const API_BASE_URL = "http://localhost:8000/api";

export const generateDoppler = async (frequency, speed, realistic = true, sampling_rate = 22050) => {
  const response = await axios.post(`${API_BASE_URL}/doppler/generate`, {
    frequency, speed, realistic, sampling_rate
  }, { responseType: "blob" });
  return response.data;
};

export const playDoppler = async (frequency, speed, realistic = true, sampling_rate = 22050) => {
  const response = await axios.post(`${API_BASE_URL}/doppler/play`, {
    frequency, speed, realistic, sampling_rate
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

export const predictDopplerFile = async (file, sampling_rate = 22050) => {
  const formData = new FormData();
  formData.append("file", file);
  
  //Send sampling_rate as query parameter for any value
  const response = await axios.post(
    `${API_BASE_URL}/doppler/predict?sampling_rate=${sampling_rate}`, 
    formData, 
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );
  return response.data;
};