import Plot from "react-plotly.js";
import { useMemo } from "react";

const colorPalette = {
  Alzheimer: "#FF6B6B",
  Dementia: "#FFD93D",
  Epilepsy: "#6BCB77",
  Healthy: "#4D96FF",
  Schizophrenia: "#845EC2",
};

export default function EEGSignalGraphs({ channels, buffer, time, fs, windowSeconds, isLoading, experimentalFs, originalFs }) {
  
  // Calculate signal statistics to show differences
  const signalStats = useMemo(() => {
    if (!channels.length || !time.length) return null;
    
    const stats = {};
    channels.forEach(ch => {
      const samples = (buffer[ch] || []).slice(-Math.round(fs * windowSeconds));
      if (samples.length > 0) {
        const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
        const variance = samples.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / samples.length;
        const std = Math.sqrt(variance);
        
        stats[ch] = {
          mean: mean,
          std: std,
          max: Math.max(...samples),
          min: Math.min(...samples),
          range: Math.max(...samples) - Math.min(...samples)
        };
      }
    });
    return stats;
  }, [buffer, channels, fs, windowSeconds]);

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
      {/* Sampling Rate Info Banner */}
      {experimentalFs && originalFs && experimentalFs !== originalFs && (
        <div style={{
          padding: "10px",
          background: "#e7f3ff",
          border: "1px solid #b8d4ff",
          borderRadius: "6px",
          marginBottom: "15px",
          fontSize: "14px"
        }}>
          <strong>Sampling Rate:</strong> {experimentalFs} Hz 
          {experimentalFs < originalFs && (
            <span style={{ color: "#e74c3c", marginLeft: "10px" }}>
              ⬇️ Downsampled from {originalFs} Hz (Nyquist: {experimentalFs/2} Hz)
            </span>
          )}
          {experimentalFs > originalFs && (
            <span style={{ color: "#27ae60", marginLeft: "10px" }}>
              ⬆️ Upsampled from {originalFs} Hz
            </span>
          )}
        </div>
      )}

      {channels.map((ch) => {
        const trace = {
          x: time.slice(-Math.round(fs * windowSeconds)),
          y: (buffer[ch] || []).slice(-Math.round(fs * windowSeconds)),
          type: "scatter",
          mode: "lines",
          name: ch,
          line: { shape: "spline", smoothing: 1.2, width: 1.6, color: colorPalette[ch] || "#2355c0" },
        };
        
        const stats = signalStats ? signalStats[ch] : null;
        
        return (
          <div key={ch} style={{ marginBottom: "20px" }}>
            {/* Signal Statistics */}
            {stats && (
              <div style={{
                display: "flex",
                gap: "15px",
                fontSize: "12px",
                color: "#666",
                marginBottom: "8px",
                padding: "5px 10px",
                background: "#f8f9fa",
                borderRadius: "4px"
              }}>
                <span>Mean: {stats.mean.toFixed(2)} µV</span>
                <span>Std: {stats.std.toFixed(2)} µV</span>
                <span>Range: {stats.range.toFixed(2)} µV</span>
                {experimentalFs && originalFs && experimentalFs !== originalFs && (
                  <span style={{
                    color: experimentalFs < originalFs ? "#e74c3c" : "#27ae60",
                    fontWeight: "bold"
                  }}>
                    {experimentalFs < originalFs ? "↓ Downsampled" : "↑ Upsampled"}
                  </span>
                )}
              </div>
            )}
            
            <Plot
              data={[trace]}
              layout={{
                height: 220,
                title: `${ch} ${experimentalFs ? `(${experimentalFs} Hz)` : ''}`,
                xaxis: {
                  title: "Time (s)",
                  zeroline: false,
                  showgrid: true,
                },
                yaxis: { 
                  title: "Amplitude (µV)", 
                  zeroline: false, 
                  showgrid: true,
                  // Keep consistent scale to see amplitude changes
                  range: stats ? [stats.min - 10, stats.max + 10] : undefined
                },
                margin: { t: 36, l: 50, r: 20, b: 36 },
                annotations: experimentalFs && originalFs && experimentalFs !== originalFs ? [
                  {
                    x: 0.02,
                    y: 0.98,
                    xref: 'paper',
                    yref: 'paper',
                    text: experimentalFs < originalFs ? `↓ ${experimentalFs}Hz` : `↑ ${experimentalFs}Hz`,
                    showarrow: false,
                    bgcolor: experimentalFs < originalFs ? '#ffcccc' : '#ccffcc',
                    bordercolor: experimentalFs < originalFs ? '#e74c3c' : '#27ae60',
                    borderwidth: 1,
                    borderpad: 4,
                    font: { size: 12, color: experimentalFs < originalFs ? '#c0392b' : '#27ae60' }
                  }
                ] : []
              }}
              config={{
                responsive: true,
                scrollZoom: true,
                displaylogo: false,
                modeBarButtonsToRemove: ["resetScale2d"],
              }}
              style={{ width: "100%" }}
            />
          </div>
        );
      })}
    </div>
  );
}