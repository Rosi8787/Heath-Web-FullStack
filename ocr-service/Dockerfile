FROM python:3.11-slim

# Install Tesseract OCR lengkap (termasuk bahasa Inggris)
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements terlebih dahulu untuk memanfaatkan cache Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy seluruh kode
COPY . .

# Ekspos port default (Railway akan override dengan $PORT)
EXPOSE 8080

# Jalankan uvicorn dengan port dari environment variable PORT (Railway)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]