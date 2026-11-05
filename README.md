# 🚩 Kiberxavfsizlik CTF v2 — Korporativ Kiberxavfsizlik Arenasi & Jonli Hujum Matritsasi

Ushbu platforma zamonaviy korporativ infratuzilmalarni tahlil qilish, penetratsion testlash (Web Pentest), OSINT va xavfsizlik hisobotlarini tuzish ko'nikmalarini amaliy baholash uchun maxsus ishlab chiqilgan **3 bosqichli professional CTF musobaqa tizimidir**.

---

## 🏆 1. Musobaqa Bosqichlari (3-Tier Competition Lifecycle)

```
[1. Ro'yxatdan o'tish] (Telegram Bot /start yoki Admin orqali)
        │
        ▼
[1-BOSQICH: Linux Asoslari va Tizim Auditi] (SSH orqali ~/apex_corp)
  • 7 ta amaliy vazifa: Yashirin fayllar (ls -la), Loglar (tail), Qidiruv (grep), Fayl qidirish (find), Ruxsatlar (chmod), Arxiv (tar), Git tarixi (git log).
  • Har bir topshiriq uchun 50-100 balldan (Jami: 500 ball) va 2-bosqichga kirish ma'lumotlari (asmith : spring2026).
        │
        ▼
[2-BOSQICH: Web Pentest — 10 ta OWASP Zaiflik Matrixi] (Apex Global Technologies)
  • 10 ta realistik korporativ zaiflik (100 balldan 500 ballgacha). Jami: 3000 ball.
  • Katta Ekranda (Projektor) har bir zaiflik yechilganda Neon Yashil katakcha to'ladi!
  • Kamida 1200 ball to'plagan talaba avtomatik ravishda 3-bosqichga yo'l oladi.
        │
        ▼
[3-BOSQICH: Professional Hisobot (Proof of Work & Remediation)]
  • Topilgan zaifliklar bo'yicha PoC, CVSS ta'siri va tuzatish tavsiyalari yoziladi.
  • Hisobot (.docx / .pdf) bot yoki veb orqali hakamlarga yuboriladi (0-1000 hakam balli).
```

---

## 🎯 2. 2-Bosqich: 10 ta Web Zaifliklar va Flaglar Matritsasi (Jami 3000 ball)

| # | Kod | Zaiflik Turi | Qiyinchilik | Ball | Zaif Endpoint | Ekspluatatsiya va Flag |
|---|---|---|---|---|---|---|
| 1 | **V1** | Information Disclosure | Oson | **100** | `/.git/HEAD` | Ochiq git papkasidan commit tahlili: `FLAG{v2_infoleak_git_exposed_91a2}` |
| 2 | **V2** | User Enumeration (OSINT) | Oson | **150** | `/login` | Xatolik va sarlavha (X-Sec-Flag) tahlili: `FLAG{v2_user_enum_apex_sec_83b1}` |
| 3 | **V3** | Rate-Limit Bypass & Auth | O'rta | **200** | `/portal/staff-login` | `X-Forwarded-For` va `asmith:spring2026`: `FLAG{v2_auth_bypass_headers_77c2}` |
| 4 | **V4** | IDOR | O'rta | **250** | `/portal/employee/contract?id=1` | Direktor (CEO) shartnomasi va kodi: `FLAG{v2_idor_confidential_contract_66d4}` |
| 5 | **V5** | Stored XSS | O'rta | **250** | `/support/ticket` | Formaga XSS payload yuborib cookie o'g'irlash: `FLAG{v2_stored_xss_cookie_theft_55e5}` |
| 6 | **V6** | LFI / Path Traversal | Qiyin | **300** | `/download?doc=../../vault/.env.vault` | Ichki server fayli `.env.vault` ni o'qish: `FLAG{v2_lfi_path_traversal_master_44f6}` |
| 7 | **V7** | SQL Injection (UNION) | Qiyin | **350** | `/services/search?q=' UNION...` | `enterprise_secrets` jadvalini tortib olish: `FLAG{v2_sqli_union_secret_extract_33g7}` |
| 8 | **V8** | Insecure File Upload | Qiyin | **400** | `/careers/apply` | Rezyume formasiga webshell yuklash bypass: `FLAG{v2_fileupload_bypass_webshell_22h8}` |
| 9 | **V9** | Privilege Escalation (JWT) | Kritik | **500** | `/admin/executive-board` | JWT tokenda `"role": "superadmin"` qilish: `FLAG{v2_priv_esc_jwt_admin_takeover_11i9}` |
| 10 | **V10** | RCE / Command Injection | Kritik | **500** | `/admin/diagnostics/ping` | Tarmoq pingida `cat vault/master_flag.txt`: `FLAG{v2_rce_apex_vault_breach_00j0}` |

* **3-bosqichga o'tish chegarasi:** **1200 ball** (talaba kamida 4-5 ta osonroq yoki 2-3 ta qiyinroq zaiflikni topsa, 3-bosqich ochiladi).

---

## 📺 3. Katta Ekran (Projektor) Jonli Hujum Matritsasi

Zalga yoki auditoriyaga monitor/projektor orqali qo'yish uchun mo'ljallangan:
* **Manzil:** `http://<server-ip>:8080`
* **Xususiyatlari:**
  * **To'liq Ekran (Fullscreen):** F11 yoki ekrandagi tugma orqali.
  * **Interaktiv Matritsa:** Har bir talaba flagni topshirgan zahoti uning V1..V10 katakchasi **Yashil Neon yonadi va to'ladi (Solve animatsiyasi)**!
  * **Jonli Yangiliklar Ticker:** Kim qaysi zaiflikni fosh qilgani yoki 3-bosqichga o'tgani ekranda real-vaqt rejimida yugurib o'tadi.
  * **Real-vaqt (SSE):** Brauzerni qayta yuklash (F5) shart emas, serverdan avtomatik yangilanadi.

---

## 🚀 4. Tezkor O'rnatish va Ishga Tushirish

### A) Docker Compose orqali (Tavsiya etiladi):
```bash
cd /home/user/ctf-v2
docker-compose up -d --build
```
Konteynerlar ko'tarilgach:
* **2-Bosqich Web Target:** `http://localhost:5000`
* **Katta Ekran Jonli Matritsa:** `http://localhost:8080`
* **Hakamlar Boshqaruv Paneli:** `http://localhost:8080/admin` (Parol: `admin2026`)

### B) Mahalliy tizimda to'g'ridan-to'g'ri (Python):
```bash
cd /home/user/ctf-v2
bash install.sh

# Xizmatlarni alohida terminallarda ishga tushirish:
python3 stage2_web/app/server.py &     # Web target (5000)
python3 dashboard/server.py &          # Dashboard (8080)
python3 bot/bot.py &                   # Telegram bot (agar token bo'lsa)
```

---

## 🤖 5. Telegram Botni Sozlash (Ixtiyoriy)

1. `bot/config.py` fayliga BotFather dan olingan `BOT_TOKEN` ni yozing.
2. Botni ishga tushiring:
   ```bash
   python3 bot/bot.py
   ```
3. Bot quyidagi imkoniyatlarga ega:
   * `/start` — Yangi talabani ro'yxatdan o'tkazish va SSH hisob berish.
   * `📊 Holatim` — Joriy bosqich, web ballari va 10 ta zaiflik matrisi.
   * `🚩 Flag yuborish` — 1- va 2-bosqich flaglarini submit qilish.
   * `📝 Hisobot topshirish` — 1200 ball to'planganda Word/PDF hisobot faylini qabul qilish.

---

## 📁 6. Loyiha Tuzilishi

```
ctf-v2/
├── README.md                      ← Ushbu to'liq qo'llanma
├── docker-compose.yml             ← Web Target va Dashboardni 1 komandada ko'tarish
├── install.sh                     ← O'rnatish skripti
├── uninstall.sh                   ← Tozalash skripti
├── core_db/
│   ├── schema.sql                 ← SQLite ma'lumotlar bazasi sxemasi
│   └── db.py                      ← Markaziy boshqaruv Python moduli
├── stage1_linux/
│   ├── setup_stage1.sh            ← 1-bosqich Apex Corp Linux muhitini yaratish
│   └── company_data/              ← Xodimlar, yozishmalar, git arxivi
├── stage2_web/
│   ├── Dockerfile                 ← Web Target Docker fayli
│   ├── challenges_config.json     ← 10 ta zaiflik konfiguratsiyasi
│   └── app/
│       ├── server.py              ← 10 ta OWASP zaiflikka ega Flask ilova
│       ├── db_init.py             ← Apex Corp ma'lumotlar bazasi initsializatsiyasi
│       ├── static/                ← CSS, JS, hujjatlar
│       └── templates/             ← Bosh sahifa, Staff login, Admin panel, Ping
├── stage3_reporting/
│   └── templates/
│       ├── report_template.docx   ← Tayyor Word hisobot shabloni
│       └── report_template.md     ← Markdown hisobot shabloni
├── dashboard/
│   ├── Dockerfile                 ← Live Matrix Docker fayli
│   ├── server.py                  ← SSE real-vaqt veb-serveri
│   └── templates/
│       ├── matrix.html            ← KATTA EKRAN (PROJEKTOR) JONLI MATRITSASI
│       └── admin.html             ← Hakamlar va baholash paneli
├── bot/
│   ├── bot.py                     ← 3 bosqichli Telegram Bot
│   ├── config.py                  ← Bot sozlamalari
│   └── requirements.txt
└── bin/
    ├── check                      ← /usr/local/bin/check (Flag tekshirish)
    └── status                     ← /usr/local/bin/status (CLI progress)
```
