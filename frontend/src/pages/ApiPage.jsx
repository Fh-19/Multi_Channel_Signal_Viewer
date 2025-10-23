import React, { useState, useRef } from "react";
import axios from "axios";
import WaveSurfer from "wavesurfer.js";

export default function AudioAnalysisPage() {
  const [audioFile, setAudioFile] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [aliasResult, setAliasResult] = useState(null);
  const [loadingPredict, setLoadingPredict] = useState(false);
  const [loadingAlias, setLoadingAlias] = useState(false);
  const [rate, setRate] = useState(10000);

  const waveformRef = useRef(null);
  const aliasWaveformRef = useRef(null);
  const wavesurferPredict = useRef(null);
  const wavesurferAlias = useRef(null);

  // Initialize waveform
  const initWaveform = (ref, fileUrl) => {
    if (!ref.current) return;

    if (ref === waveformRef && wavesurferPredict.current) wavesurferPredict.current.destroy();
    if (ref === aliasWaveformRef && wavesurferAlias.current) wavesurferAlias.current.destroy();

    const ws = WaveSurfer.create({
      container: ref.current,
      waveColor: "#9db8ff",
      progressColor: "#2055c0",
      cursorColor: "#2055c0",
      height: 90,
    });

    ws.load(fileUrl);

    if (ref === waveformRef) wavesurferPredict.current = ws;
    else wavesurferAlias.current = ws;
  };

  // Handle upload
  const handleAudioUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAudioFile(file);
    setPrediction(null);
    setAliasResult(null);

    const fileUrl = URL.createObjectURL(file);
    initWaveform(waveformRef, fileUrl);
  };

  // Predict handler
  const handlePredict = async () => {
    if (!audioFile) return alert("Please upload an audio file first!");
    setLoadingPredict(true);
    setPrediction(null);

    const formData = new FormData();
    formData.append("file", audioFile);

    try {
      const res = await axios.post("http://127.0.0.1:8000/api/predict", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("Prediction Result:", res.data);
      setPrediction(res.data);

      if (res.data.file_url) initWaveform(waveformRef, res.data.file_url);
    } catch (err) {
      console.error(err);
      alert("Prediction failed!");
    } finally {
      setLoadingPredict(false);
    }
  };

  // Alias handler and predict
  const handleAlias = async () => {
    if (!audioFile) return alert("Please upload an audio file first!");
    setLoadingAlias(true);
    setAliasResult(null);

    const formData = new FormData();
    formData.append("file", audioFile);
    formData.append("rate", rate);

    try {
      const res = await axios.post("http://127.0.0.1:8000/api/alias", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("Alias Result:", res.data);
      setAliasResult(res.data);

      if (res.data.alias_file_url) {
        setTimeout(() => initWaveform(aliasWaveformRef, res.data.alias_file_url), 300);
      }
    } catch (err) {
      console.error("Alias Error:", err);
      alert("Aliasing failed!");
    } finally {
      setLoadingAlias(false);
    }
  };

  // Play buttons
  const handlePlayPause = (type) => {
    if (type === "predict" && wavesurferPredict.current) wavesurferPredict.current.playPause();
    if (type === "alias" && wavesurferAlias.current) wavesurferAlias.current.playPause();
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f0f4f8" }}>
      {/* LEFT PANEL - Controls & Waveforms */}
      <div style={{ flex: 6, padding: "25px", borderRight: "2px solid #dbe2ef" }}>
        <h1 style={{ color: "#263357", fontWeight: 700, marginBottom: "25px" }}>Audio Analysis</h1>

        {/* Upload Section */}
        <div style={{ 
          background: "#fff", 
          padding: "20px", 
          borderRadius: "12px", 
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          marginBottom: "25px"
        }}>
          <h3 style={{ color: "#2055c0", marginBottom: "15px" }}>Upload Audio</h3>
          <input
            type="file"
            accept="audio/*"
            onChange={handleAudioUpload}
            style={{
              display: "block",
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #b7cdfc",
              background: "#f9fbff",
            }}
          />
        </div>

        {/* Original Audio Section */}
        <div style={{ 
          background: "#fff", 
          padding: "20px", 
          borderRadius: "12px", 
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          marginBottom: "25px"
        }}>
          <h3 style={{ color: "#2055c0", marginBottom: "15px" }}>Original Audio</h3>
          <div
            ref={waveformRef}
            style={{
              background: "#f9fbff",
              borderRadius: "8px",
              border: "1px solid #e1e8ff",
              padding: "15px",
              marginBottom: "15px",
            }}
          ></div>
          
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button
              onClick={() => handlePlayPause("predict")}
              style={{ 
                background: "#2e6adf", 
                color: "#fff", 
                border: "none", 
                padding: "10px 20px", 
                borderRadius: "7px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              ▶ Play / Pause
            </button>

            <button
              onClick={handlePredict}
              disabled={loadingPredict}
              style={{
                background: loadingPredict ? "#b3b3b3" : "#1ca876",
                color: "#fff",
                padding: "10px 20px",
                borderRadius: "7px",
                border: "none",
                fontWeight: "600",
                cursor: loadingPredict ? "not-allowed" : "pointer"
              }}
            >
              {loadingPredict ? "Predicting..." : "Predict"}
            </button>
          </div>
        </div>

        {/* Aliasing Controls Section */}
        <div style={{ 
          background: "#fff", 
          padding: "20px", 
          borderRadius: "12px", 
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          marginBottom: "25px"
        }}>
          <h3 style={{ color: "#e24a33", marginBottom: "15px" }}>Aliasing Analysis</h3>
          
          <div style={{ display: "flex", gap: "15px", alignItems: "center", marginBottom: "15px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "5px", color: "#2055c0", fontWeight: "600" }}>
                Aliasing Rate:
              </label>
              <input
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "8px", 
                  borderRadius: "5px", 
                  border: "1px solid #b7cdfc" 
                }}
              />
            </div>
            
            <button
              onClick={handleAlias}
              disabled={loadingAlias}
              style={{
                background: loadingAlias ? "#b3b3b3" : "#e24a33",
                color: "#fff",
                padding: "10px 20px",
                borderRadius: "7px",
                border: "none",
                fontWeight: "600",
                cursor: loadingAlias ? "not-allowed" : "pointer",
                alignSelf: "flex-end"
              }}
            >
              {loadingAlias ? "Aliasing..." : "Apply Aliasing"}
            </button>
          </div>

          {/* Aliased Audio Waveform */}
          {aliasResult && (
            <div>
              <h4 style={{ color: "#e24a33", margin: "15px 0 10px 0" }}>Aliased Audio</h4>
              <div
                ref={aliasWaveformRef}
                style={{
                  background: "#f9fbff",
                  borderRadius: "8px",
                  border: "1px solid #e1e8ff",
                  padding: "15px",
                  marginBottom: "15px",
                }}
              ></div>
              
              <button
                onClick={() => handlePlayPause("alias")}
                style={{ 
                  background: "#e74c3c", 
                  color: "#fff", 
                  border: "none", 
                  padding: "10px 20px", 
                  borderRadius: "7px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                ▶ Play Aliased Audio
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL - Results & Information */}
      <div style={{ flex: 4, padding: "25px", background: "#f9fbff" }}>
        {/* How It Works Section */}
        <div style={{ 
          background: "#fff", 
          padding: "20px", 
          borderRadius: "12px", 
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          marginBottom: "25px"
        }}>
          <h2 style={{ color: "#2055c0", marginBottom: "15px" }}>How It Works</h2>
          <ul style={{ color: "#4a5568", fontSize: "14px", lineHeight: "1.6", paddingLeft: "20px" }}>
            <li style={{ marginBottom: "8px" }}>Upload an audio file in `.wav` or `.mp3` format.</li>
            <li style={{ marginBottom: "8px" }}>Click <b style={{ color: "#1e8b54" }}>Predict</b> to classify the audio with ML model.</li>
            <li style={{ marginBottom: "8px" }}>Click <b style={{ color: "#e24a33" }}>Aliasing</b> to analyze frequency distortions.</li>
            <li style={{ marginBottom: "8px" }}>You can play both waveforms independently.</li>
            <li>You can change aliasing rate for different results.</li>
          </ul>
        </div>

        {/* Prediction Results Section */}
        {prediction && (
          <div style={{ 
            background: "#fff", 
            padding: "20px", 
            borderRadius: "12px", 
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            marginBottom: "25px"
          }}>
            <h2 style={{ color: "#1ca876", marginBottom: "15px" }}>Prediction Results</h2>
            <div style={{ background: "#f0f9f4", padding: "15px", borderRadius: "8px", marginBottom: "15px" }}>
              <p style={{ margin: "8px 0" }}><b>Label:</b> {prediction.predicted_label}</p>
              <p style={{ margin: "8px 0" }}><b>Confidence:</b> {prediction.confidence.toFixed(2)}%</p>
              <p style={{ margin: "8px 0" }}><b>Sample Rate:</b> {prediction.sample_rate} Hz</p>
            </div>
            
            {prediction.spec_url && (
              <div>
                <h4 style={{ color: "#2055c0", marginBottom: "10px" }}>Spectrogram</h4>
                <img 
                  src={prediction.spec_url} 
                  alt="Spectrogram" 
                  style={{ 
                    width: "100%", 
                    borderRadius: "8px",
                    border: "1px solid #e1e8ff"
                  }} 
                />
              </div>
            )}
          </div>
        )}

        {/* Aliasing Results Section */}
        {aliasResult && (
          <div style={{ 
            background: "#fff", 
            padding: "20px", 
            borderRadius: "12px", 
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)"
          }}>
            <h2 style={{ color: "#e24a33", marginBottom: "15px" }}>Aliasing Results</h2>
            <div style={{ background: "#fdf0f0", padding: "15px", borderRadius: "8px", marginBottom: "15px" }}>
              <p style={{ margin: "8px 0" }}><b>Label:</b> {aliasResult.predicted_label}</p>
              <p style={{ margin: "8px 0" }}><b>Confidence:</b> {aliasResult.confidence.toFixed(2)}%</p>
              <p style={{ margin: "8px 0" }}><b>Sample Rate:</b> {aliasResult.sample_rate} Hz</p>
            </div>
            
            {aliasResult.alias_spec_url && (
              <div>
                <h4 style={{ color: "#e24a33", marginBottom: "10px" }}>Alias Spectrogram</h4>
                <img
                  src={aliasResult.alias_spec_url}
                  alt="Alias Spectrogram"
                  style={{ 
                    width: "100%", 
                    borderRadius: "8px",
                    border: "1px solid #f8d7da"
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}