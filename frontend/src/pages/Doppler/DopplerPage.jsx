import React, { useState } from "react";
import DopplerControls from "./DopplerControls";
import DopplerVisualization from "./DopplerVisualization";
import DopplerUpload from "./DopplerUpload";

export default function DopplerPage() {
  const [frequency, setFrequency] = useState(300);
  const [speed, setSpeed] = useState(90);
  const [realisticMode, setRealisticMode] = useState(true);
  const [samplingRate, setSamplingRate] = useState(22050); 
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);
  const [waveform, setWaveform] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null); 
  const [playingUploaded, setPlayingUploaded] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100%",
        background: "#f0f4f8",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      {/* Left: Control Panel */}
      <div
        style={{
          flex: 1,
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <h1
          style={{
            margin: "0 0 18px 0",
            fontWeight: 700,
            fontSize: 26,
            color: "#263357",
          }}
        >
          Doppler Shift Simulator
        </h1>

        <DopplerControls
          realisticMode={realisticMode}
          setRealisticMode={setRealisticMode}
          frequency={frequency}
          setFrequency={setFrequency}
          speed={speed}
          setSpeed={setSpeed}
          samplingRate={samplingRate} 
          setSamplingRate={setSamplingRate} 
          playing={playing}
          setPlaying={setPlaying}
          setError={setError}
        />

        <DopplerUpload
          setLoading={setLoading}
          setUploadStatus={setUploadStatus}
          setPrediction={setPrediction}
          setError={setError}
          setWaveform={setWaveform}
          setAudioUrl={setAudioUrl}
          setPlayingUploaded={setPlayingUploaded}
          loading={loading}
          uploadStatus={uploadStatus}
          error={error}
          audioUrl={audioUrl}
          playingUploaded={playingUploaded}
          samplingRate={samplingRate} 
        />
      </div>

      {/* Right: Waveform and Predictions */}
      <DopplerVisualization 
        waveform={waveform} 
        prediction={prediction}
        audioUrl={audioUrl}
        playingUploaded={playingUploaded}
        setPlayingUploaded={setPlayingUploaded}
        samplingRate={samplingRate} 
        uploadStatus={uploadStatus} 
      />
    </div>
  );
}