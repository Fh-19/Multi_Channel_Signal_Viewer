import ECGSignalGraphs from "./ECGSignalGraphs";
import PolarVisualization from "./visualizations/PolarVisualization";
import RecurrenceVisualization from "./visualizations/RecurrenceVisualization";
import XORVisualization from "./visualizations/XORVisualization";

const ADVANCED_MODES = [
  { label: "Polar Graph", value: "polar" },
  { label: "Recurrence Graph", value: "recurrence" },
  { label: "XOR Graph", value: "xor" }
];

const POLAR_MODES = [
  { label: "Cumulative", value: "cumulative" },
  { label: "Latest Window", value: "latest" }
];

const MODE4_DISPLAY_TYPES = [
  { label: "Heatmap", value: "heatmap" },
  { label: "Scatter Plot", value: "scatter" }
];

const COLOR_SCALES = [
  "Jet", "Hot", "Viridis", "Plasma", "Inferno", "Magma", "Cividis", "Electric", "Rainbow"
];

export default function ECGVisualizations({
  signals,
  signalData,
  leads,
  leadNames,
  fs,
  selectedVisualization,
  setSelectedVisualization,
  polarTraces,
  setPolarTraces,
  crpMatrix,
  setCrpMatrix,
  xorChunks,
  setXorChunks,
  xorChannel,
  setXorChannel,
  colorScale,
  setColorScale,
  recurrencePlotType,
  setRecurrencePlotType,
  polarMode,
  setPolarMode,
  isLoading,
  signalMode,
  scatterData,
  clearPolarTraces,
  clearRecurrenceMatrix,
  resetXorChunks
}) {
  const renderSelectedVisualization = () => {
    switch (selectedVisualization) {
      case "polar":
        return (
          <PolarVisualization
            polarTraces={polarTraces}
            polarMode={polarMode}
            isLoading={isLoading}
          />
        );
      
      case "recurrence":
        return (
          <RecurrenceVisualization
            crpMatrix={crpMatrix}
            recurrencePlotType={recurrencePlotType}
            colorScale={colorScale}
            leads={leads}
            leadNames={leadNames}
            isLoading={isLoading}
            scatterData={scatterData}
          />
        );
      
      case "xor":
        return (
          <XORVisualization
            xorChunks={xorChunks}
            xorChannel={xorChannel}
            leadNames={leadNames}
            isLoading={isLoading}
          />
        );
      
      default:
        return (
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            height: "400px",
            color: "#8d97b6"
          }}>
            Select an advanced visualization mode
          </div>
        );
    }
  };

  return (
    <>
      {/* Signal Graphs - Always visible */}
      <ECGSignalGraphs
        signals={signals}
        signalData={signalData}
        leads={leads}
        leadNames={leadNames}
        fs={fs}
        signalMode={signalMode}
        isLoading={isLoading}
      />

      {/* Advanced Visualizations */}
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
              {ADVANCED_MODES.map(mode => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Mode-specific controls */}
        <div style={{ marginBottom: 20 }}>
          {selectedVisualization === "polar" && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Polar Mode:
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
                  {POLAR_MODES.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button 
                onClick={() => !isLoading && clearPolarTraces()}
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
                Clear Polar
              </button>
            </div>
          )}
          
          {selectedVisualization === "recurrence" && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Display Type:
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
                  {MODE4_DISPLAY_TYPES.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 13, fontWeight: 600, marginLeft: 15 }}>
                Color Scale:
                <select 
                  value={colorScale} 
                  onChange={(e) => !isLoading && setColorScale(e.target.value)}
                  disabled={isLoading}
                  style={{ 
                    marginLeft: 8, 
                    padding: "6px 8px", 
                    borderRadius: 6,
                    opacity: isLoading ? 0.7 : 1 
                  }}
                >
                  {COLOR_SCALES.map(scale => (
                    <option key={scale} value={scale}>{scale}</option>
                  ))}
                </select>
              </label>
              <button 
                onClick={() => !isLoading && clearRecurrenceMatrix()}
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
                Clear Matrix
              </button>
            </div>
          )}
          
          {selectedVisualization === "xor" && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginLeft: 10 }}>
                Lead:
                <select 
                  value={xorChannel} 
                  onChange={(e) => !isLoading && setXorChannel(Number(e.target.value))}
                  disabled={isLoading}
                  style={{ 
                    marginLeft: 8, 
                    padding: "6px 8px", 
                    borderRadius: 6,
                    opacity: isLoading ? 0.7 : 1 
                  }}
                >
                  {leadNames.map((leadName, index) => (
                    <option key={index} value={index}>
                      {leadName}
                    </option>
                  ))}
                </select>
              </label>
              <button 
                onClick={() => !isLoading && resetXorChunks()}
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
                Reset XOR
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