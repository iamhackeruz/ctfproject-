# CyberEdu — Professional Kiberxavfsizlik Ta'lim Platformasi

**CyberEdu** — o'zbek tilidagi (lotin yozuvi) interaktiv kiberxavfsizlik, tarmoq va Linux ta'lim platformasi. Platforma o'quv markazlarda, universitetlarda va mustaqil talabalar bilan amaliy kiberxavfsizlik mashg'ulotlarini o'tkazish uchun mo'ljallangan.

Talabalar platformada real zaifliklarni (XSS, SQL Injection, IDOR, Linux eskalatsiya, kriptografiya va tarmoq tahlili) xavfsiz izolyatsiyalangan muhitda tahlil qiladi va bayroqlarni (flag) qo'lga kiritadi.

---

## 🏛️ Arxitektura va Xavfsizlik Modeli

Platforma "Defence-in-Depth" (ko'p qatlamli himoya) konsepsiyasiga tayanadi:
- **Asosiy Ilova (Next.js 16 + React 19 + TypeScript):** App Router, Server Actions va API Route handlers.
- **Kriptografik CSP va Xavfsizlik Sarlavhalari:** Har bir so'rov uchun dinamik kriptografik `nonce` (`script-src 'self' 'nonce-...'`). `unsafe-inline` va `unsafe-eval` butunlay taqiqlangan.
- **Ma'lumotlar Bazasi (PostgreSQL 16 + Prisma):** Tashqi portlarga ochilmagan, qat'iy ichki Docker tarmog'ida ishlaydi.
- **Argon2id Parol Xeshlash:** OWASP tavsiyalari bo'yicha eng yuqori xavfsizlik profili (Memory: 64MB, Iterations: 3, Parallelism: 4).
- **Izolyatsiyalangan Sandbox Sidecar:** Next.js ilovasi `docker.sock` ga bevosita kira olmaydi. Alohida HMAC-imzolangan sidecar xizmati orqali Linux terminal va veb-laboratoriyalar cheklangan huquqda (`read-only`, `cap-drop ALL`, `no-network`, `pids-limit 64`, `tmpfs nosuid/noexec`) ishga tushiriladi.
- **Dinamik Flag Tizimi:** Flaglar qattiq yozilmagan. Ular har bir talaba va har bir lab uchun maxfiy server kaliti bilan dinamik HMAC-SHA256 orqali generatsiya qilinadi: `HMAC(FLAG_SECRET, labId + userId)`.
- **Opaque Origin Sandbox:** Veb-laboratoriyalar iframe ichida `sandbox="allow-scripts allow-forms"` (lekin `allow-same-origin`siz) ochiladi. Natijada ularning origin'i `"null"` bo'lib, platforma cookie va ota DOM ga mutlaqo kira olmaydi.

---

## 📋 Tizim Talablari

- **Operatsion tizim:** Linux (Ubuntu 22.04 LTS / Debian 12 tavsiya etiladi)
- **Node.js:** v20.x yoki v22.x LTS
- **Docker & Docker Compose:** Docker v24+ (Docker Compose v2.20+)
- **PostgreSQL:** v16 (Docker orqali avtomatik o'rnatiladi)
- **Python:** v3.10+ (Veb-laboratoriya konteynerlari uchun)

---

## 🚀 O'rnatish va Tezkor Ishga Tushirish

### 1. Repozitoriyni yuklab olish va paketlarni o'rnatish
```bash
git clone <repo-url> sayt
cd sayt
npm install
```

### 2. Muhit o'zgaruvchilarini sozlash va sirlarni yaratish
Tizimda barcha kriptografik sirlarni `openssl` yordamida avtomatik, xavfsiz va ekranga chiqarmasdan yaratish:
```bash
# Sirlarni avtomatik .env.production fayliga to'ldirish (ruxsat: 600)
chmod +x scripts/generate-secrets.sh
./scripts/generate-secrets.sh .env.production
```
*Eslatma: Skript mavjud kalitlarni o'chirmaydi, faqat yetishmayotganlarini qo'shadi va sirlarni ekranga aslo chiqarmaydi.*

Agar development muhiti uchun kerak bo'lsa:
```bash
cp .env.production.example .env
```

### 3. Docker Sandbox tasvirlarini yig'ish (Images)
```bash
# Terminal laboratoriyasi uchun
docker build -t cyberedu-terminal-sandbox:latest docker/terminal-sandbox

# Veb-laboratoriyalar uchun
docker build -t cyberedu-weblab:latest labs
```

### 4. Sidecar Daemon xizmatini yig'ish
```bash
npx tsc -p services/sandbox-daemon/tsconfig.json
```

### 5. Birinchi Ishga Tushirish (Deploy & First-Run)
Barcha Prisma migratsiyalarini qo'llash, birlamchi administratorni va o'quv dasturini yuklash:
```bash
chmod +x scripts/*.sh
npm run deploy
```

### 6. Platformani Ishga Tushirish
- **Dasturchi rejimida (Development):**
```bash
npm run dev
```
- **Ishlab chiqarish rejimida (Production via Docker Compose):**
```bash
docker compose up -d --build
```

---

## 🏷️ Versiyalash va Serverga Joylash Tartibi (Git Tags Release Workflow)

Xavfsizlik va barqarorlik talablariga muvofiq, **ishlab chiqarish (Production) serveriga faqat tekshirilgan rasmiy Git teglari (Release Tags)** joylanadi. Xom yoki oraliq `main`/`dev` shoxlari production serverga to'g'ridan-to'g'ri deploy qilinmaydi.

### Ishlab chiqish tartibi:
1. Barcha yangi imkoniyatlar, tuzatishlar va o'zgarishlar **`dev`** shoxida olib boriladi.
2. Barcha xavfsizlik va integratsiya testlari (`npm run test:security`) 100% muvaffaqiyatli o'tgandan so'ng, `dev` shoxi `main` shoxiga birlashtiriladi.
3. Yangi versiya tegi belgilanadi (masalan: `git tag -a v0.2.1-pilot -m "CyberEdu Pilot Release v0.2.1-pilot"`).

### Production serverda yangi versiyani chiqarish (Deploy from Tag):
```bash
cd /home/deploy/sayt

# 1. Yangi teglarni olish:
git fetch --tags

# 2. Chiqarilgan barqaror versiya tegiga o'tish (masalan, v0.2.1-pilot):
git checkout tags/v0.2.1-pilot

# 3. Prisma migratsiyalarini qo'llash:
docker compose -f docker-compose.yml run --rm app npx prisma migrate deploy

# 4. Konteynerlarni qayta yig'ish va to'xtovsiz qayta ko'tarish:
docker compose -f docker-compose.yml up -d --build --no-deps app
```

---

## 👨‍🏫 Ustoz va Administrator Qo'llanmasi

### 1. Talabalarni Ro'yxatdan O'tkazish (Taklif Kodlari)
Xavfsizlik talablariga ko'ra, standart holda **OCHIQ RO'YXATDAN O'TISH O'CHIRILGAN** (`ALLOW_PUBLIC_REGISTRATION=false`). Begona shaxslar platformaga kira olmaydi.

Ustoz talabalar uchun bir martalik taklif kodini yaratadi:
- **API orqali:** `POST /api/auth` (`action: "create-invite"`)
- Generatsiya qilingan kod (masalan: `CYBER-INV-9A8B7C`) 7 kun davomida amal qiladi.
- Talaba `/register` sahifasida ushbu taklif kodini kiritib hisob ochadi. Kod ishlatilgandan so'ng avtomatik tarzda bekor qilinadi.

### 2. Test (Quiz) Urinishlarini Qayta Tiklash
Talabalar har bir testni 3 marta topshirish huquqiga ega. 3 ta muvaffaqiyatsiz urinishdan keyin test 24 soatga bloklanadi.
- 24 soat o'tgach urinishlar avtomatik ravishda tiklanadi.
- Agar ustoz dars davomida talabaga qo'shimcha imkoniyat bermoqchi bo'lsa:
  - `DELETE /api/quizzes/[lessonId]?userId=<studentId>` so'rovi yuboriladi.
  - Ushbu amal faqat Ustoz/Admin tomonidan bajariladi va tizim xavfsizlik audit logiga qayd etiladi.

### 3. Parolni Tiklash va Vaqtinchalik Parol Berish
- Agar SMTP konfiguratsiya qilingan bo'lsa, talaba `/forgot-password` orqali 15 daqiqalik bir martalik tasdiqlash kodini oladi.
- Agar SMTP sozlanmagan bo'lsa, ustoz boshqaruv paneli orqali:
  - `POST /api/auth` (`action: "generate-temp-password"`, `studentEmail: "ali@cyberedu.uz"`)
  - Tizim kamida 12 belgili bir martalik parol beradi (`Temp#...`).
  - Talabaning barcha faol sessiyalari xavfsizlik yuzasidan darhol bekor qilinadi.
  - Talaba ushbu parol bilan birinchi marta kirganda, tizim unga parolni o'zgartirishni majburiy qilib qo'yadi (`mustChangePassword: true`).

---

## 📚 Kurslar va Laboratoriyalar Qo'shish Tartibi

### Yangi Kurs yoki Dars Qo'shish
1. Ustoz hisobida tizimga kiring (`role: instructor` yoki `admin`).
2. `/courses` bo'limida yangi kurs yaratish yoki mavjud kursni tahrirlash.
3. Dars materiallari Markdown formatida yoziladi (javascript:, data: protokollari va xom HTML xavfsizlik filtri orqali avtomatik tozalanadi).
4. Har bir darsga kamida 5 ta savoldan iborat test (Quiz) biriktirilishi shart. Savollar variantlari talaba har safar kirganda avtomatik ravishda aralashtirib beriladi (shuffled).

### Yangi Laboratoriya Qo'shish
Platformada 3 turdagi laboratoriyalar mavjud:
1. **Statik Kripto/Tahlil Lablari:** Baza tahlili, hash ochish, steganografiya.
2. **Terminal Lablari (Linux Terminal Sandbox):** Izolyatsiyalangan Linux konteyneri.
3. **Veb-Laboratoriyalar (Vulnerable Web Instances):** XSS, SQLi, IDOR, SSRF kabi zaifliklar.

Laboratoriya flaglari server tomonidan avtomatik dinamik yaratiladi. Talaba topshirgan bayroq `crypto.timingSafeEqual` bilan solishtiriladi, bu esa timing attack hujumlarining oldini oladi.

---

## 💾 Ma'lumotlar Bazasini Zaxiralash va Tiklash

### Zaxiralash (Backup)
Zaxiralash skripti bazani `pg_dump` orqali eksport qilib, `gzip -9` bilan siqadi va 7 kundan eski nusxalarni avtomatik o'chiradi:
```bash
./scripts/backup-db.sh
```
Avtomatik kunlik zaxiralash uchun crontab ga qo'shing:
```bash
0 3 * * * /home/user/sayt/scripts/backup-db.sh >> /var/log/cyberedu-backup.log 2>&1
```

### Qayta Tiklash (Restore)
Favqulodda holatda zaxiradan to'liq qayta tiklash:
```bash
./scripts/restore-db.sh backups/db/cyberedu_db_YYYYMMDD_HHMMSS.sql.gz
```

---

## 📊 Server Holatini Kuzatish (Monitoring)

Platformada server va xizmatlar salomatligini real vaqt rejimida kuzatish uchun maxsus monitoring vositalari mavjud:

### 1. `/api/health` Endpointi (Uptime & Docker Healthcheck)
Tashqi monitoring tizimlari (masalan: Uptime Kuma, Prometheus Blackbox, Datadog) va Docker konteyner healthchecklari uchun mo'ljallangan:
- **URL:** `GET /api/health`
- **Javob (HTTP 200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-11-02T12:00:00.000Z",
  "services": {
    "database": { "status": "up", "latencyMs": 3 },
    "sandboxDaemon": { "status": "up", "latencyMs": 5 },
    "storage": { "status": "ok", "freePercent": 84.5 }
  }
}
```
*Xavfsizlik: Ushbu endpointda hech qanday sirlar, parollar, ichki fayl yo'llari yoki maxfiy ma'lumotlar oshkor qilinmaydi.*

### 2. Administrator Panelida "Server holati" Bo'limi
Admin hisobida `/dashboard` sahifasiga kirib, **"🖥️ Server holati"** bo'limida quyidagilarni jonli ko'rish mumkin:
- **Ma'lumotlar bazasi (PostgreSQL 16):** Ulanish holati, kechikish va jami foydalanuvchilar soni.
- **Sandbox Daemon (Sidecar):** Faol terminal va veb-laboratoriya seanslari soni hamda maksimal limitlar.
- **Disk Xotirasi:** Xost diskining umumiy, ishlatilgan va bo'sh joyi (GB va foizda).
- **Medialar Hajmi:** Dars videolari va topshiriq birikmalari (attachments) egallagan hajm.
- **Zaxiralar va Cron:** Oxirgi avtomatik backup fayli va oxirgi cron eslatmalari ishga tushgan vaqti.
- **Avto-yangilash:** Har 30 soniyada ma'lumotlarni avtomatik yangilash imkoniyati.

---

## 🛠️ Muammolarni Bartaraf Etish (Troubleshooting)

1. **"Xavfsizlik xatosi: Kriptografik maxfiy kalitlar tekshiruvdan o'tmadi"**
   - Sabab: `.env` faylidagi `SESSION_SECRET`, `FLAG_SECRET` yoki boshqa kalitlar 32 baytdan qisqa yoki standart qiymatda qolib ketgan.
   - Yechim: `openssl rand -hex 32` orqali yangi kalitlar generatsiya qiling.

2. **"Laboratoriya bilan aloqa uzildi: Connection refused"**
   - Sabab: Sidecar daemon yoki Docker servisi ishlamayapti.
   - Yechim: `docker ps` ni tekshiring va `npm run daemon` yoki `docker compose restart sandbox-daemon` buyrug'ini bering.

3. **"CSRF tekshiruvi rad etildi: Opaque yoki null Origin ruxsat etilmaydi"**
   - Sabab: Laboratoriya iframe ichidagi XSS skripti platformaning `/api/*` yo'llariga ruxsatsiz so'rov yuborishga uringan.
   - Izoh: Bu xavfsizlik himoyasining to'g'ri ishlayotganini bildiradi. Opaque origindan platforma API lariga kirish taqiqlangan.

4. **Konteynerlar soni limiti (Resource Limit Reached)**
   - Sabab: Global 20 ta terminal yoki 10 ta veb-lab limiti to'lgan.
   - Yechim: Sidecar demoni har 60 soniyada 30 daqiqadan oshgan eskirgan instansiyalarni avtomatik tozalaydi. Zudlik bilan tozalash uchun: `docker rm -f $(docker ps -q -f "label=managed-by=cyberedu")`.

---

## ☁️ Contabo Cloud VPS Deploy Sozlamalari (6 vCPU, 12 GB RAM, NVMe)

Platforma bitta yaxlit VPS server arxitekturasida barqaror va xavfsiz ishlashga to'liq moslashtirilgan.

### 1. Server Resurslari Taqsimoti (Resource Allocation)
- **Umumiy Xotira:** 12 GB RAM + 2 GB Swap (Jami 14 GB virtual xotira)
- **Asosiy Ilova (`cyberedu-app`):** 2 GB RAM (2 vCPU)
- **Ma'lumotlar Bazasi (`postgres`):** 2 GB RAM (2 vCPU)
- **Docker Sandbox Sidecar (`sandbox-daemon`):** 512 MB RAM (1 vCPU)
- **Terminal Sandboxlari:** Maksimal 15 ta faol seans (har biri 128 MB RAM, 0.5 vCPU, tmpfs nosuid/noexec) -> jami ~1.9 GB RAM
- **Veb-Laboratoriya Instansiyalari:** Maksimal 4 ta faol instansiya (har biri 128 MB RAM, 0.5 vCPU) -> jami ~512 MB RAM
- **Tizim va Kesh:** ~5 GB operatsion tizim, Linux kesh va NVMe I/O buferi uchun zaxirada qoladi.

Resurs yetishmaganda yoki barcha slotlar to'lganda, foydalanuvchiga aniq o'zbekcha xabar qaytariladi:
`"Hozirda barcha laboratoriya serverlari band (maksimal limitga yetildi: 4 ta). Iltimos, bir necha daqiqadan so'ng qayta urinib ko'ring yoki faol instansiyangizni yakunlang."`

### 2. Contabo VPS da 2 GB Swap Faylini Sozlash
Serverda xotira to'lib qolib (OOM) konteynerlar to'xtab qolishining oldini olish uchun 2 GB swap sozlash:
```bash
# 1. 2 GB hajmida swapfile yaratish
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile

# 2. Swap tuzilmasini yaratish va yoqish
sudo mkswap /swapfile
sudo swapon /swapfile

# 3. Server qayta yoqilganda (reboot) avtomatik saqlanib qolishi uchun fstab ga yozish
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 4. Swappiness parametrini 10 ga sozlash (faqat xotira yetishmaganda swap ishlatiladi)
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf

# 5. Tekshirish
free -h
swapon --show
```

### 3. Docker Image'larni Lokal Yig'ib Serverga Yuborish Yo'riqnomasi

Contabo VPS da image'larni noldan build qilmasdan, o'z kompyuteringizda yig'ib to'g'ridan-to'g'ri serverga uzatish tavsiya etiladi.

#### Usul A: SSH Quvuri (Piped SSH - Hech qanday Registry talab qilinmaydi)
```bash
# 1. O'z lokal kompyuteringizda barcha Docker image'larni yig'ing:
docker build -t cyberedu-app:latest .
docker build -t cyberedu-sandbox-daemon:latest ./services/sandbox-daemon
docker build -t cyberedu-weblab:latest ./docker/labs/weblab
docker build -t cyberedu-terminal-sandbox:latest ./docker/labs/terminal

# 2. Siqilgan oqim (gzip) orqali to'g'ridan-to'g'ri Contabo serverga yuklang:
docker save cyberedu-app:latest | gzip | ssh root@SERVER_IP "gunzip | docker load"
docker save cyberedu-sandbox-daemon:latest | gzip | ssh root@SERVER_IP "gunzip | docker load"
docker save cyberedu-weblab:latest | gzip | ssh root@SERVER_IP "gunzip | docker load"
docker save cyberedu-terminal-sandbox:latest | gzip | ssh root@SERVER_IP "gunzip | docker load"

# 3. Serverda tekshirish:
ssh root@SERVER_IP "docker images"
```

#### Usul B: Container Registry (GitHub Packages / Docker Hub) orqali
```bash
# 1. Lokal mashinada tag qo'yish va push qilish:
docker tag cyberedu-app:latest ghcr.io/your-username/cyberedu-app:latest
docker push ghcr.io/your-username/cyberedu-app:latest

# 2. Serverda pull qilish:
ssh root@SERVER_IP "docker pull ghcr.io/your-username/cyberedu-app:latest"
```

### 4. Production Xavfsizlik Qoidalari va Server Tekshiruvi
Production muhitida quyidagi qat'iy xavfsizlik arxitekturasi amal qiladi:
1. **Standart Qiymatlar Yo'qligi:** `Caddyfile` va `docker-compose.yml` da `DOMAIN`, `LABS_DOMAIN` va `ACME_EMAIL` uchun hech qanday standart fallback qiymat yo'q. Ushbu o'zgaruvchilar `.env.production` da ko'rsatilmasa, tizim ishga tushmaydi.
2. **Portlar Izolyatsiyasi (Docker UFW Himoyasi):** Tashqi internetga faqat Caddy Reverse Proxy (`80` va `443`) ochilgan. `postgres` va `sandbox-daemon` da hech qanday port ochilmagan (faqat ichki tarmoqda). `app` faqat `127.0.0.1:3000` ga bog'langan. Dev muhit portlari alohida `docker-compose.override.yml` ga chiqarilgan (production'da ishlatilmaydi).
3. **To'liq Yo'riqnoma va Post-Deployment Checklist:** Batafsil bosqichma-bosqich server sozlash, `unattended-upgrades`, `fail2ban`, no-standart SSH port va 12 bandli tekshiruv ro'yxati uchun [`docs/SERVERGA_JOYLASH.md`](docs/SERVERGA_JOYLASH.md) qo'llanmasiga qarang.

---

## 🎬 9-BOSQICH: XAVFSIZ VIDEO DARSLAR TIZIMI (SELF-HOSTED VIDEO STREAMING)

CyberEdu platformasi dars videolarini uchinchi tomon xizmatlariga (YouTube/Vimeo) bog'lanmagan holda, to'liq o'z serverida xavfsiz va tejamkor saqlash va ko'rsatish imkoniyatiga ega. Tizim arxitekturasi kelajakda S3, MinIO, Cloudflare R2 yoki BunnyCDN ga oson ko'chirish (VideoStorage interfeysi orqali) uchun mo'ljallangan.

### 1. Lokal Video Tayyorlash (Serverda Transkodlash YO'Q)
Server CPU va xotirasini tejash maqsadida videolar serverda transkod qilinmaydi. Admin yoki instruktor videoni platformaga yuklashdan oldin ffmpeg yordamida veb uchun optimallashtiradi:
```bash
ffmpeg -i input.mov -c:v libx264 -crf 23 -preset medium -vf "scale=-2:720" -c:a aac -b:a 128k -movflags +faststart output.mp4
```
**Parametrlar tushuntirishi:**
- `-c:v libx264`: Barcha brauzerlar va mobil qurilmalarda 100% qo'llab-quvvatlanuvchi H.264 video kodeki.
- `-crf 23`: Vizual yo'qotishsiz optimal siqish darajasi (18-24 oralig'i standart).
- `-vf "scale=-2:720"`: 720p HD o'lchamga keltirish (traffik va tezlik balansi).
- `-c:a aac -b:a 128k`: Kristall toza ovoz va past tarmoq sarfi.
- `-movflags +faststart`: **Eng muhim parametr** — MP4 faylining metama'lumotlarini (moov atom) fayl boshiga ko'chiradi. Natijada brauzer butun videoni yuklamasdan, darhol (1-soniyadanoq) videoni o'ynatishni boshlaydi.

### 2. Reverse Proxy (Nginx / Caddy) Sozlamalari
Katta hajmdagi videolarni yuklash (1.5 GB gacha) va 206 Partial Content oqimlarini to'g'ri proksilash uchun reverse proxy sozlamalari:

#### Nginx sozlamasi:
```nginx
# /etc/nginx/sites-available/cyberedu.conf
server {
    server_name cyberedu.uz;
    client_max_body_size 1600M; # 1.6 GB limit

    location /api/admin/videos/upload {
        proxy_pass http://127.0.0.1:3000;
        proxy_request_buffering off; # Butun faylni Nginx xotirasiga buferlamasdan Node.js ga oqimlaydi
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        client_max_body_size 1600M;
    }

    location /api/videos/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_buffering off; # Video oqimida kechikish bo'lmasligi uchun
        proxy_set_header Range $http_range;
        proxy_set_header If-Range $http_if_range;
        proxy_cache off;
    }
}
```

#### Caddy sozlamasi:
```caddy
cyberedu.uz {
    request_body {
        max_size 1600MB
    }

    reverse_proxy 127.0.0.1:3000 {
        flush_interval -1 # Oqimli streaming uchun buferlashni o'chirish
    }
}
```

### 3. Server Diskini Kuzatish (Disk Monitoring & Alerts)
Videolar `/app/data/videos` (yoki `VIDEO_DIR`) katalogida saqlanadi. Disk to'lib qolishining oldini olish uchun monitoring o'rnatiladi:
```bash
# 1. Disk bo'sh joyini tekshirish
df -h /var/lib/docker/volumes

# 2. Avtomatik monitoring skripti (cron orqali har 6 soatda):
# /usr/local/bin/check_disk.sh
#!/bin/bash
USAGE=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$USAGE" -gt 85 ]; then
  echo "OGOHLANTIRISH: Server diski 85% dan oshdi ($USAGE%). Keraksiz videolarni tozalang." | mail -s "Disk Alert" admin@cyberedu.uz
fi
```

### 4. Avtorizatsiya: Sessiya Cookie vs 10 daqiqalik Imzolangan Token
Platforma ikkala usulni ham qo'llab-quvvatlaydi, biroq asosiy tizim sifatida **HttpOnly Session Cookie + canAccess** tanlandi:
- **Sessiya Cookie (Tanlangan asosiy usul):** Brauzer HTML5 `<video src="/api/videos/[id]/stream">` so'rovlarida `cyberedu_session` cookie'sini avtomatik jo'natadi. Bu orqali URL manzillarida hech qanday maxfiy token ko'rinmaydi (brauzer tarixi, referer yoki proksi loglariga oqib ketmaydi). Eng asosiysi: administrator talabani bloklaganida yoki obunani bekor qilganida, sessiya darhol rad etiladi va video o'sha soniyaning o'zidayoq to'xtaydi.
- **10 daqiqalik Imzolangan Token (Qo'shimcha usul):** `generateSignedVideoToken(userId, lessonId, 10m)` orqali kelajakda BunnyCDN yoki S3 orqali qisqa muddatli imzolangan havolalar yaratish uchun tayyorlandi.

### 5. Videolar Zaxira Nusxasi (Backup)
Baza zaxirasiga videolarni ham qo'shib olish uchun muhit o'zgaruvchisi yoqiladi:
```bash
BACKUP_INCLUDE_VIDEOS=true ./scripts/backup-db.sh
```

---

## 📝 10-Bosqich: Uy Vazifalari, Davomat va Telegram Bildirishnomalar

### 1. Uy Vazifalari (Assignments & Submissions)
- **Modellar va Huquqlar:** `Assignment`, `Submission`, `SubmissionHistory`, `AssignmentExtension`.
- **Muddat va Kechikish:** Standart muddat (`dueAt`), kechikkan topshirish ruxsati (`allowLateSubmission`) va kechikish jarima foizi (`latePenaltyPercent`). Shaxsiy uzaytirish imkoniyati (`AssignmentExtension`).
- **Fayl Yuklash Xavfsizligi:**
  - `ATTACHMENTS_DIR` (standart `data/attachments` yoki `/app/data/attachments`), maksimal hajm 10 MB (`MAX_ATTACHMENT_SIZE_BYTES`).
  - Fayl formati faqat kengaytma orqali emas, serverda **magic-bytes** orqali tekshiriladi (PDF, ZIP, PNG, JPG, TXT, MD, PY, SH).
  - PE (`.exe`), ELF ikkilik fayllar, HTML, SVG, PHP va null-baytli binar inyeksiyalar qat'iy rad etiladi.
  - Original fayl nomi o'rniga 48-belgili kriptografik tasodifiy nom (`generateAttachmentKey`) bilan yopiq papkada saqlanadi.
  - Yuklab olishda `Content-Disposition: attachment; filename="sanitized_name"` va `nosniff` sarlavhalari qo'llaniladi.
  - IDOR himoyasi: talaba faqat o'z topshirig'i faylini, ustoz/admin esa o'z guruhidagi topshiriqlarni yuklab oladi.
- **Ko'p Versiyalilik va Baholash:** Muddatgacha qayta topshirish mumkin (oldingi variantlar `SubmissionHistory` da saqlanadi). Ustoz baho qo'yishi (`GRADED`) yoki qayta topshirish uchun izoh bilan qaytarishi (`RETURNED`) mumkin.
- **CSV Eksport:** Baholar jadvali eksport qilinganda `=,+,-,@,\t,\r` belgilari bilan boshlanuvchi formula inyeksiyalari apostrof (`'`) bilan xavfsizlantiriladi.

### 2. Davomat Tizimi (Attendance Management)
- **Guruh Darslari:** `ClassSession` (sana, mavzu, guruh).
- **Tezkor Belgilash:** Guruh talabalarini bir bosishda "Hammasi qatnashdi" qilish yoki har biriga alohida status (`PRESENT`, `ABSENT`, `LATE`, `EXCUSED`) qo'yish (batch upsert).
- **Statistika va Xavf Ogohlantirishi:** Talaba 3 marta yoki undan ko'p sababsiz dars qoldirsa, tizim `isAtRisk` deb belgilaydi va qizil ogohlantirish ko'rsatadi. Talaba o'z profilida shaxsiy davomat foizini va qoldirilgan darslar ro'yxatini ko'ra oladi.
- **CSV Eksport:** Davomat hisoboti formula inyeksiyasidan himoyalangan CSV formatida eksport qilinadi.

### 3. Telegram Bot Bildirishnomalari va Webhook
- **Muhit O'zgaruvchilari:**
  ```env
  TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
  TELEGRAM_BOT_USERNAME="CyberEduUzBot"
  TELEGRAM_WEBHOOK_SECRET="kriptografik_tasodifiy_hex_kalit"
  ```
- **Webhook O'rnatish Buyrug'i:**
  ```bash
  curl -F "url=https://cyberedu.uz/api/telegram/webhook" \
       -F "secret_token=TELEGRAM_WEBHOOK_SECRET" \
       https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook
  ```
- **Xavfsiz Bog'lash:** Talaba sozlamalar bo'limida 6 belgili bir martalik 10 daqiqalik kod generatsiya qiladi. Botga `/start <KOD>` yuborilganda profil Telegram bilan bog'lanadi. Bog'lanishni istalgan vaqtda uzish mumkin (`/stop` yoki saytdagi tugma orqali).
- **Maxfiy Ma'lumotlarni Niqoblash (Privacy Scrubbing):** Telegramga bildirishnoma yuborishdan oldin matndagi parollar, CTF flaglari (`FLAG{******}`) va email manzillari (`u***@domain.uz`) avtomatik niqoblanadi.
- **Asinxron Navbat va Rate Limit:** Xabarlar `Notification` jadvaliga `PENDING` sifatida tushadi, Telegram API limiti bo'yicha (sekundiga 25 so'rov) xavfsiz yetkaziladi.
- **Sayt Ichidagi Qo'ng'iroqcha:** Yuqori menyuda yangi bildirishnomalar soni ko'rsatkichli `NotificationBell` mavjud, dars va vazifa xabarlari bir zumda ko'rinadi.

### 4. Birikmalar Zaxirasi (Backup Attachments)
Baza zaxirasiga topshiriq birikmalarini ham qo'shib olish:
```bash
BACKUP_INCLUDE_ATTACHMENTS=true ./scripts/backup-db.sh
```

---

## 🔐 11-Bosqich: Ikki Bosqichli Autentifikatsiya (2FA TOTP) va Eslatmalar

### 1. Ikki Bosqichli Autentifikatsiya (TOTP)
- **Rollar bo'yicha majburiylik:** `admin`, `instructor`, `accountant` rollari uchun birinchi kirishdayoq 2FA ulash majburiy. `student` roli uchun esa ixtiyoriy (profil sozlamalarida yoqish/o'chirish mumkin).
- **Google Authenticator & Authy mosligi:** QR-kod SVG formatida va matnli Base32 maxfiy kalit ko'rsatiladi. Standart RFC 6238 TOTP (30 soniya, 6 raqam, SHA1).
- **AES-256-GCM Shifrlash:** Barcha TOTP maxfiy kalitlari bazada `TOTP_ENCRYPTION_KEY` orqali AES-256-GCM usulida shifrlangan holda saqlanadi.
- **Replay & Time Skew Himoyasi:** Bir 30 soniyalik darcha ichida foydalanilgan kod qayta qabul qilinmaydi (`twoFactorLastUsedStep`). Vaqt tafovuti ±1 qadam (±30 soniya).
- **Brute-Force & Lockout:** Ketma-ket 5 ta noto'g'ri kod urinishidan so'ng hisob 15 daqiqaga bloklanadi.
- **Zaxira Kodlari (Backup Codes):** Har bir hisob uchun 10 ta bir martalik zaxira kod beriladi (`XXXX-XXXX`). Bazada SHA-256 xesh ko'rinishida saqlanadi va bir marta ishlatilgach bekor qilinadi.
- **Favqulodda Tiklash (Emergency Admin Reset):**
  Agar administrator o'zining TOTP qurilmasini yo'qotsa, server konsolida favqulodda tiklash skripti mavjud:
  ```bash
  ADMIN_RESET_TOKEN="kriptografik_maxfiy_token" npx tsx scripts/reset-2fa.ts admin@cyberedu.uz
  ```
  Skript 2FA ni o'chiradi, barcha faol sessiyalarni bekor qiladi va audit logiga yozadi.

### 2. Muddat Eslatmalari va Idempotent Rejalashtiruvchi (Scheduler)
- **Eslatmalar:**
  - Uy vazifasi muddatiga 24 soat va 2 soat qolganda topshirmagan talabalarga eslatma.
  - Premium yoki guruh orqali berilgan kurs huquqi tugashiga 3 kun qolganda talabaga eslatma.
  - Yangi topshiriq topshirilganda mas'ul ustozga bildirishnoma.
- **Idempotentlik:** Har bir eslatma bazada `dedupKey` bo'yicha yagona bo'lib, qayta ishga tushganda yoki server o'chib-yoqqanda hech qachon takroriy xabar chiqarmaydi.
- **Ishga tushirish (Cron):**
  ```bash
  curl -X POST http://127.0.0.1:3000/api/cron/reminders -H "Authorization: Bearer $CRON_SECRET"
  ```

### 3. Server Crontab Konfiguratsiyasi (Tayyor Qatorlar)
Serverda `crontab -e` buyrug'ini ochib, quyidagi qatorlarni joylashtiring:
```bash
# 1. Har 10 daqiqada muddat eslatmalarini qayta ishlash:
*/10 * * * * curl -s -X POST -H "Authorization: Bearer $(grep -E '^CRON_SECRET=' /home/user/porftfolio/sayt/.env.production | cut -d'=' -f2- | tr -d '\"')" http://127.0.0.1:3000/api/cron/reminders > /dev/null 2>&1

# 2. Har kecha soat 02:30 da ma'lumotlar bazasi va birikmalar zaxirasini olish (7 kunlik avtomatik rotatsiya):
30 2 * * * cd /home/user/porftfolio/sayt && BACKUP_INCLUDE_ATTACHMENTS=true ./scripts/backup-db.sh >> /var/log/cyberedu-backup.log 2>&1
```

---

## 🧪 Xavfsizlik va Brauzer Testlarini Ishga Tushirish

Barcha 6 bosqichli xavfsizlik auditi, IDOR, RBAC, HMAC flag, Docker izolyatsiyasi va haqiqiy Chromium Playwright testlarini tekshirish:
```bash
npm run test:security
```
TypeScript va Sintaksis tekshiruvi:
```bash
npm run lint
npm run build
```
