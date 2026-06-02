from fastapi import FastAPI, UploadFile, File
import pytesseract
import cv2
import numpy as np
import os
import uvicorn

app = FastAPI()
TEMP_FOLDER = "temp"
os.makedirs(TEMP_FOLDER, exist_ok=True)

# Set tesseract path jika diperlukan (di container biasanya sudah terdeteksi otomatis)
# pytesseract.pytesseract.tesseract_cmd = r'/usr/bin/tesseract'

def preprocess_for_ocr(img):
    # grayscale dan resize jika terlalu besar (lebar 800px)
    h, w = img.shape[:2]
    if w > 800:
        scale = 800 / w
        new_w = 800
        new_h = int(h * scale)
        img = cv2.resize(img, (new_w, new_h))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # thresholding ringan untuk mempertajam teks
    _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return thresh

@app.get("/")
def root():
    return {"status": "ok"}

@app.post("/ocr")
async def scan_ocr(file: UploadFile = File(...)):
    try:
        # baca file
        contents = await file.read()
        np_arr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            return {"text": "", "error": "cannot read image"}

        # preprocess
        processed = preprocess_for_ocr(img)

        # OCR dengan konfigurasi --psm 6 (blok teks seragam)
        custom_config = r'--oem 3 --psm 6'
        text = pytesseract.image_to_string(processed, config=custom_config)

        return {"text": text.strip(), "ocr_data": []}  # tidak perlu ocr_data detail
    except Exception as e:
        return {"text": "", "error": str(e)}