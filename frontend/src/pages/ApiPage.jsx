import React, { useState, useRef } from "react";
import axios from "axios";
import WaveSurfer from "wavesurfer.js";

export default function AudioAnalysisPage() {
  const [audioFile, setAudioFile] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [aliasResult, setAliasResult] = useState(null);
  const [loadingPredict, setLoadingPredict] = useState(false);
  const [loadingAlias, setLoadingAlias] = useState(false);
  const [rate, setRate] = useState(10000); // ✅ user can choose alias rate

  const waveformRef = useRef(null);
  const aliasWaveformRef = useRef(null);
  const wavesurferPredict = useRef(null);
  const wavesurferAlias = useRef(null);

  // ✅ Initialize waveform
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

  // ✅ Handle upload
  const handleAudioUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAudioFile(file);
    setPrediction(null);
    setAliasResult(null);

    const fileUrl = URL.createObjectURL(file);
    initWaveform(waveformRef, fileUrl);
  };

  // ✅ Predict handler
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

  // ✅ Alias handler
  const handleAlias = async () => {
    if (!audioFile) return alert("Please upload an audio file first!");
    setLoadingAlias(true);
    setAliasResult(null);

    const formData = new FormData();
    formData.append("file", audioFile);
    formData.append("rate", rate); // ✅ fixed 422 error

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

  // ✅ Play buttons
  const handlePlayPause = (type) => {
    if (type === "predict" && wavesurferPredict.current) wavesurferPredict.current.playPause();
    if (type === "alias" && wavesurferAlias.current) wavesurferAlias.current.playPause();
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f0f4f8" }}>
      {/* LEFT PANEL */}
      <div style={{ flex: 7, padding: "20px 30px", borderRight: "2px solid #dbe2ef" }}>
        <h1 style={{ color: "#263357", fontWeight: 700 }}>🎵 Audio Analysis</h1>

        {/* Upload */}
        <div style={{ margin: "15px 0" }}>
          <label style={{ fontWeight: 600, color: "#2055c0" }}>Upload Audio File:</label>
          <input
            type="file"
            accept="audio/*"
            onChange={handleAudioUpload}
            style={{
              display: "block",
              marginTop: 6,
              padding: "8px",
              borderRadius: 7,
              border: "1px solid #b7cdfc",
              background: "#fff",
            }}
          />
        </div>

        {/* 🎧 Original / Predicted waveform */}
        <div
          ref={waveformRef}
          style={{
            background: "#ffffff",
            borderRadius: 10,
            boxShadow: "0 3px 8px rgba(0,0,0,0.1)",
            padding: "10px",
            marginBottom: 20,
          }}
        ></div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={() => handlePlayPause("predict")}
            style={{ background: "#2e6adf", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 7 }}
          >
            ▶ Play / Pause
          </button>

          <button
            onClick={handlePredict}
            disabled={loadingPredict}
            style={{
              background: loadingPredict ? "#b3b3b3" : "#1e8b54",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: 7,
              border: "none",
            }}
          >
            {loadingPredict ? "Predicting..." : "Predict"}
          </button>

          <div>
            <label style={{ marginRight: "8px", color: "#2055c0", fontWeight: 600 }}>Aliasing Rate:</label>
            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              style={{ width: "100px", padding: "6px", borderRadius: 5, border: "1px solid #b7cdfc" }}
            />
          </div>

          <button
            onClick={handleAlias}
            disabled={loadingAlias}
            style={{
              background: loadingAlias ? "#b3b3b3" : "#c02424",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: 7,
              border: "none",
            }}
          >
            {loadingAlias ? "Aliasing..." : "Aliasing"}
          </button>
        </div>

        {/* Prediction Result */}
        {prediction && (
          <div style={{ marginTop: 20, background: "#fff", padding: 16, borderRadius: 10, maxWidth: 500 }}>
            <h3 style={{ color: "#2055c0" }}>Prediction Result</h3>
            <p><b>Label:</b> {prediction.predicted_label}</p>
            <p><b>Confidence:</b> {prediction.confidence.toFixed(2)}%</p>
            <p><b>Sample Rate:</b> {prediction.sample_rate} Hz</p>
            {prediction.spec_url && (
              <img src={prediction.spec_url} alt="Spectrogram" style={{ width: "100%", borderRadius: 10 }} />
            )}
          </div>
        )}

        {/* Aliasing Result */}
        {aliasResult && (
          <div style={{ marginTop: 25, background: "#fff", padding: 16, borderRadius: 10, maxWidth: 500 }}>
            <h3 style={{ color: "#c02424" }}>Aliasing Result</h3>
            <p><b>Label:</b> {aliasResult.predicted_label}</p>
            <p><b>Confidence:</b> {aliasResult.confidence.toFixed(2)}%</p>
            <p><b>Sample Rate:</b> {aliasResult.sample_rate} Hz</p>

            <div
              ref={aliasWaveformRef}
              style={{
                background: "#ffffff",
                borderRadius: 10,
                boxShadow: "0 3px 8px rgba(0,0,0,0.1)",
                padding: "10px",
                margin: "10px 0",
              }}
            ></div>

            <button
              onClick={() => handlePlayPause("alias")}
              style={{ background: "#e74c3c", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 7 }}
            >
              ▶ Play Aliased Audio
            </button>

            {aliasResult.alias_spec_url && (
              <img
                src={aliasResult.alias_spec_url}
                alt="Alias Spectrogram"
                style={{ width: "100%", borderRadius: 10, marginTop: 10 }}
              />
            )}
          </div>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex: 3, padding: "25px", background: "#f9fbff" }}>
        <h2 style={{ color: "#2055c0" }}>How It Works</h2>
        <ul style={{ color: "#4a5568", fontSize: 14, lineHeight: 1.6 }}>
          <li>Upload an audio file in `.wav` or `.mp3` format.</li>
          <li>Click <b>Predict</b> to classify the audio with ML model.</li>
          <li>Click <b>Aliasing</b> to analyze frequency distortions.</li>
          <li>You can play both waveforms independently.</li>
          <li>You can change aliasing rate for different results.</li>
        </ul>
      </div>
    </div>
  );
}
