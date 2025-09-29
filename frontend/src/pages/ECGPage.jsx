// frontend/src/pages/ECGPage.jsx
import React, { useState, useEffect, useRef } from "react";
import Plot from "react-plotly.js";
import { fetchEcgData } from "../services/ecgService.jsx"; // your service

const ECG_LEAD_NAMES = [
  "I", "II", "III", "aVR", "aVL", "aVF",
  "V1", "V2", "V3", "V4", "V5", "V6"
];

export default function ECGPage() {
  // user controls
  const [recordNumber, setRecordNumber] = useState("98");
  const [leads, setLeads] = useState([0, 1, 2]); // original-lead indices
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // 1x default
  const [loop, setLoop] = useState(true);
  const [mode, setMode] = useState(1); // 1 = cycle streaming, 2 = continuous scrolling
  const [isPlaying, setIsPlaying] = useState(false);

  // backend data
  const [signals, setSignals] = useState([]); // full record (N x L) where L === leads.length
  const [fs, setFs] = useState(500);
  const [rawRPeaks, setRawRPeaks] = useState({}); // from backend: { originalLeadIdx: [sampleIndices] }

  // streaming state
  const [displaySignals, setDisplaySignals] = useState([]); // buffer shown on plot (array of samples)
  const [displayStart, setDisplayStart] = useState(0); // sample index in original record that corresponds to displaySignals[0]

  // refs to keep counters without stale closures
  const timerRef = useRef(null);
  const cycleIdxRef = useRef(0);
  const withinCycleIdxRef = useRef(0);
  const continuousIdxRef = useRef(0);
  const signalsRef = useRef(signals);
  const rPeaksRef = useRef(rawRPeaks);

  // update refs whenever data changes
  useEffect(() => { signalsRef.current = signals; }, [signals]);
  useEffect(() => { rPeaksRef.current = rawRPeaks; }, [rawRPeaks]);

  // Helper: convert backend r_peaks keys to numeric keys
  const normalizeRPeaks = (rp) => {
    if (!rp) return {};
    const out = {};
    for (const k of Object.keys(rp)) {
      const n = Number(k);
      out[n] = Array.isArray(rp[k]) ? rp[k].map(x => Number(x)) : [];
    }
    return out;
  };

  // Load data from backend
  async function handleLoad() {
    setIsPlaying(false);
    clearTimeout(timerRef.current);
    try {
      const data = await fetchEcgData(recordNumber, leads);
      setSignals(data.signals || []);
      setFs(data.fs || 500);
      setRawRPeaks(normalizeRPeaks(data.r_peaks || {}));
      cycleIdxRef.current = 0;
      withinCycleIdxRef.current = 0;
      continuousIdxRef.current = 0;
      setDisplaySignals([]);
      setDisplayStart(0);
      setIsPlaying(true);
    } catch (err) {
      console.error("Failed to load ECG:", err);
      alert("Failed to load ECG: " + (err.message || err));
    }
  }

  // Toggle lead selection (max 3)
  const toggleLead = (idx) => {
    setIsPlaying(false);
    clearTimeout(timerRef.current);
    setLeads(prev => {
      if (prev.includes(idx)) return prev.filter(l => l !== idx);
      if (prev.length >= 3) return prev;
      return [...prev, idx];
    });
  };

  // Stop helper
  const stopStreaming = () => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    setIsPlaying(false);
  };

  // Play/pause toggle
  const handlePlayPause = () => {
    if (isPlaying) {
      stopStreaming();
    } else {
      if (!signals || signals.length === 0) {
        alert("Load a record first");
        return;
      }
      setIsPlaying(true);
    }
  };

  // Clean up on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // === Mode 1: Cycle-by-cycle streaming ===
  useEffect(() => {
    if (!isPlaying || mode !== 1) return;
    if (!signalsRef.current.length) return;

    const refLead = leads.length > 0 ? leads[0] : 0;
    const peaksForRef = rPeaksRef.current[refLead] || [];
    if (!peaksForRef || peaksForRef.length < 2) return;

    const peaks = peaksForRef.slice().map(Number).sort((a,b)=>a-b);
    let cancelled = false;
    cycleIdxRef.current = 0;
    withinCycleIdxRef.current = 0;
    const msPerSample = (1000.0 / fs) / Math.max(0.01, playbackSpeed);

    const step = () => {
      if (cancelled || !isPlaying) return;

      const cIdx = cycleIdxRef.current;
      const start = peaks[cIdx];
      const end = peaks[cIdx + 1];
      const cycleLen = end - start;
      if (cycleLen <= 0) {
        cycleIdxRef.current = (cycleIdxRef.current + 1) % (peaks.length - 1);
        withinCycleIdxRef.current = 0;
        timerRef.current = setTimeout(step, msPerSample);
        return;
      }

      const sIdx = withinCycleIdxRef.current;
      const globalIdx = start + sIdx;
      if (!signalsRef.current[globalIdx]) {
        cycleIdxRef.current = (cycleIdxRef.current + 1) % (peaks.length - 1);
        withinCycleIdxRef.current = 0;
        setDisplaySignals([]);
        setDisplayStart(peaks[cycleIdxRef.current]);
        timerRef.current = setTimeout(step, msPerSample);
        return;
      }

      if (sIdx === 0) {
        setDisplaySignals([]);
        setDisplayStart(start);
      }

      const sampleRow = signalsRef.current[globalIdx];
      setDisplaySignals(prev => prev.concat([sampleRow]));
      withinCycleIdxRef.current += 1;

      if (withinCycleIdxRef.current >= cycleLen) {
        withinCycleIdxRef.current = 0;
        cycleIdxRef.current = (cycleIdxRef.current + 1) % (peaks.length - 1);
        timerRef.current = setTimeout(() => {
          setDisplaySignals([]);
          timerRef.current = setTimeout(step, msPerSample);
        }, 0);
      } else {
        timerRef.current = setTimeout(step, msPerSample);
      }
    };

    timerRef.current = setTimeout(step, 0);
    return () => { cancelled = true; if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying, mode, fs, playbackSpeed, leads]);

  // === Mode 2: Continuous scrolling (1.5s window) ===
  useEffect(() => {
    if (!isPlaying || mode !== 2) return;
    if (!signalsRef.current.length) return;

    let cancelled = false;
    continuousIdxRef.current = 0;
    const bufferMaxSamples = fs * 10; // keep 10s internally
    const displayWindowSamples = Math.round(fs * 1.5); // show 1.5s at a time
    const tickInterval = 100;
    const samplesPerTick = Math.max(1, Math.round((fs * playbackSpeed * tickInterval) / 1000));

    const step = () => {
      if (cancelled || !isPlaying) return;
      const startIdx = continuousIdxRef.current;
      let endIdx = startIdx + samplesPerTick;
      if (endIdx > signalsRef.current.length) endIdx = signalsRef.current.length;

      const chunk = signalsRef.current.slice(startIdx, endIdx);
      setDisplaySignals(prev => {
        let next = prev.concat(chunk);
        if (next.length > bufferMaxSamples) next = next.slice(next.length - bufferMaxSamples);
        const windowStart = Math.max(0, next.length - displayWindowSamples);
        setDisplayStart(continuousIdxRef.current - (next.length - windowStart));
        return next.slice(windowStart);
      });

      continuousIdxRef.current = endIdx;
      if (continuousIdxRef.current >= signalsRef.current.length) {
        if (loop) { continuousIdxRef.current = 0; setDisplaySignals([]); setDisplayStart(0); }
        else { setIsPlaying(false); return; }
      }

      timerRef.current = setTimeout(step, tickInterval);
    };

    timerRef.current = setTimeout(step, 0);
    return () => { cancelled = true; if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying, mode, fs, playbackSpeed, loop, leads]);

  // --- Plot preparation ---
  const xAxis = displaySignals.map((_, i) => mode === 1 ? i/fs : (displayStart + i)/fs);
  const rPeaksNumeric = normalizeRPeaks(rawRPeaks);

  const peaksForLeadInView = (originalLeadIdx) => {
    const allPeaks = rPeaksNumeric[originalLeadIdx] || [];
    if (!allPeaks.length) return { xs: [], ys: [] };
    const colIdx = leads.indexOf(originalLeadIdx);
    if (colIdx === -1) return { xs: [], ys: [] };
    const xs = [], ys = [];
    for (const p of allPeaks) {
      const pNum = Number(p);
      if (pNum >= displayStart && pNum < displayStart + displaySignals.length) {
        const relIdx = pNum - displayStart;
        const row = displaySignals[relIdx];
        const y = row ? row[colIdx] : null;
        if (y !== null) { xs.push(mode === 1 ? relIdx/fs : (displayStart + relIdx)/fs); ys.push(y); }
      }
    }
    return { xs, ys };
  };

  // --- Build merged traces ---
  const leadOffset = 0.0;
  const allTraces = [];
  leads.forEach((origLeadIdx, i) => {
    const y = displaySignals.map(row => row ? row[i] + i*leadOffset : null);
    allTraces.push({ x: xAxis, y, type: "scatter", mode: "lines", name: ECG_LEAD_NAMES[origLeadIdx], line: { width: 1.5 } });
    const peakData = peaksForLeadInView(origLeadIdx);
    const yPeaks = peakData.ys.map(v => v + i*leadOffset);
    allTraces.push({ x: peakData.xs, y: yPeaks, type: "scatter", mode: "markers+text", name: `R-peaks ${ECG_LEAD_NAMES[origLeadIdx]}`, marker: { color: "red", size: 8, symbol: "circle" }, text: peakData.xs.map(() => "R"), textposition: "top center" });
  });

  return (
    <div style={{ padding: "20px" }}>
      <h2>ECG Viewer</h2>

      <div style={{ marginBottom: "10px" }}>
        <label>
          Record number:{" "}
          <input type="text" value={recordNumber} onChange={e => setRecordNumber(e.target.value)} style={{ width: "60px" }} />
        </label>
        <button onClick={handleLoad} style={{ marginLeft: "10px" }}>Load</button>
        <button onClick={handlePlayPause} style={{ marginLeft: "10px" }}>{isPlaying ? "Pause" : "Play"}</button>
        <button onClick={stopStreaming} style={{ marginLeft: "10px" }}>Stop</button>
      </div>

      <div style={{ marginBottom: "10px" }}>
        <button onClick={() => setMode(1)} style={{ fontWeight: mode===1?"bold":"normal" }}>Mode 1 (Cycle-by-cycle)</button>
        <button onClick={() => setMode(2)} style={{ marginLeft:"10px", fontWeight: mode===2?"bold":"normal" }}>Mode 2 (Continuous)</button>
      </div>

      <div style={{ marginBottom: "10px" }}>
        <label>Speed: <input type="number" step="0.1" value={playbackSpeed} onChange={e=>setPlaybackSpeed(Number(e.target.value)||1)} style={{ width:"60px" }} /> x</label>
        <label style={{ marginLeft:"20px" }}>
          <input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)} /> Loop playback
        </label>
      </div>

      <div style={{ marginBottom: "10px" }}>
        {Array.from({length:12}, (_,i)=>(
          <label key={i} style={{ marginRight:"10px" }}>
            <input type="checkbox" checked={leads.includes(i)} onChange={()=>toggleLead(i)} /> {ECG_LEAD_NAMES[i]}
          </label>
        ))}
      </div>

      <Plot
        data={allTraces}
        layout={{
          width: 900,
          height: 400,
          margin: { l: 50, r: 20, t: 40, b: 40 },
          title: `ECG (${mode === 1 ? "Cycle" : "Continuous"})`,
          xaxis: { title: "Time (s)" },
          yaxis: { title: "Amplitude + offset (mV)", autorange: true },
          showlegend: true,
        }}
        config={{ displayModeBar: false }}
      />
    </div>
  );
}
