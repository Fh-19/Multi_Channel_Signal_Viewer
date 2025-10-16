import Plot from "react-plotly.js";

const LEAD_COLORS = [
  "#E24A33", "#348ABD", "#988ED5", "#777777", "#FBC15E",
  "#8EBA42", "#FFB5B8", "#FF7F0E", "#1CA876", "#B776B7", "#F8585A", "#6D8B93",
];

export default function ECGSignalGraphs({
  signals,
  signalData,
  leads,
  leadNames,
  fs,
  signalMode,
  isLoading
}) {
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
        Loading ECG Traces...
      </div>
    );
  }

  if (!signals.length || !leads.length) {
    return (
      <div style={{ marginTop: 20, color: "#8d97b6" }}>
        No ECG data to display yet.
      </div>
    );
  }

  const signalTraces = leads.map((leadIdx, i) => ({
    x: signalData,
    y: signals.map((row) => (row ? row[leadIdx] : null)),
    type: "scatter",
    mode: "lines",
    name: leadNames[leadIdx] || `Lead ${leadIdx + 1}`,
    line: { width: 1.2, color: LEAD_COLORS[leadIdx] },
  }));

  return (
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
  );
}