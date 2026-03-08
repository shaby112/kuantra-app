#!/bin/bash
set -e

echo "Starting InsightOps..."

cd /app/backend
python -m uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 2 \
  --log-level info &

nginx -g 'daemon off;'
