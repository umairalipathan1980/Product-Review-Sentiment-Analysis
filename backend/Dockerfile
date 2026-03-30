FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend

# Remove any .env that may have been copied — credentials are injected at
# runtime via docker-compose env_file, not baked into the image.
RUN rm -f /app/backend/.env

# Create runtime directories used by the pipeline and output caches.
RUN mkdir -p /app/input

WORKDIR /app/backend
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]


