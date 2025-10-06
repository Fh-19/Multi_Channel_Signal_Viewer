import React, { useState, useRef } from "react";

function ApiPage() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    if (selectedFile) {
      setAudioUrl(URL.createObjectURL(selectedFile));
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a file first!");
    const formData = new FormData();
    formData.append("file", file);
    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error("Error:", error);
      alert("Something went wrong!");
    }
    setLoading(false);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
    audio.onended = () => setIsPlaying(false);
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
      {/* LEFT: Upload + Playback (70%) */}
      <div
        style={{
          flex: 7,
          padding: "20px 28px",
          overflowY: "auto",
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
          Drone / Noise Audio Detection
        </h1>

        {/* Upload */}
        <input
          type="file"
          accept=".wav"
          onChange={handleFileChange}
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 7,
            border: "1px solid #b7cdfc",
            width: "100%",
            maxWidth: 420,
            fontSize: 16,
            background: "#fafeff",
          }}
        />

        <button
          onClick={handleUpload}
          disabled={loading}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: loading ? "#7f93b7" : "#2055c0",
            color: "#fff",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Processing..." : "Upload & Predict"}
        </button>

        {/* Audio playback */}
        {audioUrl && (
          <div style={{ marginTop: 25 }}>
            <h3 style={{ fontWeight: 600, marginBottom: 8, color: "#263357" }}>
              🎵 Uploaded Audio
            </h3>
            <audio ref={audioRef} src={audioUrl} style={{ width: "100%" }} />
            <button
              onClick={togglePlay}
              style={{
                marginTop: 12,
                padding: "8px 16px",
                borderRadius: 6,
                border: "none",
                background: isPlaying ? "#e74c3c" : "#2ecc71",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
          </div>
        )}
      </div>

      {/* RIGHT: Prediction (30%) */}
      <div
        style={{
          flex: 3,
          padding: "20px 24px",
          overflowY: "auto",
          background: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 12, color: "#263357" }}>
          Prediction Result
        </h2>

        {result ? (
          <div>
            <p style={{ fontSize: 15, marginBottom: 8 }}>
              <strong>Predicted Label:</strong> {result.predicted_label}
            </p>
            <p style={{ fontSize: 15, marginBottom: 8 }}>
              <strong>Confidence:</strong>{" "}
              {typeof result.confidence === "number"
                ? `${result.confidence.toFixed(2)}%`
                : result.confidence}
            </p>
          </div>
        ) : (
          <div style={{ color: "#8d97b6" }}>No prediction yet.</div>
        )}
      </div>
    </div>
  );
}

export default ApiPage;
