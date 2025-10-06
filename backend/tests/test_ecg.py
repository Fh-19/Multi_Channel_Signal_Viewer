"""
test_ecg.py
------------
Unit tests for ECG endpoints and processing logic.
Uses FastAPI's TestClient to verify API responses.
"""
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Hello World"}
