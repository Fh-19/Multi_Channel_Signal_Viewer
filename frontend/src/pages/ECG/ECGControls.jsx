import React, { useState } from "react";

const ECGControls = ({
  handleFileUpload,
  handleUpload,
  handlePlayPause,
  isPlaying,
  playbackSpeed,
  setPlaybackSpeed,
  signalMode,
  setSignalMode,
  windowSeconds,
  setWindowSeconds,
  cycleWindowSize,
  setCycleWindowSize,
  xorTolerance,
  setXorTolerance,
  allLeads,
  leads,
  toggleLead,
  selectedVisualization,
  isLoading,
  filename,
  // NEW: Sampling frequency props
  displayFs,
  originalFs,
  onSamplingFrequencyChange,
  aliasingWarning,
  resamplingType,
}) => {
  const [manualFs, setManualFs] = useState(displayFs.toString());

  // Update manualFs when displayFs changes externally
  React.useEffect(() => {
    setManualFs(displayFs.toString());
  }, [displayFs]);

  const handleManualFsChange = (e) => {
    const value = e.target.value;
    setManualFs(value);
  };

  const handleManualFsSubmit = () => {
    const newFs = parseInt(manualFs, 10);
    if (!isNaN(newFs) && newFs >= 100 && newFs <= 1000) {
      onSamplingFrequencyChange(newFs);
    } else {
      alert("Please enter a valid sampling frequency between 100 and 1000 Hz");
      setManualFs(displayFs.toString());
    }
  };

  const handleManualFsKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleManualFsSubmit();
    }
  };

  // Helper functions for status display
  const getStatusColor = (resamplingType, aliasingWarning) => {
    if (aliasingWarning) return "#e24a33"; // Red for aliasing
    if (resamplingType === "upsampling") return "#1ca876"; // Green for upsampling
    if (resamplingType === "none") return "#666"; // Gray for no change
    return "#fbc15e"; // Yellow for downsampling without aliasing
  };

  const getStatusBackground = (resamplingType, aliasingWarning) => {
    if (aliasingWarning) return "#ffeaea";
    if (resamplingType === "upsampling") return "#f0fff0";
    if (resamplingType === "none") return "#f5f5f5";
    return "#fffbf0";
  };

  const getStatusMessage = (resamplingType, aliasingWarning, displayFs, originalFs) => {
    if (resamplingType === "none") {
      return `✓ Original sampling: ${originalFs} Hz`;
    }
    if (resamplingType === "upsampling") {
      return `↑ Upsampling: ${originalFs} Hz → ${displayFs} Hz (smoother signal)`;
    }
    if (aliasingWarning) {
      return `⚠️ Downsampling with aliasing: ${displayFs} Hz < ${originalFs} Hz`;
    }
    return `↓ Downsampling: ${originalFs} Hz → ${displayFs} Hz (no aliasing)`;
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "15px",
      marginBottom: "20px"
    }}>
      {/* File Upload and Sampling Control in a single row */}
      <div style={{
        display: "flex",
        gap: "15px",
        alignItems: "stretch"
      }}>
        {/* File Upload Section - Left */}
        <div style={{
          flex: 1,
          padding: "15px",
          background: "#fff",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          minWidth: "300px"
        }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#333" }}>
            ECG File Upload
          </h3>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              accept=".dat,.hea"
              style={{ flex: 1 }}
              disabled={isLoading}
            />
            <button
              onClick={handleUpload}
              disabled={isLoading}
              style={{
                padding: "8px 16px",
                background: "#2055c0",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.6 : 1
              }}
            >
              {isLoading ? "Uploading..." : "Upload Files"}
            </button>
          </div>
          {filename && (
            <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
              Loaded: {filename}
            </div>
          )}
        </div>

        {/* Sampling Frequency Control Section - Right */}
        <div style={{
          flex: 1,
          padding: "15px",
          background: "#fff",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          minWidth: "300px"
        }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#333" }}>
            Sampling Frequency Control
          </h3>
          
          {/* Slider and Manual Input Row */}
          <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "10px" }}>
            {/* Slider Section */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "12px", color: "#666", minWidth: "80px" }}>
                Target FS: {displayFs} Hz
              </span>
              
              <input
                type="range"
                min="100"
                max="1000"
                step="10"
                value={displayFs}
                onChange={(e) => onSamplingFrequencyChange(Number(e.target.value))}
                style={{ flex: 1 }}
                disabled={!filename}
              />
            </div>

            {/* Manual Input - Compact to the right of slider */}
            <div style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: "100px" }}>
              <input
                type="number"
                min="100"
                max="1000"
                step="10"
                value={manualFs}
                onChange={handleManualFsChange}
                onKeyPress={handleManualFsKeyPress}
                onBlur={handleManualFsSubmit}
                disabled={!filename}
                style={{
                  width: "70px",
                  padding: "4px 6px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "12px",
                  opacity: filename ? 1 : 0.6
                }}
              />
              <span style={{ fontSize: "12px", color: "#666" }}>Hz</span>
            </div>
            
            {/* Reset Button */}
            <button 
              onClick={() => onSamplingFrequencyChange(originalFs)}
              disabled={!filename}
              style={{
                padding: "5px 10px",
                fontSize: "12px",
                background: "#2055c0",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: filename ? "pointer" : "not-allowed",
                opacity: filename ? 1 : 0.6,
                whiteSpace: "nowrap"
              }}
            >
              Reset to {originalFs} Hz
            </button>
          </div>
          
          <div style={{ fontSize: "11px", color: "#888" }}>
            <div>Original: {originalFs} Hz | Nyquist: {Math.round(originalFs/2)} Hz</div>
            
            {/* Enhanced status display */}
            <div style={{ 
              color: getStatusColor(resamplingType, aliasingWarning),
              fontWeight: "bold",
              marginTop: "5px",
              padding: "5px",
              background: getStatusBackground(resamplingType, aliasingWarning),
              borderRadius: "3px"
            }}>
              {getStatusMessage(resamplingType, aliasingWarning, displayFs, originalFs)}
            </div>
          </div>
        </div>
      </div>

      {/* Playback Controls Section */}
      <div style={{
        padding: "15px",
        background: "#fff",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}>
        <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#333" }}>
          Playback Controls
        </h3>
        
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={handlePlayPause}
            disabled={!filename}
            style={{
              padding: "8px 16px",
              background: isPlaying ? "#e24a33" : "#1ca876",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: filename ? "pointer" : "not-allowed",
              opacity: filename ? 1 : 0.6
            }}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>

          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            disabled={!filename}
            style={{
              padding: "6px 10px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              opacity: filename ? 1 : 0.6
            }}
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
          </select>

          <select
            value={signalMode}
            onChange={(e) => setSignalMode(e.target.value)}
            disabled={!filename}
            style={{
              padding: "6px 10px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              opacity: filename ? 1 : 0.6
            }}
          >
            <option value="continuous">Continuous</option>
            <option value="cycle">Cycle-based</option>
          </select>

          {signalMode === "continuous" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "#666" }}>Window:</span>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={windowSeconds}
                onChange={(e) => setWindowSeconds(Number(e.target.value))}
                style={{ width: "80px" }}
                disabled={!filename}
              />
              <span style={{ fontSize: "12px", color: "#666", minWidth: "40px" }}>
                {windowSeconds}s
              </span>
            </div>
          )}

          {signalMode === "cycle" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "#666" }}>Cycle:</span>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={cycleWindowSize}
                onChange={(e) => setCycleWindowSize(Number(e.target.value))}
                style={{ width: "80px" }}
                disabled={!filename}
              />
              <span style={{ fontSize: "12px", color: "#666", minWidth: "40px" }}>
                {cycleWindowSize}xRR
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Lead Selection Section */}
      <div style={{
        padding: "15px",
        background: "#fff",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}>
        <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#333" }}>
          Lead Selection
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {allLeads.map((lead, idx) => (
            <button
              key={idx}
              onClick={() => toggleLead(idx)}
              disabled={!filename}
              style={{
                padding: "6px 12px",
                background: leads.includes(idx) ? "#2055c0" : "#f0f0f0",
                color: leads.includes(idx) ? "white" : "#333",
                border: "none",
                borderRadius: "4px",
                cursor: filename ? "pointer" : "not-allowed",
                opacity: filename ? 1 : 0.6,
                fontSize: "12px"
              }}
            >
              {lead}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ECGControls;