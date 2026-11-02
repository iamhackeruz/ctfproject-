# CyberEdu Platformasini Contabo Cloud VPS Serveriga Joylash (Production Deployment Guide)

Ushbu yo'riqnoma **CyberEdu** ta'lim platformasini **Ubuntu 22.04 LTS** yoki **Ubuntu 24.04 LTS** o'rnatilgan **Contabo Cloud VPS** (6 vCPU, 12 GB RAM, NVMe) serverida noldan boshlab, professional xavfsizlik talablariga muvofiq to'liq ishga tushirish bo'yicha bosqichma-bosqich qo'llanmadir.

> [!NOTE]
> Barcha buyruqlar tartib bilan bajarilishi shart. Har bir qadamda kutilayotgan natija (**Qanday bo'lishi kerak**) ko'rsatilgan.
> Lokal sinab bo'lmaydigan (faqat real tashqi serverda amalga oshiriladigan) amallar maxsus belgilangan.

---

## MUNDARIJA
- [1. (a) SSH Kalit va Xavfsiz Foydalanuvchi](#1-a-ssh-kalit-va-xavfsiz-foydalanuvchi)
- [2. (b) UFW Xavfsizlik Devori va Docker Izolyatsiyasi](#2-b-ufw-xavfsizlik-devori-va-docker-izolyatsiyasi)
- [3. (c) Server Hardening (Avtomatik Yangilanishlar, Fail2ban va No-standart SSH Port)](#3-c-server-hardening-avtomatik-yangilanishlar-fail2ban-va-no-standart-ssh-port)
- [4. (d) 2 GB Swap Faylini Sozlash](#4-d-2-gb-swap-faylini-sozlash)
- [5. (e) Docker va Docker Compose O'rnatish](#5-e-docker-va-docker-compose-ornatish)
- [6. (f) DNS Yozuvlarini Bog'lash (Domen va Labs)](#6-f-dns-yozuvlarini-boglash-domen-va-labs)
- [7. (g) Loyihani Serverga Ko'chirish](#7-g-loyihani-serverga-kochirish)
- [8. (h) .env.production va Kriptografik Sirlarni Generatsiya Qilish](#8-h-envproduction-va-kriptografik-sirlarni-generatsiya-qilish)
- [9. (i) Docker Compose Ishga Tushirish, Seed va Ilk 2FA Sozlash](#9-i-docker-compose-ishga-tushirish-seed-va-ilk-2fa-sozlash)
- [10. (j) Avtomatik HTTPS (SSL) Tekshirish](#10-j-avtomatik-https-ssl-tekshirish)
- [11. (k) Server Crontab (Avtomatik Zaxira va Eslatmalar)](#11-k-server-crontab-avtomatik-zaxira-va-eslatmalar)
- [12. (l) Zaxiralarni Tashqi Xotiraga Nusxalash (Off-Site Backup)](#12-l-zaxiralarni-tashqi-xotiraga-nusxalash-off-site-backup)
- [13. (m) Tashqi Portlarni nmap Bilan Skanerlash](#13-m-tashqi-portlarni-nmap-bilan-skanerlash)
- [14. (n) labs. Subdomenida Cookie Izolyatsiyasini DevTools Bilan Tekshirish](#14-n-labs-subdomenida-cookie-izolyatsiyasini-devtools-bilan-tekshirish)
- [15. (o) Tizimni Yangilash va Orqaga Qaytarish (Rollback)](#15-o-tizimni-yangilash-va-orqaga-qaytarish-rollback)
- [16. (p) Monitoring va Muammolarni Aniqlash (Troubleshooting)](#16-p-monitoring-va-muammolarni-aniqlash-troubleshooting)
- [17. (q) Joylashdan Keyingi Tekshiruv Ro'yxati (Post-Deployment Checklist)](#17-q-joylashdan-keyingi-tekshiruv-royxati-post-deployment-checklist)

---

## 1. (a) SSH Kalit va Xavfsiz Foydalanuvchi

Serverga parolli kirishni taqiqlash va alohida imtiyozli foydalanuvchi (`deploy`) yaratish.

### 1-qadam. O'z lokal kompyuteringizdan SSH kalitni serverga nusxalash
*(O'z kompyuteringizda bajarasiz)*
```bash
# Agar SSH kalitingiz bo'lmasa:
ssh-keygen -t ed25519 -C "admin-deploy@cyberedu.uz"

# Kalitni Contabo VPS serveriga yuklash:
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@SERVER_IP
```
**Qanday bo'lishi kerak:**
```
/usr/bin/ssh-copy-id: INFO: 1 key(s) added.
Now try logging into the machine, with: "ssh 'root@SERVER_IP'"
```

### 2-qadam. Serverga kirish va `deploy` foydalanuvchisini yaratish
```bash
ssh root@SERVER_IP

# Yangi foydalanuvchi yaratish (parolni mustahkam kiriting):
adduser deploy

# Foydalanuvchiga sudo huquqini berish:
usermod -aG sudo deploy

# SSH kalitlarni deploy foydalanuvchisiga o'tkazish:
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### 3-qadam. Root va parolli kirishni o'chirish
`/etc/ssh/sshd_config.d/50-security.conf` faylini yarating:
```bash
sudo bash -c 'cat > /etc/ssh/sshd_config.d/50-security.conf << "EOF"
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
X11Forwarding no
MaxAuthTries 3
EOF'

# SSH xizmatini tekshirib qayta yuklash:
sudo sshd -t
sudo systemctl restart ssh
```
> [!CAUTION]
> Joriy SSH seansini yopmasdan, boshqa terminal oynasida `ssh deploy@SERVER_IP` orqali muvaffaqiyatli kira olishingizni sinab ko'ring!

**Qanday bo'lishi kerak:**
`ssh deploy@SERVER_IP` parolsiz, darhol SSH kalit orqali ulanadi; `ssh root@SERVER_IP` esa `Permission denied (publickey)` bilan rad etiladi.

---

## 2. (b) UFW Xavfsizlik Devori va Docker Izolyatsiyasi

Serverning barcha ichki portlarini (PostgreSQL: 5432, Node.js: 3000, Sandbox Daemon: 5055, Lablar: 8080+) tashqi dunyodan qat'iy himoyalash.

```bash
# Standart qoidalar: kiruvchi barcha trafigi bloklanadi, chiquvchi ruxsat beriladi
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Faqat 3 ta xavfsiz port ochiladi
sudo ufw allow 22/tcp comment 'SSH Port'
sudo ufw allow 80/tcp comment 'HTTP Let Encrypt'
sudo ufw allow 443/tcp comment 'HTTPS Caddy'

# Xavfsizlik devorini yoqish:
sudo ufw --force enable
sudo ufw status verbose
```

**Qanday bo'lishi kerak:**
```
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), disabled (routed)

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere                  # SSH Port
80/tcp                     ALLOW IN    Anywhere                  # HTTP Let Encrypt
443/tcp                    ALLOW IN    Anywhere                  # HTTPS Caddy
```

> [!WARNING]
> ### ⚠️ KRITIK XAVFSIZLIK OGOHLANTIRISHI: DOCKER VA UFW O'RTASIDAGI MUNOSABAT
> Docker sukut bo'yicha Linux yadrosining `iptables` tizimidagi `PREROUTING` va `DOCKER` zanjirlariga to'g'ridan-to'g'ri qoidalar kiritadi. Ushbu zanjirlar UFW ning `INPUT` filtrlash qoidalaridan **OLDIN** ishga tushadi!
>
> Shu sababli, agar `docker-compose.yml` faylida biror port `0.0.0.0:5432:5432` yoki shunchaki `5432:5432` deb e'lon qilinsa, **UFW uni bloklay olmaydi va port butun internetga ochiq bo'lib qoladi**!
>
> **CyberEdu loyihasida bu muammo qanday 100% bartaraf etilgan:**
> 1. `docker-compose.yml` da `postgres` va `sandbox-daemon` servislari uchun umuman `ports:` bo'limi yo'q! Ular faqat Dockerning ichki izolyatsiyalangan tarmog'ida (`cyberedu-internal-net`) muloqot qiladi va tashqi xost interfeysiga ulanmaydi.
> 2. `app` (Next.js) porti faqat `127.0.0.1:3000:3000` ga bog'langan (tashqi IP larga ochilmagan).
> 3. Tashqi internetga faqat va faqat Caddy Reverse Proxy (`80:80` va `443:443`) ochiladi.
> 4. Mahalliy dasturlashda qulaylik uchun ishlatiladigan portlar alohida `docker-compose.override.yml` fayliga chiqarilgan bo'lib, u faqat lokal dev muhitida ishlatiladi va production serverga ko'chirilmaydi!
>
> **Xostdagi ochiq portlarni tekshirish buyrug'i (Serverda bajarasiz):**
> ```bash
> sudo ss -tlnp
> ```
> **Kutilgan natija:**
> `0.0.0.0` yoki `[::]` (tashqi interfeyslar) faqat quyidagi portlarni tinglayotgan bo'lishi shart:
> - `:22` (yoki `:2222` — SSH xizmati)
> - `:80` (Caddy HTTP)
> - `:443` (Caddy HTTPS)
> `127.0.0.1:3000` faqat localhost da bo'lishi, `5432` yoki `5055` esa tashqi interfeyslarda aslo ko'rinmasligi shart!

---

## 3. (c) Server Hardening (Avtomatik Yangilanishlar, Fail2ban va No-standart SSH Port)

VPS serverini xakerlik skanerlari, botnetlar va zero-day ekspluatatsiyalardan ko'p qatlamli himoyalash.

### 1. Avtomatik Xavfsizlik Yangilanishlari (unattended-upgrades)
Linux yadrosi va xavfsizlik paketlarini inson omilisiz avtomatik yangilab borishni sozlash:

```bash
# 1. Kerakli paketlarni o'rnatish:
sudo apt-get update
sudo apt-get install -y unattended-upgrades update-notifier-common

# 2. Xavfsizlik yangilanishlarini sozlash:
sudo bash -c 'cat > /etc/apt/apt.conf.d/50unattended-upgrades << "EOF"
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infrastructure-security";
};
Unattended-Upgrade::Package-Blacklist {
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::InstallOnShutdown "false";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-New-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF'

# 3. Kunlik tekshiruv va avtomatik yuklashni faollashtirish:
sudo bash -c 'cat > /etc/apt/apt.conf.d/20auto-upgrades << "EOF"
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
EOF'

# 4. Sinov tariqasida (dry-run) tekshirish:
sudo unattended-upgrades --dry-run --debug
```

**Qanday bo'lishi kerak:**
Buyruq yakunida hech qanday xatosiz `No packages found that can be upgraded unattended` yoki yangilanishlar ro'yxatini ko'rsatadi.

---

### 2. Fail2ban — SSH Brute-Force Hujumlaridan Himoya
SSH ga parolni tanlashga urinayotgan har qanday IP manzilini avtomatik bloklash:

```bash
# 1. Fail2ban o'rnatish:
sudo apt-get install -y fail2ban

# 2. Xavfsiz mahalliy konfiguratsiya yaratish (/etc/fail2ban/jail.local):
sudo bash -c 'cat > /etc/fail2ban/jail.local << "EOF"
[DEFAULT]
bantime  = 1d
findtime = 10m
maxretry = 3
ignoreip = 127.0.0.1/8 ::1
banaction = ufw

[sshd]
enabled  = true
port     = ssh
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 3
bantime  = 1d
EOF'

# 3. Fail2ban servisini yoqish va ishga tushirish:
sudo systemctl enable --now fail2ban
sudo systemctl restart fail2ban

# 4. Fail2ban holatini tekshirish:
sudo fail2ban-client status sshd
```

**Qanday bo'lishi kerak:**
```
Status for the jail: sshd
|- Filter
|  |- Currently failed: 0
|  |- Total failed:     0
|  `- File list:        /var/log/auth.log
`- Actions
   |- Currently banned: 0
   |- Total banned:     0
   `- Banned IP list:
```

---

### 3. Ixtiyoriy: Standart Bo'lmagan SSH Portga O'tish (Masalan, 2222)
Internetdagi minglab avtomatlashgan botlar standart 22-portni doimiy skaner qiladi. Portni 2222 ga o'tkazish loglarni 99% spam-urinishlardan tozalaydi.

> [!CAUTION]
> Ushbu amallarni qat'iy tartibda bajaring. Yangi terminalda ulanishni tekshirmasdan oldingi SSH seansini aslo yopmang!

```bash
# 1-QADAM: Avval yangi portni UFW xavfsizlik devorida oching!
sudo ufw allow 2222/tcp comment 'SSH Custom Port'

# 2-QADAM: SSH konfiguratsiyasiga portni qo'shing:
sudo bash -c 'cat > /etc/ssh/sshd_config.d/50-custom-port.conf << "EOF"
Port 2222
EOF'

# 3-QADAM: Fail2ban konfiguratsiyasini yangi portga moslang:
sudo sed -i 's/port     = ssh/port     = 2222/' /etc/fail2ban/jail.local

# 4-QADAM: Konfiguratsiyani tekshirib, xizmatlarni qayta ishga tushiring:
sudo sshd -t
sudo systemctl restart ssh
sudo systemctl restart fail2ban
```

**Tekshirish (O'z kompyuteringizdagi YANGI terminal oynasida):**
```bash
ssh -p 2222 deploy@SERVER_IP
```
Agar ulanish muvaffaqiyatli bo'lsa, eski 22-portni UFW dan olib tashlang:
```bash
sudo ufw delete allow 22/tcp
```

---

## 4. (d) 2 GB Swap Faylini Sozlash

Contabo VPS NVMe xotirasida 2 GB swap fayl ochish (OOM - Out of Memory holatlaridan himoya).

```bash
# 1. 2 GB hajmida bo'sh fayl ajratish va ruxsatni cheklash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile

# 2. Swap tuzilmasini yaratish va yoqish
sudo mkswap /swapfile
sudo swapon /swapfile

# 3. Server o'chib-yoqqanda avtomatik ulanishi uchun fstab ga yozish
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 4. Swappiness parametrini 10 ga sozlash (faqat RAM 90% to'lganda swap ishlatiladi)
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf

# 5. Holatni tekshirish
free -h
```

**Qanday bo'lishi kerak:**
```
               total        used        free      shared  buff/cache   available
Mem:            11Gi       1.2Gi       8.5Gi        24Mi       1.8Gi       9.8Gi
Swap:          2.0Gi          0B       2.0Gi
```

---

## 5. (e) Docker va Docker Compose O'rnatish

Rasmiy Docker repozitoriysi orqali eng so'nggi barqaror versiyani o'rnatish.

```bash
# 1. Zarur vositalarni o'rnatish
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# 2. Docker rasmiy GPG kalitini yuklash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 3. Repozitoriy qo'shish
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Docker Engine va Docker Compose plaginini o'rnatish
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Deploy foydalanuvchisini docker guruhiga qo'shish (sudo'siz ishlatish uchun)
sudo usermod -aG docker deploy
sudo systemctl enable --now docker

# 6. Tekshirish
docker --version
docker compose version
```

**Qanday bo'lishi kerak:**
```
Docker version 27.x.x, build ...
Docker Compose version v2.x.x
```

---

## 6. (f) DNS Yozuvlarini Bog'lash (Domen va Labs)

> [!IMPORTANT]
> **[Lokal sinab bo'lmaydi]** Ushbu qadam domen registratoringiz (masalan, Cloudflare, Namecheap, GoDaddy yoki cPanel) boshqaruv panelida amalga oshiriladi.

Domen DNS sozlamalariga quyidagi ikkita **A** yozuvini kiriting:

| Turi | Nom (Host) | Qiymat (Points to) | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` (yoki `cyberedu.uz`) | `CONTABO_SERVER_IP` | 300 soniya |
| **A** | `labs` (yoki `labs.cyberedu.uz`) | `CONTABO_SERVER_IP` | 300 soniya |

### DNS yo'nalganligini terminaldan tekshirish:
```bash
dig +short cyberedu.uz
dig +short labs.cyberedu.uz
```
**Qanday bo'lishi kerak:**
Har ikkala buyruq ham sizning Contabo VPS serveringizning aniq tashqi IP manzilini qaytarishi kerak.

---

## 7. (g) Loyihani Serverga Ko'chirish

Loyihani serverga o'tkazishning 2 xil professional usuli mavjud:

### Usul 1 (Tavsiya etiladi): Git orqali kodni olish va serverda ishga tushirish
```bash
# Serverda loyiha papkasini ochish:
cd /home/deploy
git clone <sizning-git-repo-manzilingiz> sayt
cd /home/deploy/sayt
```

### Usul 2: Piped SSH quvuri (Registry talab qilinmaydi)
*(Lokal kompyuteringizdan turib serverga image'larni uzatish)*
```bash
# Lokal mashinada image'larni yig'ish:
docker build -t cyberedu-app:latest .
docker build -t cyberedu-sandbox-daemon:latest ./services/sandbox-daemon
docker build -t cyberedu-weblab:latest ./docker/labs/weblab
docker build -t cyberedu-terminal-sandbox:latest ./docker/labs/terminal

# Siqilgan gzip oqimida serverga yuklash:
docker save cyberedu-app:latest | gzip | ssh deploy@SERVER_IP "gunzip | docker load"
docker save cyberedu-sandbox-daemon:latest | gzip | ssh deploy@SERVER_IP "gunzip | docker load"
docker save cyberedu-weblab:latest | gzip | ssh deploy@SERVER_IP "gunzip | docker load"
docker save cyberedu-terminal-sandbox:latest | gzip | ssh deploy@SERVER_IP "gunzip | docker load"
```

**Qanday bo'lishi kerak:**
Serverda `docker images` buyrug'i `cyberedu-app`, `cyberedu-sandbox-daemon`, `cyberedu-weblab` va `cyberedu-terminal-sandbox` tasvirlari mavjudligini ko'rsatadi.

---

## 8. (h) .env.production va Kriptografik Sirlarni Generatsiya Qilish

Xavfsiz avtomatik skript orqali barcha sirlarni ekranga chiqarmasdan generatsiya qilish:

> [!IMPORTANT]
> ### ⚠️ STANDART QIYMATLAR YO'QLIGI (MAJBURIY TALAB)
> `Caddyfile` va `docker-compose.yml` fayllarida `DOMAIN`, `LABS_DOMAIN` hamda `ACME_EMAIL` uchun **hech qanday standart fallback qiymat yo'q**!
> Agar `.env.production` faylida ushbu o'zgaruvchilar ko'rsatilmasa yoki bo'sh qoldirilsa, Docker Compose hamda Caddy avtomatik ravishda aniq xato bilan ishga tushishdan to'xtaydi (`required variable DOMAIN is missing a value`).
> Shu sababli, quyidagi qadamda domeningiz va emailingizni to'g'ri kiritishingiz shart.

```bash
cd /home/deploy/sayt

# 1. Avtomatik generatorni ishga tushirish (mavjud faylni buzmaydi, ruxsatni 600 qiladi)
chmod +x scripts/generate-secrets.sh
./scripts/generate-secrets.sh .env.production

# 2. Domen va email parametrlarini .env.production ga kiritish:
# Masalan: nano .env.production
# DOMAIN=sizning-domeningiz.uz
# LABS_DOMAIN=labs.sizning-domeningiz.uz
# ACME_EMAIL=admin@sizning-domeningiz.uz

# 3. Production xavfsizlik tekshiruvini ishga tushirish:
npx tsx scripts/verify-production-env.ts
```

**Qanday bo'lishi kerak:**
```
[CyberEdu] '.env.production' fayli muvaffaqiyatli tekshirildi/yangilandi (ruxsat: 600).
✅ [XAVFSIZLIK] Barcha muhit o'zgaruvchilari va sirlar to'liq xavfsizlik talablariga javob beradi.
```

---

## 9. (i) Docker Compose Ishga Tushirish, Seed va Ilk 2FA Sozlash

```bash
cd /home/deploy/sayt

# 1. Konteynerlarni fon rejimida ko'tarish:
docker compose -f docker-compose.yml up -d

# 2. Ishga tushgan konteynerlar holatini tekshirish:
docker compose ps
```

**Qanday bo'lishi kerak:**
```
NAME                           IMAGE                          STATUS                  PORTS
cyberedu-postgres-prod         postgres:16-alpine             Up (healthy)            5432/tcp
cyberedu-sandbox-daemon-prod   cyberedu-sandbox-daemon        Up (healthy)            5055/tcp
cyberedu-app-prod              cyberedu-app                   Up (healthy)            127.0.0.1:3000->3000/tcp
cyberedu-caddy                 caddy:2.8-alpine               Up                      0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

### 3. Administrator Kirishi va 2FA Sozlash
1. Brauzerda `https://sizning-domeningiz.uz/login` sahifasini oching.
2. `.env.production` faylida ko'rsatilgan `ADMIN_INIT_EMAIL` va `ADMIN_INIT_PASSWORD` bilan tizimga kiring:
   *(Parolni ko'rish: `grep 'ADMIN_INIT_PASSWORD=' .env.production | cut -d'=' -f2-`)*
3. Birinchi kirishda darhol **2FA Sozlash ekrani** ochiladi.
4. Telefoningizdagi **Google Authenticator** yoki **Authy** ilovasi orqali ekrandagi SVG QR-kodni skanerlang.
5. Ilova bergan 6 xonali kodni kiriting va **"Tasdiqlash va Yoqish"** tugmasini bosing.
6. Ekranda ko'rsatilgan **10 ta bir martalik zaxira kodni nusxalab, xavfsiz joyda saqlang**.

**Qanday bo'lishi kerak:**
Tasdiqlashdan so'ng darhol `/dashboard` (Administrator boshqaruv paneli) ochiladi.

---

## 10. (j) Avtomatik HTTPS (SSL) Tekshirish

> [!IMPORTANT]
> **[Lokal sinab bo'lmaydi]** Let's Encrypt jonli sertifikatlari faqat haqiqiy DNS va 80/443 portlar ochiq bo'lgandagina olinadi.

Tashqi kompyuterdan HTTPS sertifikati va xavfsizlik sarlavhalarini tekshirish:

```bash
curl -Iv https://sizning-domeningiz.uz
```

**Qanday bo'lishi kerak:**
```
* Server certificate:
*  subject: CN=sizning-domeningiz.uz
*  issuer: C=US; O=Let's Encrypt; CN=R...
*  SSL certificate verify ok.
< HTTP/2 200
< strict-transport-security: max-age=63072000; includeSubDomains; preload
< x-content-type-options: nosniff
< x-frame-options: DENY
< referrer-policy: strict-origin-when-cross-origin
```

---

## 11. (k) Server Crontab (Avtomatik Zaxira va Eslatmalar)

Serverda avtomatik vazifalarni yoqish:

```bash
crontab -e
```
Fayl oxiriga quyidagi 2 ta qatorni qo'shing:

```crontab
# 1. Har 10 daqiqada uy vazifalari va obuna eslatmalarini jo'natish (CRON_SECRET bilan himoyalangan):
*/10 * * * * curl -s -X POST -H "Authorization: Bearer $(grep -E '^CRON_SECRET=' /home/deploy/sayt/.env.production | cut -d'=' -f2- | tr -d '\"')" http://127.0.0.1:3000/api/cron/reminders > /dev/null 2>&1

# 2. Har kecha soat 02:30 da ma'lumotlar bazasi va birikmalar zaxirasini olish (7 kunlik rotatsiya):
30 2 * * * cd /home/deploy/sayt && BACKUP_INCLUDE_ATTACHMENTS=true ./scripts/backup-db.sh >> /var/log/cyberedu-backup.log 2>&1
```

**Qanday bo'lishi kerak:**
`crontab -l` buyrug'i kiritilgan qatorlarni xatosiz ko'rsatadi.

---

## 12. (l) Zaxiralarni Tashqi Xotiraga Nusxalash (Off-Site Backup)

Contabo serveri ishdan chiqqan taqdirda ma'lumotlarni saqlab qolish uchun zaxira nusxalarini tashqi bulutga (Cloudflare R2, S3 yoki ikkinchi zaxira serverga) yuborish.

### rclone orqali S3 / Cloudflare R2 ga sinxronizatsiya:
```bash
sudo apt-get install -y rclone
rclone config # S3 yoki R2 ulanishini 'backup-storage' nomi bilan sozlang

# Zaxira skripti oxiriga yoki crontab'ga sinxronizatsiya buyrug'ini qo'shing:
# Har kuni 03:00 da lokal zaxira papkasini bulutga nusxalash:
0 3 * * * rclone sync /var/backups/cyberedu/ backup-storage:cyberedu-backups/ --fast-list > /dev/null 2>&1
```

**Qanday bo'lishi kerak:**
Lokal `/var/backups/cyberedu/` papkasidagi barcha `.sql.gz` va `attachments_*.tar.gz` arxivlari avtomatik ravishda tashqi xavfsiz omborda paydo bo'ladi.

---

## 13. (m) Tashqi Portlarni nmap Bilan Skanerlash

O'z kompyuteringizdan (tashqaridan) server IP manzilidagi barcha 65535 ta portni to'liq skanerlab, faqat ruxsat etilgan 3 ta port ochiqligini tekshiring:

```bash
nmap -Pn -p- SERVER_IP
```

**Qanday bo'lishi kerak:**
```
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
443/tcp  open  https
```
> [!NOTE]
> 5432 (PostgreSQL), 3000 (Node.js), 5055 (Sandbox Daemon) portlari tashqi dunyodan butunlay yopiq (`filtered` yoki `closed`) bo'lishi shart!

---

## 14. (n) labs. Subdomenida Cookie Izolyatsiyasini DevTools Bilan Tekshirish

Brauzer Developer Tools (F12) orqali kiberxavfsizlik talablarining ishlashini tekshirish:

1. Asosiy domenda login qiling: `https://cyberedu.uz`.
2. F12 ni bosing -> **Application** -> **Cookies** bo'limiga o'ting.
   - `cyberedu_session` cookie'si atributlari:
     - `HttpOnly`: **Ha** (belgilangan)
     - `Secure`: **Ha** (faqat HTTPS)
     - `SameSite`: **Lax**
     - `Domain`: `cyberedu.uz` (hech qanday `.cyberedu.uz` wildcard emas, faqat asosiy domen!).
3. Endi laboratoriya sahifasini oching: `https://labs.cyberedu.uz/...`
   - Konsolda `document.cookie` ni tekshiring: **bo'sh** (hech qanday ota platforma sessiya cookie'si ko'rinmaydi).
   - Iframe `origin` qiymati: `"null"` (Opaque Origin).

**Qanday bo'lishi kerak:**
Laboratoriyadagi har qanday XSS yoki exploit ota platformaning `cyberedu_session` cookie'sini o'g'irlay olmaydi.

---

## 15. (o) Tizimni Yangilash va Orqaga Qaytarish (Rollback)

> [!IMPORTANT]
> Ishlab chiqarish serveriga faqat tekshirilgan rasmiy **Git teglari (Release Tags)** chiqariladi.

### Yangi versiyani chiqarish (Deploy from Tag):
```bash
cd /home/deploy/sayt

# 1. Yangi teglarni olish:
git fetch --tags

# 2. Chiqarilgan rasmiy versiya tegiga o'tish (masalan, v0.2-pilot):
git checkout tags/v0.2-pilot

# 3. Prisma migratsiyalarini qo'llash:
docker compose -f docker-compose.yml run --rm app npx prisma migrate deploy

# 4. Yangilangan servisni to'xtovsiz qayta yig'ish va yuklash:
docker compose -f docker-compose.yml up -d --no-deps --build app
```

### Xatolik yuz berganda orqaga qaytarish (Rollback):
```bash
# 1. Oldingi barqaror versiya tegiga qaytish:
git checkout tags/<OLD_VERSION_TAG>

# 2. Kerak bo'lsa ma'lumotlar bazasini oxirgi zaxiradan tiklash:
./scripts/restore-db.sh /var/backups/cyberedu/cyberedu_backup_YYYYMMDD_HHMMSS.sql.gz

# 3. Konteynerlarni qayta ko'tarish:
docker compose -f docker-compose.yml up -d --build app
```

---

## 16. (p) Monitoring va Muammolarni Aniqlash (Troubleshooting)

### 1. Konteynerlar loglarini kuzatish:
```bash
# Barcha loglar oqimi:
docker compose logs -f --tail=100

# Faqat asosiy veb-ilova loglari:
docker compose logs -f app

# Caddy veb-server loglari:
docker compose logs -f caddy
```

### 2. Resurs sarfi va xotira holatini tekshirish:
```bash
# Konteynerlarning real vaqt CPU va RAM sarfi:
docker stats --no-stream

# Disk to'lganligini tekshirish:
df -h /
```

### 3. Agar 2FA yo'qolsa - Favqulodda Admin Tiklash:
Agar bosh administrator o'z telefonidagi Authenticator kodini yo'qotib qo'ysa:
```bash
cd /home/deploy/sayt
docker compose exec app npx tsx scripts/reset-2fa.ts admin@cyberedu.uz
```
Bu buyruq administratorning 2FA sini o'chiradi, barcha faol sessiyalarni xavfsiz bekor qiladi va audit jurnaliga qayd etadi.

---

## 17. (q) Joylashdan Keyingi Tekshiruv Ro'yxati (Post-Deployment Checklist)

Platformani production muhitida to'liq ishga tushirgandan so'ng, tizimning har bir xavfsizlik va funksional qatlamini tekshirish uchun ushbu jadval va buyruqlardan foydalaning:

| # | Tekshiruv Maqsadi | Terminal Buyrug'i | Kutilgan Natija (Qanday bo'lishi kerak) |
| :-: | :--- | :--- | :--- |
| **1** | **Konteynerlar holati** | `docker compose ps` | Barcha 4 ta asosiy servis (`cyberedu-postgres-prod`, `cyberedu-sandbox-daemon-prod`, `cyberedu-app`, `cyberedu-caddy-prod`) `Up (healthy)` holatida bo'lishi shart |
| **2** | **Xostdagi ochiq portlar (Docker UFW himoyasi)** | `sudo ss -tlnp` | `0.0.0.0` yoki `[::]` tashqi interfeyslarida faqat `:80`, `:443` va SSH (`:22` yoki `:2222`) bo'lishi kerak. `:5432` va `:5055` yo'q, `:3000` esa faqat `127.0.0.1` ga bog'langan |
| **3** | **Tashqi portlar nmap skaneri** | `nmap -Pn -p- <SERVER_IP>` | Faqat 3 ta port ochiq (`80/tcp`, `443/tcp`, SSH). PostgreSQL (5432), Sidecar (5055), App (3000) tashqi dunyoga aslo ko'rinmasligi kerak |
| **4** | **HTTPS va TLS 1.3 sertifikati** | `curl -Iv https://${DOMAIN}` | `HTTP/2 200`, Let's Encrypt / ZeroSSL sertifikati `SSL certificate verify ok`, HSTS `max-age=63072000`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` |
| **5** | **Labs subdomenida cookie izolyatsiyasi** | `curl -s -I https://${LABS_DOMAIN}` | Caddy `header_up -Cookie` qoidasi tufayli ota platformaning `cyberedu_session` cookie'si laboratoriya subdomeniga o'tmasligi |
| **6** | **Tashqaridan Cron API bloklanishi** | `curl -i https://${DOMAIN}/api/cron/reminders` | `HTTP/2 403 Forbidden` ("Kirish taqiqlangan" xabari) |
| **7** | **Localhost orqali Cron ishlashi** | `curl -s -X POST -H "Authorization: Bearer <CRON_SECRET>" http://127.0.0.1:3000/api/cron/reminders` | `HTTP 200` va JSON natija: `{"success":true,"tasks":{...}}` |
| **8** | **Fail2ban SSH himoyasi holati** | `sudo fail2ban-client status sshd` | `Status for the jail: sshd` va `Currently banned` ro'yxati, xizmat faol ishlayotgani |
| **9** | **Avtomatik tizim yangilanishlari** | `systemctl status unattended-upgrades` | `Active: active (running)` holatida bo'lishi |
| **10** | **Sandbox Daemon izolyatsiyasi** | `docker compose exec app curl -s http://sandbox-daemon:5055/health` | `{"status":"ok","activeTerminals":0,"activeWebLabs":0}` |
| **11** | **Baza va birikmalar zaxira nusxasi** | `cd /home/deploy/sayt && ./scripts/backup-db.sh` | `/var/backups/cyberedu/` papkasida `.sql.gz` fayli yaratilishi va `Backup muvaffaqiyatli yakunlandi` chiqishi |
| **12** | **Administrator 2FA tekshiruvi** | Brauzerda `https://${DOMAIN}/login` | Birlamchi admin loginidan so'ng darhol SVG QR-kod va bir martalik 10 ta zaxira kod berilishi |

---

✅ **Tabriklaymiz! CyberEdu platformasi Contabo VPS serverida xalqaro OWASP va kiberxavfsizlik standartlari asosida to'liq ishga tushirildi.**
