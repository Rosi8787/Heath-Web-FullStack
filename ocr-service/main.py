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
ocr = PaddleOCR(lang="en")
print("OCR READY")


def preprocess_image(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)

    sharpen_kernel = np.array([
        [0, -1, 0],
        [-1, 5, -1],
        [0, -1, 0]
    ])
    gray = cv2.filter2D(gray, -1, sharpen_kernel)
    gray = cv2.medianBlur(gray, 3)
    gray = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 10
    )
    return gray


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

    # Baca gambar dengan OpenCV
    img = cv2.imread(temp_path)
    if img is None:
        os.remove(temp_path)
        return {"text": "", "ocr_data": [], "error": "cannot read image"}

    # Preprocessing
    processed = preprocess_image(img)
    processed_path = f"{TEMP_FOLDER}/processed_{file.filename}"
    cv2.imwrite(processed_path, processed)

    # OCR
    try:
        result = ocr.ocr(processed_path)
    except Exception as e:
        # Bersihkan file temporary
        for p in [temp_path, processed_path]:
            if os.path.exists(p):
                os.remove(p)
        return {"error": str(e)}

    # Parse hasil OCR
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
        return {"error": f"parse error: {e}"}

    # Bersihkan file temporary
    for p in [temp_path, processed_path]:
        if os.path.exists(p):
            os.remove(p)

    return {
        "text": extracted_text,
        "ocr_data": ocr_data
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=False)