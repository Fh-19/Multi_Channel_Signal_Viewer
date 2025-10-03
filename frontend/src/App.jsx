import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import ECGPage from "./pages/ECGPage.jsx";
import EEGPage from "./pages/EEGPage.jsx";

function App() {
  return (
    <Router>
      <div className="App">
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
