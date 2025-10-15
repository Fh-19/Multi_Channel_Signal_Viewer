import { useMemo, useEffect } from "react"; // ADD: Import useEffect
import Plot from "react-plotly.js";
import { predictEegFile } from "../../services/eegService";

const colorPalette = {
  Alzheimer: "#FF6B6B",
  Dementia: "#FFD93D",
  Epilepsy: "#6BCB77",
  Healthy: "#4D96FF",
  Schizophrenia: "#845EC2",
};

export default function EEGAnalysis({
  uploadedFile,
  prediction,
  setPrediction,
  predictionProbs,
  setPredictionProbs,
  isPredicting,
  setIsPredicting,
  channels,
  buffer,
  time,
  fs,
  windowSeconds,
  bandPowers,
  setBandPowers,
  bandPowerChannel,
  setBandPowerChannel,
  isLoading
}) {
  // Compute EEG bands
  const bandData = useMemo(() => {
    if (!channels.length || !time.length) return null;

    const selectedChannel = bandPowerChannel || channels[0];
    const samples = buffer[selectedChannel] || [];
    if (samples.length < fs) return null;

    // FFT
    const N = samples.length;
    const freqs = Array.from({ length: Math.floor(N / 2) }, (_, i) => (i * fs) / N);
    const fft = new Array(N);
    for (let k = 0; k < N; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) {
        const phi = (2 * Math.PI * k * n) / N;
        re += samples[n] * Math.cos(phi);
        im -= samples[n] * Math.sin(phi);
      }
      fft[k] = Math.sqrt(re * re + im * im);
    }
    const psd = fft.slice(0, Math.floor(N / 2));

    // Band ranges (Hz)
    const bands = {
      Delta: [0.5, 4],
      Theta: [4, 8],
      Alpha: [8, 13],
      Beta: [13, 30],
      Gamma: [30, 100],
    };

    // Compute absolute power per band
    const power = {};
    let total = 0;
    for (const [band, [low, high]] of Object.entries(bands)) {
      let sum = 0;
      for (let i = 0; i < freqs.length; i++) {
        if (freqs[i] >= low && freqs[i] < high) sum += psd[i];
      }
      power[band] = sum;
      total += sum;
    }

    // Convert to relative (%) power
    const relative = {};
    for (const band of Object.keys(power)) {
      relative[band] = total > 0 ? (power[band] / total) * 100 : 0;
    }
    return relative;
  }, [buffer, channels, fs, time, bandPowerChannel]);

  // FIXED: Update band powers using useEffect instead of useMemo
  useEffect(() => {
    if (bandData) {
      setBandPowers(bandData);
    }
  }, [bandData, setBandPowers]);

  // Predict handler
  const handlePredict = async () => {
    if (!uploadedFile) return;
    setIsPredicting(true);
    setPrediction(null);
    setPredictionProbs(null);

    try {
      const res = await predictEegFile(uploadedFile);
      if (res.probabilities && Object.keys(res.probabilities).length > 0) {
        setPrediction(res.prediction || "Unknown");
        setPredictionProbs(res.probabilities);
      } else if (res.prediction) {
        setPrediction(res.prediction);
      } else {
        setPrediction("Unknown");
      }
    } catch (err) {
      console.error(err);
      setPrediction("Prediction error");
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div style={{
      flex: 3,
      padding: "20px 24px",
      overflowY: "auto",
      background: "#fff",
      alignItems: "center",
      width: "100%",
      opacity: isLoading ? 0.5 : 1
    }}>
      <h2 style={{ marginTop: 0, marginBottom: 12, color: "#263357" }}>Prediction + Band Powers</h2>

      {/* Prediction */}
      <div style={{ marginTop: 25 }}>
        <button
          onClick={handlePredict}
          disabled={isPredicting || isLoading || !uploadedFile}
          style={{
            backgroundColor: (isPredicting || isLoading || !uploadedFile) ? "#8d97b6" : "#2055c0",
            color: "white",
            border: "none",
            borderRadius: 6,
            padding: "6px 12px",
            fontWeight: 600,
            cursor: (isPredicting || isLoading || !uploadedFile) ? "not-allowed" : "pointer",
            marginBottom: 10,
          }}
        >
          {isPredicting ? "Predicting..." : (isLoading ? "Loading Data..." : "Predict Disease")}
        </button>

        {isLoading ? (
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100px",
            color: "#8d97b6",
            fontSize: "14px",
            fontWeight: "bold"
          }}>
            Waiting for EEG data to load...
          </div>
        ) : predictionProbs ? (
          <>
            <div style={{ fontSize: 15, marginBottom: 8 }}>
              Predicted:{" "}
              <strong style={{ color: colorPalette[prediction] || "#2055c0" }}>
                {prediction}
              </strong>
            </div>

            <Plot
              data={[
                {
                  type: "bar",
                  x: Object.values(predictionProbs),
                  y: Object.keys(predictionProbs),
                  orientation: "h",
                  marker: {
                    color: Object.keys(predictionProbs).map(
                      (cls) => colorPalette[cls] || "#2055c0"
                    ),
                  },
                  text: Object.values(predictionProbs).map(
                    (v) => (v * 100).toFixed(1) + "%"
                  ),
                  textposition: "auto",
                },
              ]}
              layout={{
                height: 250,
                margin: { t: 20, l: 120, r: 30, b: 40 },
                xaxis: { title: "Probability", range: [0, 1] },
                yaxis: { automargin: true },
                title: `Prediction Probabilities`,
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%" }}
            />
          </>
        ) : prediction ? (
          <div style={{ fontWeight: 700, color: "#2055c0" }}>
            Predicted: {prediction}
          </div>
        ) : (
          <div style={{ color: "#8d97b6" }}>No prediction yet.</div>
        )}
      </div>

      {/* Band Power Chart */}
      <div style={{ marginTop: 25 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>EEG Band Powers</div>
        
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 600, opacity: isLoading ? 0.7 : 1 }}>
            Channel:
            <select
              value={bandPowerChannel || ""}
              onChange={(e) => !isLoading && setBandPowerChannel(e.target.value || null)}
              disabled={isLoading}
              style={{ 
                marginLeft: 8, 
                padding: "4px 8px", 
                borderRadius: 4, 
                fontSize: 13,
                opacity: isLoading ? 0.7 : 1 
              }}
            >
              <option value="">Auto (first channel)</option>
              {channels.map((ch) => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          </label>
        </div>

        {isLoading ? (
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "250px",
            color: "#8d97b6",
            fontSize: "14px",
            fontWeight: "bold"
          }}>
            Calculating band powers...
          </div>
        ) : bandPowers ? (
          <Plot
            data={[
              {
                type: "bar",
                x: Object.keys(bandPowers),
                y: Object.values(bandPowers),
                marker: { color: ["#4D96FF", "#6BCB77", "#FFD93D", "#FF6B6B", "#845EC2"] },
                text: Object.values(bandPowers).map(v => v.toFixed(1) + "%"),
                textposition: "auto",
              },
            ]}
            layout={{
              height: 250,
              margin: { t: 20, l: 40, r: 20, b: 40 },
              yaxis: { title: "Relative Power (%)", range: [0, 100] },
              title: `Channel: ${bandPowerChannel || channels[0] || "-"}`,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%" }}
          />
        ) : (
          <div style={{ color: "#8d97b6" }}>Band power chart waiting for data...</div>
        )}
      </div>
    </div>
  );
}