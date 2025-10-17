import React, { useState } from "react";
import axios from "axios";

const VoiceGenderPage = () => {
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null); // لتشغيل الصوت
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setResult(null);

    // إنشاء رابط مؤقت لتشغيل الصوت
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setAudioUrl(url);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a .wav file first!");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(
        "http://127.0.0.1:8000/api/voice_gender/predict",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      setResult(res.data);
    } catch (error) {
      console.error(error);
      alert("Error uploading file. Check your backend connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.card}>
        <h1 style={styles.title}>🎙️ Voice Gender Classifier</h1>
        <p style={styles.subtitle}>
          Upload a WAV file to detect the speaker’s gender
        </p>

        <input type="file" accept=".wav" onChange={handleFileChange} />

        {/* 🔊 تشغيل الصوت قبل التحليل */}
        {audioUrl && (
          <div style={{ marginTop: "15px" }}>
            <audio controls src={audioUrl} style={{ width: "100%" }} />
          </div>
        )}

        <button style={styles.button} onClick={handleUpload} disabled={loading}>
          {loading ? "Processing..." : "Upload & Detect"}
        </button>

        {result && (
          <div style={styles.resultBox}>
            <h3>File: {result.filename}</h3>
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
        )}
      </div>
    </div>
  );
};

// 🎨 تنسيقات الصفحة
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
    maxWidth: "500px",
    width: "90%",
  },
  title: {
    fontSize: "26px",
    marginBottom: "10px",
    color: "#001f3f",
  },
  subtitle: {
    color: "#555",
    marginBottom: "20px",
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
  },
  resultBox: {
    marginTop: "30px",
    background: "#f9f9f9",
    padding: "20px",
    borderRadius: "10px",
    border: "1px solid #ddd",
  },
};

export default VoiceGenderPage;
