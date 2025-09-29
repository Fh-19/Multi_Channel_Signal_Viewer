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

  // Load data from backend (explicit load button recommended)
  async function handleLoad() {
    setIsPlaying(false);
    clearTimeout(timerRef.current);
    try {
      const data = await fetchEcgData(recordNumber, leads);
      // backend returns signals with only selected leads as columns (N x L)
      setSignals(data.signals || []);
      setFs(data.fs || 500);
      setRawRPeaks(normalizeRPeaks(data.r_peaks || {}));
      // reset streaming pointers
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
      // start (requires data)
      if (!signals || signals.length === 0) {
        alert("Load a record first");
        return;
      }
      setIsPlaying(true);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // === Mode 1: Cycle-by-cycle streaming (each cycle is drawn sample-by-sample and then cleared) ===
  useEffect(() => {
    if (!isPlaying || mode !== 1) return;
    if (!signalsRef.current || signalsRef.current.length === 0) return;

    // reference lead for cycle boundaries is the first selected lead
    const refLead = leads.length > 0 ? leads[0] : 0;
    const peaksForRef = (rPeaksRef.current && rPeaksRef.current[refLead]) ? rPeaksRef.current[refLead] : [];

    if (!peaksForRef || peaksForRef.length < 2) {
      console.warn("Not enough peaks to do cycle streaming on lead", refLead);
      return;
    }

    // ensure indices are numeric and sorted
    const peaks = peaksForRef.slice().map(x => Number(x)).sort((a,b)=>a-b);

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

      // Append next sample in cycle
      const sIdx = withinCycleIdxRef.current;
      const globalIdx = start + sIdx;
      // guard
      if (!signalsRef.current[globalIdx]) {
        // if out of bounds, move to next cycle
        cycleIdxRef.current = (cycleIdxRef.current + 1) % (peaks.length - 1);
        withinCycleIdxRef.current = 0;
        setDisplaySignals([]); // clear
        setDisplayStart(peaks[cycleIdxRef.current]);
        timerRef.current = setTimeout(step, msPerSample);
        return;
      }

      // If sIdx == 0, start new cycle: clear buffer and set displayStart
      if (sIdx === 0) {
        setDisplaySignals([]);
        setDisplayStart(start);
      }

      // append the sampleRow (selected-leads only)
      const sampleRow = signalsRef.current[globalIdx];
      setDisplaySignals(prev => {
        // small optimization: avoid huge arrays — cycle limited by cycleLen anyway
        const next = prev.concat([sampleRow]);
        return next;
      });

      withinCycleIdxRef.current += 1;

      if (withinCycleIdxRef.current >= cycleLen) {
        // end of cycle: clear (user requested immediate erase) and go to next cycle
        withinCycleIdxRef.current = 0;
        cycleIdxRef.current = (cycleIdxRef.current + 1) % (peaks.length - 1);
        // clear after a tiny pause so plot can show cycle end (0ms ok)
        timerRef.current = setTimeout(() => {
          setDisplaySignals([]); // erase current cycle
          // then schedule next cycle start
          timerRef.current = setTimeout(step, msPerSample);
        }, 0);
      } else {
        timerRef.current = setTimeout(step, msPerSample);
      }
    };

    // start streaming
    timerRef.current = setTimeout(step, 0);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, mode, fs, playbackSpeed, leads]); // depends on leads (refLead might change)

  // === Mode 2: Continuous scrolling (append and scroll, no reset) ===
  useEffect(() => {
    if (!isPlaying || mode !== 2) return;
    if (!signalsRef.current || signalsRef.current.length === 0) return;

    let cancelled = false;
    continuousIdxRef.current = 0;
    setDisplaySignals([]); // start fresh
    setDisplayStart(0);

    const msPerSample = (1000.0 / fs) / Math.max(0.01, playbackSpeed);
    const bufferMaxSamples = Math.max(1, Math.round(fs * 10)); // keep last 10s by default

    const step = () => {
      if (cancelled || !isPlaying) return;

      const idx = continuousIdxRef.current;
      if (idx >= signalsRef.current.length) {
        // end of record
        if (loop) {
          continuousIdxRef.current = 0;
          setDisplaySignals([]);
          setDisplayStart(0);
          timerRef.current = setTimeout(step, msPerSample);
          return;
        } else {
          setIsPlaying(false);
          return;
        }
      }

      const sampleRow = signalsRef.current[idx];
      setDisplaySignals(prev => {
        const next = prev.concat([sampleRow]);
        if (next.length > bufferMaxSamples) {
          // shift window
          setDisplayStart(prevStart => prevStart + (next.length - bufferMaxSamples));
          return next.slice(next.length - bufferMaxSamples);
        }
        return next;
      });

      continuousIdxRef.current += 1;
      timerRef.current = setTimeout(step, msPerSample);
    };

    timerRef.current = setTimeout(step, 0);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, mode, fs, playbackSpeed, loop, leads]);


  // --- Build traces for plotting ---
  // displaySignals: array of rows, each row is columns for the selected leads in the same order as `leads`
  // displayStart: absolute index in original record of displaySignals[0]

  // prepare x axis base
  const xAxis = displaySignals.map((_, i) => {
    if (mode === 1) {
      // cycle mode -> start time at 0 for each cycle
      return i / fs;
    } else {
      // continuous -> absolute time starting from displayStart
      return (displayStart + i) / fs;
    }
  });

  // rPeaks parsing to use numeric keys (in case backend JSON turned them into strings)
  const rPeaksNumeric = normalizeRPeaks(rawRPeaks);

  // function to compute peaks to show for a given lead (original lead index)
  const peaksForLeadInView = (originalLeadIdx) => {
    const allPeaks = rPeaksNumeric[originalLeadIdx] || [];
    if (!allPeaks || allPeaks.length === 0) return { xs: [], ys: [] };

    // Map originalLeadIdx to column index in displaySignals: find leads.indexOf(originalLeadIdx)
    const colIdx = leads.indexOf(originalLeadIdx);
    if (colIdx === -1) return { xs: [], ys: [] }; // this lead not currently requested

    const xs = [];
    const ys = [];

    // For each absolute peak p, check if it falls into visible window (displayStart .. displayStart + displaySignals.length - 1)
    for (const p of allPeaks) {
      const pNum = Number(p);
      const inWindow = (pNum >= displayStart) && (pNum < displayStart + displaySignals.length);
      if (inWindow) {
        const relativeIdx = pNum - displayStart;
        const x = (mode === 1) ? (relativeIdx / fs) : ((displayStart + relativeIdx) / fs);
        // y value: if displaySignals has that sample, take it
        const row = displaySignals[relativeIdx];
        const y = row ? row[colIdx] : null;
        if (y !== null && y !== undefined) {
          xs.push(x);
          ys.push(y);
        }
      }
    }
    return { xs, ys };
  };

  // Plot lead traces & peaks
  const plots = leads.map((origLeadIdx, i) => {
    // col index in displaySignals is i (because backend returned columns in the same order as leads array)
    const y = displaySignals.map(row => row ? row[i] : null);
    const traceSignal = {
      x: xAxis,
      y: y,
      type: "scatter",
      mode: "lines",
      name: `${ECG_LEAD_NAMES[origLeadIdx] || "L" + origLeadIdx}`
    };

    const peakData = peaksForLeadInView(origLeadIdx);
    const tracePeaks = {
      x: peakData.xs,
      y: peakData.ys,
      mode: "markers+text",
           type: "scatter",
      name: `R-peaks ${ECG_LEAD_NAMES[origLeadIdx] || "L" + origLeadIdx}`,
      marker: { color: "red", size: 8, symbol: "circle" },
      text: peakData.xs.map(() => "R"),
      textposition: "top center",
    };

    return (
      <Plot
        key={origLeadIdx}
        data={[traceSignal, tracePeaks]}
        layout={{
          width: 900,
          height: 250,
          margin: { l: 40, r: 20, t: 40, b: 40 },
          title: `${ECG_LEAD_NAMES[origLeadIdx] || "Lead " + origLeadIdx} (${mode === 1 ? "Cycle" : "Continuous"})`,
          xaxis: { title: "Time (s)" },
          yaxis: { title: "Amplitude" },
        }}
        config={{ displayModeBar: false }}
      />
    );
  });

  return (
    <div style={{ padding: "20px" }}>
      <h2>ECG Viewer</h2>

      <div style={{ marginBottom: "10px" }}>
        <label>
          Record number:{" "}
          <input
            type="text"
            value={recordNumber}
            onChange={(e) => setRecordNumber(e.target.value)}
            style={{ width: "60px" }}
          />
        </label>
        <button onClick={handleLoad} style={{ marginLeft: "10px" }}>
          Load
        </button>
        <button onClick={handlePlayPause} style={{ marginLeft: "10px" }}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button onClick={stopStreaming} style={{ marginLeft: "10px" }}>
          Stop
        </button>
      </div>

      <div style={{ marginBottom: "10px" }}>
        <button
          onClick={() => setMode(1)}
          style={{ fontWeight: mode === 1 ? "bold" : "normal" }}
        >
          Mode 1 (Cycle-by-cycle)
        </button>
        <button
          onClick={() => setMode(2)}
          style={{ marginLeft: "10px", fontWeight: mode === 2 ? "bold" : "normal" }}
        >
          Mode 2 (Continuous)
        </button>
      </div>

      <div style={{ marginBottom: "10px" }}>
        <label>
          Speed:{" "}
          <input
            type="number"
            step="0.1"
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value) || 1)}
            style={{ width: "60px" }}
          />{" "}
          x
        </label>
        <label style={{ marginLeft: "20px" }}>
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => setLoop(e.target.checked)}
          />
          Loop playback
        </label>
      </div>

      <div style={{ marginBottom: "10px" }}>
        {Array.from({ length: 12 }, (_, i) => (
          <label key={i} style={{ marginRight: "10px" }}>
            <input
              type="checkbox"
              checked={leads.includes(i)}
              onChange={() => toggleLead(i)}
            />
            {ECG_LEAD_NAMES[i]}
          </label>
        ))}
      </div>

      <div>{plots}</div>
    </div>
  );
}

