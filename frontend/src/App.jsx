import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import ECGPage from "./pages/ECGPage.jsx";
import EEGPage from "./pages/EEGPage.jsx";
import ApiPage from "./pages/ApiPage.jsx";
import SentinelMap from "./pages/SentinelMap.jsx";
function App() {
  return (
    <Router>
      <div className="App">
        {/* ✅ Navigation Bar */}
        <nav style={styles.navbar}>
          <Link to="/ecg" style={styles.link}>ECG</Link>
          <Link to="/eeg" style={styles.link}>EEG</Link>
          <Link to="/api" style={styles.link}>API</Link>
           <Link to="/map" style={styles.link}>MAP</Link>
       </nav>

        {/* ✅ Page Routes */}
        <Routes>
          <Route path="/ecg" element={<ECGPage />} />
          <Route path="/eeg" element={<EEGPage />} />
          <Route path="/api" element={<ApiPage />} />
          <Route path="/map" element={<SentinelMap />} />
          <Route path="/" element={<ApiPage />} /> {/* default page */}
        </Routes>
      </div>
    </Router>
  );
}

const styles = {
  navbar: {
    display: "flex",
    justifyContent: "center",
    gap: "20px",
    padding: "15px",
    backgroundColor: "#282c34",
  },
  link: {
    color: "white",
    textDecoration: "none",
    fontSize: "18px",
    fontWeight: "bold",
  },
};

export default App;
