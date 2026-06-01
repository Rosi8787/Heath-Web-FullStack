FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    swig \               # <-- TAMBAHKAN INI
    pkg-config \
    libjpeg-dev \
    zlib1g-dev \
    libfreetype6-dev \
    libharfbuzz-dev \
    libgomp1 \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Matikan fitur Tesseract agar kompilasi PyMuPDF tidak membutuhkan library tambahan
ENV PYMUPDF_NO_TESSERACT=1

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]