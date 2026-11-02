#!/usr/bin/env bash
# ==============================================================================
# CyberEdu Platform — Ma'lumotlar Bazasini Avtomatik Zaxiralash (Backup) Skripti
#
# Funksiyalari:
# 1. PostgreSQL bazasini pg_dump orqali to'liq eksport qilish
# 2. gzip bilan maksimal siqish (bandwidth va disk tejash)
# 3. Vaqt tamg'asi (timestamp) bilan saqlash
# 4. 7 kunlik avtomatik rotatsiya (7 kundan eski zaxira nusxalarini tozalash)
# ==============================================================================

set -euo pipefail

# Loyiha ildiz katalogini aniqlash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Muhit o'zgaruvchilarini yuklash
if [ -f .env ]; then
  # Faqat export qilinadigan o'zgaruvchilarni o'qish
  export $(grep -v '^#' .env | grep -v '^\s*$' | xargs)
fi

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups/db}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_FILENAME="cyberedu_db_${TIMESTAMP}.sql.gz"
BACKUP_FILEPATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

echo "=========================================================="
echo "   CYBEREDU MA'LUMOTLAR BAZASI ZAXIRALASH (BACKUP)"
echo "=========================================================="
echo "Vaqt: $(date)"
echo "Saqlash joyi: $BACKUP_FILEPATH"

# Agar Docker compose ichidagi postgres bo'lsa yoki to'g'ridan-to'g'ri DATABASE_URL bo'lsa
if [ -n "${DATABASE_URL:-}" ]; then
  # Prisma ?schema=public parametrini pg_dump uchun tozalash
  CLEAN_DB_URL="${DATABASE_URL%%\?schema=*}"
  echo "[*] pg_dump orqali DATABASE_URL bo'yicha zaxira nusxa olinmoqda..."
  pg_dump --clean --if-exists "$CLEAN_DB_URL" | gzip -9 > "$BACKUP_FILEPATH"
elif docker ps --format '{{.Names}}' | grep -q "cyberedu-postgres"; then
  CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep "cyberedu-postgres" | head -n 1)
  DB_USER="${POSTGRES_USER:-cyberedu}"
  DB_NAME="${POSTGRES_DB:-cyberedu}"
  echo "[*] Docker konteyneri ($CONTAINER_NAME) orqali zaxira olinmoqda..."
  docker exec -t "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip -9 > "$BACKUP_FILEPATH"
else
  echo "❌ XATO: DATABASE_URL topilmadi va cyberedu-postgres konteyneri ishlamayapti!"
  exit 1
fi

# Fayl hajmi va yaxlitligini tekshirish
if [ -s "$BACKUP_FILEPATH" ] && gzip -t "$BACKUP_FILEPATH"; then
  FILE_SIZE=$(du -h "$BACKUP_FILEPATH" | cut -f1)
  echo "✅ Zaxira nusxa muvaffaqiyatli yaratildi! Hajmi: $FILE_SIZE"
else
  echo "❌ XATO: Zaxira fayli bo'sh yoki buzilgan!"
  rm -f "$BACKUP_FILEPATH"
  exit 1
fi

# ── 9-BOSQICH: VIDEO FAYLLARINI ZAXIRALASH (BACKUP_INCLUDE_VIDEOS=true) ──────
VIDEO_DIR="${VIDEO_DIR:-$PROJECT_ROOT/data/videos}"
BACKUP_INCLUDE_VIDEOS="${BACKUP_INCLUDE_VIDEOS:-false}"

if [ "$BACKUP_INCLUDE_VIDEOS" = "true" ]; then
  echo ""
  echo "=========================================================="
  echo "   VIDEOLAR ZAXIRASI (BACKUP_INCLUDE_VIDEOS=true)"
  echo "=========================================================="
  VIDEO_BACKUP_DIR="${BACKUP_DIR}/videos"
  mkdir -p "$VIDEO_BACKUP_DIR"
  VIDEO_ARCHIVE="${VIDEO_BACKUP_DIR}/cyberedu_videos_${TIMESTAMP}.tar.gz"

  if [ -d "$VIDEO_DIR" ] && [ "$(ls -A "$VIDEO_DIR" 2>/dev/null)" ]; then
    echo "[*] '$VIDEO_DIR' katalogidagi videolar arxivlanmoqda..."
    tar -czf "$VIDEO_ARCHIVE" -C "$(dirname "$VIDEO_DIR")" "$(basename "$VIDEO_DIR")"
    if [ -s "$VIDEO_ARCHIVE" ]; then
      VID_SIZE=$(du -h "$VIDEO_ARCHIVE" | cut -f1)
      echo "✅ Videolar zaxira arxivi muvaffaqiyatli yaratildi! Hajmi: $VID_SIZE"
    fi
  else
    echo "[i] Video katalogi bo'sh yoki mavjud emas ('$VIDEO_DIR'), video arxivi o'tkazib yuborildi."
  fi

  # Videolar uchun 7 kunlik rotatsiya
  find "$VIDEO_BACKUP_DIR" -type f -name "cyberedu_videos_*.tar.gz" -mtime +7 -delete 2>/dev/null || true
fi

# ── 10-BOSQICH: TOP SHIRIQ BIRIKMALARI (ATTACHMENTS) ZAXIRALASH (BACKUP_INCLUDE_ATTACHMENTS=true) ──────
ATTACHMENTS_DIR="${ATTACHMENTS_DIR:-$PROJECT_ROOT/data/attachments}"
BACKUP_INCLUDE_ATTACHMENTS="${BACKUP_INCLUDE_ATTACHMENTS:-false}"

if [ "$BACKUP_INCLUDE_ATTACHMENTS" = "true" ]; then
  echo ""
  echo "=========================================================="
  echo "   BIRIKMALAR (ATTACHMENTS) ZAXIRASI (BACKUP_INCLUDE_ATTACHMENTS=true)"
  echo "=========================================================="
  ATTACH_BACKUP_DIR="${BACKUP_DIR}/attachments"
  mkdir -p "$ATTACH_BACKUP_DIR"
  ATTACH_ARCHIVE="${ATTACH_BACKUP_DIR}/cyberedu_attachments_${TIMESTAMP}.tar.gz"

  if [ -d "$ATTACHMENTS_DIR" ] && [ "$(ls -A "$ATTACHMENTS_DIR" 2>/dev/null)" ]; then
    echo "[*] '$ATTACHMENTS_DIR' katalogidagi birikmalar arxivlanmoqda..."
    tar -czf "$ATTACH_ARCHIVE" -C "$(dirname "$ATTACHMENTS_DIR")" "$(basename "$ATTACHMENTS_DIR")"
    if [ -s "$ATTACH_ARCHIVE" ]; then
      ATT_SIZE=$(du -h "$ATTACH_ARCHIVE" | cut -f1)
      echo "✅ Birikmalar zaxira arxivi muvaffaqiyatli yaratildi! Hajmi: $ATT_SIZE"
    fi
  else
    echo "[i] Birikmalar katalogi bo'sh yoki mavjud emas ('$ATTACHMENTS_DIR'), birikmalar arxivi o'tkazib yuborildi."
  fi

  # Birikmalar uchun 7 kunlik rotatsiya
  find "$ATTACH_BACKUP_DIR" -type f -name "cyberedu_attachments_*.tar.gz" -mtime +7 -delete 2>/dev/null || true
fi

# ── 7 KUNLIK ROTATSIYA (Clean up older than 7 days) ──────────────────────────
echo "[*] 7 kundan eski zaxira fayllarini tekshirish va tozalash..."
OLD_FILES=$(find "$BACKUP_DIR" -type f -name "cyberedu_db_*.sql.gz" -mtime +7)

if [ -n "$OLD_FILES" ]; then
  echo "[-] Quyidagi eski fayllar o'chirilmoqda:"
  echo "$OLD_FILES"
  find "$BACKUP_DIR" -type f -name "cyberedu_db_*.sql.gz" -mtime +7 -delete
  echo "✅ Eski fayllar tozalandi."
else
  echo "[i] 7 kundan eski zaxira fayllari mavjud emas."
fi

echo "=========================================================="
echo "   ZAXIRALASH MUVAFFAQIYATLI YAKUNLANDI"
echo "=========================================================="
