import React, { useState } from "react";
import axios from "axios";

export default function SARPage() {
  const [vvFile, setVvFile] = useState(null);
  const [vhFile, setVhFile] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vvFile || !vhFile) return alert("Please upload both VV and VH files.");

    const formData = new FormData();
    formData.append("vv_file", vvFile);
    formData.append("vh_file", vhFile);

    setLoading(true);
    setResultImage(null);

    try {
      const res = await axios.post("http://localhost:8000/api/sar/classify", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob",
      });

      const imageUrl = URL.createObjectURL(res.data);
      setResultImage(imageUrl);
    } catch (err) {
      console.error(err);
      alert("Classification failed!");
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
      {/* LEFT: Upload and results */}
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
          SAR Land Classification
        </h1>

        {/* Upload Form */}
        <form onSubmit={handleSubmit} style={{ maxWidth: 500 }}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: 6,
                color: "#2055c0",
              }}
            >
              VV Polarization (.tiff)
            </label>
            <input
              type="file"
              accept=".tiff"
              onChange={(e) => setVvFile(e.target.files[0])}
              style={{
                padding: "10px",
                border: "1px solid #b7cdfc",
                borderRadius: 7,
                background: "#fafeff",
                width: "100%",
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: 6,
                color: "#2055c0",
              }}
            >
              VH Polarization (.tiff)
            </label>
            <input
              type="file"
              accept=".tiff"
              onChange={(e) => setVhFile(e.target.files[0])}
              style={{
                padding: "10px",
                border: "1px solid #b7cdfc",
                borderRadius: 7,
                background: "#fafeff",
                width: "100%",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? "#b3b3b3" : "#2055c0",
              color: "#fff",
              padding: "10px 18px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              transition: "background 0.3s",
            }}
          >
            {loading ? "Processing..." : "Classify"}
          </button>
        </form>

        {/* Result Image */}
        {resultImage && (
          <div style={{ marginTop: 30 }}>
            <h3 style={{ color: "#263357", fontWeight: 700, marginBottom: 12 }}>
              Classification Result
            </h3>
            <img
              src={resultImage}
              alt="SAR Classification Result"
              style={{
                maxWidth: "100%",
                border: "2px solid #dbe2ef",
                borderRadius: 10,
                boxShadow: "0 3px 8px rgba(0,0,0,0.1)",
              }}
            />

            {/* ✅ Color Legend */}
            <div
              style={{
                marginTop: 16,
                background: "#ffffff",
                borderRadius: 8,
                padding: "12px 16px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                maxWidth: 300,
              }}
            >
              <h4
                style={{
                  margin: "0 0 8px 0",
                  fontWeight: 600,
                  color: "#2055c0",
                }}
              >
                Color Legend
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      backgroundColor: "green",
                      borderRadius: 3,
                      border: "1px solid #ccc",
                    }}
                  ></div>
                  <span style={{ color: "#333" }}>Vegetation</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      backgroundColor: "red",
                      borderRadius: 3,
                      border: "1px solid #ccc",
                    }}
                  ></div>
                  <span style={{ color: "#333" }}>Urban Areas</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      backgroundColor: "blue",
                      borderRadius: 3,
                      border: "1px solid #ccc",
                    }}
                  ></div>
                  <span style={{ color: "#333" }}>Water Bodies</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Info panel */}
      <div
        style={{
          flex: 3,
          padding: "28px",
          background: "#f9fbff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#2055c0",
            marginBottom: 16,
          }}
        >
          How It Works
        </h2>
        <p style={{ color: "#4a5568", fontSize: 15, lineHeight: 1.6 }}>
          This tool performs **land classification** on **Sentinel-1 SAR images**
          using VV and VH polarization bands.
        </p>

        <ul style={{ marginTop: 12, color: "#4a5568", fontSize: 14 }}>
          <li>Upload the corresponding VV and VH `.tiff` files.</li>
          <li>Click <b>Classify</b> to start processing.</li>
          <li>
            Once complete, the resulting land classification map will appear on
            the left with its color meaning.
          </li>
        </ul>

        <div
          style={{
            marginTop: "auto",
            color: "#8d97b6",
            fontSize: 13,
            textAlign: "center",
            borderTop: "1px solid #dbe2ef",
            paddingTop: 12,
          }}
        >
          © 2025 SAR Classification Viewer
        </div>
      </div>
    </div>
  );
}
