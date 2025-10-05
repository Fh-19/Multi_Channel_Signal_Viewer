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
  const [classificationResult, setClassificationResult] = useState(null);

  const handleFileChange = (e) => setUploadedFiles(Array.from(e.target.files));

  const handleUpload = async () => {
    if (uploadedFiles.length !== 2) {
      alert("Please select both .dat and .hea files.");
      return;
    }
    const formData = new FormData();
    uploadedFiles.forEach((file) => formData.append("files", file));
    const res = await fetch("http://127.0.0.1:8000/api/ecg/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.filename) {
      setUploadedFilename(data.filename);
      alert("Files uploaded!");
    } else {
      alert(data.message || "Upload failed.");
    }
  };

  const normalizeRPeaks = (rp) => {
    if (!rp) return {};
    const out = {};
    for (const k of Object.keys(rp)) {
      const n = Number(k);
      out[n] = Array.isArray(rp[k]) ? rp[k].map(x => Number(x)) : [];
    }
    return out;
  };

  const handleLoad = async () => {
    if (!uploadedFilename) {
      alert("Please upload an ECG file first.");
      return;
    }
    try {
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
      console.error(err);
      alert("Failed to load ECG");
    }
  };

  const getCycleSignals = (signals, rPeaks, leads, cycleIdx) => {
    const rp = normalizeRPeaks(rPeaks);
    const lead0Peaks = rp[leads[0]] || [];
    if (lead0Peaks.length < 2 || cycleIdx >= lead0Peaks.length - 1) return [];
    const start = lead0Peaks[cycleIdx];
    const end = lead0Peaks[cycleIdx + 1];
    return signals.slice(start, end);
  };

  const getContinuousSignals = (signals, start, windowSize) => signals.slice(start, start + windowSize);

  const handlePlayPause = () => {
    if (isPlaying) stopStreaming();
    else {
      if (!signals.length) { alert("Load a record first"); return; }
      setIsPlaying(true);
      mode === 1 ? playCycle() : playContinuous();
    }
  };

  const stopStreaming = () => { clearTimeout(timerRef.current); setIsPlaying(false); };

  const playCycle = () => {
    const rp = normalizeRPeaks(rPeaks);
    const lead0Peaks = rp[leads[0]] || [];
    if (cycleIdxRef.current >= lead0Peaks.length - 1) { setIsPlaying(false); return; }
    setDisplaySignals(getCycleSignals(signals, rPeaks, leads, cycleIdxRef.current));
    timerRef.current = setTimeout(() => { cycleIdxRef.current += 1; playCycle(); }, 1000);
  };

  const playContinuous = () => {
    const windowSize = 1000;
    const step = 50;
    setDisplayStart(prev => {
      const newStart = prev + step;
      if (newStart + windowSize >= signals.length) { setIsPlaying(false); return prev; }
      setDisplaySignals(getContinuousSignals(signals, newStart, windowSize));
      return newStart;
    });
    timerRef.current = setTimeout(playContinuous, 50);
  };

  useEffect(() => {
    if (!signals.length) return;
    if (mode === 1) { cycleIdxRef.current = 0; setDisplaySignals(getCycleSignals(signals, rPeaks, leads, 0)); }
    else { setDisplayStart(0); setDisplaySignals(getContinuousSignals(signals, 0, 1000)); }
    stopStreaming();
  }, [mode, signals, rPeaks, leads]);

  const toggleLead = (idx) => {
    setLeads(prev => prev.includes(idx) ? prev.filter(l => l !== idx) : (prev.length < 3 ? [...prev, idx] : prev));
  };

  const xAxis = displaySignals.map((_, i) => mode === 1 ? i / fs : (displayStart + i) / fs);
  const rPeaksNormalized = normalizeRPeaks(rPeaks);

  const allTraces = [];
  leads.forEach((leadIdx, i) => {
    const y = displaySignals.map(row => row ? row[i] : null);
    allTraces.push({ x: xAxis, y, type: "scatter", mode: "lines", name: leadNames[leadIdx] || `Lead ${leadIdx + 1}`, line: { width: 1.2 } });
    if (mode === 2) {
      const peaks = rPeaksNormalized[leadIdx] || [];
      const xs = [], ys = [];
      for (const p of peaks) {
        if (p >= displayStart && p < displayStart + displaySignals.length) {
          const relIdx = p - displayStart;
          const row = displaySignals[relIdx];
          const yVal = row ? row[i] : null;
          if (yVal !== null) { xs.push((displayStart + relIdx) / fs); ys.push(yVal); }
        }
      }
      allTraces.push({ x: xs, y: ys, type: "scatter", mode: "markers+text", name: `R-peaks ${leadNames[leadIdx]}`, marker: { color: "red", size: 7, symbol: "circle" }, text: xs.map(() => "R"), textposition: "top center" });
    }
  });

  const classifyRecord = async () => {
    if (!uploadedFilename) { alert("Upload a file first"); return; }
    try {
      const result = await classifyEcgRecord(uploadedFilename, "");
      const { label, confidence } = result;
      setClassificationResult({ label, confidence: confidence * 100 });
    } catch (err) { alert(err.message); }
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.card}>
        <h1 style={styles.title}>ECG Viewer</h1>

        <div style={styles.controls}>
          <button onClick={handleLoad}>Load</button>
          <button onClick={handlePlayPause}>{isPlaying ? "Pause" : "Play"}</button>
          <button onClick={stopStreaming}>Stop</button>
          <button onClick={classifyRecord}>Analyze</button>
        </div>

        <div style={styles.controls}>
          <button onClick={() => setMode(1)} style={{ fontWeight: mode === 1 ? "bold" : "normal" }}>Mode 1</button>
          <button onClick={() => setMode(2)} style={{ fontWeight: mode === 2 ? "bold" : "normal", marginLeft: "10px" }}>Mode 2</button>
        </div>

        <div style={styles.controls}>
          {leadNames.map((name, i) => (
            <label key={i} style={{ marginRight: "10px" }}>
              <input type="checkbox" checked={leads.includes(i)} onChange={() => toggleLead(i)} /> {name}
            </label>
          ))}
        </div>

        <div style={styles.controls}>
          <input type="file" multiple accept=".dat,.hea" onChange={handleFileChange} />
          <button onClick={handleUpload} style={{ marginLeft: "10px" }}>Upload ECG Files</button>
        </div>
        {uploadedFilename && <div style={{ marginTop: "10px" }}>Uploaded: {uploadedFilename}</div>}

        <div style={styles.plotContainer}>
          <Plot
            data={allTraces}
            layout={{ width: 900, height: 400, margin: { l: 50, r: 20, t: 40, b: 40 }, title: `ECG Viewer (${mode === 1 ? "Cycle-by-cycle" : "Continuous"})`, xaxis: { title: "Time (s)" }, yaxis: { title: "Amplitude (mV)" }, showlegend: true }}
            config={{ displayModeBar: false }}
          />
        </div>

        {classificationResult && (
          <div style={styles.result}>
            <h3>Analysis Result</h3>
            <p><strong>Label:</strong> {classificationResult.label}</p>
            <p><strong>Confidence:</strong> {classificationResult.confidence}%</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  pageContainer: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    background: "#f0f4f8",
    padding: "20px",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  card: {
    background: "#fff",
    borderRadius: "20px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
    padding: "30px",
    width: "100%",
    maxWidth: "1000px",
    display: "flex",
    flexDirection: "column",
    gap: "15px"
  },
  title: { fontSize: "28px", fontWeight: 700, marginBottom: "10px", textAlign: "center" },
  controls: { display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", marginBottom: "10px" },
  plotContainer: { borderRadius: "15px", overflow: "hidden", boxShadow: "0 4px 15px rgba(0,0,0,0.1)" },
  result: { marginTop: "20px", padding: "15px", border: "1px solid #ccc", borderRadius: "10px", background: "#fafafa" }
};
