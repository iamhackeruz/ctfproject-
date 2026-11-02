FROM alpine:3.23

RUN apk add --no-cache python3

WORKDIR /app
COPY app.py /app/app.py

# Non-root foydalanuvchi yaratish (UID 10002)
RUN addgroup -g 10002 weblab && \
    adduser -u 10002 -G weblab -s /bin/sh -D weblab && \
    chmod 755 /app/app.py

USER 10002:10002

EXPOSE 8080

ENTRYPOINT ["python3", "/app/app.py"]
