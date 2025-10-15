import Plot from "react-plotly.js";

const colorPalette = {
  Alzheimer: "#FF6B6B",
  Dementia: "#FFD93D",
  Epilepsy: "#6BCB77",
  Healthy: "#4D96FF",
  Schizophrenia: "#845EC2",
};

export default function EEGSignalGraphs({ channels, buffer, time, fs, windowSeconds, isLoading }) {
  if (isLoading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "300px",
        color: "#8d97b6",
        fontSize: "18px",
        fontWeight: "bold"
      }}>
        Loading EEG Traces...
      </div>
    );
  }

  if (channels.length === 0 || time.length === 0) {
    return (
      <div style={{ marginTop: 20, color: "#8d97b6" }}>
        No EEG data to display yet.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 20, flex: 1 }}>
      {channels.map((ch) => {
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
      })}
    </div>
  );
}