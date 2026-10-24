# ml-service/Dockerfile

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# 1. CPU-only PyTorch. The default build bundles CUDA and is several GB larger.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# 2. The remaining Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. Download the language model NOW, at build time, so the running container never needs internet.
#    HF_HOME is a shared folder (not /root) so the non-root user below can read it.
ENV HF_HOME=/opt/hf-cache
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"
ENV HF_HUB_OFFLINE=1

# 4. Application code and the seed data (replace the CSV with a real export later)
COPY . .

# 5. Where the search indexes are saved (mounted as the ml_data volume), and where the seed CSV lives
ENV ML_DATA_DIR=/app/data \
    ML_CSV_PATH=/app/seed/healthcare_incidents_synthetic.csv

# 6. Run as a non-root user
RUN useradd --create-home appuser \
    && mkdir -p /app/data \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8001

# The first start builds the search indexes (a few minutes), so allow a long start period
HEALTHCHECK --interval=30s --timeout=5s --start-period=600s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=4)" || exit 1

CMD ["uvicorn", "similar_incident_api:app", "--host", "0.0.0.0", "--port", "8001"]
