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
    # Blur tipis untuk kurangi noise
    gray = cv2.medianBlur(gray, 3)
    # Sharpening ringan
    sharpen_kernel = np.array([
        [0, -1, 0],
        [-1, 5, -1],
        [0, -1, 0]
    ])
    gray = cv2.filter2D(gray, -1, sharpen_kernel)
    return gray


@app.get("/")
def root():
    return {"status": "ok"}


@app.post("/ocr")
async def scan_ocr(file: UploadFile = File(...)):
    print("OCR REQUEST RECEIVED")

    # Simpan file asli
    temp_path = f"{TEMP_FOLDER}/{file.filename}"
    with open(temp_path, "wb") as buffer:
        buffer.write(await file.read())

    img = cv2.imread(temp_path)
    if img is None:
        os.remove(temp_path)
        return {"text": "", "ocr_data": [], "error": "cannot read image"}

    # ====== 1. Coba OCR gambar asli ======
    result = ocr.ocr(temp_path)
    if result is None or not result[0]:
        # ====== 2. Jika gagal, coba preprocessing ringan ======
        print("OCR on original image failed, trying light preprocessing...")
        processed = preprocess_light(img)
        processed_path = f"{TEMP_FOLDER}/processed_{file.filename}"
        cv2.imwrite(processed_path, processed)
        result = ocr.ocr(processed_path)
        # Setelah selesai, processed_path akan dihapus nanti
    else:
        processed_path = None  # Tidak ada file processed

    # Parse hasil
    extracted_text = ""
    ocr_data = []
    try:
        if result and result[0]:
            for line in result[0]:
                if line is None:
                    continue
                text = line[1][0]
                score = float(line[1][1])
                extracted_text += text + "\n"
                ocr_data.append({"text": text, "score": score})
    except Exception as e:
        # Bersihkan file sebelum return error
        for p in [temp_path, processed_path]:
            if p and os.path.exists(p):
                os.remove(p)
        return {"error": f"parse error: {e}"}

    # Bersihkan file temporary
    for p in [temp_path, processed_path]:
        if p and os.path.exists(p):
            os.remove(p)

    return {
        "text": extracted_text.strip(),
        "ocr_data": ocr_data
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=False)