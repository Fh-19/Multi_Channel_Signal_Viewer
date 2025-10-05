// src/pages/EEGPage.jsx
import { useState, useEffect, useRef, useMemo } from "react";
import Plot from "react-plotly.js";
import {
  uploadEegFile,
  fetchEegSegments,
  predictEegFile,
} from "../services/eegService";

function EEGPage() {
  // file + metadata
  const [filename, setFilename] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [allChannels, setAllChannels] = useState([]);
  const [channels, setChannels] = useState([]);

  // segments / playback
  const [segments, setSegments] = useState([]);
  const [segmentTimes, setSegmentTimes] = useState([]);
  const [fs, setFs] = useState(250);
  const [windowSeconds, setWindowSeconds] = useState(10);

  // prediction
  const [prediction, setPrediction] = useState(null);
  const [predictionProbs, setPredictionProbs] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);

  // playback buffer (per channel)
  const [buffer, setBuffer] = useState({});
  const [time, setTime] = useState([]);

  // playback controls
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // advanced viz state
  const [xorTolerance, setXorTolerance] = useState(5.0);
  const [xorChunks, setXorChunks] = useState([]);
  const [xorChannel, setXorChannel] = useState(null);
  const [polarMode, setPolarMode] = useState("latest");
  const [polarChannel, setPolarChannel] = useState(null);
  const [recurrencePair, setRecurrencePair] = useState([null, null]);
  const [recurrencePoints, setRecurrencePoints] = useState([]);
  const [recurrencePlotType, setRecurrencePlotType] = useState("heatmap"); // NEW: scatter or heatmap

  // NEW: Visualization selector
  const [selectedVisualization, setSelectedVisualization] = useState("xor");

  // internal refs
  const segmentIndexRef = useRef(0);
  const intervalRef = useRef(null);

  // bandpowers
  const [bandPowers, setBandPowers] = useState(null);
  const [bandPowerChannel, setBandPowerChannel] = useState(null);

  // --- Compute EEG bands (use selected channel) ---
  const bandData = useMemo(() => {
    if (!channels.length || !time.length) return null;

    const selectedChannel = bandPowerChannel || channels[0];
    const samples = buffer[selectedChannel] || [];
    if (samples.length < fs) return null;

    // FFT
    const N = samples.length;
    const freqs = Array.from({ length: Math.floor(N / 2) }, (_, i) => (i * fs) / N);
    const fft = new Array(N);
    for (let k = 0; k < N; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) {
        const phi = (2 * Math.PI * k * n) / N;
        re += samples[n] * Math.cos(phi);
        im -= samples[n] * Math.sin(phi);
      }
      fft[k] = Math.sqrt(re * re + im * im);
    }
    const psd = fft.slice(0, Math.floor(N / 2));

    // Band ranges (Hz)
    const bands = {
      Delta: [0.5, 4],
      Theta: [4, 8],
      Alpha: [8, 13],
      Beta: [13, 30],
      Gamma: [30, 100],
    };

    // Compute absolute power per band
    const power = {};
    let total = 0;
    for (const [band, [low, high]] of Object.entries(bands)) {
      let sum = 0;
      for (let i = 0; i < freqs.length; i++) {
        if (freqs[i] >= low && freqs[i] < high) sum += psd[i];
      }
      power[band] = sum;
      total += sum;
    }

    // Convert to relative (%) power
    const relative = {};
    for (const band of Object.keys(power)) {
      relative[band] = total > 0 ? (power[band] / total) * 100 : 0;
    }
    return relative;

  }, [buffer, channels, fs, time, bandPowerChannel]);

  const colorPalette = {
    Alzheimer: "#FF6B6B",
    Dementia: "#FFD93D",
    Epilepsy: "#6BCB77",
    Healthy: "#4D96FF",
    Schizophrenia: "#845EC2",
  };

  // ----- Upload handler -----
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadedFile(file);

    try {
      const meta = await uploadEegFile(file);
      setFilename(meta.filename);
      setAllChannels(meta.channels || []);
      setChannels((meta.channels || []).slice(0, 3));
      setFs(meta.sfreq || 250);
      setBandPowerChannel(null);
      setXorChannel(null);

      // reset state
      setSegments([]);
      setSegmentTimes([]);
      setBuffer({});
      setTime([]);
      setPrediction(null);
      setPredictionProbs(null);
      setXorChunks([]);
      setRecurrencePoints([]);
      segmentIndexRef.current = 0;
    } catch (err) {
      console.error(err);
      alert("Upload failed. See console.");
    }
  };

  // keep it in state for plotting
  useEffect(() => {
    if (bandData) setBandPowers(bandData);
  }, [bandData]);

  // ----- Fetch segments when filename or channels change -----
  useEffect(() => {
    if (!filename || channels.length === 0) return;

    async function loadSegments() {
      try {
        const data = await fetchEegSegments(filename, channels);
        setSegments(data.segments || []);
        setSegmentTimes(data.segment_times || []);
        setFs(data.fs || 250);
        setBuffer({});
        setTime([]);
        setXorChunks([]);
        setRecurrencePoints([]);
        segmentIndexRef.current = 0;
      } catch (err) {
        console.error(err);
        alert("Could not load segments.");
      }
    }
    loadSegments();
  }, [filename, channels]);

  // ----- Playback loop (segments -> buffer) -----
  useEffect(() => {
    // stop previous interval
    clearInterval(intervalRef.current);

    if (!segments.length || !isPlaying) return;

    const segDurationMs = (() => {
      if (segmentTimes && segmentTimes.length > 0 && segmentTimes[0].length > 1) {
        const times = segmentTimes[0];
        return Math.max(1, (times[times.length - 1] - times[0]) * 1000);
      }
      return 1000;
    })();

    const intervalMs = segDurationMs / playbackSpeed;
    intervalRef.current = setInterval(() => {
      const idx = segmentIndexRef.current;
      const segData = segments[idx];
      const segTimes = segmentTimes[idx] || [];

      if (!segData) return;

      // push segment into buffer
      setBuffer((prev) => {
        const updated = { ...prev };
        channels.forEach((ch, chIdx) => {
          const chSamples = segData.map((row) => row[chIdx]);
          updated[ch] = (updated[ch] || []).concat(chSamples);
          const maxLen = Math.round(fs * windowSeconds);
          if (updated[ch].length > maxLen) {
            updated[ch] = updated[ch].slice(-maxLen);
          }
        });
        return updated;
      });

      // push times
      setTime((prev) => {
        const combined = [...prev, ...(segTimes.length ? segTimes : new Array(segData.length).fill(0))];
        const maxLen = Math.round(fs * windowSeconds);
        return combined.length > maxLen ? combined.slice(-maxLen) : combined;
      });

      // XOR Overlay Logic
      const windowSamples = Math.round(fs * windowSeconds);
      const selectedXorChannel = xorChannel || channels[0];
      
      if (selectedXorChannel && segData.length > 0) {
        const currentBufferSamples = buffer[selectedXorChannel] || [];
        
        if (currentBufferSamples.length >= windowSamples) {
          const currentChunk = currentBufferSamples.slice(-windowSamples);
          
          setXorChunks((prev) => {
            const newChunk = {
              samples: [...currentChunk],
              removed: false,
              id: Date.now() + Math.random(),
              channel: selectedXorChannel,
            };

            let chunksToRemove = [];
            let newChunkIsDuplicate = false;

            for (let i = 0; i < prev.length; i++) {
              if (prev[i].removed) continue;
              
              const existingChunk = prev[i].samples;
              
              let totalDiff = 0;
              for (let k = 0; k < windowSamples; k++) {
                totalDiff += Math.abs(existingChunk[k] - newChunk.samples[k]);
              }
              const meanDiff = totalDiff / windowSamples;
              
              const existingRange = Math.max(...existingChunk) - Math.min(...existingChunk);
              const newRange = Math.max(...newChunk.samples) - Math.min(...newChunk.samples);
              
              console.log(`XOR Comparison [${selectedXorChannel}] - Mean diff: ${meanDiff.toFixed(4)}µV, Tolerance: ${xorTolerance}µV`);
              
              if (meanDiff <= xorTolerance) {
                console.log(`🚨 REMOVING CHUNKS [${selectedXorChannel}] - Mean diff ${meanDiff.toFixed(4)}µV <= Tolerance ${xorTolerance}µV`);
                chunksToRemove.push(i);
                newChunkIsDuplicate = true;
              }
            }

            const updatedChunks = prev.map((chunk, index) => {
              if (chunksToRemove.includes(index)) {
                console.log(`🗑️ Removing existing chunk ${index} from channel ${chunk.channel}`);
                return { ...chunk, removed: true };
              }
              return chunk;
            });

            let result;
            if (newChunkIsDuplicate) {
              console.log(`🗑️ Not adding new chunk from ${selectedXorChannel} - it's a duplicate`);
              result = updatedChunks;
            } else {
              console.log(`✅ Adding new chunk from ${selectedXorChannel} - unique signal`);
              result = [...updatedChunks, newChunk];
            }

            const maxChunksHistory = 20;
            if (result.length > maxChunksHistory) {
              return result.slice(-maxChunksHistory);
            }
            return result;
          });
        }
      }

      // Recurrence points collection
      const [chX, chY] = recurrencePair;
      if (chX && chY) {
        setRecurrencePoints((prev) => {
          const xArr = (buffer[chX] || []).slice(-Math.round(fs * windowSeconds)).concat(
            segData.map((row) => row[channels.indexOf(chX)])
          ).slice(-Math.round(fs * windowSeconds));
          const yArr = (buffer[chY] || []).slice(-Math.round(fs * windowSeconds)).concat(
            segData.map((row) => row[channels.indexOf(chY)])
          ).slice(-Math.round(fs * windowSeconds));

          const newPts = [];
          const n = Math.min(xArr.length, yArr.length);
          for (let i = 0; i < n; i++) {
            newPts.push([xArr[i], yArr[i]]);
          }

          const concat = prev.concat(newPts);
          const maxPoints = 5000;
          return concat.length > maxPoints ? concat.slice(-maxPoints) : concat;
        });
      }

      // advance segment index
      segmentIndexRef.current = (idx + 1) % segments.length;
    }, intervalMs);

    return () => clearInterval(intervalRef.current);
  }, [segments, channels, fs, isPlaying, playbackSpeed, windowSeconds, xorTolerance, recurrencePair, buffer, xorChannel]);

  // ----- Predict handler -----
  const handlePredict = async () => {
    if (!uploadedFile) return;
    setIsPredicting(true);
    setPrediction(null);
    setPredictionProbs(null);

    try {
      const res = await predictEegFile(uploadedFile);
      if (res.probabilities && Object.keys(res.probabilities).length > 0) {
        setPrediction(res.prediction || "Unknown");
        setPredictionProbs(res.probabilities);
      } else if (res.prediction) {
        setPrediction(res.prediction);
      } else {
        setPrediction("Unknown");
      }
    } catch (err) {
      console.error(err);
      setPrediction("Prediction error");
    } finally {
      setIsPredicting(false);
    }
  };

  // channel toggle helper
  const toggleChannel = (ch) => {
    if (channels.includes(ch)) {
      setChannels(channels.filter((c) => c !== ch));
    } else if (channels.length < 5) {
      setChannels([...channels, ch]);
    }
  };

  // --- Derived data for plots ---

  // XOR overlay traces
  const xorTraces = useMemo(() => {
    const selectedXorChannel = xorChannel || channels[0];
    if (!selectedXorChannel) return [];
    const windowSamples = Math.round(fs * windowSeconds);
    const traces = [];
    const timeAxis = Array.from({ length: windowSamples }, (_, i) => i / fs);

    const activeChunks = xorChunks.filter(chunk => !chunk.removed);
    
    activeChunks.forEach((chunk, idx) => {
      const vals = chunk.samples.slice(-windowSamples);
      traces.push({
        x: timeAxis,
        y: vals,
        type: "scatter",
        mode: "lines",
        name: `chunk ${idx + 1} (${chunk.channel})`,
        opacity: 0.6,
        line: { width: 1.5, color: `hsl(${(idx * 45) % 360}, 70%, 50%)` },
        hoverinfo: "name+y",
      });
    });
    return traces;
  }, [xorChunks, channels, fs, windowSeconds, xorChannel]);

  // polar data for selected channel
  const polarData = useMemo(() => {
    const ch = polarChannel || channels[0];
    if (!ch) return null;
    const windowSamples = Math.round(fs * windowSeconds);
    const samples = (buffer[ch] || []).slice(-windowSamples);
    if (!samples.length) return null;

    const thetas = samples.map((_, i) => (i / samples.length) * 2 * Math.PI);
    const r = samples.map((v) => Math.abs(v));
    if (polarMode === "latest") {
      return { theta: thetas, r, mode: "lines", name: ch };
    } else {
      return { theta: thetas, r, mode: "markers", name: ch };
    }
  }, [polarChannel, channels, buffer, fs, windowSeconds, polarMode]);

  // Recurrence plot data
  const recurrenceData = useMemo(() => {
    if (!recurrencePair[0] || !recurrencePair[1] || recurrencePoints.length === 0) return null;
    
    const pts = recurrencePoints;
    const xs = pts.map(p => p[0]);
    const ys = pts.map(p => p[1]);
    
    if (recurrencePlotType === "scatter") {
      return { xs, ys };
    } else {
      // Heatmap data
      const bins = 50;
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs);
      const yMin = Math.min(...ys);
      const yMax = Math.max(...ys);
      
      if (xMin === xMax || yMin === yMax) return null;
      
      const xStep = (xMax - xMin) / bins;
      const yStep = (yMax - yMin) / bins;
      
      const matrix = Array.from({ length: bins }, () => Array(bins).fill(0));
      
      pts.forEach(([x, y]) => {
        const xi = Math.min(bins - 1, Math.max(0, Math.floor((x - xMin) / xStep)));
        const yi = Math.min(bins - 1, Math.max(0, Math.floor((y - yMin) / yStep)));
        matrix[yi][xi] += 1;
      });
      
      return {
        z: matrix,
        x: Array.from({ length: bins }, (_, i) => xMin + i * xStep),
        y: Array.from({ length: bins }, (_, i) => yMin + i * yStep),
      };
    }
  }, [recurrencePoints, recurrencePair, recurrencePlotType]);

  // Render selected visualization
  const renderSelectedVisualization = () => {
    switch (selectedVisualization) {
      case "xor":
        return (
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              XOR overlay (channel: {xorChannel || channels[0] || "-"}) - {xorChunks.filter(chunk => !chunk.removed).length} active chunks
            </div>
            <Plot
              data={xorTraces}
              layout={{
                height: 400,
                margin: { t: 20, l: 40, r: 20, b: 28 },
                xaxis: { title: "Relative time (s)" },
                yaxis: { title: "Amplitude (µV)" },
              }}
              config={{ responsive: true, displaylogo: false }}
              style={{ width: "100%" }}
            />
          </div>
        );
      
      case "polar":
        return (
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Polar plot ({polarMode})</div>
            {polarData ? (
              <Plot
                data={[
                  {
                    type: "scatterpolar",
                    r: polarData.r,
                    theta: polarData.theta.map((t) => (t * 180 / Math.PI)),
                    mode: polarData.mode,
                    marker: { size: 3, opacity: 0.8 },
                    line: { shape: "spline" },
                  },
                ]}
                layout={{ polar: { radialaxis: { visible: true } }, height: 400, margin: { t: 10, b: 20 } }}
                config={{ displaylogo: false, responsive: true }}
                style={{ width: "100%" }}
              />
            ) : (
              <div style={{ color: "#8d97b6" }}>Polar plot waiting for data...</div>
            )}
          </div>
        );
      
      case "recurrence":
        return (
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              Recurrence {recurrencePlotType} ({recurrencePair[0] || "-"} vs {recurrencePair[1] || "-"})
            </div>
            {recurrenceData ? (
              recurrencePlotType === "scatter" ? (
                <Plot
                  data={[{
                    type: "scatter",
                    mode: "markers",
                    x: recurrenceData.xs,
                    y: recurrenceData.ys,
                    marker: {
                      size: 3,
                      opacity: 0.6,
                      color: "#2055c0"
                    }
                  }]}
                  layout={{
                    height: 400,
                    xaxis: { title: recurrencePair[0] },
                    yaxis: { title: recurrencePair[1] },
                    margin: { t: 40, l: 50, r: 20, b: 50 },
                  }}
                  config={{ displayModeBar: false }}
                  style={{ width: "100%" }}
                />
              ) : (
                <Plot
                  data={[{
                    type: "heatmap",
                    z: recurrenceData.z,
                    x: recurrenceData.x,
                    y: recurrenceData.y,
                    colorscale: "Viridis",
                    showscale: true,
                    hoverinfo: "x+y+z",
                  }]}
                  layout={{
                    height: 400,
                    xaxis: { title: recurrencePair[0] },
                    yaxis: { title: recurrencePair[1], scaleanchor: "x" },
                    margin: { t: 40, l: 50, r: 20, b: 50 },
                  }}
                  config={{ displayModeBar: false }}
                  style={{ width: "100%" }}
                />
              )
            ) : (
              <div style={{ color: "#8d97b6" }}>Recurrence plot waiting for selected channels and data...</div>
            )}
          </div>
        );
      
      default:
        return <div>Select a visualization</div>;
    }
  };

  // ----- UI render -----
  return (
    <div style={{
      display: "flex",
      height: "100vh",
      width: "100%",
      background: "#f0f4f8",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    }}>
      {/* LEFT: EEG viewer + Selected Visualization (70%) */}
      <div style={{
        flex: 7,
        padding: "20px 28px",
        overflowY: "auto",
        borderRight: "2px solid #dbe2ef",
        display: "flex",
        flexDirection: "column",
      }}>
        <h1 style={{ margin: "0 0 18px 0", fontWeight: 700, fontSize: 26, color: "#263357" }}>
          EEG Signal Viewer
        </h1>

        {/* Upload */}
        <input
          type="file"
          accept=".set,.edf"
          onChange={handleFileUpload}
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

        {/* Playback controls */}
        {segments.length > 0 && (
          <div style={{ marginTop: 10, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: "none",
                background: isPlaying ? "#e74c3c" : "#2ecc71",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>

            <label style={{ fontSize: 14 }}>
              Speed:
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 6 }}
              >
                <option value={0.25}>0.25x</option>
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            </label>

            <label style={{ fontSize: 14 }}>
              Window (s):
              <input
                type="number"
                min={1}
                max={60}
                value={windowSeconds}
                onChange={(e) => setWindowSeconds(Number(e.target.value))}
                style={{ width: 80, marginLeft: 8, padding: "6px", borderRadius: 6 }}
              />
            </label>

            <label style={{ fontSize: 14 }}>
              XOR tol (µV):
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={xorTolerance}
                onChange={(e) => setXorTolerance(Number(e.target.value))}
                style={{ width: 120, marginLeft: 8, padding: "6px", borderRadius: 6 }}
              />
            </label>
          </div>
        )}

        {/* channel selection */}
        {allChannels.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <h4 style={{ color: "#2055c0", marginBottom: 8 }}>Channels (max 5)</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {allChannels.map((ch) => (
                <label key={ch} style={{
                  cursor: "pointer",
                  padding: "6px 12px",
                  borderRadius: 12,
                  border: channels.includes(ch) ? "2px solid #2055c0" : "1px solid #ddd",
                  background: channels.includes(ch) ? "#e8f0ff" : "#fafafa",
                  fontWeight: channels.includes(ch) ? 700 : 400,
                }}>
                  <input
                    type="checkbox"
                    checked={channels.includes(ch)}
                    onChange={() => toggleChannel(ch)}
                    style={{ marginRight: 8 }}
                  />
                  {ch}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Main EEG traces */}
        <div style={{ marginTop: 20, flex: 1 }}>
          {channels.length > 0 && time.length > 0 ? (
            channels.map((ch) => {
              const trace = {
                x: time.slice(-Math.round(fs * windowSeconds)),
                y: (buffer[ch] || []).slice(-Math.round(fs * windowSeconds)),
                type: "scatter",
                mode: "lines",
                name: ch,
                line: { shape: "spline", smoothing: 1.2, width: 1.6, color: colorPalette[ch] || "#2355c0" },
              };
              return (
                <Plot
                  key={ch}
                  data={[trace]}
                  layout={{
                    height: 220,
                    title: ch,
                    xaxis: {
                      title: "Time (s)",
                      zeroline: false,
                      showgrid: true,
                    },
                    yaxis: { title: "Amplitude (µV)", zeroline: false, showgrid: true },
                    margin: { t: 36, l: 50, r: 20, b: 36 },
                  }}
                  config={{
                    responsive: true,
                    scrollZoom: true,
                    displaylogo: false,
                    modeBarButtonsToRemove: ["resetScale2d"],
                  }}
                  style={{ width: "100%", marginBottom: 14 }}
                />
              );
            })
          ) : (
            <div style={{ marginTop: 20, color: "#8d97b6" }}>
              No EEG data to display yet.
            </div>
          )}
        </div>

        {/* Visualization Selector and Controls */}
        <div style={{ marginTop: 30, borderTop: "2px solid #dbe2ef", paddingTop: 20 }}>
          <h3 style={{ margin: "0 0 15px 0", color: "#263357" }}>Advanced Visualizations</h3>
          
          {/* Visualization Selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 14, fontWeight: 600 }}>
              Select Visualization:
              <select
                value={selectedVisualization}
                onChange={(e) => setSelectedVisualization(e.target.value)}
                style={{ marginLeft: 8, padding: "8px 12px", borderRadius: 6, fontSize: 14 }}
              >
                <option value="xor">XOR Overlay</option>
                <option value="polar">Polar Plot</option>
                <option value="recurrence">Recurrence Plot</option>
              </select>
            </label>
          </div>

          {/* Visualization-specific controls */}
          <div style={{ marginBottom: 20 }}>
            {selectedVisualization === "xor" && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>
                  XOR Channel:
                  <select
                    value={xorChannel || ""}
                    onChange={(e) => setXorChannel(e.target.value || null)}
                    style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 6 }}
                  >
                    <option value="">Auto (first channel)</option>
                    {channels.map((ch) => <option key={`xor-${ch}`} value={ch}>{ch}</option>)}
                  </select>
                </label>
                <button
                  onClick={() => setXorChunks([])}
                  style={{ marginLeft: 15, padding: "6px 10px", borderRadius: 6, border: "none", background: "#2055c0", color: "#fff", fontWeight: 700 }}
                >
                  Reset XOR
                </button>
              </div>
            )}

            {selectedVisualization === "polar" && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>
                  Polar Channel:
                  <select
                    value={polarChannel || ""}
                    onChange={(e) => setPolarChannel(e.target.value || null)}
                    style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 6 }}
                  >
                    <option value="">Auto (first channel)</option>
                    {channels.map((ch) => <option key={`polar-${ch}`} value={ch}>{ch}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 13, fontWeight: 600, marginLeft: 15 }}>
                  Mode:
                  <select value={polarMode} onChange={(e) => setPolarMode(e.target.value)} style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 6 }}>
                    <option value="latest">Latest window</option>
                    <option value="cumulative">Cumulative</option>
                  </select>
                </label>
              </div>
            )}

            {selectedVisualization === "recurrence" && (
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>
                    chX:
                    <select value={recurrencePair[0] || ""} onChange={(e) => setRecurrencePair([e.target.value || null, recurrencePair[1]])} style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 6 }}>
                      <option value="">Select</option>
                      {channels.map((c) => <option value={c} key={"x"+c}>{c}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>
                    chY:
                    <select value={recurrencePair[1] || ""} onChange={(e) => setRecurrencePair([recurrencePair[0], e.target.value || null])} style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 6 }}>
                      <option value="">Select</option>
                      {channels.map((c) => <option value={c} key={"y"+c}>{c}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>
                    Type:
                    <select value={recurrencePlotType} onChange={(e) => setRecurrencePlotType(e.target.value)} style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 6 }}>
                      <option value="heatmap">Heatmap</option>
                      <option value="scatter">Scatter</option>
                    </select>
                  </label>
                </div>
                <button onClick={() => setRecurrencePoints([])} style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "#e74c3c", color: "#fff", fontWeight: 700 }}>
                  Reset Recurrence
                </button>
              </div>
            )}
          </div>

          {/* Selected Visualization */}
          <div style={{ marginTop: 20 }}>
            {renderSelectedVisualization()}
          </div>
        </div>
      </div>

      {/* RIGHT: prediction + bandpower (30%) - ALWAYS VISIBLE */}
      <div style={{
        flex: 3,
        padding: "20px 24px",
        overflowY: "auto",
        background: "#fff",
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 12, color: "#263357" }}>Prediction + Band Powers</h2>

        {/* Prediction */}
        <div style={{ marginBottom: 25 }}>
          <div style={{ marginBottom: 8 }}>
            <button
              onClick={handlePredict}
              disabled={isPredicting || !uploadedFile}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "none",
                background: isPredicting ? "#7f93b7" : "#2055c0",
                color: "#fff",
                fontWeight: 700,
                cursor: isPredicting ? "not-allowed" : "pointer"
              }}
            >
              {isPredicting ? "Predicting..." : "Predict Disease"}
            </button>
          </div>

          {predictionProbs ? (
            <>
              <div style={{ fontSize: 15, marginBottom: 8 }}>
                Predicted: <strong style={{ color: colorPalette[prediction] || "#2055c0" }}>{prediction}</strong>
              </div>
              <Plot
                data={[{
                  type: "bar",
                  x: Object.values(predictionProbs),
                  y: Object.keys(predictionProbs),
                  orientation: "h",
                  marker: { color: Object.keys(predictionProbs).map(cls => colorPalette[cls] || "#2055c0") },
                  text: Object.values(predictionProbs).map(v => (v * 100).toFixed(1) + "%"),
                  textposition: "auto",
                }]}
                layout={{ margin: { l: 70, r: 20, t: 10, b: 20 }, height: 260, xaxis: { range: [0,1], title: "Probability" } }}
                config={{ displayModeBar: false }}
                style={{ width: "100%" }}
              />
            </>
          ) : prediction ? (
            <div style={{ fontWeight: 700, color: "#2055c0" }}>Predicted: {prediction}</div>
          ) : (
            <div style={{ color: "#8d97b6" }}>No prediction yet.</div>
          )}
        </div>

        {/* Band Power Chart */}
        <div style={{ marginTop: 25 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>EEG Band Powers</div>
          
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              Channel:
              <select
                value={bandPowerChannel || ""}
                onChange={(e) => setBandPowerChannel(e.target.value || null)}
                style={{ marginLeft: 8, padding: "4px 8px", borderRadius: 4, fontSize: 13 }}
              >
                <option value="">Auto (first channel)</option>
                {channels.map((ch) => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            </label>
          </div>

          {bandPowers ? (
            <Plot
              data={[
                {
                  type: "bar",
                  x: Object.keys(bandPowers),
                  y: Object.values(bandPowers),
                  marker: { color: ["#4D96FF", "#6BCB77", "#FFD93D", "#FF6B6B", "#845EC2"] },
                  text: Object.values(bandPowers).map(v => v.toFixed(1) + "%"),
                  textposition: "auto",
                },
              ]}
              layout={{
                height: 250,
                margin: { t: 20, l: 40, r: 20, b: 40 },
                yaxis: { title: "Relative Power (%)", range: [0, 100] },
                title: `Channel: ${bandPowerChannel || channels[0] || "-"}`,
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%" }}
            />
          ) : (
            <div style={{ color: "#8d97b6" }}>Band power chart waiting for data...</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EEGPage;