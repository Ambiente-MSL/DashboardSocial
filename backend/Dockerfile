FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

# Porta interna do backend
EXPOSE 3001

# Use 1 worker para evitar múltiplos schedulers (o worker do scheduler será separado)
CMD ["gunicorn", "-b", "0.0.0.0:3001", "-w", "1", "-k", "gthread", "--threads", "8", "--timeout", "120", "server:app"]
