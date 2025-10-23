import {
  generateDoppler,
  playDoppler,
} from "../../services/dopplerService";

export default function DopplerControls({
  realisticMode,
  setRealisticMode,
  frequency,
  setFrequency,
  speed,
  setSpeed,
  samplingRate,
  setSamplingRate,
  playing,
  setPlaying,
  setError,
})
 {
  // Handle simulation playback
  const handlePlay = async () => {
    setError(null);
    setPlaying(true);
    try {
      await playDoppler(frequency, speed, realisticMode, samplingRate);
      setTimeout(() => setPlaying(false), 8000);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Failed to play Doppler signal"
      );
      setPlaying(false);
    }
  };

  // Generate and download file
  const handleGenerate = async () => {
    setError(null);
    try {
      const blob = await generateDoppler(frequency, speed, realisticMode, samplingRate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const mode = realisticMode ? "realistic" : "basic";
      a.download = `doppler_${mode}_${frequency}Hz_${speed}kmh_${samplingRate}Hz.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Failed to generate Doppler signal"
      );
    }
  };

  // Common sample rate presets for quick selection
  const commonRates = [1600 , 2500 , 8000, 16000, 22050, 32000, 44100];

  return (
    <>
      {/* Simulation Mode */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          marginBottom: 20,
        }}
      >
        <h3 style={{ color: "#2055c0", marginBottom: 10 }}>Simulation Mode</h3>
        <div style={{ display: "flex", gap: 15, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="radio"
              checked={realisticMode}
              onChange={() => setRealisticMode(true)}
            />
            Realistic Car Simulation
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="radio"
              checked={!realisticMode}
              onChange={() => setRealisticMode(false)}
            />
            Basic Doppler Tone
          </label>
        </div>
      </div>

      {/* Continuous Sampling Rate Control */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          marginBottom: 20,
        }}
      >
        <h3 style={{ color: "#2055c0", marginBottom: 10 }}>Sampling Frequency</h3>
        <div style={{ marginBottom: 10 }}>
          <label>
            Sample Rate: <strong>{samplingRate} Hz</strong>
            <input
              type="range"
              min="1600"
              max="44100"
              step="100"  
              value={samplingRate}
              onChange={(e) => setSamplingRate(Number(e.target.value))}
              style={{
                width: "100%",
                marginTop: 8,
              }}
            />
          </label>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            fontSize: "16px",
            color: "#666",
            marginTop: 4
          }}>
            <span>1.6kHz</span>
            <span>8kHz</span>
            <span>16kHz</span>
            <span>24kHz</span>
            <span>32kHz</span>
            <span>44.1kHz</span>
          </div>
          
          {/* Quick selection buttons for common rates */}
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: "12px", color: "#666", marginBottom: 8 }}>Quick select:</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {commonRates.map(rate => (
                <button
                  key={rate}
                  onClick={() => setSamplingRate(rate)}
                  style={{
                    background: samplingRate === rate ? "#2055c0" : "#f0f4f8",
                    color: samplingRate === rate ? "#fff" : "#333",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    padding: "4px 8px",
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  {rate/1000}kHz
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Generate Section */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          marginBottom: 20,
        }}
      >
        <h3 style={{ color: "#2055c0", marginBottom: 10 }}>Parameters</h3>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          <label>
            Frequency (Hz):{" "}
            <input
              type="number"
              value={frequency}
              onChange={(e) => setFrequency(Number(e.target.value))}
              style={{
                width: 120,
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid #ccc",
              }}
            />
          </label>
          <label>
            Speed (km/h):{" "}
            <input
              type="number"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              style={{
                width: 120,
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid #ccc",
              }}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handlePlay}
            disabled={playing}
            style={{
              background: playing ? "#8d97b6" : "#28a745",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontWeight: 600,
            }}
          >
            {playing ? "Playing..." : "Hear Simulation"}
          </button>
          <button
            onClick={handleGenerate}
            style={{
              background: "#2055c0",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontWeight: 600,
            }}
          >
            ⬇ Download .WAV
          </button>
        </div>
      </div>
    </>
  );
}