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
  isLoading,
  aliasingWarning,
  displayFs
}) {
  console.log("ECGSignalGraphs rendering:", { //to see if data deliver correctly
    signalsLength: signals.length,
    signalDataLength: signalData.length,
    fs,
    displayFs,
    aliasingWarning
  });

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

  const signalTraces = leads.map((leadIdx, i) => {
    const yValues = signals.map((row) => (row ? row[leadIdx] : null));
    
    return {
      x: signalData,
      y: yValues,
      type: "scatter",
      mode: "lines",
      name: leadNames[leadIdx] || `Lead ${leadIdx + 1}`,
      line: { width: 1.2, color: LEAD_COLORS[leadIdx] },
    };
  });

  const title = `ECG Signal (${signalMode === "cycle" ? "Cycle-by-cycle" : "Continuous"}) - ${displayFs} Hz${aliasingWarning ? ' ⚠️ Aliasing' : ''}`;

  return (
    <div style={{ marginTop: 20, flex: 1, minHeight: "300px", position: 'relative' }}>
      <Plot
        data={signalTraces}
        layout={{
          width: "100%",
          height: 400,
          margin: { l: 60, r: 30, t: 60, b: 50 },
          xaxis: { 
            title: "Time (s)",
            gridcolor: '#f0f0f0',
            showgrid: true
          },
          yaxis: { 
            title: "Amplitude (mV)", 
            autorange: true,
            gridcolor: '#f0f0f0',
            showgrid: true
          },
          showlegend: true,
          title: title,
          plot_bgcolor: '#fafafa',
          paper_bgcolor: '#fafafa',
        }}
        config={{ 
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
        }}
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* Signal Info Overlay */}
      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        background: aliasingWarning ? 'rgba(255, 235, 238, 0.9)' : 'rgba(232, 245, 232, 0.9)',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        border: aliasingWarning ? '1px solid #f44336' : '1px solid #4caf50',
        zIndex: 10,
        fontWeight: 'bold'
      }}>
        {displayFs} Hz {aliasingWarning && '⚠️ Aliasing'}
        <div style={{ fontSize: '10px', marginTop: '4px', fontWeight: 'normal' }}>
          {signals.length} samples
        </div>
      </div>
    </div>
  );
}