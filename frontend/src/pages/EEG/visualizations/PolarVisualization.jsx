import Plot from "react-plotly.js";

export default function PolarVisualization({ polarData, polarMode, isLoading }) {
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
        Polar plot ({polarData?.mode === "lines" ? "latest" : "cumulative"})
      </div>
      {polarData ? (
        <Plot
          data={[
            {
              type: "scatterpolar",
              r: polarData.r,
              theta: polarData.theta.map((t) => (t * 180 / Math.PI)),
              mode: polarData.mode,
              marker: { size: 3, opacity: 0.8 },
              line: { shape: "spline" },
            },
          ]}
          layout={{ 
            polar: { radialaxis: { visible: true } }, 
            height: 400, 
            margin: { t: 10, b: 20 } 
          }}
          config={{ displaylogo: false, responsive: true }}
          style={{ width: "100%" }}
        />
      ) : (
        <div style={{ color: "#8d97b6" }}>Polar plot waiting for data...</div>
      )}
    </div>
  );
}