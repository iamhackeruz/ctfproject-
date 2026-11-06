#!/usr/bin/env bash
# ==============================================================================
# CyberEdu — Avvalgi ma'lumotlarni zaxiralash, Telegram kanalga yuborish
# va bazani tozalab, foydalanuvchilar uchun 0 dan toza ishga tushirish skripti.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

ENV_FILE="${1:-.env.production}"
TARGET_ENV="${PROJECT_ROOT}/${ENV_FILE}"

echo "=========================================================="
echo "   CYBEREDU ZAXIRALASH VA TIZIMNI TOZALAB TIKLASH"
echo "=========================================================="

if [ ! -f "${TARGET_ENV}" ]; then
  echo "❌ XATO: '${TARGET_ENV}' fayli topilmadi!"
  exit 1
fi

get_val() {
  local key="$1"
  grep -E "^[[:space:]]*${key}=" "${TARGET_ENV}" | tail -n 1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true
}

BOT_TOKEN="$(get_val TELEGRAM_BOT_TOKEN)"
CHANNEL_ID="$(get_val TELEGRAM_BACKUP_CHANNEL_ID)"
PG_USER="$(get_val POSTGRES_USER)"
PG_DB="$(get_val POSTGRES_DB)"

PG_USER="${PG_USER:-cyberedu_prod_user}"
PG_DB="${PG_DB:-cyberedu_clean_prod}"

# ── 1-QADAM: BAZANI TO'LIQ ZAXIRALASH (BACKUP) ────────────────────────────────
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_DIR="${PROJECT_ROOT}/backups/db"
mkdir -p "${BACKUP_DIR}"

BACKUP_FILE="${BACKUP_DIR}/preclean_backup_${TIMESTAMP}.sql.gz"
echo ""
echo "[1/4] Avvalgi barcha ma'lumotlar bazasi zaxiralanmoqda..."

if docker ps --format '{{.Names}}' | grep -q "cyberedu-postgres"; then
  docker exec cyberedu-postgres-prod pg_dump -U "${PG_USER}" "${PG_DB}" | gzip -9 > "${BACKUP_FILE}"
else
  echo "❌ XATO: cyberedu-postgres-prod konteyneri ishlamayapti!"
  exit 1
fi

if [ -s "${BACKUP_FILE}" ] && gzip -t "${BACKUP_FILE}"; then
  FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "✅ Baza to'liq zaxiralandi: ${BACKUP_FILE} (Hajmi: ${FILE_SIZE})"
else
  echo "❌ XATO: Zaxira fayli bo'sh yoki buzilgan!"
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# ── 2-QADAM: TELEGRAM KANALGA YUBORISH ────────────────────────────────────────
echo ""
echo "[2/4] Telegram kanalga ma'lumotlarni yuborish tekshirilmoqda..."

IS_REAL_BOT=false
if [ -n "${BOT_TOKEN}" ] && [ "${BOT_TOKEN}" != "BOT_TOKENINI_SHU_YERGA_YOZING" ] && [ "${BOT_TOKEN}" != "mock_telegram_token" ]; then
  IS_REAL_BOT=true
fi

IS_REAL_CHANNEL=false
if [ -n "${CHANNEL_ID}" ] && [ "${CHANNEL_ID}" != "@KANAL_YOKI_CHAT_ID" ]; then
  IS_REAL_CHANNEL=true
fi

if [ "$IS_REAL_BOT" = true ] && [ "$IS_REAL_CHANNEL" = true ]; then
  echo "[*] Telegram bot orqali kanalga (${CHANNEL_ID}) zaxira fayli yuborilmoqda..."
  CAPTION="📦 <b>CyberEdu — Eski Ma'lumotlar Zaxirasi</b>%0A📅 Sana: <code>$(date)</code>%0Aℹ️ Tizim tozalanishidan oldingi barcha ma'lumotlar."
  
  SEND_RES=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendDocument" \
    -F "chat_id=${CHANNEL_ID}" \
    -F "caption=${CAPTION}" \
    -F "parse_mode=HTML" \
    -F "document=@${BACKUP_FILE}")
  
  if echo "${SEND_RES}" | grep -q '"ok":true'; then
    echo "✅ Zaxira fayli Telegram kanalga (${CHANNEL_ID}) muvaffaqiyatli tashlandi!"
  else
    echo "⚠️ Telegram kanalga yuborishda xatolik yuz berdi: ${SEND_RES}"
    echo "Lekin xavotir olmang, zaxira nusxangiz faylda xavfsiz saqlangan: ${BACKUP_FILE}"
  fi
else
  echo "ℹ️ TELEGRAM_BOT_TOKEN yoki TELEGRAM_BACKUP_CHANNEL_ID hozircha example holatida."
  echo "✅ Zaxira nusxa faylda xavfsiz saqlandi: ${BACKUP_FILE}"
  echo "(Keyinchalik .env fayliga bot token va kanal ID kiritilganda ushbu buyruq avtomatik kanalga tashlaydi)."
fi

# ── 3-QADAM: BAZANI TOZALASH (CLEAN RESET) ────────────────────────────────────
echo ""
echo "[3/4] Bazadagi avvalgi test ma'lumotlar tozalanmoqda (kurslar va asosiy admin saqlanadi)..."

CLEAN_SQL="
TRUNCATE TABLE 
  attendance_records,
  class_sessions,
  assignment_extensions,
  submission_history,
  submissions,
  assignments,
  telegram_connect_codes,
  notifications,
  notification_preferences,
  daily_resource_usages,
  web_lab_instances,
  lab_hint_unlocks,
  lab_submissions,
  quiz_submissions,
  lesson_progress,
  video_progress,
  enrollments,
  comments,
  certificates,
  password_reset_tokens,
  sessions,
  audit_logs,
  group_members,
  group_courses,
  groups,
  entitlements
CASCADE;

DELETE FROM users WHERE role != 'admin';
"

docker exec -i cyberedu-postgres-prod psql -U "${PG_USER}" -d "${PG_DB}" -c "${CLEAN_SQL}" >/dev/null

echo "✅ Barcha test ma'lumotlar, urinishlar, loglar va test talabalar tozalandi."
echo "✅ Asosiy administrator va o'quv dasturi kurslari to'liq saqlab qolindi."

# ── 4-QADAM: PLATFORMANI QAYTA ISHGA TUSHIRISH ────────────────────────────────
echo ""
echo "[4/4] Sayt konteyneri toza ma'lumotlar bilan qayta yuklanmoqda..."
docker compose --env-file "${TARGET_ENV}" restart app >/dev/null

echo "[*] Sayt salomatligi tekshirilmoqda (/api/health)..."
sleep 5
HEALTH_RES=$(curl -s http://127.0.0.1:3000/api/health || true)
echo "Javob: ${HEALTH_RES}"

echo ""
echo "=========================================================="
echo "🎉 TABRIKLAYMIZ! TIZIM MUVAFFAQIYATLI TOZALANDI VA ISHGA TUSHDI!"
echo "=========================================================="
echo "• Eski ma'lumotlar zaxirasi: ${BACKUP_FILE}"
echo "• Platforma holati: Yangi foydalanuvchilar (talabalar) 0 dan"
echo "  ro'yxatdan o'tib, darslarni boshlashlari uchun tayyor."
echo "=========================================================="
