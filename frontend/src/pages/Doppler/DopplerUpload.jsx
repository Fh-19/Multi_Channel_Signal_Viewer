import { uploadDopplerFile, predictDopplerFile } from "../../services/dopplerService";

export default function DopplerUpload({
  setLoading,
  setUploadStatus,
  setPrediction,
  setError,
  setWaveform,
  setAudioUrl,
  setPlayingUploaded,
  loading,
  uploadStatus,
  error,
  audioUrl,
  playingUploaded,
  samplingRate, // NEW: Receive sampling rate for prediction
}) {
  // Upload and auto-predict file
  const handleFileUpload = async (e) => {
    setError(null);
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".wav")) {
      setError("Please upload a WAV file");
      return;
    }

    setLoading(true);
    try {
      const result = await uploadDopplerFile(file);
      setUploadStatus({ ...result, filename: file.name });

      // Create URL for audio playback
      const url = URL.createObjectURL(file);
      setAudioUrl(url);

      // Auto-run prediction with current sampling rate
      const pred = await predictDopplerFile(file, samplingRate); // NEW: Pass sampling rate
      setPrediction(pred);

      // Visualize waveform
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);
      const sampleStep = Math.floor(channelData.length / 1000);
      const waveformData = channelData.filter((_, i) => i % sampleStep === 0);
      setWaveform(waveformData);
    } catch (err) {
      setError(err.message || "Failed to upload/predict");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  // Play uploaded audio
  const handlePlayUploaded = () => {
    if (!audioUrl) return;
    
    setPlayingUploaded(true);
    const audio = new Audio(audioUrl);
    
    audio.onended = () => {
      setPlayingUploaded(false);
    };
    
    audio.onerror = () => {
      setError("Failed to play uploaded audio");
      setPlayingUploaded(false);
    };
    
    audio.play().catch(err => {
      setError("Failed to play audio: " + err.message);
      setPlayingUploaded(false);
    });
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
      
      {/* NEW: Display current prediction sampling rate */}
      <p style={{ fontSize: "12px", color: "#666", marginBottom: 10 }}>
        Prediction will use sample rate: <b>{samplingRate} Hz</b>
      </p>
      
      {loading && (
        <p style={{ marginTop: 10, color: "#8d97b6" }}>Processing...</p>
      )}
      {error && (
        <p style={{ marginTop: 10, color: "red" }}>Error: {error}</p>
      )}

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
            ✅ Upload complete: <b>{uploadStatus.filename}</b>
          </p>
          {/* NEW: Display actual file sample rate */}
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