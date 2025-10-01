import { useState, useEffect, useRef } from "react";
import Plot from "react-plotly.js";
import {
  uploadEegFile,
  fetchEegSegments,
  predictEegFile,
} from "../services/eegService";

function EEGPage() {
  const [filename, setFilename] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);

  const [allChannels, setAllChannels] = useState([]);
  const [channels, setChannels] = useState([]);

  const [segments, setSegments] = useState([]);
  const [fs, setFs] = useState(250);

  const [prediction, setPrediction] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);

  // playback state
  const [buffer, setBuffer] = useState({});
  const [time, setTime] = useState([]);

  const segmentIndexRef = useRef(0);
  const intervalRef = useRef(null);
  const timeCounterRef = useRef(0);

  // -------------------------
  // Upload file
  // -------------------------
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadedFile(file);

    try {
      const meta = await uploadEegFile(file);
      console.log("Upload response:", meta);

      setFilename(meta.filename);
      setAllChannels(meta.channels || []);
      setChannels(meta.channels.slice(0, 3)); // show first 3 channels by default
      setFs(meta.sfreq);

      // reset everything
      setSegments([]);
      setBuffer({});
      setTime([]);
      setPrediction(null);
      segmentIndexRef.current = 0;
      timeCounterRef.current = 0;
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Check console for details.");
    }
  };

  // -------------------------
  // Fetch segments when file or channels change
  // -------------------------
  useEffect(() => {
    if (!filename || channels.length === 0) return;

    async function loadSegments() {
      try {
        const data = await fetchEegSegments(filename, channels);
        console.log("Segments loaded:", data);

        setSegments(data.segments || []);
        setFs(data.fs || 250);

        // reset playback
        setBuffer({});
        setTime([]);
        segmentIndexRef.current = 0;
        timeCounterRef.current = 0;
      } catch (err) {
        console.error("Error loading segments:", err);
        alert("Could not load segments.");
      }
    }

    loadSegments();
  }, [filename, channels]);

  // -------------------------
  // Playback loop
  // -------------------------
  useEffect(() => {
    if (!segments || segments.length === 0) return;
    clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const idx = segmentIndexRef.current;
      const segData = segments[idx];
      if (!segData) return;

      setBuffer((prev) => {
        const updated = { ...prev };
        channels.forEach((ch, i) => {
          updated[ch] = (updated[ch] || []).concat(segData.map((row) => row[i]));
          const maxLen = fs * 10; // keep last 10 seconds
          if (updated[ch].length > maxLen) {
            updated[ch] = updated[ch].slice(-maxLen);
          }
        });
        return updated;
      });

      setTime((prev) => {
        const newTimes = segData.map((_, j) => (timeCounterRef.current + j) / fs);
        timeCounterRef.current += segData.length;
        const combined = [...prev, ...newTimes];
        const maxLen = fs * 10;
        return combined.length > maxLen ? combined.slice(-maxLen) : combined;
      });

      segmentIndexRef.current = (idx + 1) % segments.length;
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [segments, channels, fs]);

  // -------------------------
  // Channel selection
  // -------------------------
  const toggleChannel = (ch) => {
    if (channels.includes(ch)) {
      setChannels(channels.filter((c) => c !== ch));
    } else if (channels.length < 5) {
      setChannels([...channels, ch]);
    }
  };

  // -------------------------
  // Predict disease
  // -------------------------
  const handlePredict = async () => {
    if (!uploadedFile) return;
    setIsPredicting(true);
    setPrediction(null);

    try {
      const res = await predictEegFile(uploadedFile);
      console.log("Prediction result:", res);
      setPrediction(res.prediction || "Unknown");
    } catch (err) {
      console.error("Prediction failed:", err);
      setPrediction("Prediction error. See console.");
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>EEG Viewer</h2>

      {/* File upload */}
      <input type="file" accept=".set,.edf" onChange={handleFileUpload} />

      {/* Predict button */}
      {uploadedFile && (
        <div style={{ marginTop: "15px" }}>
          <button onClick={handlePredict} disabled={isPredicting}>
            {isPredicting ? "Predicting..." : "Predict Disease"}
          </button>
        </div>
      )}

      {/* Prediction result */}
      {prediction && (
        <div style={{ marginTop: "15px", fontSize: "18px", fontWeight: "bold" }}>
           Predicted Disease:{" "}
          <span style={{ color: "darkblue" }}>{prediction}</span>
        </div>
      )}

      {/* Channel selector */}
      {allChannels.length > 0 && (
        <div style={{ marginTop: "10px" }}>
          <h4>Select channels (max 5):</h4>
          {allChannels.map((ch) => (
            <label key={ch} style={{ marginRight: "10px" }}>
              <input
                type="checkbox"
                checked={channels.includes(ch)}
                onChange={() => toggleChannel(ch)}
              />
              {ch}
            </label>
          ))}
        </div>
      )}

      {/* EEG plots */}
      <div style={{ marginTop: "20px" }}>
        {channels.length > 0 && time.length > 0 ? (
          channels.map((ch) => {
            const trace = {
              x: time,
              y: buffer[ch] || [],
              type: "scatter",
              mode: "lines",
              name: ch,
            };
            return (
              <Plot
                key={ch}
                data={[trace]}
                layout={{
                  width: 900,
                  height: 250,
                  title: `${ch}`,
                  xaxis: {
                    title: "Time (s)",
                    range:
                      time.length > 0
                        ? [time[0], time[time.length - 1]]
                        : undefined,
                  },
                  yaxis: { title: "Amplitude (µV)" },
                  margin: { t: 40, l: 50, r: 20, b: 40 },
                }}
                config={{ displayModeBar: false }}
              />
            );
          })
        ) : (
          <p style={{ marginTop: "20px" }}>No EEG data to display yet.</p>
        )}
      </div>
    </div>
  );
}

export default EEGPage;
