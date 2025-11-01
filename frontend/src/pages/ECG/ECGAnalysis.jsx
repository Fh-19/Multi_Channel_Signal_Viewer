import { useMemo } from "react";
import Plot from "react-plotly.js";
import { classifyWithSampling } from "../../services/ecgService";

const DISEASE_COLORS = {
  "1dAVb": "#E24A33",
  "RBBB": "#348ABD",
  "LBBB": "#988ED5",
  "SB": "#777777",
  "AF": "#FBC15E",
  "ST": "#8EBA42"
};
// receives all data and satae setters as props from parent components
export default function ECGAnalysis({
  filename,
  prediction,
  predictionProbs,
  isPredicting,
  fs,
  leads,
  leadNames,
  signalMode,
  selectedVisualization,
  isPlaying,
  isLoading,
  setPrediction,
  setPredictionProbs,
  setIsPredicting,
  displayFs
}) {
  // Ensures a file is uploaded before attempting prediction.
const handlePredict = async () => {
  if (!filename) {
    alert("Please upload an ECG file first.");
    return;
  }
  //delete the pervious result before new prediction:
  setIsPredicting(true);
  setPrediction(null);
  setPredictionProbs(null);

  try {
    // Pass the actual sampling rate (fs) instead of empty string
    const result = await classifyWithSampling(filename, displayFs); // get the result
    
    // Set prediction results based on the actual API response structure
    if (result && result.prediction) {
      setPrediction(result.prediction);
      
      // Set probabilities if available
      if (result.probabilities && Object.keys(result.probabilities).length > 0) {
        setPredictionProbs(result.probabilities);
      }
    } else if (result && result.label) {
      // Handle case where response uses 'label' instead of 'prediction'
      setPrediction(result.label);
      if (result.probabilities) {
        setPredictionProbs(result.probabilities);
      }
    } else {
      // Fallback for unexpected response format
      setPrediction("Unknown");
      console.warn("Unexpected API response format:", result);
    }
  } catch (err) {
    console.error("Prediction failed:", err);
    setPrediction("Prediction error");
    setPredictionProbs(null);
  } finally {
    setIsPredicting(false);
  }
};

  const classificationBarChart = useMemo(() => {
    if (!predictionProbs) return null;

    const FULL_DISEASE_NAMES = {
      'Normal': 'Normal Sinus Rhythm',
      'AF': 'Atrial Fibrillation',
      'ST': 'ST-segment Abnormality',
      'SB': 'Sinus Bradycardia',
      'LBBB': 'Left Bundle Branch Block',
      'RBBB': 'Right Bundle Branch Block',
      '1dAVb': 'First-degree Atrioventricular Block',
    };
    // prepare data for charts 
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
            ticktext: diseases.map(d => FULL_DISEASE_NAMES[d] || d)
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
      <h2 style={{ marginTop: 0, marginBottom: 12, color: "#263357" }}>ECG Analysis</h2>

      {/* Prediction */}
      <div style={{ marginTop: 25 }}>
        <button
          onClick={handlePredict}
          disabled={isPredicting || isLoading || !filename}
          style={{
            backgroundColor: (isPredicting || isLoading || !filename) ? "#8d97b6" : "#2055c0",
            color: "white",
            border: "none",
            borderRadius: 6,
            padding: "10px 18px",
            fontWeight: 600,
            cursor: (isPredicting || isLoading || !filename) ? "not-allowed" : "pointer",
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
            Waiting for ECG data to load...
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
              Load an ECG file first, then click the Predict Disease button to get disease classification predictions.
            </p>
          </div>
        )}
      </div>

      {/* Recording Information */}
      <div style={{ marginTop: 25, paddingTop: 15, borderTop: "1px solid #eee" }}>
        <h4 style={{ color: "#263357", marginBottom: 10 }}>Recording Information</h4>
        <div style={{ fontSize: "14px", color: "#555" }}>
          <p><strong>Sampling Rate:</strong> {fs} Hz</p>
          <p><strong>Selected Leads:</strong> {leads.map(idx => leadNames[idx]).join(", ")}</p>
          <p><strong>Signal Mode:</strong> {signalMode === "cycle" ? "Cycle-by-cycle" : "Continuous"}</p>
          <p><strong>Visualization:</strong> {
            selectedVisualization === "polar" ? "Polar Graph" : 
            selectedVisualization === "recurrence" ? "Recurrence Graph" : "XOR Graph"
          }</p>
          <p><strong>Status:</strong> {isPlaying ? 
            <span style={{ color: "#2ecc71", fontWeight: "bold" }}>Playing</span> : 
            <span style={{ color: "#e74c3c", fontWeight: "bold" }}>Paused</span>}
          </p>
        </div>
      </div>
    </div>
  );
}