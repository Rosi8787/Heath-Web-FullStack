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
# Tesseract path for Railway (adjust if needed)
# ------------------------------
if os.name == 'nt':  # Windows
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
else:  # Linux / Railway
    pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'

# ------------------------------
# Enhanced preprocessing
# ------------------------------
def preprocess_for_ocr(img: np.ndarray) -> np.ndarray:
    """Apply CLAHE, denoising, adaptive thresholding, and optional deskew."""
    # Resize if too wide (preserve aspect)
    h, w = img.shape[:2]
    if w > 1200:
        scale = 1200 / w
        new_w = 1200
        new_h = int(h * scale)
        img = cv2.resize(img, (new_w, new_h))

    # Convert to LAB and apply CLAHE on L-channel
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    enhanced = cv2.merge([l, a, b])
    enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

    # Convert to grayscale
    gray = cv2.cvtColor(enhanced, cv2.COLOR_BGR2GRAY)

    # Denoise (bilateral filter preserves edges)
    denoised = cv2.bilateralFilter(gray, 9, 75, 75)

    # Adaptive threshold for variable lighting
    binary = cv2.adaptiveThreshold(
        denoised, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )

    # Optional: remove small noise
    kernel = np.ones((1, 1), np.uint8)
    cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    return cleaned

def deskew(image: np.ndarray) -> np.ndarray:
    """Rotate image to correct slight skew (optional)."""
    coords = np.column_stack(np.where(image > 0))
    if len(coords) < 100:
        return image
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = 90 + angle
    if abs(angle) < 0.5:
        return image
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(image, M, (w, h),
                             flags=cv2.INTER_CUBIC,
                             borderMode=cv2.BORDER_REPLICATE)
    return rotated

# ------------------------------
# OCR endpoint
# ------------------------------
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
            return {"text": "", "error": "cannot read image"}

        processed = preprocess_for_ocr(img)
        # Optional deskew (uncomment if needed)
        # processed = deskew(processed)

        # Use Tesseract with better config
        custom_config = r'--oem 3 --psm 6 -c preserve_interword_spaces=1'

        # Get detailed data including bounding boxes
        data = pytesseract.image_to_data(
            processed,
            config=custom_config,
            output_type=pytesseract.Output.DICT
        )

        words: List[Dict[str, Any]] = []
        full_text_lines = []

        n_boxes = len(data['text'])
        for i in range(n_boxes):
            txt = data['text'][i].strip()
            if not txt:
                continue
            conf = data['conf'][i]
            try:
                confidence = float(conf) if conf != '-1' else 0.0
            except:
                confidence = 0.0

            # Bounding box
            x = data['left'][i]
            y = data['top'][i]
            w = data['width'][i]
            h = data['height'][i]

            words.append({
                "text": txt,
                "score": confidence,
                "bbox": {"x": x, "y": y, "w": w, "h": h}
            })

            # Reconstruct full text line by line (using block/line numbers)
            # Simpler: use image_to_string for full text fallback
        full_text = pytesseract.image_to_string(processed, config=custom_config)

        return {
            "text": full_text.strip(),
            "words": words
        }

    except Exception as e:
        return {"text": "", "error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)