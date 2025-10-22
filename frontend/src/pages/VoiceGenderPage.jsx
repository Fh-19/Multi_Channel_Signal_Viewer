import React, { useState } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);

const VoiceGenderPage = () => {
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [aliasedUrl, setAliasedUrl] = useState(null);
  const [recoveredUrl, setRecoveredUrl] = useState(null);

  const [result, setResult] = useState(null);
  const [aliasedResult, setAliasedResult] = useState(null);
  const [recoveredResult, setRecoveredResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [freq, setFreq] = useState(8000);

  // ---------------- Handle file selection ----------------
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setResult(null);
    setAliasedResult(null);
    setRecoveredResult(null);
    setRecoveredUrl(null);
    setAliasedUrl(null);
    if (selectedFile) setAudioUrl(URL.createObjectURL(selectedFile));
  };

  // ---------------- Upload original ----------------
  const handleUpload = async () => {
    if (!file) return alert("Please select a .wav file first!");
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("http://127.0.0.1:8000/api/voice_gender/predict", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
      setFreq(res.data.sampling_rate / 2);
    } catch (err) {
      console.error(err);
      alert("Error uploading file. Check backend.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Apply aliasing ----------------
  const handleAliasing = async () => {
    if (!result?.filename) return alert("Please classify the original file first!");
    setLoading(true);
    const formData = new FormData();
    formData.append("filename", result.filename);
    formData.append("new_sr", freq);

    try {
      const res = await axios.post("http://127.0.0.1:8000/api/voice_gender/aliasing", formData);
      setAliasedResult(res.data);
      setAliasedUrl(res.data.file_url);
    } catch (err) {
      console.error(err);
      alert("Aliasing error. Check backend.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Recover audio (Anti-alias) ----------------
  const handleRecover = async () => {
    if (!aliasedResult?.filename) return alert("Please apply aliasing first!");
    setLoading(true);
    const formData = new FormData();
    formData.append("filename", aliasedResult.filename);

    try {
      const res = await axios.post("http://127.0.0.1:8000/api/voice_gender/recover", formData);
      setRecoveredResult(res.data);
      setRecoveredUrl(res.data.file_url);
    } catch (err) {
      console.error(err);
      alert("Recovery error. Check backend.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Render spectrum chart ----------------
  const renderSpectrum = (spectrumData, label, color = "#2055c0") => {
    if (!spectrumData) return null;
    const data = {
      labels: spectrumData.freqs,
      datasets: [
        {
          label,
          data: spectrumData.magnitude,
          borderColor: color,
          borderWidth: 1,
          pointRadius: 0,
        },
      ],
    };
    const options = {
      responsive: true,
      scales: {
        x: { title: { text: "Frequency (Hz)", display: true } },
        y: { display: false },
      },
      plugins: { legend: { display: true, position: "top" } },
    };
    return (
      <div role="img" aria-label={`${label} frequency chart`}>
        <Line data={data} options={options} />
      </div>
    );
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.card}>
        <h1 style={styles.title}>🎙️ Voice Gender Classifier + Aliasing + Recovery</h1>

        {/* Upload section */}
        <label htmlFor="fileUpload" style={{ display: "block", fontWeight: "600" }}>
          Select a WAV File:
        </label>
        <input
          id="fileUpload"
          type="file"
          accept=".wav"
          onChange={handleFileChange}
          style={{ marginBottom: "10px" }}
        />

        {audioUrl && (
          <audio controls src={audioUrl} style={{ width: "100%", marginTop: "10px" }} />
        )}

        <button style={styles.button} onClick={handleUpload} disabled={loading}>
          {loading ? "Processing..." : "Upload & Detect"}
        </button>

        {/* Original result */}
        {result && (
          <>
            <div style={styles.resultBox}>
              <h3>Original File: {result.filename}</h3>
              <p>Sampling Rate: {result.sampling_rate} Hz</p>
              <h2>
                Gender:{" "}
                <span
                  style={{
                    color:
                      result.gender === "Male"
                        ? "blue"
                        : result.gender === "Female"
                        ? "deeppink"
                        : "gray",
                  }}
                >
                  {result.gender}
                </span>
              </h2>
            </div>

            <div style={{ marginTop: "20px" }}>
              <h4>Frequency Spectrum (Original)</h4>
              {renderSpectrum(result.spectrum, "Original Spectrum")}
            </div>

            {/* Aliasing Control */}
            <div style={{ marginTop: "40px" }}>
              <h3>🎚️ Aliasing Control</h3>
              <label htmlFor="freqRange" style={{ fontWeight: "600" }}>
                Sampling Frequency:
              </label>
              <input
                id="freqRange"
                type="range"
                min="1000"
                max={result.sampling_rate * 2}
                step="500"
                value={freq}
                onChange={(e) => setFreq(e.target.value)}
                style={{ width: "100%" }}
              />
              <p>Sampling Frequency: {freq} Hz</p>

              <button
                style={{ ...styles.button, backgroundColor: "#ff7b00" }}
                onClick={handleAliasing}
                disabled={loading}
              >
                Apply Aliasing
              </button>
            </div>
          </>
        )}

        {/* Aliased audio */}
        {aliasedUrl && (
          <>
            <audio controls src={aliasedUrl} style={{ width: "100%", marginTop: "20px" }} />
            <div style={styles.resultBox}>
              <h3>Aliased File: {aliasedResult.filename}</h3>
              <p>New SR: {aliasedResult.new_sr} Hz</p>
              <h2>
                Gender After Aliasing:{" "}
                <span
                  style={{
                    color:
                      aliasedResult.gender === "Male"
                        ? "blue"
                        : aliasedResult.gender === "Female"
                        ? "deeppink"
                        : "gray",
                  }}
                >
                  {aliasedResult.gender}
                </span>
              </h2>
            </div>

            <div style={{ marginTop: "20px" }}>
              <h4>Frequency Spectrum (Aliased)</h4>
              {renderSpectrum(aliasedResult.spectrum, "Aliased Spectrum", "#ff6600")}
            </div>

            <button
              style={{ ...styles.button, backgroundColor: "#008f39", marginTop: "30px" }}
              onClick={handleRecover}
              disabled={loading}
            >
              {loading ? "Recovering..." : "🔧 Recover Original (Anti-Aliasing)"}
            </button>
          </>
        )}

        {/* Recovered audio */}
        {recoveredUrl && recoveredResult && (
          <>
            <audio controls src={recoveredUrl} style={{ width: "100%", marginTop: "20px" }} />
            <div style={styles.resultBox}>
              <h3>Recovered File: {recoveredResult.filename}</h3>

              {/* ✅ Display recovered sampling rate */}
              {recoveredResult.recovered_sr && (
                <p>Recovered SR: {recoveredResult.recovered_sr} Hz</p>
              )}

              <h2>
                Gender After Recovery:{" "}
                <span
                  style={{
                    color:
                      recoveredResult.gender === "Male"
                        ? "blue"
                        : recoveredResult.gender === "Female"
                        ? "deeppink"
                        : "gray",
                  }}
                >
                  {recoveredResult.gender}
                </span>
              </h2>
            </div>

            {/* Display both before & after recovery */}
            <div style={{ marginTop: "20px" }}>
              <h4>🔍 Frequency Spectrum Comparison (Before vs After Recovery)</h4>
              {renderSpectrum(recoveredResult.spectrum_before, "Before Recovery", "#ff4444")}
              {renderSpectrum(recoveredResult.spectrum_after, "After Recovery", "#00aa33")}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ---------------- STYLES ----------------
const styles = {
  pageContainer: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f0f4f8",
  },
  card: {
    background: "#fff",
    borderRadius: "20px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
    padding: "40px",
    textAlign: "center",
    maxWidth: "700px",
    width: "90%",
  },
  title: { fontSize: "26px", marginBottom: "10px", color: "#001f3f" },
  button: {
    marginTop: "15px",
    padding: "10px 20px",
    backgroundColor: "#2055c0",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
  },
  resultBox: {
    marginTop: "20px",
    background: "#f9f9f9",
    padding: "15px",
    borderRadius: "10px",
    border: "1px solid #ddd",
  },
};

export default VoiceGenderPage;
