# backend/routers/voice_gender.py
from fastapi import APIRouter, UploadFile, File
from backend.pretrained_models.voice_gender_model import predict_gender_from_file
import os
import shutil

router = APIRouter()
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@router.post("/predict")
async def predict_voice_gender(file: UploadFile = File(...)):
    """Receives a .wav file and predicts gender"""
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    
    # Save uploaded file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Run model prediction
    gender = predict_gender_from_file(file_path)
    
    return {
        "filename": file.filename,
        "gender": gender
    }
