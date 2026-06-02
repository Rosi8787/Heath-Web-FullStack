from fastapi import FastAPI, UploadFile, File
import pytesseract
import cv2
import numpy as np
import os
import uvicorn
import re
from typing import List, Dict, Any, Optional

app = FastAPI()

# Tesseract path untuk Railway
if os.name == 'nt':
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
else:
    pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'

# ------------------------------------------------------------------
# Preprocessing super agresif untuk teks kecil
# ------------------------------------------------------------------
def preprocess_heavy(img: np.ndarray) -> np.ndarray:
    """Upscale, contrast enhance, denoise, sharpen."""
    h, w = img.shape[:2]
    if w < 1000:
        img = cv2.resize(img, (1200, int(1200 * h / w)))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8,8))
    enhanced = clahe.apply(gray)
    # Bilateral filter
    denoised = cv2.bilateralFilter(enhanced, 9, 75, 75)
    # Sharpening
    kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
    sharp = cv2.filter2D(denoised, -1, kernel)
    # Adaptive threshold
    binary = cv2.adaptiveThreshold(sharp, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY, 15, 3)
    return binary

# ------------------------------------------------------------------
# Fuzzy match untuk label gula (toleransi OCR error)
# ------------------------------------------------------------------
def is_sugar_label(text: str) -> bool:
    text = text.lower()
    patterns = [r'gula', r'sugar', r'sugars?', r'sukrosa', r'fructose',
                r'sug[^a-z]', r'gul[^a-z]', r'^sug$', r'^gul$']
    return any(re.search(p, text) for p in patterns)

# ------------------------------------------------------------------
# Crop area di sekitar kata kunci dan OCR ulang
# ------------------------------------------------------------------
def ocr_sugar_from_region(img: np.ndarray, bbox: Dict[str, int], padding: int = 40) -> Optional[float]:
    x, y, w, h = bbox['x'], bbox['y'], bbox['w'], bbox['h']
    # Perbesar area
    x1 = max(0, x - padding)
    y1 = max(0, y - padding)
    x2 = min(img.shape[1], x + w + padding)
    y2 = min(img.shape[0], y + h + padding)
    crop = img[y1:y2, x1:x2]
    if crop.size == 0:
        return None
    # Preprocess crop
    crop_proc = preprocess_heavy(crop)
    # OCR dengan whitelist angka dan g
    custom_config = r'--oem 3 --psm 8 -c tessedit_char_whitelist=0123456789.,gG'
    text = pytesseract.image_to_string(crop_proc, config=custom_config).strip()
    # Ekstrak angka
    match = re.search(r'(\d+(?:[.,]\d+)?)\s*[gG]?', text)
    if match:
        val = float(match.group(1).replace(',', '.'))
        if 0 <= val <= 100:
            return val
    return None

# ------------------------------------------------------------------
# Endpoint OCR utama
# ------------------------------------------------------------------
@app.post("/ocr")
async def scan_ocr(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        np_arr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            return {"text": "", "error": "cannot read image"}

        processed = preprocess_heavy(img)

        # Pass 1: Dapatkan semua kata dengan bounding box
        data = pytesseract.image_to_data(processed, output_type=pytesseract.Output.DICT)
        words = []
        sugar_candidates = []

        for i in range(len(data['text'])):
            txt = data['text'][i].strip()
            if not txt:
                continue
            conf = data['conf'][i]
            bbox = {
                'x': data['left'][i],
                'y': data['top'][i],
                'w': data['width'][i],
                'h': data['height'][i]
            }
            words.append({'text': txt, 'score': conf, 'bbox': bbox})

            if is_sugar_label(txt):
                sugar_candidates.append(bbox)

        # Pass 2: OCR ulang pada area setiap kandidat
        sugar_value = None
        for bbox in sugar_candidates:
            val = ocr_sugar_from_region(processed, bbox, padding=60)
            if val is not None:
                sugar_value = val
                break

        # Jika tidak ditemukan, coba cari di seluruh teks dengan regex
        full_text = pytesseract.image_to_string(processed, config='--oem 3 --psm 6')
        if sugar_value is None:
            match = re.search(r'(?:gula|sugar)[^\d]*(\d+(?:[.,]\d+)?)\s*g', full_text, re.IGNORECASE)
            if match:
                sugar_value = float(match.group(1).replace(',', '.'))

        return {
            "text": full_text.strip(),
            "words": words,
            "sugar_grams": sugar_value
        }

    except Exception as e:
        return {"text": "", "error": str(e), "sugar_grams": None}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)