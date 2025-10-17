import { useState, useEffect, useRef, useMemo } from "react";
import EEGControls from "./EEGControls";
import EEGVisualizations from "./EEGVisualizations";
import EEGAnalysis from "./EEGAnalysis";
import { uploadEegFile, fetchEegSegments } from "../../services/eegService";

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
  const [recurrencePlotType, setRecurrencePlotType] = useState("heatmap");

  // Visualization selector
  const [selectedVisualization, setSelectedVisualization] = useState("xor");

  // bandpowers
  const [bandPowers, setBandPowers] = useState(null);
  const [bandPowerChannel, setBandPowerChannel] = useState(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // NEW: Aliasing experiment state
  const [experimentalFs, setExperimentalFs] = useState(fs);
  const [originalFs, setOriginalFs] = useState(fs);
  const [isResampling, setIsResampling] = useState(false);

  // internal refs
  const segmentIndexRef = useRef(0);
  const intervalRef = useRef(null);

  // ----- Upload handler -----
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Set loading state
    setIsLoading(true);
    setUploadedFile(file);

    console.log("=== UPLOADED FILE INFO ===");
    console.log("File name:", file.name);
    console.log("File size:", file.size, "bytes");
    console.log("File type:", file.type);
    console.log("Last modified:", new Date(file.lastModified).toLocaleString());

    if (file.name.endsWith('.edf') || file.name.endsWith('.set')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target.result;
        const uint8Array = new Uint8Array(arrayBuffer.slice(0, 256));
        console.log("First 256 bytes (hex):", Array.from(uint8Array).map(b => b.toString(16).padStart(2, '0')).join(' '));
      };
      reader.readAsArrayBuffer(file.slice(0, 256));
    }

    try {
      const meta = await uploadEegFile(file);
      setFilename(meta.filename);
      setAllChannels(meta.channels || []);
      setChannels((meta.channels || []).slice(0, 3));
      setFs(meta.sfreq || 250);
      setOriginalFs(meta.sfreq || 250);
      setExperimentalFs(meta.sfreq || 250);
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
      // Reset loading state on error
      setIsLoading(false);
    }
  };

  // ----- Fetch segments when filename, channels, OR experimentalFs changes -----
  useEffect(() => {
    if (!filename || channels.length === 0) return;

    async function loadSegments() {
      try {
        setIsResampling(true);
        const data = await fetchEegSegments(filename, channels, experimentalFs);
        setSegments(data.segments || []);
        setSegmentTimes(data.segment_times || []);
        setFs(data.fs || experimentalFs);
        setBuffer({});
        setTime([]);
        setXorChunks([]);
        setRecurrencePoints([]);
        segmentIndexRef.current = 0;
        
        // Reset loading state when segments are loaded and ready
        setTimeout(() => {
          setIsLoading(false);
          setIsResampling(false);
        }, 256);
      } catch (err) {
        console.error(err);
        alert("Could not load segments.");
        // Reset loading state on error
        setIsLoading(false);
        setIsResampling(false);
      }
    }
    loadSegments();
  }, [filename, channels, experimentalFs]);

  // ----- Playback loop (segments -> buffer) -----
  useEffect(() => {
    // stop previous interval
    clearInterval(intervalRef.current);

    if (!segments.length || !isPlaying || isLoading || isResampling) return;

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
  }, [segments, channels, fs, isPlaying, playbackSpeed, windowSeconds, xorTolerance, recurrencePair, buffer, xorChannel, isLoading, isResampling, segmentTimes]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
    };
  }, []);

  // channel toggle helper
  const toggleChannel = (ch) => {
    if (channels.includes(ch)) {
      setChannels(channels.filter((c) => c !== ch));
    } else if (channels.length < 5) {
      setChannels([...channels, ch]);
    }
  };

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      width: "100%",
      background: "#f0f4f8",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    }}>
      {/* Loading Overlay */}
      {(isLoading || isResampling) && (
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
            {isResampling ? "Resampling EEG Data..." : "Loading EEG Data..."}
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

        <EEGControls
          handleFileUpload={handleFileUpload}
          segments={segments}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          playbackSpeed={playbackSpeed}
          setPlaybackSpeed={setPlaybackSpeed}
          windowSeconds={windowSeconds}
          setWindowSeconds={setWindowSeconds}
          xorTolerance={xorTolerance}
          setXorTolerance={setXorTolerance}
          setXorChannel={setXorChannel}
          allChannels={allChannels}
          channels={channels}
          toggleChannel={toggleChannel}
          isLoading={isLoading || isResampling}
          // NEW: Aliasing experiment props
          experimentalFs={experimentalFs}
          setExperimentalFs={setExperimentalFs}
          originalFs={originalFs}
          isResampling={isResampling}
        />

        <EEGVisualizations
          channels={channels}
          buffer={buffer}
          time={time}
          fs={fs}
          windowSeconds={windowSeconds}
          xorChunks={xorChunks}
          xorChannel={xorChannel}
          polarData={useMemo(() => {
            const ch = polarChannel || channels[0];
            if (!ch) return null;
            const windowSamples = Math.round(fs * windowSeconds);
            const samples = (buffer[ch] || []).slice(-windowSamples);
            if (!samples.length) return null;

            const thetas = samples.map((_, i) => (i / samples.length) * 2 * Math.PI);
            const r = samples.map((v) => Math.abs(v));
            return { 
              theta: thetas, 
              r, 
              mode: polarMode === "latest" ? "lines" : "markers", 
              name: ch 
            };
          }, [polarChannel, channels, buffer, fs, windowSeconds, polarMode])}
          recurrenceData={useMemo(() => {
            if (!recurrencePair[0] || !recurrencePair[1] || recurrencePoints.length === 0) return null;
            
            const pts = recurrencePoints;
            const xs = pts.map(p => p[0]);
            const ys = pts.map(p => p[1]);
            
            if (recurrencePlotType === "scatter") {
              return { xs, ys };
            } else {
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
          }, [recurrencePoints, recurrencePair, recurrencePlotType])}
          selectedVisualization={selectedVisualization}
          setSelectedVisualization={setSelectedVisualization}
          recurrencePair={recurrencePair}
          recurrencePlotType={recurrencePlotType}
          setRecurrencePair={setRecurrencePair}
          setRecurrencePlotType={setRecurrencePlotType}
          setXorChunks={setXorChunks}
          setXorChannel={setXorChannel}
          setRecurrencePoints={setRecurrencePoints}
          polarChannel={polarChannel}
          setPolarChannel={setPolarChannel}
          polarMode={polarMode}
          setPolarMode={setPolarMode}
          isLoading={isLoading || isResampling}
        />
      </div>

      {/* RIGHT: prediction + bandpower (30%) */}
      <EEGAnalysis
        uploadedFile={uploadedFile}
        prediction={prediction}
        setPrediction={setPrediction}
        predictionProbs={predictionProbs}
        setPredictionProbs={setPredictionProbs}
        isPredicting={isPredicting}
        setIsPredicting={setIsPredicting}
        channels={channels}
        buffer={buffer}
        time={time}
        fs={fs}
        windowSeconds={windowSeconds}
        bandPowers={bandPowers}
        setBandPowers={setBandPowers}
        bandPowerChannel={bandPowerChannel}
        setBandPowerChannel={setBandPowerChannel}
        isLoading={isLoading || isResampling}
        experimentalFs={experimentalFs}
        isPlaying = {isPlaying}
      />
    </div>
  );
}

export default EEGPage;

