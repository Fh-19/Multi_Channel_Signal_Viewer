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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md text-center">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">
          🛰 Drone / Noise Detection
        </h2>

        <label className="block mb-4">
          <input
            type="file"
            accept=".wav"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-700 
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-100 file:text-blue-700
              hover:file:bg-blue-200 cursor-pointer"
          />
        </label>

        <button
          onClick={handleUpload}
          disabled={loading}
          className={`w-full py-2 px-4 rounded-lg text-white font-semibold transition
            ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {loading ? "Processing..." : "Upload & Predict"}
        </button>

        {audioUrl && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              🎵 Uploaded Audio
            </h3>
            <audio ref={audioRef} src={audioUrl} className="w-full mt-2" />
            <button
              onClick={togglePlay}
              className="mt-3 bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg transition"
            >
              {isPlaying ? "⏸ Pause" : "▶️ Play"}
            </button>
          </div>
        )}

        {result && (
          <div className="mt-8 border-t pt-5">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              📊 Prediction Result
            </h3>
            <p className="text-gray-600">
              <strong>Predicted Label:</strong> {result.predicted_label}
            </p>
            <p className="text-gray-600">
              <strong>Confidence:</strong>{" "}
              {typeof result.confidence === "number"
                ? `${result.confidence.toFixed(2)}%`
                : result.confidence}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ApiPage;
