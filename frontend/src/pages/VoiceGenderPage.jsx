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
  Title,
  Filler
} from "chart.js";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Title, Filler);

const VoiceGenderPage = () => {
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [aliasedResult, setAliasedResult] = useState(null);
  const [recoveredResult, setRecoveredResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [freq, setFreq] = useState(8000);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setResult(null);
    setAliasedResult(null);
    setRecoveredResult(null);
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
      // setFreq(Math.floor(res.data.sampling_rate / 4));
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
    } catch (err) {
      console.error(err);
      alert("Recovery error. Check backend.");
    } finally {
      setLoading(false);
    }
  };

  // Process spectrum data for better visualization
  const processSpectrumData = (spectrumData, maxFrequency = 5000) => {
    if (!spectrumData || !spectrumData.freqs || !spectrumData.magnitude) return null;
    
    let freqs = spectrumData.freqs;
    let magnitude = spectrumData.magnitude;
    
    // Filter to show only meaningful frequency range for voice
    if (maxFrequency && freqs.length > 0) {
      const cutoffIndex = freqs.findIndex(freq => freq > maxFrequency);
      if (cutoffIndex !== -1) {
        freqs = freqs.slice(0, cutoffIndex);
        magnitude = magnitude.slice(0, cutoffIndex);
      }
    }
    
    // Reduce data points for better performance while maintaining accuracy
    // Keep more points in lower frequencies where voice signals are concentrated
    const targetPoints = 800; // Increased for better resolution
    const reductionFactor = Math.max(1, Math.floor(freqs.length / targetPoints));
    
    if (reductionFactor > 1) {
      const reducedFreqs = [];
      const reducedMagnitude = [];
      
      // Use averaging to reduce noise and show clearer signal
      for (let i = 0; i < freqs.length; i += reductionFactor) {
        const chunkFreqs = freqs.slice(i, i + reductionFactor);
        const chunkMagnitude = magnitude.slice(i, i + reductionFactor);
        
        // Use average frequency and max magnitude for better signal visibility
        const avgFreq = chunkFreqs.reduce((a, b) => a + b, 0) / chunkFreqs.length;
        const maxMag = Math.max(...chunkMagnitude);
        
        reducedFreqs.push(Number(avgFreq.toFixed(1)));
        reducedMagnitude.push(Math.round(maxMag));
      }
      
      freqs = reducedFreqs;
      magnitude = reducedMagnitude;
    }
    
    return { freqs, magnitude };
  };

  const renderSpectrum = (spectrumData, label, color = "#2055c0") => {
    if (!spectrumData) return <div style={styles.placeholder}>No spectrum data available</div>;
    
    const processedData = processSpectrumData(spectrumData);
    if (!processedData) return <div style={styles.placeholder}>Error processing spectrum data</div>;

    const data = {
      labels: processedData.freqs,
      datasets: [
        { 
          label, 
          data: processedData.magnitude, 
          borderColor: color,
          backgroundColor: `${color}20`,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2,
          fill: true
        },
      ],
    };
    
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { 
          type: 'linear',
          title: { 
            display: true, 
            text: "Frequency (Hz)",
            font: { size: 12, weight: 'bold' }
          },
          ticks: {
            maxTicksLimit: 12,
            callback: function(value) {
              if (value % 1000 === 0) return value + 'Hz';
              return '';
            }
          },
          grid: {
            color: 'rgba(0,0,0,0.1)',
            drawBorder: true
          }
        },
        y: { 
          type: 'linear',
          title: { 
            display: true, 
            text: "Magnitude",
            font: { size: 12, weight: 'bold' }
          },
          beginAtZero: true,
          ticks: {
            precision: 0
          },
          grid: {
            color: 'rgba(0,0,0,0.1)',
            drawBorder: true
          }
        },
      },
      plugins: { 
        legend: { 
          display: true, 
          position: "top",
          labels: {
            usePointStyle: true,
            padding: 15,
            font: { size: 12 }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleFont: { size: 12 },
          bodyFont: { size: 12 },
          callbacks: {
            title: (context) => `Frequency: ${context[0].parsed.x} Hz`,
            label: (context) => `Magnitude: ${context.parsed.y}`
          }
        },
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      elements: {
        line: {
          borderWidth: 2
        }
      }
    };
    
    return (
      <div style={styles.chartContainer}>
        <Line data={data} options={options} />
      </div>
    );
  };

  return (
    <div style={styles.pageContainer}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Voice Gender Analysis</h1>
        <p style={styles.subtitle}>Audio Processing with Aliasing Effects</p>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Left Panel - Controls */}
        <div style={styles.leftPanel}>
          {/* File Upload Section */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>File Upload</h3>
            <input
              type="file"
              accept=".wav"
              onChange={handleFileChange}
              style={styles.fileInput}
            />
            {audioUrl && (
              <div style={styles.audioSection}>
                <audio controls src={audioUrl} style={styles.audioPlayer} />
              </div>
            )}
            <button 
              style={styles.uploadButton} 
              onClick={handleUpload} 
              disabled={loading || !file}
            >
              {loading ? "Processing..." : "Upload & Analyze"}
            </button>
          </div>

          {/* Original Results */}
          {result && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Original Analysis</h3>
              <div style={styles.infoBox}>
                <p><strong>File:</strong> {result.filename}</p>
                <p><strong>Sample Rate:</strong> {result.sampling_rate} Hz</p>
                <p><strong>Gender:</strong> 
                  <span style={{ 
                    color: result.gender === "Male" ? "#2980b9" : 
                           result.gender === "Female" ? "#e74c3c" : "#7f8c8d",
                    fontWeight: "bold",
                    marginLeft: "8px"
                  }}>
                    {result.gender}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Aliasing Controls */}
          {result && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Aliasing Control</h3>
              <div style={styles.controlBox}>
                <label style={styles.sliderLabel}>
                  Target Sampling Rate: <strong>{freq} Hz</strong>
                </label>
                <input
                  type="range"
                  min="1000"
                  max={Math.floor(result.sampling_rate / 2) - 100}
                  step="100"
                  value={freq}
                  onChange={(e) => setFreq(parseInt(e.target.value))}
                  style={styles.slider}
                />
                <div style={styles.sliderInfo}>
                  <span>1kHz</span>
                  <span>Nyquist: {Math.floor(result.sampling_rate / 2)}Hz</span>
                </div>
                <button 
                  style={styles.warningButton} 
                  onClick={handleAliasing} 
                  disabled={loading}
                >
                  Apply Aliasing
                </button>
              </div>
            </div>
          )}

          {/* Aliased Results */}
          {aliasedResult && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Aliasing Results</h3>
              <div style={styles.infoBox}>
                <p><strong>New Sample Rate:</strong> {aliasedResult.new_sr} Hz</p>
                <p><strong>Gender:</strong> 
                  <span style={{ 
                    color: aliasedResult.gender === "Male" ? "#2980b9" : 
                           aliasedResult.gender === "Female" ? "#e74c3c" : "#7f8c8d",
                    fontWeight: "bold",
                    marginLeft: "8px"
                  }}>
                    {aliasedResult.gender}
                  </span>
                </p>
              </div>
              {aliasedResult.file_url && (
                <div style={styles.audioSection}>
                  <audio controls src={aliasedResult.file_url} style={styles.audioPlayer} />
                </div>
              )}
              <button 
                style={styles.successButton} 
                onClick={handleRecover} 
                disabled={loading}
              >
                Recover Audio
              </button>
            </div>
          )}

          {/* Recovery Results */}
          {recoveredResult && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Recovery Results</h3>
              <div style={styles.infoBox}>
                <p><strong>Gender:</strong> 
                  <span style={{ 
                    color: recoveredResult.gender === "Male" ? "#2980b9" : 
                           recoveredResult.gender === "Female" ? "#e74c3c" : "#7f8c8d",
                    fontWeight: "bold",
                    marginLeft: "8px"
                  }}>
                    {recoveredResult.gender}
                  </span>
                </p>
              </div>
              {recoveredResult.file_url && (
                <div style={styles.audioSection}>
                  <audio controls src={recoveredResult.file_url} style={styles.audioPlayer} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Visualizations */}
        <div style={styles.rightPanel}>
          {/* Original Spectrum */}
          <div style={styles.vizSection}>
            <h3 style={styles.vizTitle}>Original Spectrum (0-5kHz)</h3>
            {result ? (
              renderSpectrum(result.spectrum, "Original Signal", "#3498db")
            ) : (
              <div style={styles.placeholder}>Upload a file to see the frequency spectrum</div>
            )}
          </div>

          {/* Aliased Spectrum */}
          <div style={styles.vizSection}>
            <h3 style={styles.vizTitle}>Aliased Spectrum (0-5kHz)</h3>
            {aliasedResult ? (
              renderSpectrum(aliasedResult.spectrum, "Aliased Signal", "#e74c3c")
            ) : (
              <div style={styles.placeholder}>Apply aliasing to see frequency distortion</div>
            )}
          </div>

          {/* Recovered Spectrum */}
          <div style={styles.vizSection}>
            <h3 style={styles.vizTitle}>Recovered Spectrum (0-5kHz)</h3>
            {recoveredResult ? (
              renderSpectrum(recoveredResult.spectrum_after, "Recovered Signal", "#27ae60")
            ) : (
              <div style={styles.placeholder}>Recover audio to see anti-aliasing results</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  pageContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    padding: "0",
    margin: "0",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  header: {
    background: "rgba(255, 255, 255, 0.95)",
    padding: "20px 40px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    textAlign: "center"
  },
  title: {
    fontSize: "28px",
    margin: "0",
    color: "#2c3e50",
    fontWeight: "600"
  },
  subtitle: {
    fontSize: "14px",
    margin: "5px 0 0 0",
    color: "#7f8c8d"
  },
  mainContent: {
    display: "grid",
    gridTemplateColumns: "400px 1fr",
    height: "calc(100vh - 80px)",
    gap: "0"
  },
  leftPanel: {
    background: "#f8f9fa",
    padding: "20px",
    overflowY: "auto",
    borderRight: "1px solid #e0e0e0"
  },
  rightPanel: {
    background: "#ffffff",
    padding: "20px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "20px"
  },
  section: {
    background: "white",
    padding: "20px",
    borderRadius: "8px",
    marginBottom: "20px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    border: "1px solid #e0e0e0"
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: "600",
    margin: "0 0 15px 0",
    color: "#2c3e50",
    borderBottom: "2px solid #3498db",
    paddingBottom: "8px"
  },
  fileInput: {
    width: "100%",
    padding: "10px",
    border: "2px dashed #bdc3c7",
    borderRadius: "6px",
    marginBottom: "15px",
    fontSize: "14px"
  },
  uploadButton: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#3498db",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease"
  },
  warningButton: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#e67e22",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    marginTop: "10px"
  },
  successButton: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#27ae60",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    marginTop: "10px"
  },
  infoBox: {
    background: "#f8f9fa",
    padding: "15px",
    borderRadius: "6px",
    fontSize: "14px",
    lineHeight: "1.5"
  },
  controlBox: {
    background: "#f8f9fa",
    padding: "15px",
    borderRadius: "6px"
  },
  sliderLabel: {
    display: "block",
    fontSize: "14px",
    marginBottom: "10px",
    color: "#2c3e50",
    fontWeight: "600"
  },
  slider: {
    width: "100%",
    marginBottom: "8px"
  },
  sliderInfo: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    color: "#7f8c8d",
    marginBottom: "15px"
  },
  audioSection: {
    margin: "15px 0"
  },
  audioPlayer: {
    width: "100%",
    borderRadius: "6px"
  },
  vizSection: {
    background: "white",
    padding: "20px",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    border: "1px solid #e0e0e0",
    flex: "1",
    minHeight: "350px"
  },
  vizTitle: {
    fontSize: "16px",
    fontWeight: "600",
    margin: "0 0 15px 0",
    color: "#2c3e50"
  },
  chartContainer: {
    height: "280px",
    width: "100%"
  },
  placeholder: {
    height: "280px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f8f9fa",
    borderRadius: "6px",
    color: "#7f8c8d",
    fontSize: "14px",
    border: "2px dashed #bdc3c7",
    textAlign: "center",
    padding: "20px"
  }
};

// Add hover effects
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  }
  
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;
document.head.appendChild(styleSheet);

export default VoiceGenderPage;