#!/usr/bin/env bash
# ==============================================================================
# CyberEdu Platform — Production Deploy & First-Run Skripti
# Ishlatish: ./scripts/deploy-first-run.sh
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo "   CYBEREDU PRODUCTION ISHGA TUSHIRISH (DEPLOY & INIT)"
echo "=========================================================="

# 1. Muhit faylini tekshirish
if [ ! -f .env ]; then
  echo "❌ XATO: .env fayli topilmadi!"
  echo "Iltimos, '.env.production.example' dan nusxa olib, '.env' faylini to'ldiring."
  exit 1
fi

echo "[1/4] Prisma migratsiyalarini ma'lumotlar bazasiga qo'llash (prisma migrate deploy)..."
npx prisma migrate deploy

echo "[2/4] Prisma Client kutubxonasini generatsiya qilish..."
npx prisma generate

echo "[3/4] Birinchi administrator hisobini va o'quv dasturini tekshirish/yaratish..."
npx tsc -p tsconfig.test.json
node .test-dist/scripts/init-admin.js
rm -rf .test-dist

echo "[4/4] Tizim tayyorligini tasdiqlash..."
echo "✅ Barcha migratsiyalar qo'llandi va baza to'liq tayyor holatda!"
echo "Endi 'docker compose up -d' yoki 'npm run start' orqali platformani ishga tushirishingiz mumkin."
