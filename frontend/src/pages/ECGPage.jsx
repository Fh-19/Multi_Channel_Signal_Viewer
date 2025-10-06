import React, { useState, useEffect, useRef } from "react";
import Plot from "react-plotly.js";
import { fetchEcgData, classifyEcgRecord } from "../services/ecgService.jsx";

const DEFAULT_LEAD_NAMES = [
  "I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6",
];

const LEAD_COLORS = [
  "#E24A33", "#348ABD", "#988ED5", "#777777", "#FBC15E",
  "#8EBA42", "#FFB5B8", "#FF7F0E", "#1CA876", "#B776B7", "#F8585A", "#6D8B93",
];

const DISEASE_COLORS = {
  "1dAVb": "#E24A33",
  "RBBB": "#348ABD",
  "LBBB": "#988ED5",
  "SB": "#777777",
  "AF": "#FBC15E",
  "ST": "#8EBA42"
};

const COLOR_SCALES = [
  "Jet", "Hot", "Viridis", "Plasma", "Inferno", "Magma", "Cividis", "Electric", "Rainbow"
];

// Speed control options (multipliers)
const SPEED_OPTIONS = [
  { label: "0.5x", value: 0.5 },
  { label: "1x", value: 1 },
  { label: "1.5x", value: 1.5 }
];

// Window size options (seconds)
const WINDOW_SIZE_OPTIONS = [
  { label: "1s", value: 1 },
  { label: "2s", value: 2 },
  { label: "3s", value: 3 },
  { label: "4s", value: 4 },
  { label: "5s", value: 5 }
];

// Polar display modes
const POLAR_MODES = [
  { label: "Cumulative", value: "cumulative" },
  { label: "Latest Window", value: "latest" }
];

// Mode 4 display types
const MODE4_DISPLAY_TYPES = [
  { label: "Heatmap", value: "heatmap" },
  { label: "Scatter Plot", value: "scatter" }
];

// Advanced visualization modes
const ADVANCED_MODES = [
  { label: "Polar Graph", value: "polar" },
  { label: "Recurrence Graph", value: "recurrence" },
  { label: "XOR Graph", value: "xor" }
];

export default function ECGPage() {
  const [leads, setLeads] = useState([0, 1, 2]);
  const [signals, setSignals] = useState([]);
  const [fs, setFs] = useState(500);
  const [leadNames, setLeadNames] = useState(DEFAULT_LEAD_NAMES);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadedFilename, setUploadedFilename] = useState("");
  const [rPeaks, setRPeaks] = useState({});
  const [signalMode, setSignalMode] = useState("continuous");
  const [advancedMode, setAdvancedMode] = useState("polar");
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef(null);
  const [displaySignals, setDisplaySignals] = useState([]);
  const [displayStart, setDisplayStart] = useState(0);
  const cycleIdxRef = useRef(0);
  const [polarTraces, setPolarTraces] = useState([]);
  const [crpMatrix, setCrpMatrix] = useState(null);
  const [classificationResult, setClassificationResult] = useState(null);
  
  // Signal mode state
  const [cycleWindowSize, setCycleWindowSize] = useState(1.0);
  const [windowSizeSeconds, setWindowSizeSeconds] = useState(3);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);

  // Advanced mode state
  const [colorScale, setColorScale] = useState("Jet");
  const [mode4DisplayType, setMode4DisplayType] = useState("heatmap");
  const [mode4Progress, setMode4Progress] = useState({ current: 0, total: 0 });
  const [xorTolerance, setXorTolerance] = useState(0.05);
  const [xorChunks, setXorChunks] = useState([]);
  const [xorChannel, setXorChannel] = useState(0);
  const [xorWindowSize, setXorWindowSize] = useState(1.0);
  const [polarMode, setPolarMode] = useState("cumulative");

  // File Upload
  const handleFileChange = (e) => {
    setUploadedFiles(Array.from(e.target.files));
    setClassificationResult(null);
  };

  const handleUpload = async () => {
    if (uploadedFiles.length !== 2) {
      alert("Please select both .dat and .hea files.");
      return;
    }
    const formData = new FormData();
    uploadedFiles.forEach((file) => formData.append("files", file));
    try {
      const res = await fetch("http://127.0.0.1:8000/api/ecg/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.filename) {
        setUploadedFilename(data.filename);
        setClassificationResult(null);
        alert("Files uploaded!");
      } else {
        alert(data.message || "Upload failed.");
      }
    } catch (err) {
      alert("Upload failed: " + err.message);
    }
  };

  // Normalize R-peaks keys
  const normalizeRPeaks = (rp) => {
    if (!rp) return {};
    const out = {};
    for (const k of Object.keys(rp)) {
      const n = Number(k);
      out[n] = Array.isArray(rp[k]) ? rp[k].map((x) => Number(x)) : [];
    }
    return out;
  };

  // Load ECG from backend
  const handleLoad = async () => {
    try {
      if (!uploadedFilename) {
        alert("Please upload an ECG file first.");
        return;
      }

      console.log("Loading ECG data...");
      
      const data = await fetchEcgData(uploadedFilename, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

      setSignals(data.signals || []);
      setFs(data.fs || 500);
      setLeadNames(data.lead_names || DEFAULT_LEAD_NAMES);
      setRPeaks(normalizeRPeaks(data.r_peaks || {}));

      setDisplayStart(0);
      cycleIdxRef.current = 0;
      
      setPolarTraces([]);
      setCrpMatrix(null);
      setXorChunks([]);
      setMode4Progress({ current: 0, total: 0 });
      
      if (signalMode === "cycle") {
        setDisplaySignals(getCycleSignals(data.signals || [], data.r_peaks || {}, leads, 0, cycleWindowSize));
      } else {
        const windowSamples = Math.floor(windowSizeSeconds * data.fs);
        setDisplaySignals(getContinuousSignals(data.signals || [], 0, windowSamples));
      }
      
      setIsPlaying(false);
      
    } catch (err) {
      console.error("Failed to load ECG:", err);
      alert("Failed to load ECG: " + (err.message || err));
    }
  };

  function getCycleSignals(signals, rPeaks, leads, cycleIdx, windowSize = 1.0) {
    const rp = normalizeRPeaks(rPeaks);
    const lead0Peaks = rp[leads[0]] || [];
    if (lead0Peaks.length < 2 || cycleIdx >= lead0Peaks.length - 1) return [];
    
    const startPeak = lead0Peaks[cycleIdx];
    const nextPeak = lead0Peaks[cycleIdx + 1];
    const cycleLength = nextPeak - startPeak;
    
    const windowSamples = Math.floor(cycleLength * windowSize);
    const start = startPeak;
    const end = Math.min(startPeak + windowSamples, signals.length);
    
    return signals.slice(start, end);
  }

  function getXorChunk(signals, rPeaks, leadIdx, cycleIdx, windowSize = 1.0) {
    const rp = normalizeRPeaks(rPeaks);
    const leadPeaks = rp[leadIdx] || [];
    if (leadPeaks.length < 2 || cycleIdx >= leadPeaks.length - 1) return null;
    
    const startPeak = leadPeaks[cycleIdx];
    const nextPeak = leadPeaks[cycleIdx + 1];
    const cycleLength = nextPeak - startPeak;
    
    const windowSamples = Math.floor(cycleLength * windowSize);
    const start = startPeak;
    const end = Math.min(startPeak + windowSamples, signals.length);
    
    if (end > signals.length) return null;
    
    return signals.slice(start, end).map(row => row[leadIdx]);
  }

  function getContinuousSignals(signals, start, windowSize) {
    const end = Math.min(start + windowSize, signals.length);
    return signals.slice(start, end);
  }

  function interpolateCycle(cycleSignals, desiredLength = 200) {
    if (!cycleSignals || !cycleSignals.length) return [];
    let interpolated = [];
    for (let leadIdx = 0; leadIdx < cycleSignals[0].length; leadIdx++) {
      let leadData = cycleSignals.map(row => row[leadIdx]);
      let interpData = [];
      for (let i = 0; i < desiredLength; i++) {
        const idxF = (i * (leadData.length - 1)) / (desiredLength - 1);
        const idx0 = Math.floor(idxF);
        const idx1 = Math.min(idx0 + 1, leadData.length - 1);
        const frac = idxF - idx0;
        const val = leadData[idx0] * (1 - frac) + leadData[idx1] * frac;
        interpData.push(val);
      }
      const min = Math.min(...interpData);
      const max = Math.max(...interpData);
      const normData = interpData.map(x => (max !== min ? (x - min) / (max - min) : 0.5));
      interpolated.push(normData);
    }
    return interpolated;
  }

  function calculateAdaptiveThreshold(signal1, signal2) {
    const allValues = [...signal1, ...signal2];
    if (allValues.length === 0) return 0.1;
    
    const mean = allValues.reduce((sum, val) => sum + val, 0) / allValues.length;
    const variance = allValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allValues.length;
    const std = Math.sqrt(variance);
    
    return 0.1 * std;
  }

  // XOR Similarity Detection
  const detectXorSimilarity = (newChunk, existingChunks, tolerance) => {
    let chunksToRemove = [];
    let newChunkIsDuplicate = false;

    for (let i = 0; i < existingChunks.length; i++) {
      if (existingChunks[i].removed) continue;
      
      const existingChunk = existingChunks[i].samples;
      let totalDiff = 0;
      const minLength = Math.min(existingChunk.length, newChunk.length);
      
      for (let k = 0; k < minLength; k++) {
        totalDiff += Math.abs(existingChunk[k] - newChunk[k]);
      }
      const meanDiff = totalDiff / minLength;
      
      if (meanDiff <= tolerance) {
        chunksToRemove.push(i);
        newChunkIsDuplicate = true;
      }
    }

    return { chunksToRemove, newChunkIsDuplicate };
  };

  // Calculate delay based on speed multiplier
  const getDelay = () => {
    const baseDelay = signalMode === "continuous" ? 50 : 500;
    return baseDelay / speedMultiplier;
  };

  // Process Recurrence Mode
  const processRecurrenceMode = () => {
    if (advancedMode !== "recurrence" || !signals.length || leads.length !== 2 || !rPeaks) {
      setIsPlaying(false);
      return;
    }

    const rp = normalizeRPeaks(rPeaks);
    const peaksA = rp[leads[0]] || [];
    const peaksB = rp[leads[1]] || [];
    
    const currentCycle = cycleIdxRef.current;
    const numCycles = Math.min(peaksA.length - 1, peaksB.length - 1);
    
    if (currentCycle >= numCycles) {
      setIsPlaying(false);
      return;
    }

    setMode4Progress({ current: currentCycle + 1, total: numCycles });

    const startA = peaksA[currentCycle], endA = peaksA[currentCycle + 1];
    const startB = peaksB[currentCycle], endB = peaksB[currentCycle + 1];
    
    if (startA >= signals.length || endA > signals.length || 
        startB >= signals.length || endB > signals.length) {
      timerRef.current = setTimeout(processRecurrenceMode, getDelay());
      return;
    }

    const cycleA = signals.slice(startA, endA);
    const cycleB = signals.slice(startB, endB);

    function interp(cycle, targetLeadIndex) {
      if (!cycle || cycle.length === 0) return Array(200).fill(0);
      const raw = cycle.map(row => row[targetLeadIndex] || 0);
      let res = [];
      for (let i = 0; i < 200; i++) {
        const idxF = (i * (raw.length - 1)) / (200 - 1);
        const i0 = Math.floor(idxF);
        const i1 = Math.min(i0 + 1, raw.length - 1);
        const frac = idxF - i0;
        const interpolated = raw[i0] * (1 - frac) + raw[i1] * frac;
        res.push(interpolated);
      }
      return res;
    }

    const sig1 = interp(cycleA, leads[0]);
    const sig2 = interp(cycleB, leads[1]);

    function norm(arr) {
      if (arr.length === 0) return arr;
      const min = Math.min(...arr);
      const max = Math.max(...arr);
      if (max === min) return arr.map(() => 0.5);
      return arr.map(v => (v - min) / (max - min));
    }

    const s1 = norm(sig1);
    const s2 = norm(sig2);

    const threshold = calculateAdaptiveThreshold(s1, s2);

    setCrpMatrix(prev => {
      const desiredLen = 200;
      const currentMatrix = prev ? prev.z : Array(desiredLen).fill(0).map(() => Array(desiredLen).fill(0));
      const currentMaxVal = prev ? prev.maxVal : 0;

      const newMatrix = currentMatrix.map(row => [...row]);
      let newMaxVal = currentMaxVal;

      for (let i = 0; i < desiredLen; i++) {
        for (let j = 0; j < desiredLen; j++) {
          if (Math.abs(s1[i] - s2[j]) < threshold) {
            newMatrix[i][j] += 1;
            newMaxVal = Math.max(newMaxVal, newMatrix[i][j]);
          }
        }
      }

      const result = {
        z: newMatrix,
        x: Array.from({ length: desiredLen }, (_, i) => i),
        y: Array.from({ length: desiredLen }, (_, i) => i),
        maxVal: newMaxVal,
        currentCycle: currentCycle
      };

      return result;
    });
  };

  // Main playback function
  function playAllModes() {
    const rp = normalizeRPeaks(rPeaks);
    const lead0Peaks = rp[leads[0]] || [];
    
    if (cycleIdxRef.current >= lead0Peaks.length - 1) {
      setIsPlaying(false);
      return;
    }

    if (signalMode === "cycle") {
      const currentSignals = getCycleSignals(signals, rPeaks, leads, cycleIdxRef.current, cycleWindowSize);
      setDisplaySignals(currentSignals);
    }

    if (advancedMode === "polar") {
      let cycleSignals = [];
      let desiredLen = 200;
      if (lead0Peaks.length >= 2 && cycleIdxRef.current < lead0Peaks.length - 1) {
        const start = lead0Peaks[cycleIdxRef.current];
        const end = lead0Peaks[cycleIdxRef.current + 1];
        cycleSignals = signals.slice(start, end);
      } else {
        cycleSignals = signals.slice(0, desiredLen);
      }
      
      let interpolatedLeads = interpolateCycle(cycleSignals, desiredLen);
      const newTraces = leads.map((leadIdx, idx) => {
        const r = interpolatedLeads[idx];
        const theta = r.map((_, i) => (i * 360) / r.length);
        return {
          type: "scatterpolar",
          r,
          theta,
          mode: "lines",
          name: `${leadNames[leadIdx]} Cycle ${cycleIdxRef.current + 1}`,
          line: { width: 1.5, color: LEAD_COLORS[leadIdx] }
        };
      });

      if (polarMode === "cumulative") {
        setPolarTraces(prev => [...prev, ...newTraces]);
      } else if (polarMode === "latest") {
        setPolarTraces(newTraces);
      }
    } else if (advancedMode === "recurrence") {
      processRecurrenceMode();
    } else if (advancedMode === "xor") {
      const selectedXorChannel = xorChannel;
      const newChunk = getXorChunk(signals, rPeaks, selectedXorChannel, cycleIdxRef.current, xorWindowSize);
      
      if (newChunk && newChunk.length > 0) {
        setXorChunks((prev) => {
          const { chunksToRemove, newChunkIsDuplicate } = detectXorSimilarity(newChunk, prev, xorTolerance);

          const updatedChunks = prev.map((chunk, index) => {
            if (chunksToRemove.includes(index)) {
              return { ...chunk, removed: true };
            }
            return chunk;
          });

          let result;
          if (newChunkIsDuplicate) {
            result = updatedChunks;
          } else {
            const newChunkObj = {
              samples: [...newChunk],
              removed: false,
              id: Date.now() + Math.random(),
              channel: selectedXorChannel,
              cycleIndex: cycleIdxRef.current,
            };
            result = [...updatedChunks, newChunkObj];
          }

          const maxChunksHistory = 20;
          if (result.length > maxChunksHistory) {
            return result.slice(-maxChunksHistory);
          }
          return result;
        });
      }
    }

    timerRef.current = setTimeout(() => {
      cycleIdxRef.current += 1;
      playAllModes();
    }, getDelay());
  }

  // Continuous streaming
  function playContinuous() {
    const windowSamples = Math.floor(windowSizeSeconds * fs);
    const stepSamples = Math.max(1, Math.floor((windowSamples * 0.02) * speedMultiplier));
    
    setDisplayStart((prev) => {
      const newStart = prev + stepSamples;
      const maxStart = Math.max(0, signals.length - windowSamples);
      
      if (newStart >= maxStart) {
        setIsPlaying(false);
        return maxStart;
      }
      
      const currentSignals = getContinuousSignals(signals, newStart, windowSamples);
      setDisplaySignals(currentSignals);
      return newStart;
    });
    
    timerRef.current = setTimeout(playContinuous, getDelay());
  }

  function handlePlayPause() {
    if (isPlaying) {
      clearTimeout(timerRef.current);
      setIsPlaying(false);
    } else {
      if (!signals.length) {
        alert("Load a record first");
        return;
      }
      setIsPlaying(true);
      if (signalMode === "continuous") {
        playContinuous();
      } else {
        if (advancedMode === "recurrence" && !crpMatrix) {
          const desiredLen = 200;
          setCrpMatrix({
            z: Array(desiredLen).fill(0).map(() => Array(desiredLen).fill(0)),
            x: Array.from({ length: desiredLen }, (_, i) => i),
            y: Array.from({ length: desiredLen }, (_, i) => i),
            maxVal: 0,
            currentCycle: -1
          });
        }
        playAllModes();
      }
    }
  }

  // Mode switch effect
  useEffect(() => {
    clearTimeout(timerRef.current);
    setIsPlaying(false);
    if (!signals.length) return;
    
    cycleIdxRef.current = 0;
    
    if (signalMode === "cycle") {
      setDisplaySignals(getCycleSignals(signals, rPeaks, leads, 0, cycleWindowSize));
    } else {
      const windowSamples = Math.floor(windowSizeSeconds * fs);
      setDisplayStart(0);
      setDisplaySignals(getContinuousSignals(signals, 0, windowSamples));
    }
    
    if (advancedMode === "polar") {
      setPolarTraces([]);
    } else if (advancedMode === "recurrence") {
      setCrpMatrix(null);
      setMode4Progress({ current: 0, total: 0 });
    } else if (advancedMode === "xor") {
      setXorChunks([]);
    }
  }, [signalMode, advancedMode, signals, rPeaks, leads, cycleWindowSize, windowSizeSeconds, fs]);

  useEffect(() => {
    if (advancedMode === "polar") {
      setPolarTraces([]);
    } else if (advancedMode === "recurrence") {
      setCrpMatrix(null);
      setMode4Progress({ current: 0, total: 0 });
    } else if (advancedMode === "xor") {
      setXorChunks([]);
    }
  }, [leads]);

  const clearPolarTraces = () => {
    setPolarTraces([]);
  };

  const clearRecurrenceMatrix = () => {
    setCrpMatrix(null);
    setMode4Progress({ current: 0, total: 0 });
  };

  const resetXorChunks = () => {
    setXorChunks([]);
  };

  const toggleLead = (idx) => {
    if (advancedMode === "recurrence") {
      setLeads(prev => {
        if (prev.includes(idx)) {
          return prev.filter(l => l !== idx);
        } else if (prev.length < 2) {
          return [...prev, idx];
        } else {
          alert("You can select only 2 leads in Recurrence Compare Mode.");
          return prev;
        }
      });
    } else if (advancedMode === "xor") {
      return;
    } else {
      setLeads(prev => {
        if (prev.includes(idx)) {
          return prev.filter(l => l !== idx);
        } else if (prev.length < 3) {
          return [...prev, idx];
        } else {
          alert("You can select up to 3 leads only.");
          return prev;
        }
      });
    }
  };

  const handleAdvancedModeChange = (newMode) => {
    if (newMode === "recurrence") {
      if (leads.length > 2) {
        setLeads(leads.slice(0, 2));
      }
    }
    setAdvancedMode(newMode);
  };

  // Build traces for signal viewer
  const xAxis = displaySignals.map((_, i) =>
    signalMode === "cycle" ? i / fs : (displayStart + i) / fs
  );

  const signalTraces = [];
  leads.forEach((leadIdx, i) => {
    const y = displaySignals.map((row) => (row ? row[leadIdx] : null));
    signalTraces.push({
      x: xAxis,
      y: y,
      type: "scatter",
      mode: "lines",
      name: leadNames[leadIdx] || `Lead ${leadIdx + 1}`,
      line: { width: 1.2, color: LEAD_COLORS[leadIdx] },
    });
  });

  // XOR Traces
  const xorTraces = React.useMemo(() => {
    if (advancedMode !== "xor") return [];
    
    const activeChunks = xorChunks.filter(chunk => !chunk.removed);
    const traces = [];
    
    activeChunks.forEach((chunk, idx) => {
      const timeAxis = Array.from({ length: chunk.samples.length }, (_, i) => i / fs);
      
      traces.push({
        x: timeAxis,
        y: chunk.samples,
        type: "scatter",
        mode: "lines",
        name: `Cycle ${chunk.cycleIndex + 1} (${leadNames[chunk.channel]})`,
        opacity: 0.6,
        line: { width: 1.5, color: `hsl(${(idx * 45) % 360}, 70%, 50%)` },
        hoverinfo: "name+y",
      });
    });
    
    return traces;
  }, [xorChunks, advancedMode, fs, leadNames]);

  // Scatter plot data from recurrence matrix
  const recurrenceScatterData = React.useMemo(() => {
    if (advancedMode !== "recurrence" || !crpMatrix || mode4DisplayType !== "scatter") return [];
    
    const scatterData = [];
    const { z, x, y } = crpMatrix;
    
    for (let i = 0; i < z.length; i++) {
      for (let j = 0; j < z[i].length; j++) {
        if (z[i][j] > 0) {
          scatterData.push({
            x: x[i],
            y: y[j],
            z: z[i][j],
            text: `Count: ${z[i][j]}<br>Lead A: ${x[i]}<br>Lead B: ${y[j]}`,
          });
        }
      }
    }
    
    return [{
      x: scatterData.map(d => d.x),
      y: scatterData.map(d => d.y),
      mode: 'markers',
      type: 'scatter',
      marker: {
        size: 8,
        color: scatterData.map(d => d.z),
        colorscale: colorScale,
        colorbar: { title: 'Recurrence Count' },
        showscale: true
      },
      text: scatterData.map(d => d.text),
      hoverinfo: 'text'
    }];
  }, [crpMatrix, mode4DisplayType, colorScale, advancedMode]);

  const classificationBarChart = React.useMemo(() => {
    if (!classificationResult || !classificationResult.probabilities) return null;

    const FULL_DISEASE_NAMES = {
      'Normal': 'Normal Sinus Rhythm',
      'AF': 'Atrial Fibrillation',
      'ST': 'ST-segment Abnormality',
      'SB': 'Sinus Bradycardia',
      'LBBB': 'Left Bundle Branch Block',
      'RBBB': 'Right Bundle Branch Block',
      '1dAVb': 'First-degree Atrioventricular Block',
    };

    const probabilities = classificationResult.probabilities;
    const diseases = Object.keys(probabilities);
    const values = diseases.map((d) => probabilities[d] * 100);

    return (
      <div style={{ textAlign: "center" }}>
        <Plot
          data={[
            {
              x: values,
              y: diseases,
              type: "bar",
              orientation: "h",
              marker: {
                color: diseases.map(d => DISEASE_COLORS[d] || "#3498db"),
                line: { color: "#2c3e50", width: 1 },
              },
              text: values.map(v => v.toFixed(1) + "%"),
              textposition: "auto",
            },
          ]}
          layout={{
            width: 420,
            height: diseases.length * 40 + 100,
            margin: { l: 150, r: 20, t: 20, b: 40 },
            xaxis: { title: "Probability (%)", range: [0, 100] },
            yaxis: { 
              tickvals: diseases,
              ticktext: diseases.map(d => FULL_DISEASE_NAMES[d] || d)
            },
            showlegend: false,
          }}
          config={{ displayModeBar: false }}
        />
      </div>
    );
  }, [classificationResult]);

  // Advanced visualization component
  const AdvancedVisualization = () => {
    if (advancedMode === "polar") {
      return (
        <Plot
          data={polarTraces}
          layout={{
            width: "100%",
            height: 400,
            margin: { l: 50, r: 20, t: 40, b: 40 },
            polar: {
              radialaxis: { visible: true, range: [0, 1] },
              angularaxis: {
                direction: "counterclockwise",
                rotation: 90,
              },
            },
            showlegend: true,
            title: `Polar Cardiogram - ${polarMode === "cumulative" ? "Cumulative View" : "Latest Cycle"}`,
          }}
          config={{ displayModeBar: false }}
        />
      );
    } else if (advancedMode === "recurrence") {
      if (!crpMatrix) return (
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          height: "400px",
          color: "#8d97b6"
        }}>
          Load ECG and click Play to generate recurrence plot
        </div>
      );
      
      if (mode4DisplayType === "heatmap") {
        return (
          <Plot
            data={[{
              z: crpMatrix.z,
              x: crpMatrix.x,
              y: crpMatrix.y,
              type: "heatmap",
              colorscale: colorScale,
              zmin: 0,
              zmax: crpMatrix.maxVal || 1,
            }]}
            layout={{
              width: "100%",
              height: 400,
              margin: { l: 50, r: 20, t: 40, b: 40 },
              xaxis: { title: `${leadNames[leads[0]]} (cycle samples)` },
              yaxis: { title: `${leadNames[leads[1]]} (cycle samples)` },
              title: `Cross Recurrence Plot - Cycle ${cycleIdxRef.current + 1}`
            }}
          />
        );
      } else {
        return (
          <Plot
            data={recurrenceScatterData}
            layout={{
              width: "100%",
              height: 400,
              margin: { l: 50, r: 20, t: 40, b: 40 },
              xaxis: { title: `${leadNames[leads[0]]} (cycle samples)` },
              yaxis: { title: `${leadNames[leads[1]]} (cycle samples)` },
              title: `Recurrence Scatter Plot - Cycle ${cycleIdxRef.current + 1}`
            }}
          />
        );
      }
    } else if (advancedMode === "xor") {
      return (
        <Plot
          data={xorTraces}
          layout={{
            width: "100%",
            height: 400,
            margin: { l: 50, r: 20, t: 40, b: 40 },
            xaxis: { title: "Time (s)" },
            yaxis: { title: "Amplitude (mV)" },
            showlegend: true,
            title: `ECG XOR Overlay - Unique Cycle Patterns (${DEFAULT_LEAD_NAMES[xorChannel]})`
          }}
          config={{ displayModeBar: false }}
        />
      );
    }
    return (
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        height: "400px",
        color: "#8d97b6"
      }}>
        Select an advanced visualization mode
      </div>
    );
  };

  // Classification
  const classifyRecord = async () => {
    try {
      if (!uploadedFilename) {
        alert("Please upload an ECG file first.");
        return;
      }
      const result = await classifyEcgRecord(uploadedFilename, "");
      setClassificationResult(result);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{
      display: "flex",
      height: "170vh",
      width: "100%",
      background: "#f0f4f8",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    }}>
      {/* LEFT: ECG viewer + Advanced Visualizations (70%) */}
      <div style={{
        flex: 7,
        padding: "20px 28px",
        overflowY: "auto",
        borderRight: "2px solid #dbe2ef",
        display: "flex",
        flexDirection: "column",
      }}>
        <h1 style={{ margin: "0 0 18px 0", fontWeight: 700, fontSize: 26, color: "#263357" }}>
          ECG Signal Viewer
        </h1>

        {/* Upload */}
        <input
          type="file"
          multiple
          accept=".dat,.hea"
          onChange={handleFileChange}
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 7,
            border: "1px solid #b7cdfc",
            width: "100%",
            maxWidth: 420,
            fontSize: 16,
            background: "#fafeff"
          }}
        />

        {/* Main controls */}
        <div style={{ 
          display: "flex", 
          gap: "10px", 
          alignItems: "center",
          marginBottom: "15px"
        }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button onClick={handleUpload} style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "none",
              background: "#2055c0",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer"
            }}>
              Upload ECG Files
            </button>
            <button onClick={handleLoad} style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "none",
              background: "#2ecc71",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer"
            }}>
              Load
            </button>
            <button onClick={handlePlayPause} style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "none",
              background: isPlaying ? "#e74c3c" : "#2ecc71",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer"
            }}>
              {isPlaying ? "Pause" : "Play"}
            </button>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginLeft: "20px" }}>
            <label style={{ fontSize: 14, fontWeight: 600 }}>
              Playback Speed:
              <select 
                value={speedMultiplier} 
                onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
                style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 6 }}
              >
                {SPEED_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {uploadedFilename && (
            <span style={{ marginLeft: "20px", fontStyle: "italic", color: "#2055c0" }}>
              Uploaded: {uploadedFilename}
            </span>
          )}
        </div>

        {/* Signal mode controls */}
        <div style={{ marginBottom: "15px" }}>
          <button
            onClick={() => setSignalMode("continuous")}
            style={{ 
              padding: "8px 14px",
              borderRadius: 6,
              border: "none",
              background: signalMode === "continuous" ? "#2055c0" : "#7f93b7",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
              marginRight: "10px"
            }}>
            Continuous Mode
          </button>
          <button
            onClick={() => setSignalMode("cycle")}
            style={{ 
              padding: "8px 14px",
              borderRadius: 6,
              border: "none",
              background: signalMode === "cycle" ? "#2055c0" : "#7f93b7",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer"
            }}>
            Cycle-by-Cycle Mode
          </button>

          {signalMode === "cycle" && (
            <div style={{ display: "inline-block", marginLeft: "10px" }}>
              <label style={{ fontSize: 14, fontWeight: 600 }}>Cycle Window: </label>
              <select 
                value={cycleWindowSize} 
                onChange={(e) => setCycleWindowSize(parseFloat(e.target.value))}
                style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 6 }}
              >
                <option value={0.5}>0.5 RR</option>
                <option value={0.75}>0.75 RR</option>
                <option value={1.0}>1.0 RR</option>
                <option value={1.25}>1.25 RR</option>
                <option value={1.5}>1.5 RR</option>
              </select>
            </div>
          )}
          
          {signalMode === "continuous" && (
            <div style={{ display: "inline-block", marginLeft: "10px" }}>
              <label style={{ fontSize: 14, fontWeight: 600 }}>Window Size: </label>
              <select 
                value={windowSizeSeconds} 
                onChange={(e) => setWindowSizeSeconds(Number(e.target.value))}
                style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 6 }}
              >
                {WINDOW_SIZE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Lead selection */}
        {advancedMode !== "xor" && (
          <div style={{ marginBottom: "15px" }}>
            <h4 style={{ color: "#2055c0", marginBottom: 8 }}>Select Leads (max 3)</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {leadNames.map((name, i) => (
                <label key={i} style={{
                  cursor: "pointer",
                  padding: "6px 12px",
                  borderRadius: 12,
                  border: leads.includes(i) ? "2px solid #2055c0" : "1px solid #ddd",
                  background: leads.includes(i) ? "#e8f0ff" : "#fafafa",
                  fontWeight: leads.includes(i) ? 700 : 400,
                }}>
                  <input
                    type="checkbox"
                    checked={leads.includes(i)}
                    onChange={() => toggleLead(i)}
                    style={{ marginRight: 8 }}
                    disabled={advancedMode === "recurrence" && leads.length === 2 && !leads.includes(i)}
                  />
                  {name}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Signal plot */}
        <div style={{ marginTop: 20, flex: 1, minHeight: "300px" }}>
          <Plot
            data={signalTraces}
            layout={{
              width: "100%",
              height: "100%",
              margin: { l: 50, r: 20, t: 40, b: 40 },
              xaxis: { title: "Time (s)" },
              yaxis: { title: "Amplitude (mV)", autorange: true },
              showlegend: true,
              title: `ECG Signal (${signalMode === "cycle" ? "Cycle-by-cycle" : "Continuous"})`,
            }}
            config={{ displayModeBar: false }}
          />
        </div>

        {/* Advanced Visualizations */}
        <div style={{ marginTop: 30, borderTop: "2px solid #dbe2ef", paddingTop: 20 }}>
          <h3 style={{ margin: "0 0 15px 0", color: "#263357" }}>Advanced Visualizations</h3>
          
          {/* Advanced Visualization Selector - Dropdown */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 14, fontWeight: 600 }}>
              Select Visualization:
              <select
                value={advancedMode}
                onChange={(e) => handleAdvancedModeChange(e.target.value)}
                style={{ marginLeft: 8, padding: "8px 12px", borderRadius: 6, fontSize: 14 }}
              >
                {ADVANCED_MODES.map(mode => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Mode-specific controls */}
          <div style={{ marginBottom: 20 }}>
            {advancedMode === "polar" && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>
                  Polar Mode:
                  <select 
                    value={polarMode} 
                    onChange={(e) => setPolarMode(e.target.value)}
                    style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 6 }}
                  >
                    {POLAR_MODES.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button 
                  onClick={clearPolarTraces}
                  style={{ marginLeft: 15, padding: "6px 10px", borderRadius: 6, border: "none", background: "#2055c0", color: "#fff", fontWeight: 700 }}
                >
                  Clear Polar
                </button>
              </div>
            )}
            
            {advancedMode === "recurrence" && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>
                  Display Type:
                  <select 
                    value={mode4DisplayType} 
                    onChange={(e) => setMode4DisplayType(e.target.value)}
                    style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 6 }}
                  >
                    {MODE4_DISPLAY_TYPES.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: 13, fontWeight: 600, marginLeft: 15 }}>
                  Color Scale:
                  <select 
                    value={colorScale} 
                    onChange={(e) => setColorScale(e.target.value)}
                    style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 6 }}
                  >
                    {COLOR_SCALES.map(scale => (
                      <option key={scale} value={scale}>{scale}</option>
                    ))}
                  </select>
                </label>
                <button 
                  onClick={clearRecurrenceMatrix}
                  style={{ marginLeft: 15, padding: "6px 10px", borderRadius: 6, border: "none", background: "#2055c0", color: "#fff", fontWeight: 700 }}
                >
                  Clear Matrix
                </button>
                {mode4Progress.total > 0 && (
                  <span style={{ marginLeft: "20px", fontWeight: "bold", color: "#2055c0" }}>
                    Progress: {mode4Progress.current} / {mode4Progress.total} cycles
                  </span>
                )}
              </div>
            )}
            
            {advancedMode === "xor" && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>
                  XOR Tolerance:
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={xorTolerance}
                    onChange={(e) => setXorTolerance(Number(e.target.value))}
                    style={{ width: "60px", marginLeft: 8, padding: "4px", borderRadius: 4 }}
                  />
                </label>
                <label style={{ fontSize: 13, fontWeight: 600, marginLeft: 10 }}>
                  Window:
                  <select 
                    value={xorWindowSize} 
                    onChange={(e) => setXorWindowSize(parseFloat(e.target.value))}
                    style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 6 }}
                  >
                    <option value={0.5}>0.5 RR</option>
                    <option value={0.75}>0.75 RR</option>
                    <option value={1.0}>1.0 RR</option>
                    <option value={1.25}>1.25 RR</option>
                    <option value={1.5}>1.5 RR</option>
                  </select>
                </label>
                <label style={{ fontSize: 13, fontWeight: 600, marginLeft: 10 }}>
                  Lead:
                  <select 
                    value={xorChannel} 
                    onChange={(e) => setXorChannel(Number(e.target.value))}
                    style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 6 }}
                  >
                    {DEFAULT_LEAD_NAMES.map((leadName, index) => (
                      <option key={index} value={index}>
                        {leadName}
                      </option>
                    ))}
                  </select>
                </label>
                <button 
                  onClick={resetXorChunks}
                  style={{ marginLeft: 15, padding: "6px 10px", borderRadius: 6, border: "none", background: "#2055c0", color: "#fff", fontWeight: 700 }}
                >
                  Reset XOR
                </button>
              </div>
            )}
          </div>

          {/* Advanced visualization plot */}
          <div style={{ marginTop: 20 }}>
            <AdvancedVisualization />
          </div>
        </div>
      </div>

      {/* RIGHT: Prediction + Analysis (30%) - STATIONARY */}
      <div style={{
        flex: 3,
        padding: "20px 24px",
        overflowY: "auto",
        background: "#fff",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 12, color: "#263357" }}>ECG Analysis</h2>

        {/* Prediction Button at the top */}
        <div style={{ marginBottom: 25 }}>
          <div style={{ marginBottom: 15 }}>
            <button
              onClick={classifyRecord}
              disabled={!uploadedFilename}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "none",
                background: !uploadedFilename ? "#7f93b7" : "#2055c0",
                color: "#fff",
                fontWeight: 700,
                cursor: !uploadedFilename ? "not-allowed" : "pointer",
                width: "100%"
              }}
            >
              Predict Disease
            </button>
          </div>

          {classificationResult ? (
            <>
              <div style={{
                padding: "10px",
                backgroundColor: "#e8f5e8",
                borderRadius: "5px",
                marginBottom: "15px"
              }}>
                <h4 style={{ margin: "0 0 8px 0", color: "#263357" }}>Prediction Result</h4>
                <p style={{ fontSize: "16px", fontWeight: "bold", color: "#2055c0", margin: 0 }}>
                  {classificationResult.label || "Unknown"}
                </p>
              </div>

              {classificationResult.probabilities && (
                <div>
                  <h4 style={{ color: "#263357", marginBottom: 10 }}>Class Probabilities</h4>
                  {classificationBarChart}
                </div>
              )}
            </>
          ) : (
            <div style={{ 
              textAlign: "center", 
              color: "#8d97b6",
              padding: "20px",
              backgroundColor: "#f9f9f9",
              borderRadius: "6px"
            }}>
              <p>Click "Predict Disease" to see classification results</p>
              <p style={{ fontSize: "12px", marginTop: "10px" }}>
                Load an ECG file first, then click the Predict Disease button to get disease classification predictions.
              </p>
            </div>
          )}
        </div>

        {/* Recording Information */}
        <div style={{ marginTop: 25, paddingTop: 15, borderTop: "1px solid #eee" }}>
          <h4 style={{ color: "#263357", marginBottom: 10 }}>Recording Information</h4>
          <div style={{ fontSize: "14px", color: "#555" }}>
            <p><strong>Sampling Rate:</strong> {fs} Hz</p>
            <p><strong>Selected Leads:</strong> {leads.map(idx => leadNames[idx]).join(", ")}</p>
            <p><strong>Signal Mode:</strong> {signalMode === "cycle" ? "Cycle-by-cycle" : "Continuous"}</p>
            <p><strong>Visualization:</strong> {
              advancedMode === "polar" ? "Polar Graph" : 
              advancedMode === "recurrence" ? "Recurrence Graph" : "XOR Graph"
            }</p>
            <p><strong>Status:</strong> {isPlaying ? 
              <span style={{ color: "#2ecc71", fontWeight: "bold" }}>Playing</span> : 
              <span style={{ color: "#e74c3c", fontWeight: "bold" }}>Paused</span>}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}