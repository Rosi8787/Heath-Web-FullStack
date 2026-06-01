from fastapi import FastAPI, UploadFile, File
from paddleocr import PaddleOCR
import cv2
import numpy as np
import os
import uvicorn

app = FastAPI()

TEMP_FOLDER = "temp"
os.makedirs(TEMP_FOLDER, exist_ok=True)

print("INIT OCR...")
ocr = PaddleOCR(lang='en')
print("OCR READY")


def preprocess_light(img):
    """Resize turun jika terlalu lebar, grayscale, blur & sharpen ringan."""
    h, w = img.shape[:2]
    MAX_WIDTH = 1200
    if w > MAX_WIDTH:
        scale = MAX_WIDTH / w
        new_w = MAX_WIDTH
        new_h = int(h * scale)
        img = cv2.resize(img, (new_w, new_h))

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.medianBlur(gray, 3)
    sharpen_kernel = np.array([
        [0, -1, 0],
        [-1, 5, -1],
        [0, -1, 0]
    ])
    gray = cv2.filter2D(gray, -1, sharpen_kernel)
    return gray


def run_ocr(image_path: str):
    """Jalankan PaddleOCR dengan try-except agar aman."""
    try:
        result = ocr.ocr(image_path)
        return result, None
    except Exception as e:
        return None, str(e)


@app.get("/")
def root():
    return {"status": "ok"}


@app.post("/ocr")
async def scan_ocr(file: UploadFile = File(...)):
    print("OCR REQUEST RECEIVED")

    # Simpan file sementara
    temp_path = f"{TEMP_FOLDER}/{file.filename}"
    with open(temp_path, "wb") as buffer:
        buffer.write(await file.read())

    img = cv2.imread(temp_path)
    if img is None:
        os.remove(temp_path)
        return {"text": "", "ocr_data": [], "error": "cannot read image"}

    processed_path = None
    try:
        # 1. OCR gambar asli
        result, error = run_ocr(temp_path)
        if error:
            return {"text": "", "ocr_data": [], "error": f"OCR error: {error}"}

        if result is None or not result[0]:
            # 2. Preprocessing ringan dan coba lagi
            print("OCR on original image failed, trying light preprocessing...")
            processed = preprocess_light(img)
            processed_path = f"{TEMP_FOLDER}/processed_{file.filename}"
            cv2.imwrite(processed_path, processed)

            result, error = run_ocr(processed_path)
            if error:
                return {"text": "", "ocr_data": [], "error": f"OCR error after preprocessing: {error}"}

        # Parse hasil
        extracted_text = ""
        ocr_data = []
        if result and result[0]:
            for line in result[0]:
                if line is None:
                    continue
                text = line[1][0]
                score = float(line[1][1])
                extracted_text += text + "\n"
                ocr_data.append({"text": text, "score": score})

        return {
            "text": extracted_text.strip(),
            "ocr_data": ocr_data
        }

    except Exception as e:
        return {"text": "", "ocr_data": [], "error": f"Unexpected error: {e}"}

    finally:
        # Bersihkan file temporary
        for p in [temp_path, processed_path]:
            if p and os.path.exists(p):
                os.remove(p)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=False)