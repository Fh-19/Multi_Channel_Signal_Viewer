import Plot from "react-plotly.js";

export default function PolarVisualization({ polarTraces, polarMode, isLoading }) {
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
        Loading Polar Visualization...
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        Polar plot ({polarMode === "cumulative" ? "Cumulative" : "Latest"})
      </div>
      {polarTraces.length > 0 ? (
        <Plot
          data={polarTraces}
          layout={{
            width: "100%",
            height: 400,
            margin: { l: 50, r: 20, t: 40, b: 40 },
            polar: {
              radialaxis: { visible: true, range: [0, 1] },
              angularaxis: {
                direction: "counterclockwise",
                rotation: 90,
              },
            },
            showlegend: true,
            title: `Polar Cardiogram - ${polarMode === "cumulative" ? "Cumulative View" : "Latest Cycle"}`,
          }}
          config={{ displayModeBar: false }}
        />
      ) : (
        <div style={{ color: "#8d97b6" }}>
          Polar plot waiting for data...
        </div>
      )}
    </div>
  );
}