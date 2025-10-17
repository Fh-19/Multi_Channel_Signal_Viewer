# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="Signal Viewer Backend")

origins = [
    "http://localhost:5173",  # Vite frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or origins list if you want to restrict
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include existing routers
<<<<<<< HEAD
from backend.routers import ecg, eeg, api, raddar, doppler, sar_classifier, voice_gender
=======
from backend.routers import ecg, eeg, api, raddar, doppler, sar_classifier
>>>>>>> 2e3da8c1693a8a92e50605ab57d160dc06bb9b1e

app.include_router(ecg.router, prefix="/api/ecg")
app.include_router(eeg.router, prefix="/api/eeg")
app.include_router(api.router, prefix="/api")
app.include_router(raddar.router, prefix="/api/radar")
app.include_router(doppler.router, prefix="/api/doppler") 
<<<<<<< HEAD
app.include_router(sar_classifier.router, prefix="/api/sar")
app.include_router(voice_gender.router, prefix="/api/voice_gender") 
=======
app.include_router(sar_classifier.router, prefix="/api/sar") 
>>>>>>> 2e3da8c1693a8a92e50605ab57d160dc06bb9b1e
@app.get("/")
def root():
    return {"message": "Signal Viewer Backend - Ready"}
