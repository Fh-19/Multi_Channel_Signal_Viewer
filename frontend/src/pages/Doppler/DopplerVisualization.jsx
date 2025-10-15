import React, { useEffect } from "react";
import Plot from "react-plotly.js";

export default function DopplerVisualization({ 
  waveform, 
  prediction, 
  audioUrl, 
  playingUploaded, 
  setPlayingUploaded 
}) {
  // Clean up audio URL when component unmounts
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Play uploaded audio from visualization panel
  const handlePlayUploaded = () => {
    if (!audioUrl) return;
    
    setPlayingUploaded(true);
    const audio = new Audio(audioUrl);
    
    audio.onended = () => {
      setPlayingUploaded(false);
    };
    
    audio.onerror = () => {
      setPlayingUploaded(false);
    };
    
    audio.play().catch(err => {
      setPlayingUploaded(false);
    });
  };

  return (
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

      {/* Play button in visualization panel */}
      {audioUrl && (
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={handlePlayUploaded}
            disabled={playingUploaded}
            style={{
              background: playingUploaded ? "#8d97b6" : "#28a745",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontWeight: 600,
              fontSize: "14px",
            }}
          >
            {playingUploaded ? "🔊 Playing Uploaded Audio..." : "▶ Play Uploaded Audio"}
          </button>
        </div>
      )}

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
  );
}