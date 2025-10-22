import torch
import librosa
from transformers import AutoFeatureExtractor, AutoModelForAudioClassification
import numpy as np

# تحميل الموديل من هاجينج فيس
MODEL_NAME = "alefiury/wav2vec2-large-xlsr-53-gender-recognition-librispeech"
extractor = AutoFeatureExtractor.from_pretrained(MODEL_NAME)
model = AutoModelForAudioClassification.from_pretrained(MODEL_NAME)


def predict_gender_from_file(file_path: str):
    try:
        # تحميل الملف بصيغة mono وبمعدل 16kHz
        waveform, sr = librosa.load(file_path, sr=16000, mono=True)

        # تحويل البيانات لـ float32
        waveform = waveform.astype(np.float32)

        # تجهيز الإدخال للموديل
        inputs = extractor(
            [waveform],                # batch of 1
            sampling_rate=16000,
            return_tensors="pt",
            padding=True,
            truncation=True,           # ✅ تمت إضافة الفاصلة هنا
            max_length=int(16000 * 30) # حد أقصى 30 ثانية للصوت
        )

        # التنبؤ بالجنس
        with torch.no_grad():
            logits = model(**inputs).logits

        pred_id = torch.argmax(logits, dim=-1).item()
        label = model.config.id2label[pred_id].lower()

        # تحويل النتيجة إلى نص واضح
        if "female" in label:
            return "Female"
        elif "male" in label:
            return "Male"
        else:
            return "Unknown"

    except Exception as e:
        # في حالة حدوث أي خطأ
        return f"Error: {e}"
