import Plot from "react-plotly.js";
import { useState } from "react";

export default function XORVisualization({ 
  xorChunks, 
  xorChannel, 
  leadNames, 
  isLoading,
  xorTolerance,
}) {
  const [localThreshold, setLocalThreshold] = useState(xorTolerance);
  
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

  // Get XOR visualization data showing actual cycle points at differing time instants
  const getXorScatterData = () => {
    if (xorChunks.length === 0) return { traces: [], cycleInfo: null };
    
    const threshold = localThreshold;
    const maxLength = Math.max(...xorChunks.map(chunk => chunk.rawSamples.length));
    
    const traces = [];
    const timeInstantsWithData = [];
    
    for (let timeIdx = 0; timeIdx < maxLength; timeIdx++) {
      const valuesAtThisTime = [];
      const cyclesWithData = [];
      
      xorChunks.forEach((chunk, cycleIdx) => {
        if (timeIdx < chunk.rawSamples.length) {
          valuesAtThisTime.push(chunk.rawSamples[timeIdx]);
          cyclesWithData.push(cycleIdx);
        }
      });
      
      if (valuesAtThisTime.length === 0) continue;
      
      let allSimilar = true;
      const firstValue = valuesAtThisTime[0];
      
      for (let i = 1; i < valuesAtThisTime.length; i++) {
        if (Math.abs(valuesAtThisTime[i] - firstValue) > threshold) {
          allSimilar = false;
          break;
        }
      }
      
      if (!allSimilar) {
        timeInstantsWithData.push(timeIdx);
        
        cyclesWithData.forEach((cycleIdx, arrIdx) => {
          const timeInSeconds = timeIdx / 500;
          const value = valuesAtThisTime[arrIdx];
          
          let traceIndex = traces.findIndex(t => t.name === `Cycle ${cycleIdx + 1}`);
          if (traceIndex === -1) {
            traces.push({
              x: [timeInSeconds],
              y: [value],
              type: "scatter",
              mode: "markers",
              name: `Cycle ${cycleIdx + 1}`,
              marker: {
                size: 6,
                color: `hsl(${(cycleIdx * 45) % 360}, 70%, 50%)`,
                symbol: "circle"
              },
              showlegend: true
            });
          } else {
            traces[traceIndex].x.push(timeInSeconds);
            traces[traceIndex].y.push(value);
          }
        });
      }
    }
    
    return {
      traces,
      cycleInfo: {
        totalCycles: xorChunks.length,
        timeInstantsWithDifferences: timeInstantsWithData.length,
        totalTimeInstants: maxLength,
        threshold: threshold
      }
    };
  };

  const scatterData = getXorScatterData();
  const hasData = scatterData.traces.length > 0;

  const handleThresholdChange = (e) => {
    const newThreshold = parseFloat(e.target.value);
    if (!isNaN(newThreshold)) setLocalThreshold(newThreshold);
  };

  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        XOR Visualization - {xorChunks.length} cycles ({leadNames[xorChannel]})
      </div>
      
      {/* Threshold Control */}
      <div style={{ 
        marginBottom: 15,
        padding: '10px',
        background: '#f8f9fa',
        borderRadius: '6px',
        border: '1px solid #e9ecef'
      }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Similarity Threshold: 
          <input
            type="number"
            min="0.01"
            max="0.5"
            step="0.01"
            value={localThreshold}
            onChange={handleThresholdChange}
            style={{ 
              margin: '0 10px',
              width: '80px',
              padding: '4px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              textAlign: 'center'
            }}
          />
        </label>
        <div style={{ fontSize: 11, color: '#666', marginTop: '5px' }}>
          Lower values = more sensitive to differences | Higher values = more tolerant of variation
        </div>
      </div>
      
      {scatterData.cycleInfo && (
        <div style={{ 
          fontSize: 12, 
          color: '#666', 
          marginBottom: 10,
          padding: '8px',
          background: '#f5f5f5',
          borderRadius: '4px'
        }}>
          <strong>Showing {scatterData.traces.length} cycles:</strong> 
          {` ${scatterData.cycleInfo.timeInstantsWithDifferences} time instants with differences`}
          <br />
          <small>Threshold: {scatterData.cycleInfo.threshold} | Points show where cycles differ by more than threshold</small>
        </div>
      )}
      
      {hasData ? (
        <Plot
          data={scatterData.traces}
          layout={{
            width: "100%",
            height: 400,
            margin: { l: 50, r: 20, t: 40, b: 40 },
            xaxis: { 
              title: "Time (s)",
              range: [0, Math.max(...scatterData.traces.flatMap(t => t.x)) || 1]
            },
            yaxis: { 
              title: "Amplitude (mV)",
              autorange: true
            },
            showlegend: true,
            title: `XOR: Points Where Cycles Differ (${xorChunks.length} cycles)`
          }}
          config={{ displayModeBar: true }}
        />
      ) : xorChunks.length > 0 ? (
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          height: "400px",
          color: "#8d97b6",
          border: "1px dashed #ddd",
          borderRadius: "8px",
          flexDirection: 'column'
        }}>
          All cycles are identical within threshold ({localThreshold})
          <br />
          <small>No differences found between the {xorChunks.length} cycles</small>
          <br />
          <small style={{ fontSize: '10px', marginTop: '5px' }}>
            Try lowering the threshold to detect smaller differences
          </small>
        </div>
      ) : (
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          height: "400px",
          color: "#8d97b6",
          border: "1px dashed #ddd",
          borderRadius: "8px",
          flexDirection: 'column'
        }}>
          XOR visualization waiting for cycle data...
          <br />
          <small>Click Play to start analyzing cycle differences</small>
          <br />
          <small style={{ fontSize: '10px', marginTop: '5px' }}>
            Shows actual voltage values only at time instants where cycles differ
          </small>
        </div>
      )}
    </div>
  );
}
