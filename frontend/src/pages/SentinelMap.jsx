import React from "react";

const SentinelMap = () => {
  return (
    <div style={styles.pageContainer}>
      <div style={styles.card}>
        <h1 style={styles.title}>Sentinel Map</h1>
        <p style={styles.subtitle}>Interactive map of Sentinel satellite data</p>
        <div style={styles.mapContainer}>
          <iframe
            src="http://127.0.0.1:8000/api/radar/sentinel-map"
            title="Sentinel Map"
            style={styles.iframe}
          />
        </div>
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
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    padding: "20px",
  },
  card: {
    background: "#fff",
    borderRadius: "20px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
    padding: "30px",
    maxWidth: "1000px",
    width: "100%",
    height: "80vh",
    display: "flex",
    flexDirection: "column",
  },
  title: {
    fontSize: "28px",
    fontWeight: 700,
    marginBottom: "10px",
    color: "#263357",
    textAlign: "center",
  },
  subtitle: {
    fontSize: "16px",
    marginBottom: "20px",
    color: "#555",
    textAlign: "center",
  },
  mapContainer: {
    flex: 1,
    borderRadius: "15px",
    overflow: "hidden",
    boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
  },
  iframe: {
    width: "100%",
    height: "100%",
    border: "none",
  },
};

export default SentinelMap;
