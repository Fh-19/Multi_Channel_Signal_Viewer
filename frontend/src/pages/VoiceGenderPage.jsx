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
} from "chart.js";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip);

const VoiceGenderPage = () => {
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [aliasedUrl, setAliasedUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [aliasedResult, setAliasedResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [freq, setFreq] = useState(8000);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setResult(null);
    setAliasedResult(null);
    setAliasedUrl(null);
    if (selectedFile) setAudioUrl(URL.createObjectURL(selectedFile));
  };

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
    } catch {
      alert("Error uploading file. Check backend.");
    } finally {
      setLoading(false);
    }
  };

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
    } catch {
      alert("Aliasing error. Check backend.");
    } finally {
      setLoading(false);
    }
  };

  const renderSpectrum = (spectrumData, label) => {
    if (!spectrumData) return null;
    const data = {
      labels: spectrumData.freqs,
      datasets: [
        {
          label,
          data: spectrumData.magnitude,
          borderColor: "#2055c0",
          borderWidth: 1,
          pointRadius: 0,
        },
      ],
    };
    const options = {
      responsive: true,
      scales: { x: { title: { text: "Frequency (Hz)", display: true } }, y: { display: false } },
      plugins: { legend: { display: false } },
    };
    return <Line data={data} options={options} />;
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.card}>
        <h1 style={styles.title}>🎙️ Voice Gender Classifier + Aliasing</h1>

        <input type="file" accept=".wav" onChange={handleFileChange} />
        {audioUrl && <audio controls src={audioUrl} style={{ width: "100%", marginTop: "10px" }} />}

        <button style={styles.button} onClick={handleUpload} disabled={loading}>
          {loading ? "Processing..." : "Upload & Detect"}
        </button>

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

            <div style={{ marginTop: "40px" }}>
              <h3>🎚️ Aliasing Control</h3>
              <input
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
              >
                Apply Aliasing
              </button>
            </div>
          </>
        )}

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
              {renderSpectrum(aliasedResult.spectrum, "Aliased Spectrum")}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

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
