import React from "react";

const SentinelMap = () => {
  return (
    <div style={{ width: "100%", height: "100vh", backgroundColor: "#000" }}>
      <iframe
        src="http://127.0.0.1:8000/api/radar/sentinel-map"
        title="Sentinel Map"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
        }}
      />
    </div>
  );
};

export default SentinelMap;
