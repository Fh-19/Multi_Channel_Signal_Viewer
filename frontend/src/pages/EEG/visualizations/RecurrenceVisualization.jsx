import Plot from "react-plotly.js";

export default function RecurrenceVisualization({ 
  recurrenceData, 
  recurrencePair, 
  recurrencePlotType, 
  isLoading 
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

  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        Recurrence {recurrencePlotType} ({recurrencePair[0] || "-"} vs {recurrencePair[1] || "-"})
      </div>
      {recurrenceData ? (
        recurrencePlotType === "scatter" ? (
          <Plot
            data={[{
              type: "scatter",
              mode: "markers",
              x: recurrenceData.xs,
              y: recurrenceData.ys,
              marker: {
                size: 3,
                opacity: 0.6,
                color: "#2055c0"
              }
            }]}
            layout={{
              height: 400,
              xaxis: { title: recurrencePair[0] },
              yaxis: { title: recurrencePair[1] },
              margin: { t: 40, l: 50, r: 20, b: 50 },
            }}
            config={{ displayModeBar: false }}
            style={{ width: "100%" }}
          />
        ) : (
          <Plot
            data={[{
              type: "heatmap",
              z: recurrenceData.z,
              x: recurrenceData.x,
              y: recurrenceData.y,
              colorscale: "Viridis",
              showscale: true,
              hoverinfo: "x+y+z",
            }]}
            layout={{
              height: 400,
              xaxis: { title: recurrencePair[0] },
              yaxis: { title: recurrencePair[1], scaleanchor: "x" },
              margin: { t: 40, l: 50, r: 20, b: 50 },
            }}
            config={{ displayModeBar: false }}
            style={{ width: "100%" }}
          />
        )
      ) : (
        <div style={{ color: "#8d97b6" }}>
          Recurrence plot waiting for selected channels and data...
        </div>
      )}
    </div>
  );
}