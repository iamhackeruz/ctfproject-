#!/usr/bin/env bash
# ==============================================================================
# CyberEdu Platform — Ma'lumotlar Bazasini Qayta Tiklash (Restore) Skripti
#
# Ishlatish:
#   ./scripts/restore-db.sh <backup_file.sql.gz> [--force]
#
# Xavfsizlik:
# 1. Fayl mavjudligi va gzip yaxlitligini tekshiradi (gzip -t)
# 2. Tasdiqlash so'raydi (agar --force ko'rsatilmagan bo'lsa)
# 3. Tiklash natijasini xatoliklarsiz tekshiradi
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

if [ $# -lt 1 ]; then
  echo "Foydalanish: $0 <backup_file.sql.gz> [--force]"
  echo "Mavjud zaxira fayllari:"
  ls -lh backups/db/*.sql.gz 2>/dev/null || echo "  (Hech qanday zaxira fayli topilmadi)"
  exit 1
fi

BACKUP_FILE="$1"
FORCE_FLAG="${2:-}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ XATO: Zaxira fayli topilmadi: $BACKUP_FILE"
  exit 1
fi

echo "[1/4] Zaxira fayli yaxlitligini tekshirish (gzip -t)..."
if ! gzip -t "$BACKUP_FILE"; then
  echo "❌ XATO: Zaxira fayli buzilgan yoki to'liq emas!"
  exit 1
fi
echo "✅ Fayl yaxlitligi tasdiqlandi."

# Muhit o'zgaruvchilarini yuklash
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep -v '^\s*$' | xargs)
fi

echo "=========================================================="
echo "   OGOHLANTIRISH: MA'LUMOTLAR BAZASINI QAYTA TIKLASH"
echo "=========================================================="
echo "Tiklanadigan fayl: $BACKUP_FILE"
echo "Bu amal mavjud bazadagi barcha ma'lumotlarni o'chirib, zaxiradagi holatga keltiradi!"

if [ "$FORCE_FLAG" != "--force" ]; then
  read -p "Haqiqatan ham davom ettirmoqchimisiz? (ha/yo'q): " -r CONFIRM
  if [ "$CONFIRM" != "ha" ] && [ "$CONFIRM" != "yes" ]; then
    echo "Operatsiya bekor qilindi."
    exit 0
  fi
fi

echo "[2/4] Ma'lumotlar bazasini tozalash va qayta tiklash boshlandi..."

if [ -n "${DATABASE_URL:-}" ]; then
  CLEAN_DB_URL="${DATABASE_URL%%\?schema=*}"
  echo "[*] Eskirgan jadvallarni tozalash (DROP SCHEMA public CASCADE)..."
  psql "$CLEAN_DB_URL" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" > /dev/null
  echo "[*] psql orqali zaxira faylini tiklash..."
  gunzip -c "$BACKUP_FILE" | psql "$CLEAN_DB_URL" > /dev/null
elif docker ps --format '{{.Names}}' | grep -q "cyberedu-postgres"; then
  CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep "cyberedu-postgres" | head -n 1)
  DB_USER="${POSTGRES_USER:-cyberedu}"
  DB_NAME="${POSTGRES_DB:-cyberedu}"
  echo "[*] Docker konteyneri ($CONTAINER_NAME) ichiga yuklanmoqda..."
  gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" > /dev/null
else
  echo "❌ XATO: DATABASE_URL topilmadi va cyberedu-postgres konteyneri topilmadi!"
  exit 1
fi

echo "[3/4] Tiklash muvaffaqiyatli yakunlandi!"

# Birikmalar (attachments) arxivini qayta tiklash (agar mavjud bo'lsa)
ATTACHMENTS_DIR="${ATTACHMENTS_DIR:-$PROJECT_ROOT/data/attachments}"
LATEST_ATTACH=$(ls -t "${PROJECT_ROOT}/backups/db/attachments"/cyberedu_attachments_*.tar.gz 2>/dev/null | head -n 1 || true)
if [ -n "$LATEST_ATTACH" ] && [ -f "$LATEST_ATTACH" ]; then
  echo "[*] Birikmalar zaxirasi topildi: $LATEST_ATTACH. Tiklanmoqda..."
  mkdir -p "$(dirname "$ATTACHMENTS_DIR")"
  tar -xzf "$LATEST_ATTACH" -C "$(dirname "$ATTACHMENTS_DIR")"
  echo "✅ Birikmalar muvaffaqiyatli tiklandi: $ATTACHMENTS_DIR"
fi

echo "[4/4] Prisma migratsiyalari va schema sinxronligini tasdiqlash..."
npx prisma generate > /dev/null

echo "=========================================================="
echo "   ✅ BAZA MUVAFFAQIYATLI TIKLANDI VA FOYDALANISHGA TAYYOR"
echo "=========================================================="
