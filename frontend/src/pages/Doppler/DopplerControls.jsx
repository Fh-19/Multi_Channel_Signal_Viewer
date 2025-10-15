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
  playing,
  setPlaying,
  setError,
}) {
  // Handle simulation playback
  const handlePlay = async () => {
    setError(null);
    setPlaying(true);
    try {
      await playDoppler(frequency, speed, realisticMode);
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
      const blob = await generateDoppler(frequency, speed, realisticMode);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const mode = realisticMode ? "realistic" : "basic";
      a.download = `doppler_${mode}_${frequency}Hz_${speed}kmh.wav`;
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
            {playing ? "🔊 Playing..." : "▶ Hear Simulation"}
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