# Joe System (Nexus) — Backend image
# Build:  docker build -t nexus-backend ./backend
# Run:    docker run --env-file .env -p 8000:8000 nexus-backend

FROM python:3.12-slim

WORKDIR /app

# curl is only here for the HEALTHCHECK below; keep the image lean otherwise.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first (separate layer) so `docker build` reuses the
# cached layer on every rebuild that only touches application code.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as a non-root user — defense in depth, not strictly required but cheap.
RUN useradd --create-home --shell /bin/bash appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Lets `docker ps` / docker-compose / your orchestrator know if the API is
# actually serving traffic, not just that the process is alive.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# --proxy-headers: trust X-Forwarded-* from the nginx/reverse-proxy in front
# of this container (see frontend/nginx.conf) so request.url etc. are correct.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
