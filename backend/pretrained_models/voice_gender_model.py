import torch
import librosa
from transformers import AutoFeatureExtractor, AutoModelForAudioClassification

MODEL_NAME = "alefiury/wav2vec2-large-xlsr-53-gender-recognition-librispeech"
extractor = AutoFeatureExtractor.from_pretrained(MODEL_NAME)
model = AutoModelForAudioClassification.from_pretrained(MODEL_NAME)

def predict_gender_from_file(file_path: str):
    """تستقبل ملف صوت → تعيد Male أو Female أو Unknown"""
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
