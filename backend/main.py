# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)


app = FastAPI(title="Signal Viewer Backend")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or origins list if you want to restrict
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include existing routers
from backend.routers import ecg, eeg, api, raddar, doppler, sar_classifier, voice_gender

app.include_router(ecg.router, prefix="/api/ecg")
app.include_router(eeg.router, prefix="/api/eeg")
app.include_router(api.router, prefix="/api")
app.include_router(raddar.router, prefix="/api/radar")
app.include_router(doppler.router, prefix="/api/doppler") 
app.include_router(sar_classifier.router, prefix="/api/sar")
app.include_router(voice_gender.router, prefix="/api/voice_gender") 
@app.get("/")
def root():
    return {"message": "Signal Viewer Backend - Ready"}
