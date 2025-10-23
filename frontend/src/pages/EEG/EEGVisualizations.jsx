import EEGSignalGraphs from "./visualizations/EEGSignalGraphs";
import XORVisualization from "./visualizations/XORVisualization";
import PolarVisualization from "./visualizations/PolarVisualization";
import RecurrenceVisualization from "./visualizations/RecurrenceVisualization";

export default function EEGVisualizations({
  channels,
  buffer,
  time,
  fs,
  windowSeconds,
  xorChunks,
  xorChannel,
  polarData,
  recurrenceData,
  selectedVisualization,
  setSelectedVisualization,
  recurrencePair,
  setRecurrencePair,
  recurrencePlotType,
  setRecurrencePlotType,
  setXorChunks,
  setXorChannel,
  setRecurrencePoints,
  polarChannel,
  setPolarChannel,
  polarMode,
  setPolarMode,
  isLoading
}) {
  const renderSelectedVisualization = () => {
    switch (selectedVisualization) {
    case "xor":
      return (
       <XORVisualization
        xorChunks={xorChunks}
        xorChannel={xorChannel}
        channels={channels}
        fs={fs}
        windowSeconds={windowSeconds}
        isLoading={isLoading}
        xorTolerance={5.0} // Add this prop or pass from parent
     />
    );

      case "polar":
        return (
          <PolarVisualization
            polarData={polarData}
            polarMode={polarMode}
            isLoading={isLoading}
          />
        );
      
      case "recurrence":
        return (
          <RecurrenceVisualization
            recurrenceData={recurrenceData}
            recurrencePair={recurrencePair}
            recurrencePlotType={recurrencePlotType}
            isLoading={isLoading}
          />
        );
      
      default:
        return <div>Select a visualization</div>;
    }
  };

  return (
    <>
      {/* Signal Channel Graphs - Always visible */}
      <EEGSignalGraphs
        channels={channels}
        buffer={buffer}
        time={time}
        fs={fs}
        windowSeconds={windowSeconds}
        isLoading={isLoading}
      />

      {/* Visualization Selector and Controls */}
      <div style={{ 
        marginTop: 30, 
        borderTop: "2px solid #dbe2ef", 
        paddingTop: 20,
        opacity: isLoading ? 0.5 : 1 
      }}>
        <h3 style={{ margin: "0 0 15px 0", color: "#263357" }}>Advanced Visualizations</h3>
        
        {/* Visualization Selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 14, fontWeight: 600 }}>
            Select Visualization:
            <select
              value={selectedVisualization}
              onChange={(e) => !isLoading && setSelectedVisualization(e.target.value)}
              disabled={isLoading}
              style={{ 
                marginLeft: 8, 
                padding: "8px 12px", 
                borderRadius: 6, 
                fontSize: 14,
                opacity: isLoading ? 0.7 : 1 
              }}
            >
              <option value="xor">XOR Overlay</option>
              <option value="polar">Polar Plot</option>
              <option value="recurrence">Recurrence Plot</option>
            </select>
          </label>
        </div>

        {/* Visualization-specific controls */}
        <div style={{ marginBottom: 20 }}>
          {selectedVisualization === "xor" && (
            <div>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
              Shows points that differ from all previous chunks (point-wise XOR)
            </div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            XOR Channel:
          <select
            value={xorChannel || ""}
            onChange={(e) => !isLoading && setXorChannel(e.target.value || null)}
            disabled={isLoading}
            style={{ 
              marginLeft: 8, 
              padding: "6px 8px", 
              borderRadius: 6,
              opacity: isLoading ? 0.7 : 1 
         }}
      >
        <option value="">Auto (first channel)</option>
        {channels.map((ch) => <option key={`xor-${ch}`} value={ch}>{ch}</option>)}
      </select>
    </label>
    <button
      onClick={() => !isLoading && setXorChunks([])}
      disabled={isLoading}
      style={{ 
        marginLeft: 15, 
        padding: "6px 10px", 
        borderRadius: 6, 
        border: "none", 
        background: isLoading ? "#8d97b6" : "#2055c0", 
        color: "#fff", 
        fontWeight: 700,
        cursor: isLoading ? "not-allowed" : "pointer"
      }}
    >
      Reset XOR History
    </button>
  </div>
)}

          {selectedVisualization === "polar" && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Polar Channel:
                <select
                  value={polarChannel || ""}
                  onChange={(e) => !isLoading && setPolarChannel(e.target.value || null)}
                  disabled={isLoading}
                  style={{ 
                    marginLeft: 8, 
                    padding: "6px 8px", 
                    borderRadius: 6,
                    opacity: isLoading ? 0.7 : 1 
                  }}
                >
                  <option value="">Auto (first channel)</option>
                  {channels.map((ch) => <option key={`polar-${ch}`} value={ch}>{ch}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 13, fontWeight: 600, marginLeft: 15 }}>
                Mode:
                <select 
                  value={polarMode} 
                  onChange={(e) => !isLoading && setPolarMode(e.target.value)} 
                  disabled={isLoading}
                  style={{ 
                    marginLeft: 8, 
                    padding: "6px 8px", 
                    borderRadius: 6,
                    opacity: isLoading ? 0.7 : 1 
                  }}
                >
                  <option value="latest">Latest window</option>
                  <option value="cumulative">Cumulative</option>
                </select>
              </label>
            </div>
          )}

          {selectedVisualization === "recurrence" && (
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>
                  chX:
                  <select 
                    value={recurrencePair[0] || ""} 
                    onChange={(e) => !isLoading && setRecurrencePair([e.target.value || null, recurrencePair[1]])} 
                    disabled={isLoading}
                    style={{ 
                      marginLeft: 8, 
                      padding: "6px 8px", 
                      borderRadius: 6,
                      opacity: isLoading ? 0.7 : 1 
                    }}
                  >
                    <option value="">Select</option>
                    {channels.map((c) => <option value={c} key={"x"+c}>{c}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 13, fontWeight: 600 }}>
                  chY:
                  <select 
                    value={recurrencePair[1] || ""} 
                    onChange={(e) => !isLoading && setRecurrencePair([recurrencePair[0], e.target.value || null])} 
                    disabled={isLoading}
                    style={{ 
                      marginLeft: 8, 
                      padding: "6px 8px", 
                      borderRadius: 6,
                      opacity: isLoading ? 0.7 : 1 
                    }}
                  >
                    <option value="">Select</option>
                    {channels.map((c) => <option value={c} key={"y"+c}>{c}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 13, fontWeight: 600 }}>
                  Type:
                  <select 
                    value={recurrencePlotType} 
                    onChange={(e) => !isLoading && setRecurrencePlotType(e.target.value)} 
                    disabled={isLoading}
                    style={{ 
                      marginLeft: 8, 
                      padding: "6px 8px", 
                      borderRadius: 6,
                      opacity: isLoading ? 0.7 : 1 
                    }}
                  >
                    <option value="heatmap">Heatmap</option>
                    <option value="scatter">Scatter</option>
                  </select>
                </label>
              </div>
              <button 
                onClick={() => !isLoading && setRecurrencePoints([])} 
                disabled={isLoading}
                style={{ 
                  padding: "6px 10px", 
                  borderRadius: 6, 
                  border: "none", 
                  background: isLoading ? "#8d97b6" : "#e74c3c", 
                  color: "#fff", 
                  fontWeight: 700,
                  cursor: isLoading ? "not-allowed" : "pointer"
                }}
              >
                Reset Recurrence
              </button>
            </div>
          )}
        </div>

        {/* Selected Visualization */}
        <div style={{ marginTop: 20 }}>
          {renderSelectedVisualization()}
        </div>
      </div>
    </>
  );
}