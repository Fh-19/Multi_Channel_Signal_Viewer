import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import ECGPage from "./pages/ECGPage.jsx";
import EEGPage from "./pages/EEGPage.jsx";

function App() {
  return (
    <Router>
      <div className="App">
        <h1>Multi-Channel Signal Viewer</h1>

        {/* Simple navigation */}
        <nav style={{ marginBottom: "20px" }}>
          <Link to="/ecg" style={{ marginRight: "10px" }}>ECG Viewer</Link>
          <Link to="/eeg">EEG Viewer</Link>
        </nav>

        {/* Page routes */}
        <Routes>
          <Route path="/ecg" element={<ECGPage />} />
          <Route path="/eeg" element={<EEGPage />} />
          <Route path="/" element={<ECGPage />} /> {/* default */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
