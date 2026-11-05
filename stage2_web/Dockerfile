FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 iputils-ping \
    && rm -rf /var/lib/apt/lists/*

COPY stage2_web/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1
ENV APEX_PORT=5000

EXPOSE 5000

CMD ["python3", "stage2_web/app/server.py"]
