#!/bin/bash
# ==============================================================================
# CyberEdu Platform — scripts/generate-secrets.sh
# Production sirlari va konfiguratsiyasini xavfsiz openssl orqali generatsiya qilish.
#
# Xavfsizlik qoidalari:
# 1. Mavjud .env.production faylini ustidan YOZMAYDI (faqat yo'q kalitlarni qo'shadi).
# 2. Sirlarni ekranga (terminalga) ASLO CHIQARMAYDI.
# 3. Fayl ruxsatini qat'iy 0600 (faqat egasi o'qiy oladi) qilib o'rnatadi.
# ==============================================================================

set -euo pipefail

ENV_FILE="${1:-.env.production}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

TARGET_PATH="${ROOT_DIR}/${ENV_FILE}"

# Fayl bo'lmasa yaratish va huquqini cheklash
if [ ! -f "${TARGET_PATH}" ]; then
  touch "${TARGET_PATH}"
fi
chmod 600 "${TARGET_PATH}"

ADDED_COUNT=0

add_if_missing() {
  local key="$1"
  local val="$2"
  if ! grep -q -E "^[[:space:]]*${key}=" "${TARGET_PATH}"; then
    printf '%s="%s"\n' "${key}" "${val}" >> "${TARGET_PATH}"
    ADDED_COUNT=$((ADDED_COUNT + 1))
  fi
}

# Standart umumiy parametrlar
add_if_missing "NODE_ENV" "production"
add_if_missing "ALLOW_TEST_ACCOUNTS" "false"
add_if_missing "ALLOW_PUBLIC_REGISTRATION" "false"

# Domen va tarmoq sozlamalari
DEFAULT_DOMAIN="${DOMAIN:-cyberedu.uz}"
DEFAULT_LABS_DOMAIN="${LABS_DOMAIN:-labs.cyberedu.uz}"
DEFAULT_EMAIL="${ACME_EMAIL:-admin@cyberedu.uz}"

add_if_missing "DOMAIN" "${DEFAULT_DOMAIN}"
add_if_missing "LABS_DOMAIN" "${DEFAULT_LABS_DOMAIN}"
add_if_missing "ACME_EMAIL" "${DEFAULT_EMAIL}"

# Kriptografik tasodifiy sirlar (kamida 64 hex belgi)
SEC_SESSION=$(openssl rand -hex 32)
SEC_FLAG=$(openssl rand -hex 32)
SEC_DAEMON=$(openssl rand -hex 32)
SEC_TOTP=$(openssl rand -hex 32)
SEC_CRON=$(openssl rand -hex 32)
SEC_ADMIN_RESET=$(openssl rand -hex 32)

add_if_missing "SESSION_SECRET" "${SEC_SESSION}"
add_if_missing "FLAG_SECRET" "${SEC_FLAG}"
add_if_missing "DAEMON_SECRET" "${SEC_DAEMON}"
add_if_missing "TOTP_ENCRYPTION_KEY" "${SEC_TOTP}"
add_if_missing "CRON_SECRET" "${SEC_CRON}"
add_if_missing "ADMIN_RESET_TOKEN" "${SEC_ADMIN_RESET}"

# Ma'lumotlar bazasi foydalanuvchisi va kuchli paroli (24 belgi)
PG_USER="cyberedu"
PG_DB="cyberedu"
PG_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)

add_if_missing "POSTGRES_USER" "${PG_USER}"
add_if_missing "POSTGRES_DB" "${PG_DB}"
add_if_missing "POSTGRES_PASSWORD" "${PG_PASS}"

# Mavjud yoki yangi paroldan foydalanib DATABASE_URL ni shakllantirish
EXISTING_PASS=$(grep -E "^[[:space:]]*POSTGRES_PASSWORD=" "${TARGET_PATH}" | cut -d'=' -f2- | tr -d '"' || true)
if [ -z "${EXISTING_PASS}" ]; then
  EXISTING_PASS="${PG_PASS}"
fi
add_if_missing "DATABASE_URL" "postgresql://${PG_USER}:${EXISTING_PASS}@postgres:5432/${PG_DB}?schema=public"

# Boshlang'ich Administrator (Seed uchun)
ADMIN_PASS="$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)A!1"
add_if_missing "ADMIN_INIT_EMAIL" "admin@${DEFAULT_DOMAIN}"
add_if_missing "ADMIN_INIT_PASSWORD" "${ADMIN_PASS}"
add_if_missing "ADMIN_INIT_NAME" "Bosh Administrator"
add_if_missing "ADMIN_INIT_PHONE" "+998901234567"

# Papkalar va resurs cheklovlari
add_if_missing "VIDEO_DIR" "/app/data/videos"
add_if_missing "ATTACHMENTS_DIR" "/app/data/attachments"
add_if_missing "MAX_TERMINAL_CONTAINERS" "15"
add_if_missing "MAX_WEB_LAB_CONTAINERS" "4"

# Xavfsizlik uchun fayl huquqini yana bir bor 600 qilib tekshirish
chmod 600 "${TARGET_PATH}"

# Sirlarni aslo ekranga chiqarmaymiz
echo "[CyberEdu] '${ENV_FILE}' fayli muvaffaqiyatli tekshirildi/yangilandi (ruxsat: 600)."
echo "[CyberEdu] Yangi kiritilgan parametrlar soni: ${ADDED_COUNT}"
