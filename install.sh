#!/bin/bash
# install.sh — CTF v2 O'rnatish va Ishga Tushirish Skripti
# Foydalanish: bash install.sh yoki sudo bash install.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export CTF_DB_PATH="${CTF_DB_PATH:-/var/ctf/ctf_v2.db}"

echo "===================================================================="
echo "  🚩 KIBERXAVFSIZLIK CTF v2 — TIZIMNI O'RNATISH VA SOZLASH"
echo "===================================================================="

# 1. Kataloglar yaratish
echo "[1/4] /var/ctf ma'lumotlar va hisobotlar kataloglari yaratilmoqda..."
mkdir -p /var/ctf/reports
chmod 777 /var/ctf 2>/dev/null || true
chmod 777 /var/ctf/reports 2>/dev/null || true

# 2. Markaziy ma'lumotlar bazasini sozlash
echo "[2/4] Markaziy SQLite bazasi (ctf_v2.db) initsializatsiya qilinmoqda..."
python3 -c "
import sys
sys.path.insert(0, '$SCRIPT_DIR')
from core_db import db
db.init_db('$CTF_DB_PATH')
print('   ✅ Baza tayyor: $CTF_DB_PATH')
"
chmod 666 "$CTF_DB_PATH"* 2>/dev/null || true

# 3. Terminal buyruqlarini ulash (check va status)
echo "[3/4] /usr/local/bin/ ga buyruqlar ulanmoqda..."
if [ -w /usr/local/bin ]; then
    ln -sf "$SCRIPT_DIR/bin/check" /usr/local/bin/check
    ln -sf "$SCRIPT_DIR/bin/status" /usr/local/bin/status
    chmod +x /usr/local/bin/check /usr/local/bin/status
    echo "   ✅ /usr/local/bin/check va status muvaffaqiyatli ulandi"
else
    echo "   [i] Sudo huquqi yo'q, buyruqlar $SCRIPT_DIR/bin da qoldi."
fi

# 4. 1-bosqich Linux muhitini tayyorlash
echo "[4/4] 1-bosqich korporativ Linux muhiti sozlanmoqda..."
bash "$SCRIPT_DIR/stage1_linux/setup_stage1.sh" "${SUDO_USER:-$(whoami)}"

echo ""
echo "===================================================================="
echo "  🎉 CTF v2 TO'LIQ O'RNATILDI VA TAYYOR!"
echo "===================================================================="
echo "  🌐 2-Bosqich Web Target:        http://localhost:5000"
echo "  📺 Katta Ekran Jonli Matritsa:  http://localhost:8080"
echo "  🛡 Hakamlar Paneli:             http://localhost:8080/admin (Parol: admin2026)"
echo ""
echo "  🚀 Xizmatlarni ishga tushirish uchun:"
echo "     • Docker orqali:       docker-compose up -d"
echo "     • Qo'lda (terminalda): python3 stage2_web/app/server.py &"
echo "                            python3 dashboard/server.py &"
echo "                            python3 bot/bot.py &"
echo "===================================================================="
