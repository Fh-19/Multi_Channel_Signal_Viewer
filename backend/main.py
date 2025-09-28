# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = [
    "http://localhost:5173",  # Vite frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# include routers
from .routers import ecg, eeg  # assuming both routers exist
app.include_router(ecg.router, prefix="/api/ecg")
app.include_router(eeg.router, prefix="/api/eeg")

@app.get("/")
def root():
    return {"message": "Signal Viewer Backend - Ready"}
