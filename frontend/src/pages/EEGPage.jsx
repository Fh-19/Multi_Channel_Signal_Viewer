import { useState, useEffect, useRef } from "react";
import Plot from "react-plotly.js";
import { uploadEegFile, fetchEegSegments } from "../services/eegService.jsx";

function EEGPage() {
  const [filename, setFilename] = useState(null);
  const [allChannels, setAllChannels] = useState([]);
  const [channels, setChannels] = useState([]);
  const [segments, setSegments] = useState([]);
  const [fs, setFs] = useState(250);

  // rolling data buffers
  const [buffer, setBuffer] = useState({});
  const [time, setTime] = useState([]);

  const segmentIndexRef = useRef(0);
  const intervalRef = useRef(null);
  const timeCounterRef = useRef(0); // keeps track of elapsed samples

  // Upload file
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const meta = await uploadEegFile(file);
      setFilename(meta.filename);
      setAllChannels(meta.channels);
      setChannels(meta.channels.slice(0, 3));
      setFs(meta.sfreq);
      setSegments([]);
      setBuffer({});
      setTime([]);
      segmentIndexRef.current = 0;
      timeCounterRef.current = 0;
    }
  };

  // Fetch all segments once
  useEffect(() => {
    if (!filename || channels.length === 0) return;
    async function loadSegments() {
      const data = await fetchEegSegments(filename, channels);
      setSegments(data.segments);
      setFs(data.fs);
      setBuffer({});
      setTime([]);
      segmentIndexRef.current = 0;
      timeCounterRef.current = 0;
    }
    loadSegments();
  }, [filename, channels]);

  // Playback loop (scrolling in real-time)
  useEffect(() => {
    if (segments.length === 0) return;

    intervalRef.current = setInterval(() => {
      const idx = segmentIndexRef.current;
      const segData = segments[idx];
      if (!segData) return;

      // append samples to buffer
      setBuffer((prev) => {
        const updated = { ...prev };
        channels.forEach((ch, i) => {
          updated[ch] = (updated[ch] || []).concat(segData.map((row) => row[i]));
          const maxLen = fs * 10; // keep last 10 seconds
          if (updated[ch].length > maxLen) {
            updated[ch] = updated[ch].slice(updated[ch].length - maxLen);
          }
        });
        return updated;
      });

      // update time axis with correct absolute values
      setTime((prev) => {
        const newTimes = segData.map(
          (_, j) => (timeCounterRef.current + j) / fs
        );
        timeCounterRef.current += segData.length;
        const combined = [...prev, ...newTimes];
        const maxLen = fs * 10;
        if (combined.length > maxLen) {
          return combined.slice(combined.length - maxLen);
        }
        return combined;
      });

      // move to next segment
      segmentIndexRef.current = (idx + 1) % segments.length;
    }, 1000); // process one segment per second

    return () => clearInterval(intervalRef.current);
  }, [segments, channels, fs]);

  // Toggle channel
  const toggleChannel = (ch) => {
    if (channels.includes(ch)) {
      setChannels(channels.filter((c) => c !== ch));
    } else if (channels.length < 5) {
      setChannels([...channels, ch]);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>EEG Viewer (Scrolling)</h2>

      {/* File upload */}
      <input type="file" accept=".set,.edf" onChange={handleFileUpload} />

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

      {/* Plots */}
      <div style={{ marginTop: "20px" }}>
        {channels.map((ch) => {
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
              }}
              config={{ displayModeBar: false }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default EEGPage;
