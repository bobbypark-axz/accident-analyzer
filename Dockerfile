FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements-server.txt .
RUN pip install --no-cache-dir -r requirements-server.txt gunicorn

COPY app.py .

# Download YOLOv8n model at build time
# Download YOLOv8n (nano - fastest) at build time
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

ENV PORT=5000

EXPOSE ${PORT}

CMD gunicorn app:app --bind 0.0.0.0:$PORT --timeout 300 --workers 1 --threads 2
