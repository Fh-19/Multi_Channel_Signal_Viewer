// ecgService.js
// ---------------
// Provides functions to call backend ECG endpoints:
// - uploadFile
// - getChannelData
// - getPlots
// frontend/services/ecgService.jsx

import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000/api";

export async function fetchEcgData(recordNumber, leads) {
  const leadParams = leads.map((l) => `leads=${l}`).join("&");
  const url = `${API_BASE_URL}/ecg/ecg?record_number=${recordNumber}&${leadParams}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ECG data: ${res.status}`);
  }
  return await res.json();
}
