import { Link } from "react-router-dom";

function MainPage() {
  return (
    <div style={styles.pageContainer}>
      <div style={styles.card}>

        <h1 style={styles.title}>Welcome to our signal viewer</h1>

        <h1 style={styles.title}>Multi-Channel Signal Viewer</h1>

        <p style={styles.subtitle}>Select a page to explore your data:</p>
        <div style={styles.buttons}>
          <Link to="/ecg" style={styles.button}>ECG</Link>
          <Link to="/eeg" style={styles.button}>EEG</Link>
          <Link to="/api" style={styles.button}>Drone Detection</Link>
          <Link to="/map" style={styles.button}>Sentinel Map</Link>
          <Link to="/doppler" style={styles.button}>Doppler Shift</Link>
          <Link to="/sar" style={styles.button}>SAR Classifier</Link>

        </div>
      </div>
    </div>
  );
}

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
    padding: "40px 50px",
    textAlign: "center",
    maxWidth: "450px",
    width: "100%",
  },
  title: {
    fontSize: "28px",
    fontWeight: 700,
    marginBottom: "12px",
    color: "#263357",
  },
  subtitle: {
    fontSize: "16px",
    marginBottom: "25px",
    color: "#555",
  },
  buttons: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  button: {
    padding: "12px 20px",
    backgroundColor: "#2055c0",
    color: "white",
    textDecoration: "none",
    fontSize: "16px",
    borderRadius: "10px",
    fontWeight: 600,
    transition: "0.2s",
    boxShadow: "0 4px 10px rgba(32,85,192,0.3)",
  },
};

export default MainPage;
