#!/bin/bash
# stage1_linux/setup_stage1.sh
# Kiberxavfsizlik CTF v2 — 1-Bosqich: Linux Tizim Auditi (7 ta amaliy topshiriq)
# Foydalanish: bash setup_stage1.sh <student_username>

set -e

USERNAME=${1:-$(whoami)}
HOME_DIR="/home/$USERNAME"
CORP_DIR="$HOME_DIR/apex_corp"

echo "[*] $USERNAME uchun 1-bosqich (Apex Corp) amaliy topshiriqlari yaratilmoqda..."

# Eski katalog mavjud bo'lsa tozalash
rm -rf "$CORP_DIR"
mkdir -p "$CORP_DIR"/{01_hidden_station,02_system_logs,03_employee_registry,04_lost_backups,05_restricted_vault,06_archived_backups,07_git_repository}

# ==============================================================================
# 01-TOPShIRIQ: Yashirin stansiya ma'lumotlari
# ==============================================================================
cat > "$CORP_DIR/01_hidden_station/README.txt" <<'EOF'
================================================================================
🏢 APEX GLOBAL TECHNOLOGIES — 01-TOPShIRIQ: YASHIRIN MA'LUMOT
================================================================================
Apex Corporation xavfsizlik nazorati stansiyasiga xush kelibsiz.
Administrator ushbu stansiya katalogiga favqulodda kirish kalitini joylashtirgan.
Biroq maxfiy tizim fayllari odatiy ro'yxatda ko'rinmasligi mumkin.

Topshiriq:
Katalogdagi barcha obyektlarni sinchkovlik bilan tekshiring va yashiringan
maxfiy tizim flagini fosh qiling!
================================================================================
EOF

cat > "$CORP_DIR/01_hidden_station/station_info.txt" <<'EOF'
Apex Corporation — Terminal stansiyasi #01
Tizim holati: Faol (Online)
Katalog: Ichki monitoring va xavfsizlik
EOF

cat > "$CORP_DIR/01_hidden_station/.apex_sys_flag" <<'EOF'
FLAG{v2_linux_01_hidden_ls_4821}
EOF


# ==============================================================================
# 02-TOPShIRIQ: Katta log faylining oxirini ko'rish
# ==============================================================================
cat > "$CORP_DIR/02_system_logs/README.txt" <<'EOF'
================================================================================
🏢 APEX GLOBAL TECHNOLOGIES — 02-TOPShIRIQ: MONITORING JURNALI TAHLILI
================================================================================
Server oxirgi ishga tushish paytida katta hajmli 'server_startup.log' monitoring
jurnalini yaratdi. Tizim xavfsiz holatga kelishi bilan, jurnalning eng oxirgi
yozuvlarida favqulodda xavfsizlik flagi qayd etilgan.

Topshiriq:
Ushbu katta hajmli jurnalning eng so'nggi xabarlarini tahlil qiling va
favqulodda tizim kalitini qo'lga kiriting!
================================================================================
EOF

LOG_FILE="$CORP_DIR/02_system_logs/server_startup.log"
{
  for i in $(seq 1 220); do
    printf "[2026-10-25 08:%02d:%02d] systemd[%d]: Service worker-%d initialized. Status=ACTIVE cpu=0.%d%%\n" \
      $((i / 60)) $((i % 60)) $((1000 + i)) $i $(( (i * 7) % 100 ))
  done
  echo "[2026-10-25 08:59:50] apex-security-guard: All baseline microservices verified."
  echo "[2026-10-25 08:59:52] apex-audit-daemon: Synchronizing corporate ledger hashes."
  echo "[2026-10-25 08:59:55] apex-net-core: Internal loopback firewall rules loaded."
  echo "[2026-10-25 08:59:58] apex-emergency-sec: Emergency token successfully generated."
  echo "[2026-10-25 09:00:00] FLAG{v2_linux_02_tail_log_3910}"
} > "$LOG_FILE"


# ==============================================================================
# 03-TOPShIRIQ: Xodimlar reestridan token qidirish
# ==============================================================================
cat > "$CORP_DIR/03_employee_registry/README.txt" <<'EOF'
================================================================================
🏢 APEX GLOBAL TECHNOLOGIES — 03-TOPShIRIQ: XODIMLAR REESTRIDAN QIDIRUV
================================================================================
Ushbu papkada kompaniyaning barcha xodimlari ro'yxati (employees.csv) saqlanmoqda.
Kiber-xavfsizlik bo'limi xodimlardan biri profili ichiga audit tekshiruvi uchun
maxsus flagni kiritib qo'ygan.

Topshiriq:
Yuzlab qatorli ma'lumotlar bazasi ichidan maxfiy flag kalitini qidirib toping!
================================================================================
EOF

CSV_FILE="$CORP_DIR/03_employee_registry/employees.csv"
{
  echo "id,full_name,department,role,email,status"
  echo "1,Dr. Robert Vance,Executive Board,CEO,ceo@apextech.com,Active"
  echo "2,Elena Rostova,Information Security,CTO,erostova@apextech.com,Active"
  echo "3,Adam Smith,Cloud Infrastructure,Lead Systems Engineer,asmith@apextech.com,Active"
  echo "4,Sarah Connor,Cloud Infrastructure,Senior DevOps,sconnor@apextech.com,Active"
  for j in $(seq 5 60); do
    echo "$j,Employee_$j,Operations,Staff,staff_$j@apextech.com,Active"
  done
  echo "61,Security Bot,Audit Special,FLAG{v2_linux_03_grep_filter_8824},audit_bot@apextech.com,Active"
  for k in $(seq 62 120); do
    echo "$k,Employee_$k,Operations,Staff,staff_$k@apextech.com,Active"
  done
} > "$CSV_FILE"


# ==============================================================================
# 04-TOPShIRIQ: Ichki arxivdan zaxira faylini topish
# ==============================================================================
cat > "$CORP_DIR/04_lost_backups/README.txt" <<'EOF'
================================================================================
🏢 APEX GLOBAL TECHNOLOGIES — 04-TOPShIRIQ: YO'QOLGAN ZAXIRA NUSXASI
================================================================================
Kompaniyaning bo'limlari bo'yicha ko'plab ichma-ich arxiv kataloglari mavjud.
Administrator 'vault_recovery' nomli o'ta muhim zaxira faylini ushbu kataloglardan
biriga joylashtirib, uning aniq yo'lini yo'qotib qo'ygan.

Topshiriq:
Butun kataloglar tizimini skanerlab, o'sha faylni toping va uning tarkibidagi
tiklash flagini oling!
================================================================================
EOF

mkdir -p "$CORP_DIR/04_lost_backups/dept_finance/2025/q3/archive"
mkdir -p "$CORP_DIR/04_lost_backups/dept_hr/contracts/archive"
mkdir -p "$CORP_DIR/04_lost_backups/dept_it/cloud/storage/legacy"
mkdir -p "$CORP_DIR/04_lost_backups/dept_marketing/campaigns/2026"

echo "Moliya hisoboti 2025" > "$CORP_DIR/04_lost_backups/dept_finance/2025/q3/archive/report.dat"
echo "Xodimlar shartnomalari arxivi" > "$CORP_DIR/04_lost_backups/dept_hr/contracts/archive/contracts.list"
echo "Marketing rejasi 2026" > "$CORP_DIR/04_lost_backups/dept_marketing/campaigns/2026/plan.txt"

cat > "$CORP_DIR/04_lost_backups/dept_it/cloud/storage/legacy/vault_recovery.bak" <<'EOF'
================================================================================
🏢 APEX CORP — TIZIMNI TIKLASH KALITI (RECOVERY KEY)
================================================================================
Maxfiy kassa tiklash kodi:
FLAG{v2_linux_04_find_path_1749}
================================================================================
EOF


# ==============================================================================
# 05-TOPShIRIQ: Himoyalangan kassa ruxsatini tiklash
# ==============================================================================
cat > "$CORP_DIR/05_restricted_vault/README.txt" <<'EOF'
================================================================================
🏢 APEX GLOBAL TECHNOLOGIES — 05-TOPShIRIQ: CHEKLANGAN OMBOR HUQUQLARI
================================================================================
Ushbu katalogda '.vault_passphrase.txt' nomli maxfiy fayl mavjud.
Biroq administrator tizim xavfsizligini ta'minlash maqsadida unga barcha o'qish
huquqlarini yopib qo'ygan (ruxsatsiz kirish taqiqlangan).

Topshiriq:
Fayl egasi sifatida ushbu cheklovni bartaraf eting, faylga kirish huquqini tiklang
va ichidagi parolni qo'lga kiriting!
================================================================================
EOF

cat > "$CORP_DIR/05_restricted_vault/.vault_passphrase.txt" <<'EOF'
================================================================================
🏢 APEX CORP — MAXFIY KASSA PAROLI
================================================================================
Siz ruxsatlarni muvaffaqiyatli to'g'riladingiz!
Flagingiz:
FLAG{v2_linux_05_chmod_perms_9201}
================================================================================
EOF
chmod 000 "$CORP_DIR/05_restricted_vault/.vault_passphrase.txt"


# ==============================================================================
# 06-TOPShIRIQ: Hodisalar arxivi paketini ochish
# ==============================================================================
cat > "$CORP_DIR/06_archived_backups/README.txt" <<'EOF'
================================================================================
🏢 APEX GLOBAL TECHNOLOGIES — 06-TOPShIRIQ: QISILGAN HODISALAR PAKETI
================================================================================
Tizim administratori kiber-hodisalar xotirasini 'incident_bundle.tar.gz' nomli
qisilgan arxiv fayli shaklida qoldirgan.

Topshiriq:
Ushbu arxiv paketini oching va uning tarkibidan xavfsizlik flagini ajratib oling!
================================================================================
EOF

TMP_TAR_DIR=$(mktemp -d)
cat > "$TMP_TAR_DIR/backup_notes.txt" <<'EOF'
================================================================================
🏢 APEX CORP — ZAXIRA ARXIVI ESLATMASI
================================================================================
Arxiv muvaffaqiyatli ochildi!
Sizning 6-topshiriq flagingiz:
FLAG{v2_linux_06_tar_extract_6530}
================================================================================
EOF
(
  cd "$TMP_TAR_DIR"
  tar -czf "$CORP_DIR/06_archived_backups/incident_bundle.tar.gz" backup_notes.txt
)
rm -rf "$TMP_TAR_DIR"


# ==============================================================================
# 07-TOPShIRIQ: Repozitoriy tarixidan o'chirilgan sir
# ==============================================================================
cat > "$CORP_DIR/07_git_repository/README.txt" <<'EOF'
================================================================================
🏢 APEX GLOBAL TECHNOLOGIES — 07-TOPShIRIQ: O'CHIRILGAN VERSIYALAR TARIXI
================================================================================
Ushbu papkada 'apex-api' loyihasining manba kodi joylashgan.
Muhandis Adam Smith loyiha sozlamalarini yangilash jarayonida maxfiy integratsiya
kalitini dastlabki versiyaga qo'shgan, keyin esa xavfsizlik siyosati tufayli
uni matndan o'chirib, "REDACTED" bilan almashtirgan.

Topshiriq:
Loyiha o'zgarishlar tarixini tahlil qiling, o'tmishdagi versiyada nima bo'lganini
aniqlang va o'chirilgan flagni hamda Adam Smith ning tizim parolini tiklang!
================================================================================
EOF

mkdir -p "$CORP_DIR/07_git_repository/apex-api"
(
  cd "$CORP_DIR/07_git_repository/apex-api"
  git init -q
  git config user.name "Adam Smith"
  git config user.email "asmith@apextech.com"

  cat > README.md <<'EOF'
# Apex Corporation Internal Gateway API
Ushbu API ichki xizmatlar o'rtasida aloqa o'rnatish uchun mo'ljallangan.
EOF

  cat > config.env <<'EOF'
GATEWAY_HOST=0.0.0.0
GATEWAY_PORT=5000
SYS_LEAD=asmith
SYS_PASSWORD=spring2026
SECRET_INTEGRATION_KEY=FLAG{v2_linux_07_git_history_7718}
EOF
  git add .
  git commit -q -m "feat: initial commit of internal gateway configuration"

  # Maxfiy kalitni tozalash va ikkinchi commit qilish
  cat > config.env <<'EOF'
GATEWAY_HOST=0.0.0.0
GATEWAY_PORT=5000
SYS_LEAD=asmith
SYS_PASSWORD=REDACTED
SECRET_INTEGRATION_KEY=REDACTED_BY_SECURITY_POLICY
EOF
  git add config.env
  git commit -q -m "security: redact credentials and secrets from gateway config"
)


# ==============================================================================
# Asosiy qo'llanma (README.txt va APEX_MISSION.txt)
# ==============================================================================
cat > "$HOME_DIR/README.txt" <<'EOF'
================================================================================
🚩 KIBERXAVFSIZLIK CTF v2 — 1-BOSQICH (LINUX MUHITI) QO'LLANMASI
================================================================================

Salom, Kiber-Tadqiqotchi!
Siz xalqaro "Apex Global Technologies" korporatsiyasi tizimlarini audit qilish
uchun qabul qilindingiz.

Sizning barcha amaliy topshiriqlaringiz '~/apex_corp' katalogida joylashgan!
U yerga o'tish:
  cd ~/apex_corp

--------------------------------------------------------------------------------
🎯 1-BOSQICHNING 7 TA AMALIY TOPSHIRIG'I:
--------------------------------------------------------------------------------
  📁 01_hidden_station       → Yashirin stansiya ma'lumotlari           [+50 ball]
  📁 02_system_logs           → Server loglaridan favqulodda kalit       [+50 ball]
  📁 03_employee_registry     → Xodimlar reestridan token qidirish       [+75 ball]
  📁 04_lost_backups          → Ichki arxivdan zaxira faylini topish     [+75 ball]
  📁 05_restricted_vault      → Himoyalangan kassa ruxsatini tiklash     [+75 ball]
  📁 06_archived_backups      → Hodisalar arxivi paketini ochish         [+75 ball]
  📁 07_git_repository        → Repozitoriy tarixidan o'chirilgan sir    [+100 ball]
  ------------------------------------------------------------------------------
  Jami: 7 ta topshiriq / 500 ball!

Har bir papka ichida topshiriq tavsifi ('README.txt') mavjud.
Topshiriqlarni hal etish vositalari va yo'llarini mustaqil aniqlashingiz lozim.

📌 TEKSHIRUV VA PROGRESS:
  • O'z holatingiz va ballarni ko'rish: status
  • Topilgan flagni tekshirish:         check FLAG{...}

* Eslatma: Urinishlar soni cheklanmagan — to'g'ri kalit topilmaguncha cheksiz urinish mumkin.
Barcha 7 ta topshiriq yakunlangach, sizga 2-bosqich (Web Pentest) portali ochiladi!
Omad yor bo'lsin!
================================================================================
EOF

cp "$HOME_DIR/README.txt" "$HOME_DIR/APEX_MISSION.txt"
cp "$HOME_DIR/README.txt" "$CORP_DIR/README.txt"

# Shell rc fayllariga talaba kirganda avtomatik chiqadigan banner qo'shish (faqat talabalar hisobiga, user yoki root ga emas)
if [ "$USERNAME" != "root" ] && [ "$USERNAME" != "user" ]; then
  for rc_file in "$HOME_DIR/.bashrc" "$HOME_DIR/.zshrc" "$HOME_DIR/.profile"; do
    if [ -f "$rc_file" ] && ! grep -q "CTF_WELCOME_BANNER" "$rc_file"; then
cat >> "$rc_file" <<'EOF'

# CTF_WELCOME_BANNER
if [ -t 1 ] && [ -d "$HOME/apex_corp" ]; then
    echo ""
    echo -e "\033[1;36m================================================================================\033[0m"
    echo -e "\033[1;32m  🚩 KIBERXAVFSIZLIK CTF v2 — OPERATSIYA 'APEX INFILTRATION'\033[0m"
    echo -e "\033[1;36m--------------------------------------------------------------------------------\033[0m"
    echo -e "  Tizimga muvaffaqiyatli ulandingiz!"
    echo -e "  📄 Qo'llanma:   \033[1;33mcat README.txt\033[0m"
    echo -e "  📁 Vazifalar:   \033[1;33mcd ~/apex_corp\033[0m"
    echo -e "  📊 Holat:       \033[1;33mstatus\033[0m"
    echo -e "  🚩 Tekshiruv:   \033[1;33mcheck FLAG{...}\033[0m"
    echo -e "\033[1;36m================================================================================\033[0m"
    echo ""
fi
EOF
      chown "$USERNAME:$USERNAME" "$rc_file" 2>/dev/null || true
    fi
  done
fi

# Huquqlarni sozlash
chown -R "$USERNAME:$USERNAME" "$CORP_DIR" 2>/dev/null || true
chown "$USERNAME:$USERNAME" "$HOME_DIR/README.txt" "$HOME_DIR/APEX_MISSION.txt" 2>/dev/null || true
chmod 000 "$CORP_DIR/05_restricted_vault/.vault_passphrase.txt" 2>/dev/null || true

echo "[+] $USERNAME uchun 1-bosqich (7 ta amaliy topshiriq) muvaffaqiyatli sozlandi!"
