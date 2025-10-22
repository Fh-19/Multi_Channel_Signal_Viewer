import { useState, useEffect, useRef, useCallback } from "react";
import ECGControls from "./ECGControls";
import ECGVisualizations from "./ECGVisualizations";
import ECGAnalysis from "./ECGAnalysis";
import { fetchEcgData, resampleEcgData, classifyWithSampling } from "../../services/ecgService";

const DEFAULT_LEAD_NAMES = [
  "I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6",
];

const LEAD_COLORS = [
  "#E24A33", "#348ABD", "#988EDP", "#777777", "#FBC15E",
  "#8EBA42", "#FFB5B8", "#FF7F0E", "#1CA876", "#B776B7", "#F8585A", "#6D8B93",
];

export default function ECGPage() {
  // Core state
  const [filename, setFilename] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [allLeads, setAllLeads] = useState(DEFAULT_LEAD_NAMES);
  const [leads, setLeads] = useState([0, 1, 2]);
  
  // Signal data
  const [signals, setSignals] = useState([]);
  const [fs, setFs] = useState(500);
  const [originalFs, setOriginalFs] = useState(500);
  const [displayFs, setDisplayFs] = useState(500);
  const [rPeaks, setRPeaks] = useState({});
  const [displaySignals, setDisplaySignals] = useState([]);
  const [displayStart, setDisplayStart] = useState(0);
  
  // Playback
  const [signalMode, setSignalMode] = useState("continuous");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [windowSeconds, setWindowSeconds] = useState(3);
  const [cycleWindowSize, setCycleWindowSize] = useState(1.0);
  
  // Analysis
  const [prediction, setPrediction] = useState(null);
  const [predictionProbs, setPredictionProbs] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [aliasingWarning, setAliasingWarning] = useState(false);
  const [resamplingType, setResamplingType] = useState("none");
  
  // Visualizations
  const [selectedVisualization, setSelectedVisualization] = useState("polar");
  const [xorTolerance, setXorTolerance] = useState(0.05);
  const [xorChunks, setXorChunks] = useState([]);
  const [xorChannel, setXorChannel] = useState(0);
  const [polarTraces, setPolarTraces] = useState([]);
  const [crpMatrix, setCrpMatrix] = useState(null);
  const [scatterData, setScatterData] = useState([]);
  const [colorScale, setColorScale] = useState("Jet");
  const [recurrencePlotType, setRecurrencePlotType] = useState("heatmap");
  const [polarMode, setPolarMode] = useState("cumulative");
  
  // Loading
  const [isLoading, setIsLoading] = useState(false);
  
  // Refs
  const cycleIdxRef = useRef(0);
  const timerRef = useRef(null);
  const isPlayingRef = useRef(false);

  // File handling
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setUploadedFiles(files);
    setPrediction(null);
    setPredictionProbs(null);
    setAliasingWarning(false);
    setResamplingType("none");
  };

  // Combined upload and load function
  const handleUpload = async () => {
    if (uploadedFiles.length !== 2) {
      alert("Please select both .dat and .hea files.");
      return;
    }
    
    setIsLoading(true);
    const formData = new FormData();
    uploadedFiles.forEach((file) => formData.append("files", file));
    
    try {
      const res = await fetch("http://127.0.0.1:8000/api/ecg/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.filename) {
        setFilename(data.filename);
        
        // Load ECG data immediately after upload
        console.log("Loading ECG data...");
        const ecgData = await fetchEcgData(data.filename, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        
        console.log("Original ECG data:", {
          signalsLength: ecgData.signals?.length,
          fs: ecgData.fs,
          originalFs: ecgData.original_fs
        });
        
        setSignals(ecgData.signals || []);
        const originalFsValue = ecgData.original_fs || ecgData.fs || 500;
        setFs(originalFsValue);
        setOriginalFs(originalFsValue);
        setDisplayFs(originalFsValue);
        setAllLeads(ecgData.lead_names || DEFAULT_LEAD_NAMES);
        
        // Normalize R-peaks
        const normalizedRPeaks = {};
        if (ecgData.r_peaks) {
          for (const k of Object.keys(ecgData.r_peaks)) {
            const n = Number(k);
            normalizedRPeaks[n] = Array.isArray(ecgData.r_peaks[k]) ? ecgData.r_peaks[k].map((x) => Number(x)) : [];
          }
        }
        setRPeaks(normalizedRPeaks);

        // Reset states for fresh start
        setDisplayStart(0);
        cycleIdxRef.current = 0;
        isPlayingRef.current = false;
        setPolarTraces([]);
        setCrpMatrix(null);
        setScatterData([]);
        setXorChunks([]);
        setDisplaySignals([]);
        setPrediction(null);
        setPredictionProbs(null);
        setAliasingWarning(false);
        setResamplingType("none");

        // Set initial display signals based on current mode
        if (signalMode === "cycle") {
          const initialSignals = getCycleSignals(0);
          setDisplaySignals(initialSignals);
        } else {
          const windowSamples = Math.floor(windowSeconds * originalFsValue);
          const initialSignals = getContinuousSignals(0, windowSamples);
          setDisplaySignals(initialSignals);
        }
        
        setIsPlaying(false);
        alert("Files uploaded and loaded successfully!");
      } else {
        alert(data.message || "Upload failed.");
      }
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Signal processing helpers with useCallback
  const getCycleSignals = useCallback((cycleIdx) => {
    if (!signals.length) return [];
    
    const lead0Peaks = rPeaks[leads[0]] || [];
    if (lead0Peaks.length < 2 || cycleIdx >= lead0Peaks.length - 1) return [];
    
    const startPeak = lead0Peaks[cycleIdx];
    const nextPeak = lead0Peaks[cycleIdx + 1];
    const cycleLength = nextPeak - startPeak;
    
    const windowSamples = Math.floor(cycleLength * cycleWindowSize);
    const start = startPeak;
    const end = Math.min(startPeak + windowSamples, signals.length);
    
    return signals.slice(start, end);
  }, [signals, rPeaks, leads, cycleWindowSize]);

  const getContinuousSignals = useCallback((start, windowSize) => {
    const end = Math.min(start + windowSize, signals.length);
    return signals.slice(start, end);
  }, [signals]);

  // Handle sampling frequency change
  const handleSamplingFrequencyChange = async (newFs) => {
    if (!filename) {
      alert("Please upload an ECG file first.");
      return;
    }

    console.log(`Changing sampling frequency from ${displayFs}Hz to ${newFs}Hz`);
    
    setIsLoading(true);
    
    try {
      if (newFs === originalFs) {
        // Reset to original signals
        console.log("Resetting to original signals");
        const ecgData = await fetchEcgData(filename, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        setSignals(ecgData.signals || []);
        setFs(originalFs);
        setRPeaks(ecgData.r_peaks || {});
        setAliasingWarning(false);
        setResamplingType("none");
      } else {
        // Apply resampling
        console.log("Applying resampling...");
        const resampledData = await resampleEcgData(filename, newFs);
        console.log("Resampled data:", {
          signalsLength: resampledData.signals?.length,
          newFs: resampledData.fs,
          aliasing: resampledData.aliasing_warning
        });
        
        setSignals(resampledData.signals || []);
        setFs(newFs);
        setRPeaks(resampledData.r_peaks || {});
        setAliasingWarning(resampledData.aliasing_warning || false);
        setResamplingType(resampledData.resampling_type || "none");
      }

      setDisplayFs(newFs);

      // Reset playback and update display
      setIsPlaying(false);
      clearTimeout(timerRef.current);
      cycleIdxRef.current = 0;
      setDisplayStart(0);
      
      // Force update display signals with current signals
      if (signalMode === "cycle") {
        const newDisplaySignals = getCycleSignals(0);
        setDisplaySignals(newDisplaySignals);
      } else {
        const windowSamples = Math.floor(windowSeconds * newFs);
        const newDisplaySignals = getContinuousSignals(0, windowSamples);
        setDisplaySignals(newDisplaySignals);
      }
      
      console.log("Display updated with new signals");
      
    } catch (err) {
      console.error("Resampling failed:", err);
      alert("Failed to resample signals: " + err.message);
      setDisplayFs(originalFs);
    } finally {
      setIsLoading(false);
    }
  };

  //Handle classification with current sampling frequency
  const handleClassification = async () => {
    if (!filename) {
      alert("Please upload an ECG file first.");
      return;
    }

    setIsPredicting(true);
    try {
      console.log(`Classifying with sampling frequency: ${displayFs}Hz`);
      const result = await classifyWithSampling(filename, displayFs);
      console.log("Classification result:", {
        label: result.label,
        used_fs: result.used_fs,
        original_fs: result.original_fs,
        aliasing_warning: result.aliasing_warning
      });
      setPrediction(result.label);
      setPredictionProbs(result.probabilities);
      setAliasingWarning(result.aliasing_warning || false);
    } catch (err) {
      console.error("Classification error:", err);
      alert("Classification failed: " + err.message);
    } finally {
      setIsPredicting(false);
    }
  };

  const getXorChunk = (leadIdx, cycleIdx) => {
    const leadPeaks = rPeaks[leadIdx] || [];
    if (leadPeaks.length < 2 || cycleIdx >= leadPeaks.length - 1) return null;
    
    const startPeak = leadPeaks[cycleIdx];
    const nextPeak = leadPeaks[cycleIdx + 1];
    const cycleLength = nextPeak - startPeak;
    
    const windowSamples = Math.floor(cycleLength * cycleWindowSize);
    const start = startPeak;
    const end = Math.min(startPeak + windowSamples, signals.length);
    
    if (end > signals.length) return null;
    
    return signals.slice(start, end).map(row => row[leadIdx]);
  };

  const interpolateCycle = (cycleSignals, desiredLength = 200) => {
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
  };

  // Helper functions for recurrence visualization
  const calculateAdaptiveThreshold = (signal1, signal2) => {
    const allValues = [...signal1, ...signal2];
    if (allValues.length === 0) return 0.1;
    
    const mean = allValues.reduce((sum, val) => sum + val, 0) / allValues.length;
    const variance = allValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allValues.length;
    const std = Math.sqrt(variance);
    
    return 0.1 * std;
  };

  // Add this function to generate scatter plot data
  const generateRecurrenceScatterData = (crpMatrix, colorScale) => {
    if (!crpMatrix || !crpMatrix.z) return [];
    
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
  };

  const processRecurrenceMode = () => {
    if (!signals.length || leads.length !== 2 || !rPeaks) {
      setIsPlaying(false);
      return false;
    }

    const lead0Peaks = rPeaks[leads[0]] || [];
    const lead1Peaks = rPeaks[leads[1]] || [];
    
    const currentCycle = cycleIdxRef.current;
    const numCycles = Math.min(lead0Peaks.length - 1, lead1Peaks.length - 1);
    
    if (currentCycle >= numCycles) {
      setIsPlaying(false);
      return false;
    }

    const startA = lead0Peaks[currentCycle], endA = lead0Peaks[currentCycle + 1];
    const startB = lead1Peaks[currentCycle], endB = lead1Peaks[currentCycle + 1];
    
    if (startA >= signals.length || endA > signals.length || 
        startB >= signals.length || endB > signals.length) {
      return true;
    }

    const cycleA = signals.slice(startA, endA);
    const cycleB = signals.slice(startB, endB);

    const interp = (cycle, targetLeadIndex) => {
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
    };

    const sig1 = interp(cycleA, leads[0]);
    const sig2 = interp(cycleB, leads[1]);

    const norm = (arr) => {
      if (arr.length === 0) return arr;
      const min = Math.min(...arr);
      const max = Math.max(...arr);
      if (max === min) return arr.map(() => 0.5);
      return arr.map(v => (v - min) / (max - min));
    };

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

      // Generate scatter data whenever matrix updates
      const newScatterData = generateRecurrenceScatterData(result, colorScale);
      setScatterData(newScatterData);

      return result;
    });

    return true;
  };

  // Playback control
  const getDelay = () => {
    const baseDelay = signalMode === "continuous" ? 50 : 500;
    return baseDelay / playbackSpeed;
  };

  // Play continuous mode - stops at end
  const playContinuous = () => {
    if (!isPlayingRef.current) return;
    
    const windowSamples = Math.floor(windowSeconds * fs);
    const stepSamples = Math.max(1, Math.floor((windowSamples * 0.02) * playbackSpeed));
    
    setDisplayStart((prev) => {
      const newStart = prev + stepSamples;
      const maxStart = Math.max(0, signals.length - windowSamples);
      
      // Stop when reaching the end
      if (newStart >= maxStart) {
        setIsPlaying(false);
        isPlayingRef.current = false;
        return maxStart;
      }
      
      const currentSignals = getContinuousSignals(newStart, windowSamples);
      setDisplaySignals(currentSignals);
      return newStart;
    });
    
    // Schedule next frame only if still playing
    if (isPlayingRef.current) {
      timerRef.current = setTimeout(playContinuous, getDelay());
    }
  };

  // Play cycle mode - stops at end
  const playCycleMode = () => {
    if (!isPlayingRef.current) return;
    
    const lead0Peaks = rPeaks[leads[0]] || [];
    
    // Stop when reaching the end
    if (cycleIdxRef.current >= lead0Peaks.length - 1) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      return;
    }

    // Update display signals
    const currentSignals = getCycleSignals(cycleIdxRef.current);
    setDisplaySignals(currentSignals);

    // Advanced visualizations
    if (selectedVisualization === "polar") {
      updatePolarVisualization();
    } else if (selectedVisualization === "recurrence") {
      // Process recurrence visualization
      if (leads.length === 2) {
        const shouldContinue = processRecurrenceMode();
        if (!shouldContinue) {
          setIsPlaying(false);
          isPlayingRef.current = false;
          return;
        }
      }
    } else if (selectedVisualization === "xor") {
      updateXORVisualization();
    }

    // Schedule next frame only if still playing
    if (isPlayingRef.current) {
      timerRef.current = setTimeout(() => {
        cycleIdxRef.current += 1;
        playCycleMode();
      }, getDelay());
    }
  };

  const updatePolarVisualization = () => {
    const lead0Peaks = rPeaks[leads[0]] || [];
    let cycleSignals = [];
    const desiredLen = 200;
    
    if (lead0Peaks.length >= 2 && cycleIdxRef.current < lead0Peaks.length - 1) {
      const start = lead0Peaks[cycleIdxRef.current];
      const end = lead0Peaks[cycleIdxRef.current + 1];
      cycleSignals = signals.slice(start, end);
    } else {
      cycleSignals = signals.slice(0, desiredLen);
    }
    
    const interpolatedLeads = interpolateCycle(cycleSignals, desiredLen);
    const newTraces = leads.map((leadIdx, idx) => {
      const r = interpolatedLeads[idx];
      const theta = r.map((_, i) => (i * 360) / r.length);
      return {
        type: "scatterpolar",
        r,
        theta,
        mode: "lines",
        name: `${allLeads[leadIdx]} Cycle ${cycleIdxRef.current + 1}`,
        line: { width: 1.5, color: LEAD_COLORS[leadIdx] }
      };
    });

    if (polarMode === "cumulative") {
      setPolarTraces(prev => [...prev, ...newTraces]);
    } else if (polarMode === "latest") {
      setPolarTraces(newTraces);
    }
  };

  // NEW XOR IMPLEMENTATION - Improved accumulation logic
  const processXorAccumulation = (newChunk, accumulatedResult, tolerance) => {
    if (!accumulatedResult || accumulatedResult.length === 0) {
      // First cycle - return as-is with all points visible
      return newChunk.map((value, index) => ({
        value,
        visible: true,
        cycle: 1,
        index
      }));
    }

    const result = [];
    const minLength = Math.min(newChunk.length, accumulatedResult.length);

    for (let i = 0; i < minLength; i++) {
      const currentValue = newChunk[i];
      const accumulatedPoint = accumulatedResult[i];
      
      // Check if values are similar within tolerance
      const isSimilar = Math.abs(currentValue - accumulatedPoint.value) <= tolerance;
      
      if (isSimilar && accumulatedPoint.visible) {
        // Similar values and previously visible → XOR result is 0 (erase/blank)
        result.push({
          value: currentValue,
          visible: false,
          cycle: accumulatedPoint.cycle + 1,
          index: i
        });
      } else {
        // Different values OR previously hidden → XOR result is 1 (keep visible)
        result.push({
          value: currentValue,
          visible: true,
          cycle: accumulatedPoint.cycle + 1,
          index: i
        });
      }
    }

    // Handle remaining points if new chunk is longer
    for (let i = minLength; i < newChunk.length; i++) {
      result.push({
        value: newChunk[i],
        visible: true,
        cycle: accumulatedResult[0]?.cycle + 1 || 1,
        index: i
      });
    }

    return result;
  };

  // Replace the existing updateXORVisualization function
  const updateXORVisualization = () => {
    const newChunk = getXorChunk(xorChannel, cycleIdxRef.current);
    
    if (newChunk && newChunk.length > 0) {
      setXorChunks((prev) => {
        // Get the accumulated XOR result from previous cycles
        const accumulatedResult = prev.length > 0 ? prev[prev.length - 1].accumulatedXor : null;
        
        // Process the new cycle with XOR accumulation
        const newAccumulatedResult = processXorAccumulation(newChunk, accumulatedResult, xorTolerance);
        
        // Create visualization data for this cycle
        const cycleData = {
          cycleIndex: cycleIdxRef.current,
          rawSamples: [...newChunk],
          accumulatedXor: newAccumulatedResult,
          timestamp: Date.now(),
          channel: xorChannel,
        };
        
        // Keep limited history for performance
        const maxHistory = 15;
        const updatedChunks = [...prev, cycleData];
        return updatedChunks.length > maxHistory 
          ? updatedChunks.slice(-maxHistory)
          : updatedChunks;
      });
    }
  };

  // Replace the existing detectXorSimilarity function
  const detectXorSimilarity = (newChunk, existingChunks, tolerance) => {
    // This function is now simplified since we're using accumulation approach
    return { chunksToRemove: [], newChunkIsDuplicate: false };
  };

  // Handle play/pause with restart capability
  const handlePlayPause = () => {
    if (isPlaying) {
      // Pause playback
      clearTimeout(timerRef.current);
      setIsPlaying(false);
      isPlayingRef.current = false;
    } else {
      // Start or restart playback
      if (!signals.length) {
        alert("Please upload an ECG file first.");
        return;
      }
      
      const lead0Peaks = rPeaks[leads[0]] || [];
      
      // Check if we're at the end and need to restart
      const isAtEnd = signalMode === "cycle" 
        ? cycleIdxRef.current >= lead0Peaks.length - 1
        : displayStart >= signals.length - Math.floor(windowSeconds * fs);
      
      if (isAtEnd) {
        // Reset to beginning for replay
        setDisplayStart(0);
        cycleIdxRef.current = 0;
        
        // Clear advanced visualizations for fresh start
        setPolarTraces([]);
        setCrpMatrix(null);
        setScatterData([]);
        setXorChunks([]);
        
        // Set initial display signals
        if (signalMode === "cycle") {
          const initialSignals = getCycleSignals(0);
          setDisplaySignals(initialSignals);
        } else {
          const windowSamples = Math.floor(windowSeconds * fs);
          const initialSignals = getContinuousSignals(0, windowSamples);
          setDisplaySignals(initialSignals);
        }
      }
      
      // Initialize recurrence matrix if needed
      if (selectedVisualization === "recurrence" && !crpMatrix) {
        const desiredLen = 200;
        setCrpMatrix({
          z: Array(desiredLen).fill(0).map(() => Array(desiredLen).fill(0)),
          x: Array.from({ length: desiredLen }, (_, i) => i),
          y: Array.from({ length: desiredLen }, (_, i) => i),
          maxVal: 0,
          currentCycle: -1
        });
      }
      
      // Set playing state using both state and ref
      setIsPlaying(true);
      isPlayingRef.current = true;
      
      // Start playback
      if (signalMode === "continuous") {
        playContinuous();
      } else {
        playCycleMode();
      }
    }
  };

  // Clear functions
  const clearPolarTraces = () => setPolarTraces([]);
  const clearRecurrenceMatrix = () => {
    setCrpMatrix(null);
    setScatterData([]);
  };
  const resetXorChunks = () => setXorChunks([]);

  // Effects
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
    };
  }, []);

  // Sync ref with state
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    setIsPlaying(false);
    isPlayingRef.current = false;
    if (!signals.length) return;
    
    cycleIdxRef.current = 0;
    
    if (signalMode === "cycle") {
      const newSignals = getCycleSignals(0);
      setDisplaySignals(newSignals);
    } else {
      const windowSamples = Math.floor(windowSeconds * fs);
      setDisplayStart(0);
      const newSignals = getContinuousSignals(0, windowSamples);
      setDisplaySignals(newSignals);
    }
    
    // Reset visualizations
    setPolarTraces([]);
    setCrpMatrix(null);
    setScatterData([]);
    setXorChunks([]);
  }, [signalMode, signals, leads, cycleWindowSize, windowSeconds, fs, getCycleSignals, getContinuousSignals]);

  // Lead selection
  const toggleLead = (leadIdx) => {
    if (selectedVisualization === "recurrence") {
      setLeads(prev => {
        if (prev.includes(leadIdx)) {
          return prev.filter(l => l !== leadIdx);
        } else if (prev.length < 2) {
          return [...prev, leadIdx];
        } else {
          alert("You can select only 2 leads in Recurrence mode.");
          return prev;
        }
      });
    } else {
      setLeads(prev => {
        if (prev.includes(leadIdx)) {
          return prev.filter(l => l !== leadIdx);
        } else if (prev.length < 3) {
          return [...prev, leadIdx];
        } else {
          alert("You can select up to 3 leads only.");
          return prev;
        }
      });
    }
  };

  const handleVisualizationChange = (newMode) => {
    if (newMode === "recurrence") {
      if (leads.length > 2) {
        setLeads(leads.slice(0, 2));
      }
    }
    setSelectedVisualization(newMode);
  };

  // Prepare data for components
  const signalData = displaySignals.map((_, i) =>
    signalMode === "cycle" ? i / fs : (displayStart + i) / fs
  );

  // Debug logging
  console.log("ECGPage state:", {
    signalsLength: signals.length,
    displaySignalsLength: displaySignals.length,
    fs,
    displayFs,
    originalFs,
    aliasingWarning,
    resamplingType
  });

  return (
    <div style={{
      display: "flex",
      height: "190vh",
      width: "100%",
      background: "#f0f4f8",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    }}>
      {/* Loading Overlay */}
      {isLoading && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(255, 255, 255, 0.9)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
          flexDirection: "column",
        }}>
          <div style={{
            fontSize: "24px",
            fontWeight: "bold",
            color: "#2055c0",
            marginBottom: "20px"
          }}>
            Loading ECG Data...
          </div>
          <div style={{
            width: "50px",
            height: "50px",
            border: "5px solid #f3f3f3",
            borderTop: "5px solid #2055c0",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
        </div>
      )}

      {/* LEFT: ECG viewer + Visualizations (70%) */}
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

        <ECGControls
          handleFileUpload={handleFileUpload}
          handleUpload={handleUpload}
          handlePlayPause={handlePlayPause}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          setPlaybackSpeed={setPlaybackSpeed}
          signalMode={signalMode}
          setSignalMode={setSignalMode}
          windowSeconds={windowSeconds}
          setWindowSeconds={setWindowSeconds}
          cycleWindowSize={cycleWindowSize}
          setCycleWindowSize={setCycleWindowSize}
          xorTolerance={xorTolerance}
          setXorTolerance={setXorTolerance}
          allLeads={allLeads}
          leads={leads}
          toggleLead={toggleLead}
          selectedVisualization={selectedVisualization}
          isLoading={isLoading}
          filename={filename}
          displayFs={displayFs}
          originalFs={originalFs}
          onSamplingFrequencyChange={handleSamplingFrequencyChange}
          aliasingWarning={aliasingWarning}
          resamplingType={resamplingType}
        />

        <ECGVisualizations
          signals={displaySignals}
          signalData={signalData}
          leads={leads}
          leadNames={allLeads}
          fs={fs}
          selectedVisualization={selectedVisualization}
          setSelectedVisualization={handleVisualizationChange}
          polarTraces={polarTraces}
          setPolarTraces={setPolarTraces}
          crpMatrix={crpMatrix}
          setCrpMatrix={setCrpMatrix}
          xorChunks={xorChunks}
          setXorChunks={setXorChunks}
          xorChannel={xorChannel}
          setXorChannel={setXorChannel}
          colorScale={colorScale}
          setColorScale={setColorScale}
          recurrencePlotType={recurrencePlotType}
          setRecurrencePlotType={setRecurrencePlotType}
          polarMode={polarMode}
          setPolarMode={setPolarMode}
          isLoading={isLoading}
          signalMode={signalMode}
          scatterData={scatterData}
          clearPolarTraces={clearPolarTraces}
          clearRecurrenceMatrix={clearRecurrenceMatrix}
          resetXorChunks={resetXorChunks}
          aliasingWarning={aliasingWarning}
          displayFs={displayFs}
          originalFs={originalFs}
          resamplingType={resamplingType}
        />
      </div>

      {/* RIGHT: Analysis (30%) */}
      <ECGAnalysis
        filename={filename}
        prediction={prediction}
        predictionProbs={predictionProbs}
        isPredicting={isPredicting}
        fs={fs}
        leads={leads}
        leadNames={allLeads}
        signalMode={signalMode}
        selectedVisualization={selectedVisualization}
        isPlaying={isPlaying}
        isLoading={isLoading}
        setPrediction={setPrediction}
        setPredictionProbs={setPredictionProbs}
        setIsPredicting={setIsPredicting}
        onClassification={handleClassification}
        aliasingWarning={aliasingWarning}
        displayFs={displayFs}
        originalFs={originalFs}
        resamplingType={resamplingType}
      />
    </div>
  );
}