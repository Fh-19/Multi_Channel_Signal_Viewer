// frontend/src/pages/ECGPage.jsx
import React, { useState, useEffect, useRef } from "react";
import Plot from "react-plotly.js";
import { fetchEcgData, classifyEcgRecord } from "../services/ecgService.jsx";

const DEFAULT_LEAD_NAMES = [
  "I", "II", "III", "aVR", "aVL", "aVF",
  "V1", "V2", "V3", "V4", "V5", "V6"
];

export default function ECGPage() {
  const [leads, setLeads] = useState([0, 1, 2]);
  const [signals, setSignals] = useState([]);
  const [fs, setFs] = useState(500);
  const [leadNames, setLeadNames] = useState(DEFAULT_LEAD_NAMES);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadedFilename, setUploadedFilename] = useState("");
  const [rPeaks, setRPeaks] = useState({});
  const [mode, setMode] = useState(2); // 1 = cycle-by-cycle, 2 = continuous
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef(null);
  const [displaySignals, setDisplaySignals] = useState([]);
  const [displayStart, setDisplayStart] = useState(0);
  const cycleIdxRef = useRef(0);

  // --- New: Classification results ---
  const [classificationResult, setClassificationResult] = useState(null);

  // --- File Upload ---
  const handleFileChange = (e) => {
    setUploadedFiles(Array.from(e.target.files));
  };

  const handleUpload = async () => {
    if (uploadedFiles.length !== 2) {
      alert("Please select both .dat and .hea files.");
      return;
    }
    const formData = new FormData();
    uploadedFiles.forEach((file) => formData.append("files", file));
    const res = await fetch("http://127.0.0.1:8000/api/ecg/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.filename) {
      setUploadedFilename(data.filename);
      alert("Files uploaded!");
    } else {
      alert(data.message || "Upload failed.");
    }
  };

  // --- Normalize R-peaks keys ---
  const normalizeRPeaks = (rp) => {
    if (!rp) return {};
    const out = {};
    for (const k of Object.keys(rp)) {
      const n = Number(k);
      out[n] = Array.isArray(rp[k]) ? rp[k].map(x => Number(x)) : [];
    }
    return out;
  };

  // --- Load ECG from backend ---
  const handleLoad = async () => {
    try {
      if (!uploadedFilename) {
        alert("Please upload an ECG file first.");
        return;
      }
      const data = await fetchEcgData(uploadedFilename, leads);
      setSignals(data.signals || []);
      setFs(data.fs || 500);
      setLeadNames(data.lead_names || DEFAULT_LEAD_NAMES);
      setRPeaks(normalizeRPeaks(data.r_peaks || {}));
      setDisplayStart(0);
      cycleIdxRef.current = 0;

      if (mode === 1) {
        setDisplaySignals(getCycleSignals(data.signals || [], data.r_peaks || {}, leads, 0));
      } else {
        setDisplaySignals(getContinuousSignals(data.signals || [], 0, 1000));
      }
      setIsPlaying(false);
    } catch (err) {
      console.error("Failed to load ECG:", err);
      alert("Failed to load ECG: " + (err.message || err));
    }
  };

  // --- Get signals for current cycle (mode 1) ---
  function getCycleSignals(signals, rPeaks, leads, cycleIdx) {
    const rp = normalizeRPeaks(rPeaks);
    const lead0Peaks = rp[leads[0]] || [];
    if (lead0Peaks.length < 2 || cycleIdx >= lead0Peaks.length - 1) return [];
    const start = lead0Peaks[cycleIdx];
    const end = lead0Peaks[cycleIdx + 1];
    return signals.slice(start, end);
  }

  // --- Get signals for continuous mode (mode 2) ---
  function getContinuousSignals(signals, start, windowSize) {
    return signals.slice(start, start + windowSize);
  }

  // --- Play/Pause/Stop ---
  const handlePlayPause = () => {
    if (isPlaying) {
      stopStreaming();
    } else {
      if (!signals.length) {
        alert("Load a record first");
        return;
      }
      setIsPlaying(true);
      if (mode === 1) playCycle();
      else playContinuous();
    }
  };

  const stopStreaming = () => {
    clearTimeout(timerRef.current);
    setIsPlaying(false);
  };

  // --- Cycle-by-cycle streaming ---
  function playCycle() {
    const rp = normalizeRPeaks(rPeaks);
    const lead0Peaks = rp[leads[0]] || [];
    if (cycleIdxRef.current >= lead0Peaks.length - 1) {
      setIsPlaying(false);
      return;
    }
    setDisplaySignals(getCycleSignals(signals, rPeaks, leads, cycleIdxRef.current));
    timerRef.current = setTimeout(() => {
      cycleIdxRef.current += 1;
      playCycle();
    }, 1000);
  }

  // --- Continuous streaming ---
  function playContinuous() {
    const windowSize = 1000;
    const step = 50; // advance 50 samples (~0.1s at 500Hz) per frame

    setDisplayStart(prev => {
      const newStart = prev + step;
      if (newStart + windowSize >= signals.length) {
        setIsPlaying(false);
        return prev;
      }
      setDisplaySignals(getContinuousSignals(signals, newStart, windowSize));
      return newStart;
    });

    timerRef.current = setTimeout(playContinuous, 50); // update ~20 FPS
  }

  // --- Mode switch ---
  useEffect(() => {
    if (!signals.length) return;
    if (mode === 1) {
      cycleIdxRef.current = 0;
      setDisplaySignals(getCycleSignals(signals, rPeaks, leads, 0));
    } else {
      setDisplayStart(0);
      setDisplaySignals(getContinuousSignals(signals, 0, 1000));
    }
    stopStreaming();
    // eslint-disable-next-line
  }, [mode, signals, rPeaks, leads]);

  // --- Toggle lead ---
  const toggleLead = (idx) => {
    setLeads((prev) => {
      if (prev.includes(idx)) {
        return prev.filter((l) => l !== idx);
      } else if (prev.length < 3) {
        return [...prev, idx];
      } else {
        alert("You can select up to 3 leads only.");
        return prev;
      }
    });
  };

  // --- Build traces for plotting ---
  const xAxis = displaySignals.map((_, i) =>
    mode === 1 ? i / fs : (displayStart + i) / fs
  );
  const rPeaksNormalized = normalizeRPeaks(rPeaks);

  const allTraces = [];
  leads.forEach((leadIdx, i) => {
    const y = displaySignals.map(row => row ? row[i] : null);
    allTraces.push({
      x: xAxis,
      y: y,
      type: "scatter",
      mode: "lines",
      name: leadNames[leadIdx] || `Lead ${leadIdx + 1}`,
      line: { width: 1.2 },
    });

    if (mode === 2) {
      const peaks = rPeaksNormalized[leadIdx] || [];
      const xs = [], ys = [];
      for (const p of peaks) {
        if (p >= displayStart && p < displayStart + displaySignals.length) {
          const relIdx = p - displayStart;
          const row = displaySignals[relIdx];
          const yVal = row ? row[i] : null;
          if (yVal !== null) {
            xs.push((displayStart + relIdx) / fs);
            ys.push(yVal);
          }
        }
      }
      allTraces.push({
        x: xs,
        y: ys,
        type: "scatter",
        mode: "markers+text",
        name: `R-peaks ${leadNames[leadIdx]}`,
        marker: { color: "red", size: 7, symbol: "circle" },
        text: xs.map(() => "R"),
        textposition: "top center",
      });
    }
  });

  // --- Classification ---
 const classifyRecord = async () => {
  try {
    if (!uploadedFilename) {
      alert("Please upload an ECG file first.");
      return;
    }
    const result = await classifyEcgRecord(uploadedFilename, "");
    const { label, confidence } = result;
    setClassificationResult({
      label,
      confidence: confidence * 100 // keep it number, not string
    });
  } catch (err) {
    alert(err.message);
  }
};


  return (
    <div style={{ padding: "20px" }}>
      <h2>ECG Viewer</h2>
      <div style={{ marginBottom: "10px" }}>
        <button onClick={handleLoad}>Load</button>
        <button onClick={handlePlayPause} style={{ marginLeft: "10px" }}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button onClick={stopStreaming} style={{ marginLeft: "10px" }}>
          Stop
        </button>
        <button onClick={classifyRecord} style={{ marginLeft: "10px" }}>
          Analyze
        </button>
      </div>
      <div style={{ marginBottom: "10px" }}>
        <button onClick={() => setMode(1)} style={{ fontWeight: mode === 1 ? "bold" : "normal" }}>
          Mode 1 (Cycle-by-cycle)
        </button>
        <button onClick={() => setMode(2)} style={{ marginLeft: "10px", fontWeight: mode === 2 ? "bold" : "normal" }}>
          Mode 2 (Continuous)
        </button>
      </div>
      <div style={{ marginBottom: "10px" }}>
        {leadNames.map((name, i) => (
          <label key={i} style={{ marginRight: "10px" }}>
            <input
              type="checkbox"
              checked={leads.includes(i)}
              onChange={() => toggleLead(i)}
            />{" "}
            {name}
          </label>
        ))}
      </div>
      <div style={{ marginBottom: "10px" }}>
        <input
          type="file"
          multiple
          accept=".dat,.hea"
          onChange={handleFileChange}
        />
        <button onClick={handleUpload} style={{ marginLeft: "10px" }}>
          Upload ECG Files
        </button>
        {uploadedFilename && (
          <div style={{ marginTop: "10px" }}>
            Uploaded file: {uploadedFilename}
          </div>
        )}
      </div>
      <Plot
        data={allTraces}
        layout={{
          width: 900,
          height: 400,
          margin: { l: 50, r: 20, t: 40, b: 40 },
          title: `ECG Viewer (${mode === 1 ? "Cycle-by-cycle" : "Continuous"})`,
          xaxis: { title: "Time (s)" },
          yaxis: { title: "Amplitude (mV)", autorange: true },
          showlegend: true,
        }}
        config={{ displayModeBar: false }}
      />

      {/* --- Classification Results --- */}
      {classificationResult && (
        <div style={{ marginTop: "20px", padding: "10px", border: "1px solid #ccc", borderRadius: "8px" }}>
          <h3>Analysis Result</h3>
          <p><strong>Label:</strong> {classificationResult.label}</p>
          <p><strong>Confidence:</strong> {classificationResult.confidence}%</p>
        </div>
      )} 

      {classificationResult && (
        <div style={{ marginTop: "20px", fontSize: "1.2em" }}>
          <strong>Prediction:</strong>{" "}
          {classificationResult.confidence < 50 ? "Abnormal ECG" : classificationResult.label}
        </div>
      )}
    </div>
  );
}
