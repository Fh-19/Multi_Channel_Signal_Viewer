const SPEED_OPTIONS = [
  { label: "0.5x", value: 0.5 },
  { label: "1x", value: 1 },
  { label: "1.5x", value: 1.5 }
];

const WINDOW_SIZE_OPTIONS = [
  { label: "1s", value: 1 },
  { label: "2s", value: 2 },
  { label: "3s", value: 3 },
  { label: "4s", value: 4 },
  { label: "5s", value: 5 }
];

export default function ECGControls({
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
  filename
}) {
  return (
    <>
      {/* File Upload */}
      <div style={{ position: "relative" }}>
        <input
          type="file"
          multiple
          accept=".dat,.hea"
          onChange={handleFileUpload}
          disabled={isLoading}
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 7,
            border: "1px solid #b7cdfc",
            width: "100%",
            maxWidth: 420,
            fontSize: 16,
            background: isLoading ? "#f0f4f8" : "#fafeff",
            opacity: isLoading ? 0.7 : 1,
            cursor: isLoading ? "not-allowed" : "pointer"
          }}
        />
        {isLoading && (
          <div style={{
            position: "absolute",
            right: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "#2055c0",
            fontWeight: "bold",
            fontSize: "12px"
          }}>
            Uploading...
          </div>
        )}
      </div>

      {/* Main controls */}
      <div style={{ 
        display: "flex", 
        gap: "10px", 
        alignItems: "center",
        marginBottom: "15px",
        opacity: isLoading ? 0.5 : 1 
      }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button onClick={handleUpload} disabled={isLoading} style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: "none",
            background: isLoading ? "#8d97b6" : "#2055c0",
            color: "#fff",
            fontWeight: 700,
            cursor: isLoading ? "not-allowed" : "pointer"
          }}>
            Upload ECG Files
          </button>
          <button onClick={handlePlayPause} disabled={isLoading} style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: "none",
            background: isLoading ? "#8d97b6" : (isPlaying ? "#e74c3c" : "#2ecc71"),
            color: "#fff",
            fontWeight: 700,
            cursor: isLoading ? "not-allowed" : "pointer"
          }}>
            {isPlaying ? "Pause" : "Play"}
          </button>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", marginLeft: "20px" }}>
          <label style={{ fontSize: 14, fontWeight: 600, opacity: isLoading ? 0.7 : 1 }}>
            Speed:
            <select 
              value={playbackSpeed} 
              onChange={(e) => !isLoading && setPlaybackSpeed(Number(e.target.value))}
              disabled={isLoading}
              style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 6, opacity: isLoading ? 0.7 : 1 }}
            >
              {SPEED_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filename && (
          <span style={{ marginLeft: "20px", fontStyle: "italic", color: "#2055c0", opacity: isLoading ? 0.7 : 1 }}>
            Loaded: {filename}
          </span>
        )}
      </div>

      {/* Signal mode controls */}
      <div style={{ marginBottom: "15px", opacity: isLoading ? 0.5 : 1 }}>
        <button
          onClick={() => !isLoading && setSignalMode("continuous")}
          disabled={isLoading}
          style={{ 
            padding: "8px 14px",
            borderRadius: 6,
            border: "none",
            background: signalMode === "continuous" ? "#2055c0" : "#7f93b7",
            color: "#fff",
            fontWeight: 700,
            cursor: isLoading ? "not-allowed" : "pointer",
            marginRight: "10px",
            opacity: isLoading ? 0.7 : 1
          }}>
          Continuous Mode
        </button>
        <button
          onClick={() => !isLoading && setSignalMode("cycle")}
          disabled={isLoading}
          style={{ 
            padding: "8px 14px",
            borderRadius: 6,
            border: "none",
            background: signalMode === "cycle" ? "#2055c0" : "#7f93b7",
            color: "#fff",
            fontWeight: 700,
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.7 : 1
          }}>
          Cycle Mode
        </button>

        {signalMode === "cycle" && (
          <div style={{ display: "inline-block", marginLeft: "10px" }}>
            <label style={{ fontSize: 14, fontWeight: 600, opacity: isLoading ? 0.7 : 1 }}>Cycle Window: </label>
            <select 
              value={cycleWindowSize} 
              onChange={(e) => !isLoading && setCycleWindowSize(parseFloat(e.target.value))}
              disabled={isLoading}
              style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 6, opacity: isLoading ? 0.7 : 1 }}
            >
              <option value={0.5}>0.5 RR</option>
              <option value={0.75}>0.75 RR</option>
              <option value={1.0}>1.0 RR</option>
              <option value={1.25}>1.25 RR</option>
              <option value={1.5}>1.5 RR</option>
            </select>
          </div>
        )}
        
        {signalMode === "continuous" && (
          <div style={{ display: "inline-block", marginLeft: "10px" }}>
            <label style={{ fontSize: 14, fontWeight: 600, opacity: isLoading ? 0.7 : 1 }}>Window Size: </label>
            <select 
              value={windowSeconds} 
              onChange={(e) => !isLoading && setWindowSeconds(Number(e.target.value))}
              disabled={isLoading}
              style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 6, opacity: isLoading ? 0.7 : 1 }}
            >
              {WINDOW_SIZE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* XOR Tolerance for XOR mode */}
      {selectedVisualization === "xor" && (
        <div style={{ marginBottom: "15px", opacity: isLoading ? 0.5 : 1 }}>
          <label style={{ fontSize: 14, fontWeight: 600, opacity: isLoading ? 0.7 : 1 }}>
            XOR Tolerance:
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={xorTolerance}
              onChange={(e) => !isLoading && setXorTolerance(Number(e.target.value))}
              disabled={isLoading}
              style={{ width: "80px", marginLeft: 8, padding: "6px", borderRadius: 6, opacity: isLoading ? 0.7 : 1 }}
            />
          </label>
        </div>
      )}

      {/* Lead selection */}
      {selectedVisualization !== "xor" && (
        <div style={{ 
          marginTop: 8,
          opacity: isLoading ? 0.5 : 1 
        }}>
          <h4 style={{ color: "#2055c0", marginBottom: 8 }}>
            Select Leads {selectedVisualization === "recurrence" ? "(max 2)" : "(max 3)"}
          </h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {allLeads.map((name, i) => (
              <label key={i} style={{
                cursor: isLoading ? "not-allowed" : "pointer",
                padding: "6px 12px",
                borderRadius: 12,
                border: leads.includes(i) ? "2px solid #2055c0" : "1px solid #ddd",
                background: leads.includes(i) ? "#e8f0ff" : "#fafafa",
                fontWeight: leads.includes(i) ? 700 : 400,
                opacity: isLoading ? 0.7 : 1
              }}>
                <input
                  type="checkbox"
                  checked={leads.includes(i)}
                  onChange={() => !isLoading && toggleLead(i)}
                  disabled={isLoading || (selectedVisualization === "recurrence" && leads.length === 2 && !leads.includes(i))}
                  style={{ marginRight: 8 }}
                />
                {name}
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  );
}