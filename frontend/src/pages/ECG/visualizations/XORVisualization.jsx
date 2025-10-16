import Plot from "react-plotly.js";

export default function XORVisualization({ 
  xorChunks, 
  xorChannel, 
  leadNames, 
  isLoading 
}) {
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

  const activeChunks = xorChunks.filter(chunk => !chunk.removed);
  const xorTraces = activeChunks.map((chunk, idx) => ({
    x: Array.from({ length: chunk.samples.length }, (_, i) => i / 500),
    y: chunk.samples,
    type: "scatter",
    mode: "lines",
    name: `Cycle ${chunk.cycleIndex + 1} (${leadNames[chunk.channel]})`,
    opacity: 0.6,
    line: { width: 1.5, color: `hsl(${(idx * 45) % 360}, 70%, 50%)` },
    hoverinfo: "name+y",
  }));

  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        XOR Overlay - {activeChunks.length} unique cycles ({leadNames[xorChannel]})
      </div>
      {activeChunks.length > 0 ? (
        <Plot
          data={xorTraces}
          layout={{
            width: "100%",
            height: 400,
            margin: { l: 50, r: 20, t: 40, b: 40 },
            xaxis: { title: "Time (s)" },
            yaxis: { title: "Amplitude (mV)" },
            showlegend: true,
          }}
          config={{ displayModeBar: false }}
        />
      ) : (
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          height: "400px",
          color: "#8d97b6",
          border: "1px dashed #ddd",
          borderRadius: "8px"
        }}>
          XOR overlay waiting for unique cycle patterns...
          <br />
          <small>Click Play to start generating patterns</small>
        </div>
      )}
    </div>
  );
}