import torch
import librosa
from transformers import AutoFeatureExtractor, AutoModelForAudioClassification

MODEL_NAME = "alefiury/wav2vec2-large-xlsr-53-gender-recognition-librispeech"

# Initialize as None - will load only when needed
extractor = None
model = None
model_loaded = False

def load_model():
    """Load the model only when needed"""
    global extractor, model, model_loaded
    
    if model_loaded:
        return True  # Already loaded
    
    try:
        print(">>> Loading voice gender model...")
        extractor = AutoFeatureExtractor.from_pretrained(MODEL_NAME)
        model = AutoModelForAudioClassification.from_pretrained(MODEL_NAME)
        model_loaded = True
        print(">>> Model loaded successfully!")
        return True
    except Exception as e:
        print(f">>> Error loading model: {e}")
        model_loaded = False
        return False

def predict_gender_from_file(file_path: str):
    """تستقبل ملف صوت → تعيد Male أو Female أو Unknown"""
    global model_loaded
    
    # Load model only when prediction is needed
    if not model_loaded:
        if not load_model():
            return "Model failed to load"
    
    try:
        waveform, sr = librosa.load(file_path, sr=16000, mono=True)
        inputs = extractor(waveform, sampling_rate=16000, return_tensors="pt")
        with torch.no_grad():
            logits = model(**inputs).logits

        # نحسب softmax لتحويل logits إلى احتمالات
        probs = torch.softmax(logits, dim=-1)[0].tolist()
        # نعرف mapping من id إلى label من الموديل
        id2label = model.config.id2label  # غالبًا {0: "female", 1: "male"} أو العكس

        # نختار الفئة الأعلى احتمال
        pred_id = torch.argmax(logits, dim=-1).item()
        label = id2label[pred_id].lower()

        if "female" in label:
            return "Female"
        elif "male" in label:
            return "Male"
        else:
            return "Unknown"

    except Exception as e:
        return f"Error: {e}"