from fastapi import FastAPI, UploadFile, File
from paddleocr import PaddleOCR
import shutil
import os
import cv2
import numpy as np

app = FastAPI()

# =========================
# INIT OCR
# =========================

ocr = PaddleOCR(
    use_angle_cls=True,
    lang='en'
)

TEMP_FOLDER = "temp"

os.makedirs(TEMP_FOLDER, exist_ok=True)

# =========================
# IMAGE PREPROCESSING
# =========================

def preprocess_image(img: np.ndarray) -> np.ndarray:

    # Step 1: Grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Step 2: Upscale 2x
    gray = cv2.resize(
        gray,
        None,
        fx=2,
        fy=2,
        interpolation=cv2.INTER_CUBIC,
    )

    # Step 3: Sharpen
    sharpen_kernel = np.array([
        [0, -1, 0],
        [-1, 5, -1],
        [0, -1, 0],
    ])

    gray = cv2.filter2D(
        gray,
        -1,
        sharpen_kernel
    )

    # Step 4: Denoise ringan
    gray = cv2.medianBlur(gray, 3)

    # Step 5: Adaptive Threshold
    gray = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=31,
        C=10,
    )

    return gray

# =========================
# OCR ENDPOINT
# =========================

@app.get("/")
def health():
    return {"status": "ok"}

@app.post("/ocr")
async def scan_ocr(file: UploadFile = File(...)):
    
    print("OCR HIT")
    print(file.filename)
    
    print("========== OCR HIT ==========")
    print(file.filename)

    temp_path = f"{TEMP_FOLDER}/{file.filename}"

    # =========================
    # SAVE IMAGE
    # =========================

    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # =========================
    # LOAD IMAGE
    # =========================

    img = cv2.imread(temp_path)

    if img is None:

        if os.path.exists(temp_path):
            os.remove(temp_path)

        return {
            "text": "OCR FAILED: Cannot read image file",
            "ocr_data": [],
        }

    # =========================
    # PREPROCESS IMAGE
    # =========================

    processed = preprocess_image(img)

    processed_path = f"{TEMP_FOLDER}/processed_{file.filename}"

    cv2.imwrite(
        processed_path,
        processed
    )

    # =========================
    # OCR PROCESS
    # =========================

    try:

        result = ocr.ocr(
            processed_path,
            cls=True
        )

    except TypeError:

        # fallback untuk versi tertentu
        result = ocr.ocr(processed_path)

    print("=========== OCR RAW ===========")
    print(result)

    extracted_text = ""
    ocr_data = []

    # =========================
    # PARSE OCR RESULT
    # =========================

    try:

        if result and len(result) > 0:

            for line in result[0]:

                if line is None:
                    continue

                text = line[1][0]
                score = float(line[1][1])

                extracted_text += text + "\n"

                ocr_data.append({
                    "text": text,
                    "score": score
                })

    except Exception as e:

        print("OCR PARSE ERROR:")
        print(e)

    print("=========== OCR TEXT ===========")
    print(extracted_text)

    # =========================
    # CLEANUP
    # =========================

    if os.path.exists(temp_path):
        os.remove(temp_path)

    if os.path.exists(processed_path):
        os.remove(processed_path)
        
  
    # =========================
    # RETURN RESULT
    # =========================

    return {
        "text": extracted_text,
        "ocr_data": ocr_data,
    }
    
import os
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000))
    )