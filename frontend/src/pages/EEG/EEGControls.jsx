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
  isLoading
}) {
  return (
    <>
      {/* Upload with loading state */}
      <div style={{ position: "relative" }}>
        <input
          type="file"
          accept=".set,.edf"
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

      {/* Playback controls - disable during loading */}
      {segments.length > 0 && (
        <div style={{ 
          marginTop: 10, 
          marginBottom: 8, 
          display: "flex", 
          alignItems: "center", 
          gap: 12,
          opacity: isLoading ? 0.5 : 1 
        }}>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={isLoading}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "none",
              background: isPlaying ? "#e74c3c" : "#2ecc71",
              color: "#fff",
              fontWeight: 700,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>

          <label style={{ fontSize: 14, opacity: isLoading ? 0.7 : 1 }}>
            Speed:
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              disabled={isLoading}
              style={{ 
                marginLeft: 8, 
                padding: "6px 8px", 
                borderRadius: 6,
                opacity: isLoading ? 0.7 : 1 
              }}
            >
              <option value={0.25}>0.25x</option>
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </label>

          <label style={{ fontSize: 14, opacity: isLoading ? 0.7 : 1 }}>
            Window (s):
            <input
              type="number"
              min={1}
              max={60}
              value={windowSeconds}
              onChange={(e) => setWindowSeconds(Number(e.target.value))}
              disabled={isLoading}
              style={{ 
                width: 80, 
                marginLeft: 8, 
                padding: "6px", 
                borderRadius: 6,
                opacity: isLoading ? 0.7 : 1 
              }}
            />
          </label>

          <label style={{ fontSize: 14, opacity: isLoading ? 0.7 : 1 }}>
            XOR tol (µV):
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={xorTolerance}
              onChange={(e) => setXorTolerance(Number(e.target.value))}
              disabled={isLoading}
              style={{ 
                width: 120, 
                marginLeft: 8, 
                padding: "6px", 
                borderRadius: 6,
                opacity: isLoading ? 0.7 : 1 
              }}
            />
          </label>
        </div>
      )}

      {/* channel selection - disable during loading */}
      {allChannels.length > 0 && (
        <div style={{ 
          marginTop: 8,
          opacity: isLoading ? 0.5 : 1 
        }}>
          <h4 style={{ color: "#2055c0", marginBottom: 8 }}>Channels (max 5)</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {allChannels.map((ch) => (
              <label key={ch} style={{
                cursor: isLoading ? "not-allowed" : "pointer",
                padding: "6px 12px",
                borderRadius: 12,
                border: channels.includes(ch) ? "2px solid #2055c0" : "1px solid #ddd",
                background: channels.includes(ch) ? "#e8f0ff" : "#fafafa",
                fontWeight: channels.includes(ch) ? 700 : 400,
                opacity: isLoading ? 0.7 : 1
              }}>
                <input
                  type="checkbox"
                  checked={channels.includes(ch)}
                  onChange={() => !isLoading && toggleChannel(ch)}
                  disabled={isLoading}
                  style={{ marginRight: 8 }}
                />
                {ch}
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  );
}