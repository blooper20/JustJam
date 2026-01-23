FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    pkg-config \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Add missing dependencies
RUN pip install --no-cache-dir \
    redis \
    fastapi-cache2[redis] \
    prometheus-fastapi-instrumentator \
    slowapi \
    python-multipart

# Copy the rest of the code
COPY . .

# Set environment variables
ENV PYTHONPATH=/app
ENV APP_ENV=production
ENV UPLOAD_DIR=/app/temp/uploads
ENV SEPARATED_DIR=/app/temp/separated

# Create directories
RUN mkdir -p temp/uploads temp/separated

# Expose port
EXPOSE 8000

# Start command
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
