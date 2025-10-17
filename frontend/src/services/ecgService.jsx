import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000/api";

export async function fetchEcgData(filename, leads) {
  const leadParams = leads.map((l) => `leads=${l}`).join("&");
  const url = `${API_BASE_URL}/ecg/ecg?filename=${filename}&${leadParams}`;
  console.log("Fetching ECG data from:", url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ECG data: ${res.status}`);
  const data = await res.json();
  console.log("ECG data fetched:", { 
    length: data.signals?.length, 
    fs: data.fs,
    original_fs: data.original_fs 
  });
  return data;
}

// Upload ECG file pair (.dat + .hea)
export async function uploadEcgFile(files) {
  const formData = new FormData();
  files.forEach(f => formData.append("files", f));

  const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
}

// Resample ECG data (both upsampling and downsampling)
export async function resampleEcgData(filename, targetFs) {
  console.log(`Resampling ${filename} to ${targetFs}Hz`);
  const response = await fetch(`${API_BASE_URL}/ecg/resample`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      record_number: filename,
      target_fs: targetFs
    })
  });
  
  if (!response.ok) {
    throw new Error(`Resampling failed: ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log("Resampling result:", { 
    signalsLength: data.signals?.length, 
    newFs: data.fs,
    aliasing: data.aliasing_warning 
  });
  return data;
}

// Classify with specific sampling frequency - FIXED
export async function classifyWithSampling(filename, targetFs = null) {
  console.log(`Classifying ${filename} at ${targetFs}Hz`);
  
  const requestBody = {
    record_number: filename,
    data_folder: "services/data"
  };
  
  // Only add target_fs if it's provided
  if (targetFs !== null && targetFs !== undefined) {
    requestBody.target_fs = targetFs;
  }
  
  console.log("Classification request body:", requestBody);
  
  const response = await fetch(`${API_BASE_URL}/ecg/classify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Classification failed:", errorText);
    throw new Error(`Classification failed: ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log("Classification response:", data);
  return data;
}