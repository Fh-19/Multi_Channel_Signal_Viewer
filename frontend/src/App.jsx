import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import MainPage from "./pages/MainPage.jsx";
import ECGPage from "./pages/ECGPage.jsx";
import EEGPage from "./pages/EEGPage.jsx";
import ApiPage from "./pages/ApiPage.jsx";
import SentinelMap from "./pages/SentinelMap.jsx";
import DopplerPage from "./pages/DopplerPage.jsx";

function App() {
  return (
    <Router>
      <div style={styles.app}>
        {/* Home Button (top-left, not overlapping content) */}
        <Link to="/" style={styles.homeButton}>
          {/* Inline SVG home icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginRight: "1px" }}
          >
            <path d="M3 9L12 2l9 7" />
            <path d="M9 22V12h6v10" />
          </svg>
        </Link>

        {/* Page Routes */}
        <div style={styles.pageContent}>
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/ecg" element={<ECGPage />} />
            <Route path="/eeg" element={<EEGPage />} />
            <Route path="/api" element={<ApiPage />} />
            <Route path="/map" element={<SentinelMap />} />
            <Route path="/doppler" element={<DopplerPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

const styles = {
  app: {
    fontFamily: "'Segoe UI', sans-serif", // ✅ Font change
    position: "relative",
    minHeight: "100vh",
  },
  homeButton: {
    position: "fixed",
    top: "10px",
    left: "15px",
    display: "flex",
    alignItems: "center",
    backgroundColor: "#001f3f", // navy blue
    color: "white",
    padding: "10px 10px",
    borderRadius: "6px",
    textDecoration: "none",
    fontWeight: "600",
    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
    transition: "background-color 0.3s ease",
    zIndex: 1000, // ensures it stays above page content but not overlapping
  },
  pageContent: {
    paddingTop: "50px", // keeps page content pushed down
    backgroundColor: "#f0f4f8",
  },
};

export default App;
