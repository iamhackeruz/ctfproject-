# ==============================================================================
# CyberEdu Sandbox Daemon Sidecar Dockerfile
# Xavfsizlik: Minimal alpine asosida, faqat docker-cli va nodejs
# ==============================================================================

FROM node:20-alpine

RUN apk add --no-cache docker-cli curl

WORKDIR /daemon

# Server dist faylini ko'chirish
COPY dist/ ./dist/

ENV NODE_ENV=production
ENV DAEMON_PORT=5055

EXPOSE 5055

HEALTHCHECK --interval=20s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:5055/health || exit 1

CMD ["node", "dist/server.js"]
