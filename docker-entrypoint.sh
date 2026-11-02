#!/bin/sh
set -e

echo "=== [CyberEdu] Konteyner ishga tushirilmoqda ==="

echo "[1/4] Muhit o'zgaruvchilari va sirlarini tekshirish..."
if [ -f "/app/.test-dist/scripts/verify-production-env.js" ]; then
  node /app/.test-dist/scripts/verify-production-env.js
elif [ -f "/app/scripts/verify-production-env.js" ]; then
  node /app/scripts/verify-production-env.js
elif [ -f "/app/scripts/verify-production-env.ts" ]; then
  npx tsx /app/scripts/verify-production-env.ts
fi

echo "[2/4] Prisma migratsiyalarini ma'lumotlar bazasiga qo'llash (prisma migrate deploy)..."
npx prisma migrate deploy

echo "[3/4] Administrator va asosiy kontentni tekshirish / yaratish..."
if [ -f "/app/.test-dist/scripts/init-admin.js" ]; then
  node /app/.test-dist/scripts/init-admin.js || echo "[OGOHLANTIRISH] init-admin yakunlandi yoki xatolik qaytdi."
elif [ -f "/app/scripts/init-admin.js" ]; then
  node /app/scripts/init-admin.js || echo "[OGOHLANTIRISH] init-admin yakunlandi yoki xatolik qaytdi."
fi

echo "[4/4] CyberEdu platformasini ishga tushirish..."
exec "$@"
