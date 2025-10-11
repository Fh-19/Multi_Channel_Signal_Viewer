import React, { useState } from "react";
import Plot from "react-plotly.js";

import axios from "axios";

import {
  generateDoppler,
  playDoppler,
  uploadDopplerFile,
  predictDopplerFile,
} from "../services/dopplerService";

export default function DopplerPage() {
  const [frequency, setFrequency] = useState(300);
  const [speed, setSpeed] = useState(90);
  const [realisticMode, setRealisticMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);
  const [waveform, setWaveform] = useState(null); // store waveform data for plotting


  const BACKEND_URL = "http://127.0.0.1:5000"; // 🔹 غيّريها لو السيرفر بتاعك شغال على port تاني

  // --- Generate Doppler WAV ---
  const handleGenerate = async () => {

  // 📡 Handle simulation playback
  const handlePlay = async () => {
    setError(null);
    setPlaying(true);
    try {

      const response = await axios.post(
        `${BACKEND_URL}/generate_doppler`,
        { frequency, speed },
        { responseType: "blob" } // علشان يرجع ملف WAV
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `doppler_${frequency}Hz_${speed}mps.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError("Error generating Doppler WAV file.");
      console.error(err);

      await playDoppler(frequency, speed, realisticMode);
      setTimeout(() => setPlaying(false), 8000);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Failed to play Doppler signal"
      );
      setPlaying(false);

    }
  };

  // 🎧 Generate and download file
  const handleGenerate = async () => {
    setError(null);
    try {
      const blob = await generateDoppler(frequency, speed, realisticMode);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const mode = realisticMode ? "realistic" : "basic";
      a.download = `doppler_${mode}_${frequency}Hz_${speed}kmh.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Failed to generate Doppler signal"
      );
    }
  };

  // ⬆️ Upload and auto-predict file
  const handleFileUpload = async (e) => {
    setError(null);
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".wav")) {
      setError("Please upload a WAV file");
      return;
    }

    setLoading(true);
    try {

      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post(`${BACKEND_URL}/analyze_doppler`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setAnalysisResult(response.data);
    } catch (err) {
      console.error(err);
      setError("Error analyzing file. Make sure backend is running.");

      const result = await uploadDopplerFile(file);
      setUploadStatus(result);
      setUploadStatus({ ...result, filename: file.name });

      // Auto-run prediction
      const pred = await predictDopplerFile(file);
      setPrediction(pred);

      // visualize waveform
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);
      const sampleStep = Math.floor(channelData.length / 1000);
      const waveformData = channelData.filter(
        (_, i) => i % sampleStep === 0
      );
      setWaveform(waveformData);
    } catch (err) {
      setError(err.message || "Failed to upload/predict");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100%",
        background: "#f0f4f8",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      {/* Left: Control Panel */}
      <div
        style={{
          flex: 1,
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <h1
          style={{
            margin: "0 0 18px 0",
            fontWeight: 700,
            fontSize: 26,
            color: "#263357",
          }}
        >
          Doppler Shift Simulator
        </h1>

        {/* Simulation Mode */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            marginBottom: 20,
          }}
        >
          <h3 style={{ color: "#2055c0", marginBottom: 10 }}>Simulation Mode</h3>
          <div style={{ display: "flex", gap: 15, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="radio"
                checked={realisticMode}
                onChange={() => setRealisticMode(true)}
              />
              Realistic Car Simulation
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="radio"
                checked={!realisticMode}
                onChange={() => setRealisticMode(false)}
              />
              Basic Doppler Tone
            </label>
          </div>
        </div>

        {/* Generate Section */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            marginBottom: 20,
          }}
        >
          <h3 style={{ color: "#2055c0", marginBottom: 10 }}>Parameters</h3>
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            <label>
              Frequency (Hz):{" "}
              <input
                type="number"
                value={frequency}
                onChange={(e) => setFrequency(Number(e.target.value))}
                style={{
                  width: 120,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                }}
              />
            </label>
            <label>
              Speed (km/h):{" "}
              <input
                type="number"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                style={{
                  width: 120,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                }}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handlePlay}
              disabled={playing}
              style={{
                background: playing ? "#8d97b6" : "#28a745",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontWeight: 600,
              }}
            >
              {playing ? "🔊 Playing..." : "▶ Hear Simulation"}
            </button>
            <button
              onClick={handleGenerate}
              style={{
                background: "#2055c0",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontWeight: 600,
              }}
            >
              ⬇ Download .WAV
            </button>
          </div>
        </div>

        {/* Upload Section */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
         }}
        >
        
          <h3 style={{ color: "#2055c0", marginBottom: 10 }}>Upload Audio</h3>
          <input
            type="file"
            accept=".wav"
            onChange={handleFileUpload}
            style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid #ccc",
            width: "100%",
            maxWidth: 300,
          }}
        />
        {loading && (
          <p style={{ marginTop: 10, color: "#8d97b6" }}>Processing...</p>
        )}
        {error && (
          <p style={{ marginTop: 10, color: "red" }}>Error: {error}</p>
        )}

      {/* New upload complete message */}
      {uploadStatus && (
        <p
          style={{
            marginTop: 10,
            color: "#2e7d32",
            background: "#e8f5e9",
            padding: "8px 12px",
            borderRadius: 6,
            fontWeight: 500,
         }}
        >
          ✅ Upload complete: <b>{uploadStatus.filename}</b>
        </p>
      )}
      </div>
      </div>
      {/* Right: Waveform and Predictions */}
      <div
        style={{
          flex: 1.2,
          padding: "28px",
          overflowY: "auto",
          background: "#fff",
          margin: "28px",
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}
      >
        <h2 style={{ color: "#2055c0", marginBottom: 20 }}>
          Uploaded Audio Waveform
        </h2>

        {waveform ? (
          <Plot
            data={[
              {
                x: Array.from({ length: waveform.length }, (_, i) => i),
                y: waveform,
                type: "scatter",
                mode: "lines",
                line: { color: "#2055c0", width: 1 },
              },
            ]}
            layout={{
              height: 350,
              margin: { t: 10, r: 10, l: 40, b: 30 },
              xaxis: { title: "Sample" },
              yaxis: { title: "Amplitude" },
            }}
            style={{ width: "100%" }}
          />
        ) : (
          <p style={{ color: "#666" }}>
            No waveform yet — upload a WAV file to visualize it.
          </p>
        )}

        {prediction && (
          <div
            style={{
              marginTop: 30,
              background: "#e8f5e8",
              padding: 16,
              borderRadius: 8,
            }}
          >
            <h3 style={{ color: "#2055c0" }}>Predicted Parameters</h3>
            <p style={{ color: "#333" }}>
              <b>Speed:</b> {prediction.pred_speed_kmh.toFixed(2)} km/h
            </p>
            <p style={{ color: "#333" }}>
              <b>Frequency:</b> {prediction.pred_freq_hz.toFixed(2)} Hz
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
