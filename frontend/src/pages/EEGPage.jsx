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
  const [segmentTimes, setSegmentTimes] = useState([]);
  const [fs, setFs] = useState(250);

  const [prediction, setPrediction] = useState(null);
  const [predictionProbs, setPredictionProbs] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);

  // playback state
  const [buffer, setBuffer] = useState({});
  const [time, setTime] = useState([]);

  const segmentIndexRef = useRef(0);
  const intervalRef = useRef(null);
  const timeCounterRef = useRef(0);

  // Upload file handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadedFile(file);

    try {
      const meta = await uploadEegFile(file);
      setFilename(meta.filename);
      setAllChannels(meta.channels || []);
      setChannels(meta.channels.slice(0, 3)); // show first 3 channels by default
      setFs(meta.sfreq || 250);

      // reset states
      setSegments([]);
      setBuffer({});
      setTime([]);
      setPrediction(null);
      setPredictionProbs(null);
      segmentIndexRef.current = 0;
      timeCounterRef.current = 0;
    } catch (err) {
      alert("Upload failed. Check console.");
      console.error(err);
    }
  };

  // Fetch segments when filename or channels changes
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
        segmentIndexRef.current = 0;
        timeCounterRef.current = 0;
      } catch (err) {
        alert("Could not load segments.");
        console.error(err);
      }
    }
    loadSegments();
  }, [filename, channels]);

  // Playback loop for EEG segments
  useEffect(() => {
    if (!segments.length) return;
    clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const idx = segmentIndexRef.current;
      const segData = segments[idx];
      const segTimes = segmentTimes[idx];
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
        const combined = [...prev, ...segTimes];
        const maxLen = fs * 10;
        return combined.length > maxLen ? combined.slice(-maxLen) : combined;
      });

      segmentIndexRef.current = (idx + 1) % segments.length;
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [segments, channels, fs]);

  // Toggle channel selection
  const toggleChannel = (ch) => {
    if (channels.includes(ch)) {
      setChannels(channels.filter((c) => c !== ch));
    } else if (channels.length < 5) {
      setChannels([...channels, ch]);
    }
  };

  // Predict disease handler
  const handlePredict = async () => {
    if (!uploadedFile) return;
    setIsPredicting(true);
    setPrediction(null);
    setPredictionProbs(null);

    try {
      const res = await predictEegFile(uploadedFile);
      // Expect res.probabilities as object {ClassName: prob}
      if (res.probabilities && Object.keys(res.probabilities).length > 0) {
        setPrediction(res.prediction || "Unknown");
        setPredictionProbs(res.probabilities);
      } else if (res.prediction) {
        setPrediction(res.prediction);
        setPredictionProbs(null);
      } else {
        setPrediction("Unknown");
        setPredictionProbs(null);
      }
    } catch (err) {
      setPrediction("Prediction error. See console.");
      console.error(err);
    } finally {
      setIsPredicting(false);
    }
  };

  const colorPalette = {
    Alzheimer: "#FF6B6B",
    Dementia: "#FFD93D",
    Epilepsy: "#6BCB77",
    Healthy: "#4D96FF",
    Schizophrenia: "#845EC2",
  };

  // --- start rendering:
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f0f4f8",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      margin: 0,
      padding: "30px 0"
    }}>
      {/* ALL PAGE CONTENT INSIDE THIS CENTERED CONTAINER */}
      <div style={{
        background: "#f6faff",
        maxWidth: 1050,
        margin: "auto",
        borderRadius: 18,
        boxShadow: "0 6px 40px rgba(0,0,0,0.10)",
        padding: "38px 44px 50px 44px",
        minHeight: 690
      }}>
        {/* Top title and nav */}
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          marginBottom: 16
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontWeight: 700,
              fontSize: 32,
              color: "#263357",
              letterSpacing: "1px"
            }}>
              Multi-Channel Signal Viewer
            </h1>
            {/* Optional: Breadcrumbs or nav links */}
            <div style={{ marginTop: 8, fontSize: 16 }}>
              <a href="/ecg" style={{ color: "#2055c0", marginRight: 18, fontWeight: 500, textDecoration: "underline" }}>
                ECG Viewer
              </a>
              <a href="/eeg" style={{ color: "#2055c0", fontWeight: 500, textDecoration: "underline" }}>
                EEG Viewer
              </a>
            </div>
          </div>
        </div>
        {/* Main EEG Viewer */}
        <div style={{
          background: "#e8eef8",
          borderRadius: 16,
          padding: "25px 32px",
          marginTop: 18,
          boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
        }}>
          <h2 style={{
            color: "#263357",
            margin: "0 0 24px 0",
            textAlign: "center",
            fontWeight: 600,
            fontSize: "2rem"
          }}>
            EEG Viewer
          </h2>
          {/* File Upload */}
          <input
            type="file"
            accept=".set,.edf"
            onChange={handleFileUpload}
            style={{
              marginBottom: 18,
              padding: "10px 14px",
              borderRadius: 7,
              border: "1px solid #b7cdfc",
              width: "100%",
              maxWidth: 410,
              fontSize: 17,
              background: "#fafeff"
            }}
          />
          {/* Predict */}
          {uploadedFile && (
            <div style={{ textAlign: "center", margin: "10px 0 30px 0" }}>
              <button
                onClick={handlePredict}
                disabled={isPredicting}
                style={{
                  padding: "12px 32px",
                  fontSize: 18,
                  fontWeight: "bold",
                  color: "#fff",
                  backgroundColor: isPredicting ? "#7f93b7" : "#2055c0",
                  border: "none",
                  borderRadius: 9,
                  cursor: isPredicting ? "not-allowed" : "pointer",
                  boxShadow: "0 6px 18px rgba(50,80,200,0.16)",
                  transition: "background-color 0.2s ease"
                }}>
                {isPredicting ? "Predicting..." : "Predict Disease"}
              </button>
            </div>
          )}
          {/* Prediction results - Bar chart */}
          {predictionProbs ? (
            <div
              style={{
                maxWidth: 700,
                margin: "20px auto",
                backgroundColor: "transparent",
                borderRadius: 10,
                padding: 0,
                boxShadow: "",
              }}
            >
              <div style={{ marginBottom: 7, fontSize: 21, textAlign: "center", color: "#3635a7", fontWeight: 700 }}>
                Predicted Disease: <span style={{ color: colorPalette[prediction] || "#2055c0" }}>{prediction}</span>
              </div>
              <div style={{ marginBottom: 12, fontSize: 15, textAlign: "center", color: "#16a575" }}>
                Confidence Level: {(Math.max(...Object.values(predictionProbs)) * 100).toFixed(1)}%
              </div>
              <Plot
                data={[
                  {
                    type: "bar",
                    x: Object.values(predictionProbs),
                    y: Object.keys(predictionProbs),
                    orientation: "h",
                    marker: {
                      color: Object.keys(predictionProbs).map((cls) => colorPalette[cls] || "#2055c0"),
                    },
                    text: Object.values(predictionProbs).map((v) => (v * 100).toFixed(1) + "%"),
                    textposition: "auto",
                  },
                ]}
                layout={{
                  margin: { l: 50, r: 100, t: 10, b: 30 },
                  xaxis: {
                    range: [0, 1],
                    title: "Probability",
                    showgrid: true,
                    zeroline: true,
                  },
                    yaxis: {
                      automargin: true,  // let Plotly handle y axis label spacing
                      tickfont: { size: 5 },
                  } ,
                  height: 308,
                  font: {
                    family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                    size: 20,
                  },
                  yaxis: { automargin: true },
                }}
                config={{ displayModeBar: false }}
              />
            </div>
          ) : prediction ? (
            <div
              style={{
                marginTop: 18,
                fontSize: 18,
                fontWeight: "bold",
                color: colorPalette[prediction] || "#2055c0",
                textAlign: "center",
              }}
            >
              Predicted Disease: {prediction}
            </div>
          ) : null}
          {/* Channel Selection */}
          {allChannels.length > 0 && (
            <div style={{ marginTop: 30, maxWidth: 610, marginLeft: "auto", marginRight: "auto" }}>
              <h4 style={{ color: "#2055c0", marginBottom: 9, textAlign: "center", fontWeight: 600, fontSize: 18 }}>
                Select Channels (max 5)
              </h4>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
                {allChannels.map((ch) => (
                  <label
                    key={ch}
                    style={{
                      cursor: "pointer",
                      userSelect: "none",
                      marginRight: 16,
                      marginBottom: 14,
                      padding: "6px 14px",
                      borderRadius: 13,
                      border: "2px solid",
                      borderColor: channels.includes(ch) ? "#2055c0" : "#aaa",
                      backgroundColor: channels.includes(ch) ? "#e2edff" : "#f9f9f9",
                      color: channels.includes(ch) ? "#263357" : "#878787",
                      fontWeight: channels.includes(ch) ? 600 : 400,
                      transition: "all 0.2s ease",
                      fontSize: 15,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={channels.includes(ch)}
                      onChange={() => toggleChannel(ch)}
                      style={{ marginRight: 6 }}
                    />
                    {ch}
                  </label>
                ))}
              </div>
            </div>
          )}
          {/* EEG plots */}
          <div style={{ marginTop: 32 }}>
            {channels.length > 0 && time.length > 0 ? (
              channels.map((ch) => {
                const trace = {
                  x: time,
                  y: buffer[ch] || [],
                  type: "scatter",
                  mode: "lines",
                  name: ch,
                  line: { shape: "spline", smoothing: 1.3, width: 2, color: colorPalette[ch] || "#2355c0" },
                };
                return (
                  <Plot
                    key={ch}
                    data={[trace]}
                    layout={{
                      width: 900,
                      height: 250,
                      title: ch,
                      xaxis: {
                        title: "Time (s)",
                        range: time.length > 0 ? [time[0], time[time.length - 1]] : undefined,
                        zeroline: false, showgrid: true,
                      },
                      yaxis: { title: "Amplitude (µV)", zeroline: false, showgrid: true },
                      margin: { t: 40, l: 50, r: 20, b: 40 },
                      font: { family: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" },
                    }}
                    config={{ displayModeBar: false }}
                  />
                );
              })
            ) : (
              <p style={{ marginTop: 20, color: "#8d97b6", textAlign: "center", fontSize: 17 }}>
                No EEG data to display yet.
              </p>
            )}
          </div>
        </div>
        {/* END MAIN EEG VIEWER container */}
      </div>
    </div>
  );
}

export default EEGPage;

