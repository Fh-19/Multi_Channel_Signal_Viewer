import { useMemo, useEffect } from "react";
import Plot from "react-plotly.js";
import { predictEegFile } from "../../services/eegService";

const DISEASE_COLORS = {
  "Alzheimer": "#E24A33",
  "Dementia": "#348ABD", 
  "Epilepsy": "#988ED5",
  "Healthy": "#8EBA42",
  "Schizophrenia": "#FBC15E"
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
  isLoading,
  experimentalFs,
  isPlaying = false
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

  // Update band powers using useEffect
  useEffect(() => {
    if (bandData) {
      setBandPowers(bandData);
    }
  }, [bandData, setBandPowers]);

  // Predict handler - uses experimentalFs
  const handlePredict = async () => {
    if (!uploadedFile) {
      alert("Please upload an EEG file first.");
      return;
    }
    
    setIsPredicting(true);
    setPrediction(null);
    setPredictionProbs(null);

    try {
      const res = await predictEegFile(uploadedFile, experimentalFs);
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

  const classificationBarChart = useMemo(() => {
    if (!predictionProbs) return null;

    const diseases = Object.keys(predictionProbs);
    const values = diseases.map((d) => predictionProbs[d] * 100);

    return (
      <Plot
        data={[
          {
            x: values,
            y: diseases,
            type: "bar",
            orientation: "h",
            marker: {
              color: diseases.map(d => DISEASE_COLORS[d] || "#3498db"),
              line: { color: "#2c3e50", width: 1 },
            },
            text: values.map(v => v.toFixed(1) + "%"),
            textposition: "auto",
          },
        ]}
        layout={{
          width: 420,
          height: diseases.length * 40 + 100,
          margin: { l: 150, r: 20, t: 20, b: 40 },
          xaxis: { title: "Probability (%)", range: [0, 100] },
          yaxis: { 
            tickvals: diseases,
            ticktext: diseases
          },
          showlegend: false,
        }}
        config={{ displayModeBar: false }}
      />
    );
  }, [predictionProbs]);

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
      <h2 style={{ marginTop: 0, marginBottom: 12, color: "#263357" }}>EEG Analysis</h2>

      {/* Prediction Section */}
      <div style={{ marginTop: 25 }}>
        <button
          onClick={handlePredict}
          disabled={isPredicting || isLoading || !uploadedFile}
          style={{
            backgroundColor: (isPredicting || isLoading || !uploadedFile) ? "#8d97b6" : "#2055c0",
            color: "white",
            border: "none",
            borderRadius: 6,
            padding: "10px 18px",
            fontWeight: 600,
            cursor: (isPredicting || isLoading || !uploadedFile) ? "not-allowed" : "pointer",
            marginBottom: 15,
            width: "100%"
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
            <div style={{
              padding: "10px",
              backgroundColor: "#e8f5e8",
              borderRadius: "5px",
              marginBottom: "15px"
            }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#263357" }}>Prediction Result</h4>
              <p style={{ 
                fontSize: "16px", 
                fontWeight: "bold", 
                color: DISEASE_COLORS[prediction] || "#2055c0", 
                margin: 0 
              }}>
                {prediction}
              </p>
            </div>

            <div style={{ textAlign: "center" }}>
              <h4 style={{ color: "#263357", marginBottom: 10 }}>Class Probabilities</h4>
              {classificationBarChart}
            </div>
          </>
        ) : prediction ? (
          <div style={{
            padding: "10px",
            backgroundColor: "#e8f5e8",
            borderRadius: "5px",
            marginBottom: "15px"
          }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#263357" }}>Prediction Result</h4>
            <p style={{ 
              fontSize: "16px", 
              fontWeight: "bold", 
              color: DISEASE_COLORS[prediction] || "#2055c0", 
              margin: 0 
            }}>
              {prediction}
            </p>
          </div>
        ) : (
          <div style={{ 
            textAlign: "center", 
            color: "#8d97b6",
            padding: "20px",
            backgroundColor: "#f9f9f9",
            borderRadius: "6px"
          }}>
            <p>Click "Predict Disease" to see classification results</p>
            <p style={{ fontSize: "12px", marginTop: "10px" }}>
              Load an EEG file first, then click the Predict Disease button to get disease classification predictions.
            </p>
          </div>
        )}
      </div>

      {/* Band Power Chart */}
      <div style={{ marginTop: 25, paddingTop: 15, borderTop: "1px solid #eee" }}>
        <h4 style={{ color: "#263357", marginBottom: 10 }}>EEG Band Powers</h4>
        
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 14, fontWeight: 600, opacity: isLoading ? 0.7 : 1 }}>
            Channel:
            <select
              value={bandPowerChannel || ""}
              onChange={(e) => !isLoading && setBandPowerChannel(e.target.value || null)}
              disabled={isLoading}
              style={{ 
                marginLeft: 8, 
                padding: "6px 10px", 
                borderRadius: "4px",
                border: "1px solid #ddd",
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
                marker: { 
                  color: [  "#E24A33",
                  "#348ABD", 
                  "#988ED5",
                  "#8EBA42",
                  "#FBC15E"],
                  line: { color: "#2c3e50", width: 1 }
                },
                text: Object.values(bandPowers).map(v => v.toFixed(1) + "%"),
                textposition: "auto",
              },
            ]}
            layout={{
              height: 300,
              margin: { t: 20, l: 60, r: 20, b: 60 },
              xaxis: { title: "Frequency Band" },
              yaxis: { title: "Relative Power (%)", range: [0, 100] },
              showlegend: false,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%" }}
          />
        ) : (
          <div style={{ 
            textAlign: "center", 
            color: "#8d97b6",
            padding: "20px",
            backgroundColor: "#f9f9f9",
            borderRadius: "6px"
          }}>
            Band power chart waiting for EEG data...
          </div>
        )}
      </div>

      {/* Recording Information - MOVED TO BOTTOM */}
      <div style={{ marginTop: 25, paddingTop: 15, borderTop: "1px solid #eee" }}>
        <h4 style={{ color: "#263357", marginBottom: 10 }}>Recording Information</h4>
        <div style={{ fontSize: "14px", color: "#555" }}>
          <p><strong>Sampling Rate:</strong> {experimentalFs} Hz</p>
          <p><strong>Selected Channels:</strong> {channels.join(", ")}</p>
          <p><strong>Window Size:</strong> {windowSeconds} seconds</p>
          <p><strong>Status:</strong> 
            <span style={{ color: "#e74c3c", fontWeight: "bold", marginLeft: "5px" }}>
              Paused
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}