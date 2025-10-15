import Plot from "react-plotly.js";

export default function XORVisualization({ 
  xorChunks, 
  xorChannel, 
  channels, 
  fs, 
  windowSeconds, 
  isLoading 
}) {
  const xorTraces = () => {
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
  };

  if (isLoading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "400px",
        color: "#8d97b6",
        fontSize: "18px",
        fontWeight: "bold"
      }}>
        Loading XOR Visualization...
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        XOR overlay (channel: {xorChannel || channels[0] || "-"}) - {xorChunks.filter(chunk => !chunk.removed).length} active chunks
      </div>
      <Plot
        data={xorTraces()}
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
}