import Plot from "react-plotly.js";
import { useState, useMemo } from "react";

export default function XORVisualization({ 
  xorChunks, 
  xorChannel, 
  channels, 
  fs, 
  windowSeconds, 
  isLoading,
  xorTolerance,
  maxXorChunks // NEW: Receive dynamic chunk limit
}) {
  const [localThreshold, setLocalThreshold] = useState(xorTolerance);
  
  // Calculate chunk statistics for the UI
  const chunkStats = useMemo(() => {
    const activeChunks = xorChunks.filter(chunk => !chunk.removed);
    const totalDuration = activeChunks.length * windowSeconds;
    const timeCoverage = activeChunks.length > 1 ? 
      `Covering ${totalDuration.toFixed(1)}s of EEG data` : 
      'Collecting chunks...';
    
    return {
      activeChunks: activeChunks.length,
      maxChunks: maxXorChunks,
      timeCoverage,
      totalDuration,
      chunkLimitReached: activeChunks.length >= maxXorChunks
    };
  }, [xorChunks, maxXorChunks, windowSeconds]);

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

  // Get XOR visualization data showing only unique abnormalities
  const getXorScatterData = () => {
    const activeChunks = xorChunks.filter(chunk => !chunk.removed);
    if (activeChunks.length === 0) return { traces: [], chunkInfo: null };
    
    const threshold = localThreshold;
    const windowSamples = Math.round(fs * windowSeconds);
    
    // First pass: collect all abnormalities
    const allAbnormalities = [];
    
    for (let timeIdx = 0; timeIdx < windowSamples; timeIdx++) {
      const valuesAtThisTime = [];
      const chunksWithData = [];
      
      activeChunks.forEach((chunk, chunkIdx) => {
        const samples = chunk.samples.slice(-windowSamples);
        if (timeIdx < samples.length) {
          valuesAtThisTime.push(samples[timeIdx]);
          chunksWithData.push(chunkIdx);
        }
      });
      
      if (valuesAtThisTime.length === 0) continue;
      
      // Check if all values at this time point are similar
      let allSimilar = true;
      const firstValue = valuesAtThisTime[0];
      
      for (let i = 1; i < valuesAtThisTime.length; i++) {
        if (Math.abs(valuesAtThisTime[i] - firstValue) > threshold) {
          allSimilar = false;
          break;
        }
      }
      
      // If not all similar, add abnormalities for each chunk
      if (!allSimilar) {
        chunksWithData.forEach((chunkIdx, arrIdx) => {
          const timeInSeconds = timeIdx / fs;
          const value = valuesAtThisTime[arrIdx];
          
          allAbnormalities.push({
            time: timeInSeconds,
            value: value,
            chunkIndex: chunkIdx,
            sampleIndex: timeIdx,
            timeInSeconds: timeInSeconds,
            chunkStartTime: activeChunks[chunkIdx].startTime || 0
          });
        });
      }
    }
    
    // Second pass: remove abnormalities that match previous ones
    const uniqueAbnormalities = [];
    const seenPatterns = new Map();
    
    // Sort abnormalities by chunk index to process in order
    allAbnormalities.sort((a, b) => a.chunkIndex - b.chunkIndex);
    
    for (const abnormality of allAbnormalities) {
      const { sampleIndex, value, chunkIndex } = abnormality;
      
      if (!seenPatterns.has(sampleIndex)) {
        seenPatterns.set(sampleIndex, new Set());
      }
      
      const seenValues = seenPatterns.get(sampleIndex);
      let isUnique = true;
      
      // Check if this value matches any previously seen value at this time point
      for (const seenValue of seenValues) {
        if (Math.abs(value - seenValue) <= threshold) {
          isUnique = false;
          break;
        }
      }
      
      if (isUnique) {
        uniqueAbnormalities.push(abnormality);
        seenValues.add(value);
      }
    }
    
    // Group unique abnormalities by chunk for traces
    const traces = [];
    const chunksWithAbnormalities = new Set();
    
    uniqueAbnormalities.forEach(abnormality => {
      const { chunkIndex, timeInSeconds, value, chunkStartTime } = abnormality;
      const chunkName = `Chunk ${chunkIndex + 1}`;
      const absoluteTime = (chunkStartTime + timeInSeconds).toFixed(1);
      const hoverText = `${chunkName} at ${absoluteTime}s: ${value.toFixed(2)}µV`;
      
      let traceIndex = traces.findIndex(t => t.name === chunkName);
      if (traceIndex === -1) {
        traces.push({
          x: [timeInSeconds],
          y: [value],
          type: "scatter",
          mode: "markers",
          name: chunkName,
          marker: {
            size: 6,
            color: `hsl(${(chunkIndex * 45) % 360}, 70%, 50%)`,
            symbol: "circle"
          },
          showlegend: true,
          hoverinfo: "text",
          text: [hoverText]
        });
        chunksWithAbnormalities.add(chunkIndex);
      } else {
        traces[traceIndex].x.push(timeInSeconds);
        traces[traceIndex].y.push(value);
        traces[traceIndex].text.push(hoverText);
      }
    });
    
    return {
      traces,
      chunkInfo: {
        totalChunks: activeChunks.length,
        uniqueAbnormalities: uniqueAbnormalities.length,
        totalTimeInstants: windowSamples,
        threshold: threshold,
        chunksWithAbnormalities: chunksWithAbnormalities.size,
        timeCoverage: chunkStats.timeCoverage,
        maxChunks: maxXorChunks
      }
    };
  };

  const scatterData = getXorScatterData();
  const hasData = scatterData.traces.length > 0;
  const activeChunks = xorChunks.filter(chunk => !chunk.removed);

  const handleThresholdChange = (e) => {
    const newThreshold = parseFloat(e.target.value);
    if (!isNaN(newThreshold)) setLocalThreshold(newThreshold);
  };

  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        XOR Visualization - {activeChunks.length}/{maxXorChunks} chunks 
        {chunkStats.chunkLimitReached && " (MAX)"}
        <div style={{ fontSize: "12px", fontWeight: "normal", color: "#666", marginTop: "4px" }}>
          {chunkStats.timeCoverage} • Channel: {xorChannel || channels[0] || "-"}
        </div>
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
            min="0.1"
            max="10"
            step="0.1"
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
          µV
        </label>
        <div style={{ fontSize: 11, color: '#666', marginTop: '5px' }}>
          Lower values = more sensitive to differences | Higher values = more tolerant of variation
        </div>
      </div>
      
      {scatterData.chunkInfo && (
        <div style={{ 
          fontSize: 12, 
          color: '#666', 
          marginBottom: 10,
          padding: '8px',
          background: '#f5f5f5',
          borderRadius: '4px'
        }}>
          <div>
            <strong>Chunks: {scatterData.chunkInfo.totalChunks}/{scatterData.chunkInfo.maxChunks}</strong> 
            {` • Unique abnormalities: ${scatterData.chunkInfo.uniqueAbnormalities}`}
          </div>
          <div style={{ fontSize: '11px', marginTop: '4px' }}>
            {scatterData.chunkInfo.timeCoverage} • Threshold: {scatterData.chunkInfo.threshold}µV
            {chunkStats.chunkLimitReached && (
              <span style={{ color: '#e24a33', fontWeight: 'bold', marginLeft: '8px' }}>
                • Chunk limit reached - oldest chunks are being removed
              </span>
            )}
          </div>
        </div>
      )}
      
      {activeChunks.length > 1 ? (
        hasData ? (
          <>
            <Plot
              data={scatterData.traces}
              layout={{
                width: "100%",
                height: 400,
                margin: { l: 50, r: 20, t: 40, b: 40 },
                xaxis: { 
                  title: "Time in Chunk (s)",
                  range: [0, windowSeconds]
                },
                yaxis: { 
                  title: "Amplitude (µV)",
                  autorange: true
                },
                showlegend: true,
                title: `XOR: Unique Abnormalities (${activeChunks.length}/${maxXorChunks} chunks)`
              }}
              config={{ displayModeBar: true, displaylogo: false }}
            />
            
            {/* Enhanced Statistics */}
            <div style={{ 
              fontSize: "12px", 
              color: "#666", 
              marginTop: "10px",
              display: "flex", 
              flexWrap: "wrap",
              gap: "15px" 
            }}>
              <span>Total chunks: {activeChunks.length}/{maxXorChunks}</span>
              <span style={{ color: scatterData.chunkInfo.uniqueAbnormalities > 0 ? "#ff4444" : "#666", fontWeight: "bold" }}>
                Unique abnormalities: {scatterData.chunkInfo.uniqueAbnormalities}
              </span>
              <span>
                Time coverage: {chunkStats.totalDuration.toFixed(1)}s
              </span>
              <span>
                Chunks with abnormalities: {scatterData.chunkInfo.chunksWithAbnormalities}
              </span>
              {chunkStats.chunkLimitReached && (
                <span style={{ color: "#e24a33", fontWeight: "bold" }}>
                  ⚠️ Chunk limit reached
                </span>
              )}
            </div>
          </>
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
            No unique abnormalities found within threshold ({localThreshold}µV)
            <br />
            <small>All differences between chunks were repeated in other chunks</small>
            <br />
            <small style={{ fontSize: '10px', marginTop: '5px' }}>
              Using {activeChunks.length} chunks covering {chunkStats.totalDuration.toFixed(1)}s of EEG data
            </small>
          </div>
        )
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
          XOR visualization waiting for chunk data...
          <br />
          <small>Need at least 2 chunks to detect differences</small>
          <br />
          <small style={{ fontSize: '10px', marginTop: '5px' }}>
            Collecting chunks... ({activeChunks.length}/{maxXorChunks})
            <br />
            Maximum {maxXorChunks} chunks will be used for comparison
          </small>
        </div>
      )}
    </div>
  );
}