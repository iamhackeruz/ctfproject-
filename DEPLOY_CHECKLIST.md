# CyberEdu Platform — Ishlab Chiqarishga Chiqarishdan Oldingi Kiberxavfsizlik va Operatsion Tekshiruv Ro'yxati (DEPLOY_CHECKLIST.md)

Ushbu ro'yxat platformani real serverga (Production) o'rnatishdan oldin **har bir bandi qat'iy tekshirilishi shart bo'lgan 25 ta kiberxavfsizlik va tizim tekshiruvlarini** o'z ichiga oladi.

Har bir band yonidagi `[ ]` belgisini faqat tekshiruv muvaffaqiyatli o'tgandan so'ng `[x]` ga o'zgartiring.

---

## 🔐 1. Kriptografiya va Maxfiy Kalitlar (Secrets Management)

- [ ] **1. `.env` fayli Git nazoratidan chiqarilganligi:**
  - *Tekshirish buyrug'i:* `git status --ignored | grep .env` va `git check-ignore .env`
  - *Kutilgan natija:* `.env` git tomonidan kuzatilmaydi va `.gitignore` ro'yxatida mavjud.

- [ ] **2. Git tarixida hech qanday maxfiy kalitlar qolib ketmaganligi:**
  - *Tekshirish buyrug'i:* `gitleaks git --verbose`
  - *Kutilgan natija:* `0 leaks found`. Tarixda API tokenlar, parollar yoki private kalitlar yo'q.

- [ ] **3. Barcha kriptografik sirlar mustaqil va yuqori entropiyaga egaligi:**
  - *Tekshirish:* `SESSION_SECRET`, `FLAG_SECRET`, `TICKET_SECRET`, `SIDECAR_SECRET` har biri `openssl rand -hex 32` orqali alohida generatsiya qilingan (kamida 64 hex belgi).
  - *Kutilgan natija:* Hech bir kalit default ("test", "secret") holatda emas.

- [ ] **4. Dinamik HMAC-SHA256 Flaglar:**
  - *Kutilgan natija:* `FLAG_SECRET` serverda saqlanadi, konteyner ichiga yoki mijozga aslo uzatilmaydi.

---

## 👤 2. Autentifikatsiya, Avtorizatsiya va Rollar (Auth & RBAC)

- [ ] **5. Standart holda ochiq ro'yxatdan o'tish yopiqligi:**
  - *Kutilgan natija:* `.env` da `ALLOW_PUBLIC_REGISTRATION=false`. Ro'yxatdan o'tish faqat o'quv markaz ustozining taklif kodi (`invitation_codes`) orqali mumkin.

- [ ] **6. Parollarni xeshlashda Argon2id qo'llanilishi:**
  - *Kutilgan natija:* MD5, SHA256 yoki bcrypt o'rniga zamonaviy Argon2id (Memory: 64MB, Iterations: 3, Parallelism: 4) ishlatilmoqda. Minimal parol uzunligi 10 belgi.

- [ ] **7. Autentifikatsiya Brute-force va Lockout himoyasi:**
  - *Kutilgan natija:* Ketma-ket 5 ta noto'g'ri urinishdan so'ng hisob 15 daqiqaga bloklanadi. Parol xato bo'lganda ham, foydalanuvchi mavjud emasligida ham bir xil neytral javob beriladi.

- [ ] **8. Sessiya cookie'larining qat'iy atributlari:**
  - *Kutilgan natija:* `cyberedu_session` cookie'si: `HttpOnly=true`, `Secure=true`, `SameSite=Lax`. JavaScript orqali o'qib bo'lmaydi.

- [ ] **9. Barcha mutatsion yo'llarda server tomonidagi RBAC tekshiruvi:**
  - *Kutilgan natija:* `/api/courses/*`, `/api/quizzes/*`, `/api/admin/*` marshrutlarida har bir so'rov bo'yicha serverda rol (`admin` / `instructor`) tekshiriladi.

---

## 🛡️ 3. Veb-Xavfsizlik va Izolyatsiya (Web Security & Sandboxing)

- [ ] **10. Strict Nonce Content Security Policy (CSP):**
  - *Kutilgan natija:* `script-src 'self' 'nonce-${random}'`. `unsafe-inline` va `unsafe-eval` platforma asosiy sahifalarida QAT'IY YO'Q.

- [ ] **11. Opaque Origin Web-Lab Sandboxing:**
  - *Kutilgan natija:* Veb-laboratoriyalar iframe CSP'sida `sandbox allow-forms allow-scripts;` mavjud, lekin `allow-same-origin` YO'Q. Iframe ichida `window.origin === "null"`.

- [ ] **12. CSRF Himoyasi va Opaque Origin Bloklash:**
  - *Kutilgan natija:* `verifyCsrf` funksiyasi `Origin: null` so'rovlarini 403 Forbidden bilan bloklaydi. Lab ichidagi XSS skripti platforma API lariga mutatsion so'rov yubora olmaydi.

- [ ] **13. XSS ga qarshi Markdown xavfsiz renderlash:**
  - *Kutilgan natija:* Dars matnlarida `javascript:`, `data:` havolalari, xom HTML va begona domen rasmlari filtrlanadi.

- [ ] **14. SSRF Himoyasi:**
  - *Kutilgan natija:* Lab proksisi mijozdan hech qanday `host`, `port` yoki `url` parametrlarini qabul qilmaydi. Portlar faqat serverdagi DB yozuvidan olinadi (6001-6200 oralig'i).

---

## 🐳 4. Konteynerlar va Docker Xavfsizligi (Docker Hardening)

- [ ] **15. Next.js ilovasining docker.sock ga ulanmaganligi:**
  - *Kutilgan natija:* Asosiy Next.js ilovasi `docker.sock` fayliga kira olmaydi. Docker bilan faqat alohida Sidecar xizmati ishlaydi.

- [ ] **16. Sidecar HMAC imzosi va so'rovlar validatsiyasi:**
  - *Kutilgan natija:* Next.js va Sidecar o'rtasidagi barcha aloqa `x-sidecar-signature` (HMAC-SHA256) va vaqt tamg'asi (`x-sidecar-timestamp`) bilan himoyalangan.

- [ ] **17. Rootless Docker yoki `userns-remap` yoqilganligi:**
  - *Kutilgan natija:* Xost `/etc/docker/daemon.json` faylida `"userns-remap": "dockremap"` yoki Rootless rejim yoqilgan.

- [ ] **18. Konteyner resurslari va huquqlarini cheklash:**
  - *Kutilgan natija:* Har bir talaba konteyneri: `--network none` (terminal uchun), `--read-only`, `--cap-drop ALL`, `--pids-limit 64`, `--tmpfs /tmp:nosuid,noexec,size=32m`, `--user 10001:10001`.

- [ ] **19. Global instansiyalar limiti va yetimlarni tozalash (Contabo Cloud VPS):**
  - *Kutilgan natija:* Terminal uchun maksimal 15 (`MAX_TERMINALS=15`), veb-lab uchun maksimal 4 (`MAX_WEB_LABS=4`) global konteyner. Resurs to'lganda aniq o'zbekcha xabar chiqadi. 30 daqiqadan oshgan konteynerlar avtomatik o'chiriladi.

---

## ☁️ 7. Contabo Cloud VPS (6 vCPU, 12 GB RAM, NVMe) va Operatsion Sozlamalar

- [ ] **26. 2 GB Swap Faylining Faolligi:**
  - *Tekshirish buyrug'i:* `free -h` va `swapon --show`
  - *Kutilgan natija:* `/swapfile` kamida 2.0G hajmda faol, `swappiness=10`, `/etc/fstab` ga yozilgan.

- [ ] **27. Konteyner Xotira Limitlari (docker-compose.yml):**
  - *Kutilgan natija:* `app`: 2048M (2 vCPU), `postgres`: 2048M (2 vCPU), `sandbox-daemon`: 512M (1 vCPU).

- [ ] **28. Docker Image'larni Lokal Yig'ib Serverga Yuborish (Save/Load yoki Registry):**
  - *Kutilgan natija:* Serverda to'g'ridan-to'g'ri og'ir build qilmasdan, lokal `docker save | gzip | ssh ... docker load` orqali tayyor tasvirlar yuklangan.

- [ ] **29. Serverda Tekshirish Kerak Bo'lgan Holatlar (Server Verification):**
  - [ ] DNS A yozuvlari `cyberedu.uz` va `labs.cyberedu.uz` uchun to'g'ri yo'naltirilgan.
  - [ ] Wildcard/SAN SSL sertifikatlari HTTPS rejimida muvaffaqiyatli ishlamoqda.
  - [ ] `labs.cyberedu.uz` dagi cookie stripping tekshirilgan.
  - [ ] 15 ta terminal va 4 ta web lab bir vaqtda ishga tushirilganda RAM va Swap holati tekshirilgan.

---

## 🌐 5. Tarmoq va Infratuzilma (Network & Infrastructure)

- [ ] **20. Ichki xizmatlar tashqi portlarga ochilmaganligi:**
  - *Tekshirish:* `docker-compose.yml` da `postgres` va `sandbox-daemon` bo'limlarida `ports:` qatori yo'q. Ular faqat `cyberedu-internal-net` tarmog'ida ishlaydi.

- [ ] **21. Xost Xavfsizlik Devori (UFW):**
  - *Tekshirish buyrug'i:* `sudo ufw status verbose`
  - *Kutilgan natija:* Standart siyosat `deny incoming`, faqat 22, 80 va 443 portlariga ruxsat berilgan.

- [ ] **22. SSH Kalitlari va Xavfsiz Kirish:**
  - *Kutilgan natija:* `/etc/ssh/sshd_config` da `PasswordAuthentication no` va `PermitRootLogin no`.

- [ ] **23. Reverse Proxy (Caddy / Nginx) va Cookie Tozalash:**
  - *Kutilgan natija:* TLS 1.2+ va HSTS faol. `labs.cyberedu.uz` subdomeniga o'tayotgan so'rovlardan platforma cookie'lari (`cyberedu_session`) proksi darajasida tozalanadi.

---

## 💾 6. Operatsion Tayyorgarlik va Zaxiralash (Operations & Backups)

- [ ] **24. Avtomatik Zaxiralash (Backup) va Tiklash Sinovi:**
  - *Tekshirish buyrug'i:* `./scripts/backup-db.sh` va `./scripts/restore-db.sh backups/db/<file> --force`
  - *Kutilgan natija:* Zaxira gzip bilan muvaffaqiyatli olinadi, 7 kunlik rotatsiya ishlaydi, bazani qayta tiklash 0 xato bilan o'tadi.

- [ ] **25. Loglar va Resurslarni Nazorat Qilish:**
  - *Kutilgan natija:* `audit.log` fayli 2MB dan oshganda avtomatik rotatsiya qilinadi (maksimal 5 ta arxiv). Barcha Docker konteynerlarida `max-size: 10m` log limiti belgilangan.

- [ ] **26. Video Xotirasi va Oqimli Yuklash Tayyorgarligi (9-bosqich):**
  - *Tekshirish buyrug'i:* `BACKUP_INCLUDE_VIDEOS=true ./scripts/backup-db.sh` va `df -h /var/lib/docker/volumes`
  - *Kutilgan natija:* Reverse proxy (Nginx `client_max_body_size 1600M` yoki Caddy `request_body max_size 1600MB`) o'rnatilgan, video yuklash va 206 Range streaming buferlanmasdan to'g'ridan-to'g'ri o'tadi, video zaxiralari tar.gz bilan arxivlanadi.

- [ ] **27. Uy Vazifalari Birikmalari Xavfsizligi va Xotirasi (10-bosqich):**
  - *Tekshirish:* `ATTACHMENTS_DIR` mavjudligi (Docker da `cyberedu_prod_attachments` volume), maksimal hajm 10 MB cheklovi, magic-bytes validatsiyasi (PDF, ZIP, PNG, JPG, TXT, MD, PY, SH) va IDOR yuklab olish himoyasi.
  - *Kutilgan natija:* PE/ELF ikkilik fayllar, HTML/SVG/PHP skriptlar bloklanadi, barcha fayllar 48-belgili tasodifiy nom bilan yopiq papkada saqlanadi.

- [ ] **28. Telegram Bot Webhook va Xabarlar Xavfsizligi (10-bosqich):**
  - *Tekshirish buyrug'i:* `curl -F "url=https://cyberedu.uz/api/telegram/webhook" -F "secret_token=$TELEGRAM_WEBHOOK_SECRET" https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook`
  - *Kutilgan natija:* Telegram Webhook `X-Telegram-Bot-Api-Secret-Token` sarlavhasini tekshiradi, soxta webhook so'rovlari 401 bilan rad etiladi, xabarlardagi parollar, CTF flaglari va emaillar niqoblanadi (privacy scrubbing).

- [ ] **29. Ikki Bosqichli Autentifikatsiya (2FA TOTP) va Favqulodda Tiklash (11-bosqich):**
  - *Tekshirish:* `TOTP_ENCRYPTION_KEY` kamida 32 belgi va boshqa maxfiy kalitlardan mustaqil. Admin, instructor va accountant rollari uchun 2FA majburiy.
  - *Favqulodda tiklash:* Agar admin TOTP qurilmasi yo'qolsa: `ADMIN_RESET_TOKEN=<secret> npx tsx scripts/reset-2fa.ts <admin_email>` orqali tiklanadi (barcha sessiyalar bekor qilinadi, audit log yoziladi).

- [ ] **30. Eslatmalar Fon Vazifasi va Birikmalar Zaxirasi (11-bosqich):**
  - *Tekshirish:* `BACKUP_INCLUDE_ATTACHMENTS=true ./scripts/backup-db.sh` orqali talaba birikmalari avtomatik arxivlanadi.
  - *Cron Rejalashtiruvchi:* Crontab da har soatda `/api/cron/reminders` chaqiriladi: `0 * * * * curl -s -X POST http://127.0.0.1:3000/api/cron/reminders -H "Authorization: Bearer $CRON_SECRET" > /dev/null`. Idempotent (takroriy xabar yubormaydi).

---

## 🚀 Ishga Tushirish Tasdiqi

Yuqoridagi barcha 30 ta band to'liq bajarilgandan so'ng, tizimni ishlab chiqarishga chiqarish buyrug'i:

```bash
# 1. Sinov testlari
npm run test:security
npm run lint
npm run build

# 2. Deploy va Ma'lumotlar bazasi
./scripts/deploy-first-run.sh

# 3. Konteynerlarni fon rejimida ko'tarish
docker compose up -d
```
