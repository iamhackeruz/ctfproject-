#!/bin/bash
# setup/provision_user.sh <username> [password]
# CTF v2 — Yangi talaba hisobini yaratish va 1-bosqich (Apex Corp) muhitini sozlash.

set -e

if [ -z "$1" ]; then
    echo "Foydalanish: sudo bash $0 <username> [password]"
    exit 1
fi

USERNAME=$1
PASSWORD=$2
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "$PASSWORD" ]; then
    PASSWORD=$(openssl rand -base64 9 | tr -dc 'a-zA-Z0-9' | head -c 8)
fi

# 1. Linux foydalanuvchisini yaratish (agar mavjud bo'lmasa)
if id "$USERNAME" &>/dev/null; then
    echo "[i] Foydalanuvchi mavjud: $USERNAME"
else
    useradd -m -s /bin/bash "$USERNAME"
    echo "$USERNAME:$PASSWORD" | chpasswd
    echo "[+] Linux foydalanuvchisi yaratildi: $USERNAME (Parol: $PASSWORD)"
fi

# Talaba faqat o'z papkasiga kira olishi uchun
chmod 700 "/home/$USERNAME"

# 2. Markaziy ma'lumotlar bazasida ro'yxatdan o'tkazish
python3 -c "
import sys
sys.path.insert(0, '$SCRIPT_DIR')
from core_db import db
p = db.register_participant('$USERNAME', '$USERNAME'.capitalize(), ssh_password='$PASSWORD')
print('   [+] Baza yozuvi tayyor: id=' + str(p['id']))
"

# 3. 1-bosqich Apex Corp muhitini sozlash
bash "$SCRIPT_DIR/stage1_linux/setup_stage1.sh" "$USERNAME"

echo "[✅] $USERNAME uchun CTF v2 muhiti to'liq tayyorlandi!"
