from fastapi import FastAPI, UploadFile, File
import pytesseract
import cv2
import numpy as np
import os
import uvicorn

app = FastAPI()

TEMP_FOLDER = "temp"
os.makedirs(TEMP_FOLDER, exist_ok=True)

# Jika perlu:
# pytesseract.pytesseract.tesseract_cmd = r"/usr/bin/tesseract"


def preprocess_for_ocr(img):

    h, w = img.shape[:2]

    if w > 800:
        scale = 800 / w
        new_w = 800
        new_h = int(h * scale)

        img = cv2.resize(
            img,
            (new_w, new_h)
        )

    gray = cv2.cvtColor(
        img,
        cv2.COLOR_BGR2GRAY
    )

    _, thresh = cv2.threshold(
        gray,
        150,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )

    return thresh


@app.get("/")
def root():
    return {
        "status": "ok"
    }


@app.post("/ocr")
async def scan_ocr(
    file: UploadFile = File(...)
):
    try:

        contents = await file.read()

        np_arr = np.frombuffer(
            contents,
            np.uint8
        )

        img = cv2.imdecode(
            np_arr,
            cv2.IMREAD_COLOR
        )

        if img is None:
            return {
                "text": "",
                "error": "cannot read image"
            }

        processed = preprocess_for_ocr(img)

        custom_config = r'--oem 3 --psm 6'

        # OCR text lengkap
        text = pytesseract.image_to_string(
            processed,
            config=custom_config
        )

        # OCR detail per kata
        data = pytesseract.image_to_data(
            processed,
            config=custom_config,
            output_type=pytesseract.Output.DICT
        )

        ocr_data = []

        for i in range(
            len(data["text"])
        ):

            txt = data["text"][i].strip()

            if not txt:
                continue

            try:
                score = float(
                    data["conf"][i]
                )
            except:
                score = 0

            ocr_data.append({
                "text": txt,
                "score": score
            })

        return {
            "text": text.strip(),
            "ocr_data": ocr_data
        }

    except Exception as e:

        return {
            "text": "",
            "error": str(e)
        }


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000
    )