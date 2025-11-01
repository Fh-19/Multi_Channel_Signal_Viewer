import { uploadDopplerFile, predictDopplerFile } from "../../services/dopplerService";
import { WaveFile } from "wavefile";

export default function DopplerUpload({
  setLoading,
  setUploadStatus,
  setPrediction,
  setError,
  setWaveform,
  setAudioUrl,
  loading,
  uploadStatus,
  error,
  samplingRate,
}) {
  // Upload and auto-predict file
  const handleFileUpload = async (e) => {
    setError(null);
    const file = e.target.files[0];
    if (!file) return;

    // Validation
    if (!file.name.toLowerCase().endsWith(".wav")) {
      setError("Please upload a WAV file");
      return;
    }

    setLoading(true);
    try {
      // Step 1: Upload file and get metadata
      const result = await uploadDopplerFile(file);
      setUploadStatus({ ...result, filename: file.name });

      // Step 2: Create audio URL for playback
      const url = URL.createObjectURL(file);
      setAudioUrl(url);

      // Step 3: Run ML prediction with current sampling rate
      const pred = await predictDopplerFile(file, samplingRate);
      setPrediction(pred);

      // Step 4: Generate waveform visualization (no AudioContext decoding)
      const arrayBuffer = await file.arrayBuffer();
      const wav = new WaveFile(new Uint8Array(arrayBuffer));

      // Extract PCM samples directly (no resampling or anti-alias filtering)
      const samples = wav.getSamples(false, Float32Array);

      // Optional: lightly downsample for visualization (keep 1000 points max)
      const step = Math.max(1, Math.floor(samples.length / 1000));
      const waveformData = samples.filter((_, i) => i % step === 0);

      setWaveform(Array.from(waveformData));
    } catch (err) {
      console.error("Upload/predict error:", err);
      setError(err.message || "Failed to upload/predict");
    } finally {
      setLoading(false);
      e.target.value = ""; // Reset file input
    }
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      <h3 style={{ color: "#2055c0", marginBottom: 10 }}>Upload Audio</h3>
      <input
        type="file"
        accept=".wav"
        onChange={handleFileUpload}
        style={{
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #ccc",
          width: "100%",
          maxWidth: 300,
          marginBottom: 10,
        }}
      />

      {/* Display current prediction sampling rate */}
      <p style={{ fontSize: "12px", color: "#666", marginBottom: 10 }}>
        Prediction will use sample rate: <b>{samplingRate} Hz</b>
      </p>

      {loading && <p style={{ marginTop: 10, color: "#8d97b6" }}>Processing...</p>}
      {error && <p style={{ marginTop: 10, color: "red" }}>Error: {error}</p>}

      {uploadStatus && (
        <div>
          <p
            style={{
              marginTop: 10,
              color: "#2e7d32",
              background: "#e8f5e9",
              padding: "8px 12px",
              borderRadius: 6,
              fontWeight: 500,
            }}
          >
            Upload complete: <b>{uploadStatus.filename}</b>
          </p>
          {uploadStatus.sampling_rate && (
            <p style={{ fontSize: "12px", color: "#666", marginTop: 5 }}>
              File sample rate: <b>{uploadStatus.sampling_rate} Hz</b>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
