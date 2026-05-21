from fastapi import FastAPI, UploadFile, File
from paddleocr import PaddleOCR
import shutil
import os

app = FastAPI()

# INIT OCR
ocr = PaddleOCR(
    use_angle_cls=True,
    lang='en'
)

TEMP_FOLDER = "temp"

os.makedirs(TEMP_FOLDER, exist_ok=True)

@app.post("/ocr")
async def scan_ocr(file: UploadFile = File(...)):

    temp_path = f"{TEMP_FOLDER}/{file.filename}"

    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # OCR PROCESS
    result = ocr.predict(temp_path)

    extracted_text = ""

    try:
        for line in result[0]["rec_texts"]:
            extracted_text += line + "\n"
    except:
        extracted_text = "OCR FAILED"

    # DELETE TEMP FILE
    os.remove(temp_path)

    return {
        "text": extracted_text
    }