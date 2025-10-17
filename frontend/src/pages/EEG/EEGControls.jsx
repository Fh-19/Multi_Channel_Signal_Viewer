import { useState, useRef, useCallback, useEffect } from "react";

export default function EEGControls({
  handleFileUpload,
  segments,
  isPlaying,
  setIsPlaying,
  playbackSpeed,
  setPlaybackSpeed,
  windowSeconds,
  setWindowSeconds,
  xorTolerance,
  setXorTolerance,
  allChannels,
  channels,
  toggleChannel,
  isLoading,
  experimentalFs,
  setExperimentalFs,
  originalFs,
  isResampling
}) {
  // Predefined sampling frequency values
  const fsPresets = [32, 64, 128, 256, 512];
  
  // State for local slider value and debouncing
  const [localFs, setLocalFs] = useState(experimentalFs);
  const [isDragging, setIsDragging] = useState(false);
  const timeoutRef = useRef(null);

  // Update localFs when experimentalFs changes externally
  useEffect(() => {
    setLocalFs(experimentalFs);
  }, [experimentalFs]);

  // Debounced function to update the actual sampling frequency
  const debouncedSetExperimentalFs = useCallback((value) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (!isResampling) {
        setExperimentalFs(value);
      }
      timeoutRef.current = null;
    }, 256);
  }, [setExperimentalFs, isResampling]);

  const handleSliderStart = () => {
    setIsDragging(true);
  };

  const handleSliderChange = (value) => {
    const newValue = Number(value);
    setLocalFs(newValue);
    
    if (!isDragging) {
      debouncedSetExperimentalFs(newValue);
    }
  };

  const handleSliderEnd = () => {
    setIsDragging(false);
    if (!isResampling) {
      setExperimentalFs(localFs);
    }
  };

  const handleDirectInputChange = (value) => {
    const newValue = Math.max(32, Math.min(512, Number(value)));
    setLocalFs(newValue);
    if (!isResampling) {
      setExperimentalFs(newValue);
    }
  };

  const handlePresetClick = (presetFs) => {
    if (!isResampling) {
      setLocalFs(presetFs);
      setExperimentalFs(presetFs);
    }
  };

  const handleResetClick = () => {
    if (!isResampling && originalFs) {
      setLocalFs(originalFs);
      setExperimentalFs(originalFs);
    }
  };

  // Helper functions for status display (matching ECG UI)
  const getStatusColor = (resamplingType, aliasingWarning) => {
    if (aliasingWarning) return "#e24a33";
    if (resamplingType === "upsampling") return "#1ca876";
    if (resamplingType === "none") return "#666";
    return "#fbc15e";
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

  // Determine resampling type for status display
  const getResamplingType = () => {
    if (!originalFs || localFs === originalFs) return "none";
    return localFs > originalFs ? "upsampling" : "downsampling";
  };

  const resamplingType = getResamplingType();
  const aliasingWarning = localFs < originalFs && localFs < 100;

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
            EEG File Upload
          </h3>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="file"
              onChange={handleFileUpload}
              accept=".set,.edf"
              style={{ flex: 1 }}
              disabled={isLoading}
            />
            {isLoading && (
              <div style={{
                color: "#2055c0",
                fontWeight: "bold",
                fontSize: "12px"
              }}>
                Uploading...
              </div>
            )}
          </div>
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
                Target FS: {localFs} Hz
              </span>
              
              <input
                type="range"
                min="32"
                max="512"
                step="1"
                value={localFs}
                onChange={(e) => handleSliderChange(e.target.value)}
                onMouseDown={handleSliderStart}
                onMouseUp={handleSliderEnd}
                onTouchStart={handleSliderStart}
                onTouchEnd={handleSliderEnd}
                style={{ flex: 1 }}
                disabled={!originalFs || isResampling}
              />
            </div>

            {/* Manual Input */}
            <div style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: "100px" }}>
              <input
                type="number"
                min="32"
                max="512"
                step="1"
                value={localFs}
                onChange={(e) => handleDirectInputChange(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleDirectInputChange(localFs);
                  }
                }}
                disabled={!originalFs || isResampling}
                style={{
                  width: "70px",
                  padding: "4px 6px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "12px",
                  opacity: originalFs && !isResampling ? 1 : 0.6
                }}
              />
              <span style={{ fontSize: "12px", color: "#666" }}>Hz</span>
            </div>
            
            {/* Reset Button */}
            <button 
              onClick={handleResetClick}
              disabled={!originalFs || isResampling || localFs === originalFs}
              style={{
                padding: "5px 10px",
                fontSize: "12px",
                background: "#2055c0",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: (originalFs && !isResampling && localFs !== originalFs) ? "pointer" : "not-allowed",
                opacity: (originalFs && !isResampling && localFs !== originalFs) ? 1 : 0.6,
                whiteSpace: "nowrap"
              }}
            >
              Reset to {originalFs} Hz
            </button>
          </div>
          
          <div style={{ fontSize: "11px", color: "#888" }}>
            <div>Original: {originalFs || "N/A"} Hz | Nyquist: {originalFs ? Math.round(originalFs/2) : "N/A"} Hz</div>
            
            {/* Enhanced status display */}
            {originalFs && (
              <div style={{ 
                color: getStatusColor(resamplingType, aliasingWarning),
                fontWeight: "bold",
                marginTop: "5px",
                padding: "5px",
                background: getStatusBackground(resamplingType, aliasingWarning),
                borderRadius: "3px",
                fontSize: "10px"
              }}>
                {getStatusMessage(resamplingType, aliasingWarning, localFs, originalFs)}
              </div>
            )}
          </div>

          {/* Preset buttons */}
          {originalFs && (
            <div style={{ marginTop: "12px" }}>
              <div style={{ fontSize: "11px", fontWeight: "600", marginBottom: "6px", color: "#666" }}>
                Quick presets:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {fsPresets.map(presetFs => (
                  <button
                    key={presetFs}
                    onClick={() => handlePresetClick(presetFs)}
                    disabled={!originalFs || isResampling}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      border: "1px solid #b7cdfc",
                      background: localFs === presetFs ? "#2055c0" : "white",
                      color: localFs === presetFs ? "white" : "#2055c0",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: (originalFs && !isResampling) ? "pointer" : "not-allowed",
                      opacity: (originalFs && !isResampling) ? 1 : 0.6,
                      transition: "all 0.2s ease"
                    }}
                  >
                    {presetFs} Hz
                  </button>
                ))}
              </div>
            </div>
          )}
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
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={!segments.length || isLoading || isResampling}
            style={{
              padding: "8px 16px",
              // CHANGED: Default to green "Play" button, red when playing
              background: isPlaying ? "#e24a33" : "#1ca876",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: (segments.length && !isLoading && !isResampling) ? "pointer" : "not-allowed",
              opacity: (segments.length && !isLoading && !isResampling) ? 1 : 0.6
            }}
          >
            {/* CHANGED: Show "Play" by default, "Pause" when playing */}
            {isPlaying ? "Pause" : "Play"}
          </button>

          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            disabled={!segments.length || isLoading || isResampling}
            style={{
              padding: "6px 10px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              opacity: (segments.length && !isLoading && !isResampling) ? 1 : 0.6
            }}
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "#666" }}>Window:</span>
            <input
              type="number"
              min={1}
              max={60}
              value={windowSeconds}
              onChange={(e) => setWindowSeconds(Number(e.target.value))}
              disabled={!segments.length || isLoading || isResampling}
              style={{ 
                width: "80px", 
                padding: "6px", 
                borderRadius: "4px",
                border: "1px solid #ddd",
                opacity: (segments.length && !isLoading && !isResampling) ? 1 : 0.6
              }}
            />
            <span style={{ fontSize: "12px", color: "#666", minWidth: "40px" }}>
              {windowSeconds}s
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "#666" }}>XOR tol:</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={xorTolerance}
              onChange={(e) => setXorTolerance(Number(e.target.value))}
              disabled={!segments.length || isLoading || isResampling}
              style={{ 
                width: "80px", 
                padding: "6px", 
                borderRadius: "4px",
                border: "1px solid #ddd",
                opacity: (segments.length && !isLoading && !isResampling) ? 1 : 0.6
              }}
            />
            <span style={{ fontSize: "12px", color: "#666" }}>µV</span>
          </div>
        </div>
      </div>

      {/* Channel Selection Section */}
      <div style={{
        padding: "15px",
        background: "#fff",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}>
        <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#333" }}>
          Channel Selection
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {allChannels.map((channel) => (
            <button
              key={channel}
              onClick={() => toggleChannel(channel)}
              disabled={!segments.length || isLoading || isResampling}
              style={{
                padding: "6px 12px",
                background: channels.includes(channel) ? "#2055c0" : "#f0f0f0",
                color: channels.includes(channel) ? "white" : "#333",
                border: "none",
                borderRadius: "4px",
                cursor: (segments.length && !isLoading && !isResampling) ? "pointer" : "not-allowed",
                opacity: (segments.length && !isLoading && !isResampling) ? 1 : 0.6,
                fontSize: "12px"
              }}
            >
              {channel}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}