import Plot from "react-plotly.js";

export default function RecurrenceVisualization({
  crpMatrix,
  recurrencePlotType,
  colorScale,
  leads,
  leadNames,
  isLoading,
  scatterData
}) {
  if (isLoading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "400px",
        color: "#8d97b6",
        fontSize: "18px",
        fontWeight: "bold"
      }}>
        Loading Recurrence Visualization...
      </div>
    );
  }

  if (!crpMatrix) return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      height: "400px",
      color: "#8d97b6"
    }}>
      Load ECG and click Play to generate recurrence plot
    </div>
  );

  if (recurrencePlotType === "heatmap") {
    return (
      <Plot
        data={[{
          z: crpMatrix.z,
          x: crpMatrix.x,
          y: crpMatrix.y,
          type: "heatmap",
          colorscale: colorScale,
          zmin: 0,
          zmax: crpMatrix.maxVal || 1,
        }]}
        layout={{
          width: "100%",
          height: 400,
          margin: { l: 50, r: 20, t: 40, b: 40 },
          xaxis: { title: `${leadNames[leads[0]]} (cycle samples)` },
          yaxis: { title: `${leadNames[leads[1]]} (cycle samples)` },
          title: `Cross Recurrence Plot - Cycle ${crpMatrix.currentCycle + 1}`
        }}
      />
    );
  } else if (recurrencePlotType === "scatter") {
    return (
      <Plot
        data={scatterData}
        layout={{
          width: "100%",
          height: 400,
          margin: { l: 50, r: 20, t: 40, b: 40 },
          xaxis: { 
            title: `${leadNames[leads[0]]} (cycle samples)`,
            range: [0, 200]
          },
          yaxis: { 
            title: `${leadNames[leads[1]]} (cycle samples)`,
            range: [0, 200]
          },
          title: `Recurrence Scatter Plot - Cycle ${crpMatrix.currentCycle + 1}`
        }}
      />
    );
  } else {
    return (
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        height: "400px",
        color: "#8d97b6"
      }}>
        Unknown visualization type
      </div>
    );
  }
}