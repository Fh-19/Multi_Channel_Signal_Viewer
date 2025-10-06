export async function generateDoppler(frequency, speed) {
  const response = await fetch("http://127.0.0.1:8000/api/doppler/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frequency, speed }),
  });

  if (!response.ok) throw new Error("Failed to generate Doppler file");

  // Return as blob to allow download
  const blob = await response.blob();
  return blob;
}

export async function analyzeDopplerFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("http://127.0.0.1:8000/api/doppler/analyze", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Failed to analyze Doppler file");

  return response.json();
}
