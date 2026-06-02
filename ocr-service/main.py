from fastapi import FastAPI, UploadFile, File
import pytesseract
import cv2
import numpy as np
import os
import uvicorn
import re
from typing import List, Dict, Any

app = FastAPI()

# ------------------------------
# Tesseract path (Railway: /usr/bin/tesseract)
# ------------------------------
if os.name == 'nt':
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
else:
    pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'

# ------------------------------
# Advanced preprocessing
# ------------------------------
def preprocess_image(img: np.ndarray) -> np.ndarray:
    """Super‑charged preprocessing for small nutrition text."""
    # Resize if too small (increase resolution)
    h, w = img.shape[:2]
    if w < 800:
        scale = 1200 / w
        img = cv2.resize(img, (1200, int(h * scale)))

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Apply CLAHE (contrast)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # Sharpening kernel
    kernel_sharpen = np.array([[-1, -1, -1],
                               [-1,  9, -1],
                               [-1, -1, -1]])
    sharp = cv2.filter2D(enhanced, -1, kernel_sharpen)

    # Bilateral filter (preserve edges, reduce noise)
    denoised = cv2.bilateralFilter(sharp, 9, 75, 75)

    # Adaptive threshold
    binary = cv2.adaptiveThreshold(denoised, 255,
                                   cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY, 15, 3)

    # Morphological close to join broken characters
    kernel = np.ones((2, 2), np.uint8)
    cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    return cleaned

def run_tesseract_multi(img: np.ndarray) -> Dict[str, Any]:
    """Run Tesseract with multiple PSM modes and merge results."""
    configs = [
        '--oem 3 --psm 6',      # uniform block
        '--oem 3 --psm 11',     # sparse text
        '--oem 3 --psm 4'       # single column
    ]
    all_words = []
    best_full_text = ""

    for cfg in configs:
        data = pytesseract.image_to_data(img, config=cfg, output_type=pytesseract.Output.DICT)
        words = []
        for i in range(len(data['text'])):
            txt = data['text'][i].strip()
            if not txt:
                continue
            conf = data['conf'][i]
            confidence = float(conf) if conf != '-1' else 0.0
            words.append({
                "text": txt,
                "score": confidence,
                "bbox": {"x": data['left'][i], "y": data['top'][i],
                         "w": data['width'][i], "h": data['height'][i]}
            })
        all_words.extend(words)
        full = pytesseract.image_to_string(img, config=cfg).strip()
        if len(full) > len(best_full_text):
            best_full_text = full

    # Remove duplicate words based on bbox proximity (simple heuristic)
    unique_words = []
    for w in all_words:
        if not any(abs(w['bbox']['x'] - u['bbox']['x']) < 10 and
                   abs(w['bbox']['y'] - u['bbox']['y']) < 10 for u in unique_words):
            unique_words.append(w)
    return {"text": best_full_text, "words": unique_words}

@app.get("/")
def root():
    return {"status": "ok"}

@app.post("/ocr")
async def scan_ocr(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        np_arr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            return {"text": "", "error": "Cannot read image"}

        processed = preprocess_image(img)
        result = run_tesseract_multi(processed)

        return result

    except Exception as e:
        return {"text": "", "error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)