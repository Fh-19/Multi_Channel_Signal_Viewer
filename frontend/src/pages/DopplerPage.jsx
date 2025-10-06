import React, { useState } from "react";
import Plot from "react-plotly.js";
import { generateDoppler, analyzeDopplerFile } from "../services/dopplerService";

export default function DopplerPage() {
  const [frequency, setFrequency] = useState(1000);
  const [speed, setSpeed] = useState(30);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // --- Generate Doppler WAV ---
  const handleGenerate = async () => {
    setError(null);
    try {
      const blob = await generateDoppler(frequency, speed);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `doppler_${frequency}Hz_${speed}mps.wav`;
      a.click();
    } catch (err) {
      setError(err.message);
    }
  };

  // --- Analyze uploaded WAV ---
  const handleAnalyze = async (e) => {
    setError(null);
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const result = await analyzeDopplerFile(file);
      setAnalysisResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
      {/* LEFT SIDE: Controls */}
      <div
        style={{
          flex: 3,
          padding: "28px",
          borderRight: "2px solid #dbe2ef",
          display: "flex",
          flexDirection: "column",
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
          Doppler Signal Generator & Analyzer
        </h1>

        {/* Generate Section */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ color: "#2055c0", marginBottom: 10 }}>Generate Doppler WAV</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <label style={{ fontSize: 15 }}>
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

            <label style={{ fontSize: 15 }}>
              Speed (m/s):{" "}
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

            <button
              onClick={handleGenerate}
              style={{
                background: "#2055c0",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Generate WAV
            </button>
          </div>
        </div>

        {/* Analyze Section */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ color: "#2055c0", marginBottom: 10 }}>Analyze Doppler File</h3>
          <input
            type="file"
            accept=".wav"
            onChange={handleAnalyze}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid #ccc",
              background: "#fafeff",
              width: "100%",
              maxWidth: 300,
            }}
          />

          {loading && (
            <p style={{ marginTop: 10, color: "#8d97b6" }}>Analyzing file...</p>
          )}
          {error && (
            <p style={{ marginTop: 10, color: "red" }}>Error: {error}</p>
          )}
        </div>

        {/* Result */}
        {analysisResult && (
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "16px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <h3 style={{ color: "#2055c0", marginBottom: 10 }}>Analysis Result</h3>
            <p>
              <strong>Is Doppler Signal:</strong>{" "}
              {analysisResult.is_doppler ? "✅ Yes" : "❌ No"}
            </p>
            <p>
              <strong>Trend:</strong> {analysisResult.trend}
            </p>
            <p>
              <strong>Average Frequency:</strong>{" "}
              {analysisResult.freq_mean?.toFixed(2)} Hz
            </p>
            <p>
              <strong>Estimated Speed:</strong>{" "}
              {analysisResult.speed_est?.toFixed(2)} m/s
            </p>
          </div>
        )}
      </div>

      {/* RIGHT SIDE: Visualization */}
      <div
        style={{
          flex: 5,
          padding: "28px",
          overflowY: "auto",
        }}
      >
        <h2
          style={{
            marginBottom: 16,
            color: "#263357",
            fontWeight: 700,
            fontSize: 22,
          }}
        >
          Doppler Visualization
        </h2>

        {analysisResult && analysisResult.freq_series ? (
          <Plot
            data={[
              {
                x: analysisResult.time_series,
                y: analysisResult.freq_series,
                type: "scatter",
                mode: "lines",
                line: { color: "#2055c0", width: 2 },
                name: "Instantaneous Frequency",
              },
            ]}
            layout={{
              height: 400,
              margin: { t: 20, l: 50, r: 20, b: 40 },
              xaxis: { title: "Time (s)" },
              yaxis: { title: "Frequency (Hz)" },
            }}
            config={{ responsive: true, displaylogo: false }}
            style={{ width: "100%" }}
          />
        ) : (
          <div
            style={{
              color: "#8d97b6",
              fontSize: 16,
              marginTop: 40,
              textAlign: "center",
            }}
          >
            Upload a Doppler WAV file to see the analysis visualization here.
          </div>
        )}
      </div>
    </div>
  );
}
