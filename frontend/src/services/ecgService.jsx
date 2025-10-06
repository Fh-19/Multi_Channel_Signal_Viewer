import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000/api";

export async function fetchEcgData(filename, leads) {
  const leadParams = leads.map((l) => `leads=${l}`).join("&");
  const url = `${API_BASE_URL}/ecg/ecg?filename=${filename}&${leadParams}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ECG data: ${res.status}`);
  return await res.json();
}

export const classifyEcgRecord = async (recordNumber, dataFolder = "data") => {
  // This one is correct! The endpoint is /api/ecg/classify
  const response = await axios.post(`${API_BASE_URL}/ecg/classify`, {
    record_number: recordNumber,
    data_folder: dataFolder,
  });
  return response.data;
};
