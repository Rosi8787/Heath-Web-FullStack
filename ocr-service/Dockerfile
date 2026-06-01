FROM python:3.10-slim       # <-- ganti ini saja

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    swig \
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

ENV PYMUPDF_NO_TESSERACT=1
ENV CFLAGS="-Wno-error=incompatible-pointer-types"

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]