# ==============================================================================
# CyberEdu Platform — Production Multi-stage Dockerfile
# Xavfsizlik: Minimal alpine asosida, non-root user (nextjs:1001), no privileged
# ==============================================================================

# 1-bosqich: Bog'liqliklarni yuklab olish (Dependencies)
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# 2-bosqich: Loyihani yig'ish (Builder)
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Prisma client generatsiyasi va Next.js optimallashgan yig'ish
RUN npx prisma generate
RUN npm run build
RUN npx tsc -p tsconfig.test.json

# 3-bosqich: Ishga tushirish (Runner)
FROM node:20-alpine AS runner
RUN apk add --no-cache curl openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Xavfsizlik: root bo'lmagan foydalanuvchi
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Faqat ishlab chiqarish uchun kerakli fayllarni ko'chirish
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/.test-dist ./.test-dist
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /app/logs /app/data/videos /app/data/attachments && \
    chown -R nextjs:nodejs /app/logs /app/data && \
    chmod +x /app/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
