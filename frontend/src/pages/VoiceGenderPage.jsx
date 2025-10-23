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
  Title
} from "chart.js";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Title);

const VoiceGenderPage = () => {
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [aliasedUrl, setAliasedUrl] = useState(null);
  const [recoveredUrl, setRecoveredUrl] = useState(null);

  const [result, setResult] = useState(null);
  const [aliasedResult, setAliasedResult] = useState(null);
  const [recoveredResult, setRecoveredResult] = useState(null);
  
  // Store the original aliased spectrum separately
  const [originalAliasedSpectrum, setOriginalAliasedSpectrum] = useState(null);

  const [loading, setLoading] = useState(false);
  const [freq, setFreq] = useState(8000);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setResult(null);
    setAliasedResult(null);
    setRecoveredResult(null);
    setRecoveredUrl(null);
    setAliasedUrl(null);
    setOriginalAliasedSpectrum(null);
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
      setFreq(Math.floor(res.data.sampling_rate / 4));
    } catch (err) {
      console.error(err);
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
      setOriginalAliasedSpectrum(res.data.spectrum);
    } catch (err) {
      console.error(err);
      alert("Aliasing error. Check backend.");
    } finally {
      setLoading(false);
    }
  };

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

  // Helper function to get accurate frequency spectrum data
  const getAccurateSpectrumData = (spectrumData, maxFrequency = null) => {
    if (!spectrumData || !spectrumData.freqs || !spectrumData.magnitude) return null;
    
    // For frequency spectrum, we don't use time windows
    // Instead, we focus on meaningful frequency ranges
    let freqs = spectrumData.freqs;
    let magnitude = spectrumData.magnitude;
    
    // If maxFrequency is specified, filter to show only up to that frequency
    if (maxFrequency && freqs.length > 0) {
      const lastIndex = freqs.findIndex(freq => freq > maxFrequency);
      const cutoffIndex = lastIndex === -1 ? freqs.length : lastIndex;
      
      freqs = freqs.slice(0, cutoffIndex);
      magnitude = magnitude.slice(0, cutoffIndex);
    }
    
    // Reduce data density for better performance while maintaining accuracy
    // Keep more points in lower frequencies where detail matters
    const reductionFactor = Math.max(1, Math.floor(freqs.length / 1000));
    if (reductionFactor > 1) {
      const reducedFreqs = [];
      const reducedMagnitude = [];
      
      for (let i = 0; i < freqs.length; i += reductionFactor) {
        reducedFreqs.push(Math.round(freqs[i] * 100) / 100); // Keep 2 decimal places for frequencies
        reducedMagnitude.push(Math.round(magnitude[i]));
      }
      
      freqs = reducedFreqs;
      magnitude = reducedMagnitude;
    }
    
    return { freqs, magnitude };
  };

  const renderSpectrum = (spectrumData, label, color = "#2055c0", maxFrequency = 5000) => {
    if (!spectrumData) return null;
    
    const accurateData = getAccurateSpectrumData(spectrumData, maxFrequency);
    if (!accurateData) return null;

    const data = {
      labels: accurateData.freqs,
      datasets: [
        { 
          label, 
          data: accurateData.magnitude, 
          borderColor: color, 
          borderWidth: 1.5, 
          pointRadius: 0,
          tension: 0.1 // Smooth lines
        },
      ],
    };
    
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { 
          title: { 
            text: "Frequency (Hz)", 
            display: true,
            font: { weight: 'bold' }
          },
          type: 'linear',
          ticks: {
            callback: function(value) {
              return value % 1000 === 0 ? value + 'Hz' : '';
            },
            autoSkip: true,
            maxTicksLimit: 10
          },
          grid: {
            color: 'rgba(0,0,0,0.1)'
          }
        },
        y: { 
          title: { 
            text: "Magnitude", 
            display: true,
            font: { weight: 'bold' }
          },
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return Math.round(value);
            }
          },
          grid: {
            color: 'rgba(0,0,0,0.1)'
          }
        },
      },
      plugins: { 
        legend: { 
          display: true, 
          position: "top",
          labels: {
            usePointStyle: true,
            padding: 20,
            font: { size: 12 }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${Math.round(context.parsed.y)} @ ${context.parsed.x.toFixed(1)}Hz`;
            }
          }
        },
        title: {
          display: true,
          text: `Frequency Spectrum - ${label}`,
          font: { size: 16, weight: 'bold' },
          padding: { bottom: 20 }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    };
    
    return (
      <div style={{ height: '400px', marginBottom: '30px' }}>
        <Line data={data} options={options} />
      </div>
    );
  };

  // New function to render comparison spectrum
  const renderComparisonSpectrum = () => {
    if (!originalAliasedSpectrum || !recoveredResult?.spectrum_after) return null;
    
    const aliasedData = getAccurateSpectrumData(originalAliasedSpectrum, 5000);
    const recoveredData = getAccurateSpectrumData(recoveredResult.spectrum_after, 5000);
    
    if (!aliasedData || !recoveredData) return null;

    const data = {
      labels: aliasedData.freqs,
      datasets: [
        { 
          label: "Aliased (Before Recovery)", 
          data: aliasedData.magnitude, 
          borderColor: "#ff4444", 
          borderWidth: 2, 
          pointRadius: 0,
          tension: 0.1
        },
        { 
          label: "After Recovery", 
          data: recoveredData.magnitude, 
          borderColor: "#00aa33", 
          borderWidth: 2, 
          pointRadius: 0,
          tension: 0.1
        },
      ],
    };
    
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { 
          title: { 
            text: "Frequency (Hz)", 
            display: true,
            font: { weight: 'bold' }
          },
          type: 'linear',
          ticks: {
            callback: function(value) {
              return value % 1000 === 0 ? value + 'Hz' : '';
            },
            autoSkip: true,
            maxTicksLimit: 10
          },
          grid: {
            color: 'rgba(0,0,0,0.1)'
          }
        },
        y: { 
          title: { 
            text: "Magnitude", 
            display: true,
            font: { weight: 'bold' }
          },
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return Math.round(value);
            }
          },
          grid: {
            color: 'rgba(0,0,0,0.1)'
          }
        },
      },
      plugins: { 
        legend: { 
          display: true, 
          position: "top",
          labels: {
            usePointStyle: true,
            padding: 20,
            font: { size: 12 }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${Math.round(context.parsed.y)} @ ${context.parsed.x.toFixed(1)}Hz`;
            }
          }
        },
        title: {
          display: true,
          text: "Frequency Spectrum Comparison - Aliased vs Recovered",
          font: { size: 16, weight: 'bold' },
          padding: { bottom: 20 }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    };
    
    return (
      <div style={{ height: '450px', marginBottom: '30px' }}>
        <Line data={data} options={options} />
      </div>
    );
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.card}>
        <h1 style={styles.title}>🎙️ Voice Gender Classifier + Aliasing + Recovery</h1>
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
                <span style={{ color: result.gender === "Male" ? "blue" : result.gender === "Female" ? "deeppink" : "gray" }}>
                  {result.gender}
                </span>
              </h2>
            </div>

            <div style={{ marginTop: "20px" }}>
              <h4>Frequency Spectrum (Original) - 0-5kHz Range</h4>
              {renderSpectrum(result.spectrum, "Original Spectrum", "#2055c0", 5000)}
            </div>

            <div style={{ marginTop: "40px" }}>
              <h3>🎚️ Aliasing Control</h3>
              <label htmlFor="freqRange" style={{ fontWeight: "600" }}>
                Sampling Frequency (must be below Nyquist):
              </label>
              <input
                id="freqRange"
                type="range"
                min="1000"
                max={Math.floor(result.sampling_rate / 2) - 100}
                step="500"
                value={freq}
                onChange={(e) => setFreq(e.target.value)}
                style={{ width: "100%" }}
              />
              <p>Sampling Frequency: {freq} Hz</p>

              <button style={{ ...styles.button, backgroundColor: "#ff7b00" }} onClick={handleAliasing} disabled={loading}>
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
                <span style={{ color: aliasedResult.gender === "Male" ? "blue" : aliasedResult.gender === "Female" ? "deeppink" : "gray" }}>
                  {aliasedResult.gender}
                </span>
              </h2>
            </div>

            <div style={{ marginTop: "20px" }}>
              <h4>Frequency Spectrum (Aliased) - 0-5kHz Range</h4>
              {renderSpectrum(aliasedResult.spectrum, "Aliased Spectrum", "#ff6600", 5000)}
            </div>

            <button style={{ ...styles.button, backgroundColor: "#008f39", marginTop: "30px" }} onClick={handleRecover} disabled={loading}>
              {loading ? "Recovering..." : "Recover Original (Anti-Aliasing)"}
            </button>
          </>
        )}

        {recoveredUrl && recoveredResult && (
          <>
            <audio controls src={recoveredUrl} style={{ width: "100%", marginTop: "20px" }} />
            <div style={styles.resultBox}>
              <h3>Recovered File: {recoveredResult.filename}</h3>
              {recoveredResult.recovered_sr && <p>Recovered SR: {recoveredResult.recovered_sr} Hz</p>}
              <h2>
                Gender After Recovery:{" "}
                <span style={{ color: recoveredResult.gender === "Male" ? "blue" : recoveredResult.gender === "Female" ? "deeppink" : "gray" }}>
                  {recoveredResult.gender}
                </span>
              </h2>
            </div>

            <div style={{ marginTop: "20px" }}>
              <h4>Frequency Spectrum Comparison (Aliased vs Recovered)</h4>
              <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px" }}>
                <span style={{ color: "#ff4444", fontWeight: "bold" }}>Red:</span> Original Aliased Spectrum • 
                <span style={{ color: "#00aa33", fontWeight: "bold" }}> Green:</span> After Anti-Aliasing Recovery
              </p>
              {renderComparisonSpectrum()}
              
              {/* Individual spectra for detailed inspection */}
              <div style={{ marginTop: "40px" }}>
                <h4>Individual Spectra - 0-5kHz Range</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "15px" }}>
                  <div>
                    <h5 style={{ color: "#ff4444" }}>Aliased Spectrum</h5>
                    {renderSpectrum(originalAliasedSpectrum, "Aliased", "#ff4444", 5000)}
                  </div>
                  <div>
                    <h5 style={{ color: "#00aa33" }}>Recovered Spectrum</h5>
                    {renderSpectrum(recoveredResult.spectrum_after, "Recovered", "#00aa33", 5000)}
                  </div>
                </div>
              </div>
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
    padding: "20px 0" 
  },
  card: { 
    background: "#fff", 
    borderRadius: "20px", 
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)", 
    padding: "40px", 
    textAlign: "center", 
    maxWidth: "1200px", 
    width: "95%" 
  },
  title: { 
    fontSize: "26px", 
    marginBottom: "10px", 
    color: "#001f3f" 
  },
  button: { 
    marginTop: "15px", 
    padding: "10px 20px", 
    backgroundColor: "#2055c0", 
    color: "white", 
    border: "none", 
    borderRadius: "8px", 
    cursor: "pointer", 
    fontWeight: "600",
    transition: "background-color 0.2s",
  },
  resultBox: { 
    marginTop: "20px", 
    background: "#f9f9f9", 
    padding: "15px", 
    borderRadius: "10px", 
    border: "1px solid #ddd" 
  },
};

export default VoiceGenderPage;