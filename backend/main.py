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
from backend.routers import ecg, eeg, api, raddar, doppler

app.include_router(ecg.router, prefix="/api/ecg")
app.include_router(eeg.router, prefix="/api/eeg")
app.include_router(api.router)
app.include_router(raddar.router, prefix="/api/radar")
app.include_router(doppler.router, prefix="/api/doppler")  # ✅ Doppler router

@app.get("/")
def root():
    return {"message": "Signal Viewer Backend - Ready"}
