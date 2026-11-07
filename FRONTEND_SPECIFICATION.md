# 🏢 APEX GLOBAL TECHNOLOGIES — CTF v2 PLATFORM
# COMPLETE SYSTEM & FRONTEND TECHNICAL SPECIFICATION (PRD)

> **Hujjat versiyasi:** 2.4.0 (Production Master Spec)  
> **Muallif:** Apex Cyber Architecture & Security Team  
> **Mo'ljallangan auditoriya:** Senior Frontend Engineer / Autonomous Frontend AI Agent  
> **Qamrovi:** Platformaning ikkala sayti:
> 1. **Markaziy CTF Platformasi** (`educyber.uz` / port 8080: Portal, Live Matrix, Stealth Admin)
> 2. **Zaifliklari bor Korporativ Veb-Target** (`stage2_web` / `localhost:5000`: 10 ta OWASP zaifligi)

---

## 📑 MUNDARIJA
1. [Loyiha Maqsadi va Arxitektura Modeli](#1-loyiha-maqsadi-va-arxitektura-modeli)
2. [Ikki Xil Saytning Vazifaviy Taqsimoti](#2-ikki-xil-saytning-vazifaviy-taqsimoti)
3. [Dinamik Token va Flag Dvigateli (Anti-Cheat Mantiqi)](#3-dinamik-token-va-flag-dvigateli)
4. [1-Sayt: Markaziy CTF Platformasi — Sahifalar va UX](#4-1-sayt-markaziy-ctf-platformasi--sahifalar-va-ux)
5. [2-Sayt: Zaifliklari bor Veb-Target — 10 ta OWASP Top 10](#5-2-sayt-zaifliklari-bor-veb-target--10-ta-owasp-top-10)
6. [To'liq Backend API, JSON Payloadlar va Shartnomalar](#6-toliq-backend-api-json-payloadlar-va-shartnomalar)
7. [Dizayn Tizimi (Design Tokens, CSS & Tailwind Config)](#7-dizayn-tizimi-design-tokens-css--tailwind-config)
8. [Xavfsizlik, Stealth Admin va SSE Jonli Oqim Qoidalari](#8-xavfsizlik-stealth-admin-va-sse-jonli-oqim-qoidalari)

---

## 1. LOYIHA MAQSADI VA ARXITEKTURA MODELI

**Apex Global Technologies CTF v2** — professional kiberxavfsizlik musobaqasi ekotizimidir.

### Tizim Arxitekturasi:
Musobaqa taqsimlangan **Mijoz-Server (Client-Server)** modeli asosida ishlaydi:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MARKAZIY SERVER (educyber.uz)                         │
│  • Flask Backend (Port 8080 / Nginx Reverse Proxy)                           │
│  • Markaziy SQLite bazasi: /var/ctf/ctf_v2.db                               │
│  • SSE Oqimi: GET /api/live/stream                                          │
│  • Flag tekshiruv API: POST /api/submit_flag                                 │
└───────────────────────▲─────────────────────────────▲───────────────────────┘
                        │ HTTP / SSE                  │ AJAX / CLI POST
                        │ (Brauzer)                   │ (/api/submit_flag)
         ┌──────────────┴──────────────────┐   ┌──────┴────────────────────────┐
         │ TALABA 1 VM (APEX-ZLF9)         │   │ TALABA 2 VM (APEX-K7X2)       │
         │ • ~/apex_corp (7 ta Linux topsh)│   │ • ~/apex_corp (7 ta Linux topsh│
         │ • localhost:5000 (OWASP Target) │   │ • localhost:5000 (OWASP Target│
         │ • CLI: apex-init, check         │   │ • CLI: apex-init, check       │
         └─────────────────────────────────┘   └───────────────────────────────┘
```

1. **Markaziy Server (`educyber.uz` / port 8080):**
   * Ishtirokchilar ro'yxatdan o'tadi, tizimga kiradi va o'z Shaxsiy Portallariga (`/portal`) kiradi.
   * Katta zaldagi projektor/ekran uchun real-vaqtdagi **Jonli Hujum Matritsasi (`/matrix`)** uzatiladi.
   * Hakamlar hay'ati uchun yashirin boshqaruv paneli (`/admin`) joylashgan.
2. **Talaba Virtual Mashinasi (Ubuntu 26.04 OVA):**
   * Har bir talabaning noutbukida VirtualBox ichida izolyatsiyalangan Ubuntu VM ishlaydi.
   * VM ichida 1-bosqich topshiriqlari (`~/apex_corp`) va 2-bosqich veb ilovasi (`http://localhost:5000`) ishlaydi.

---

## 2. IKKI XIL SAYTNING VAZIFAVIY TAQSIMOTI

Frontend ishlab chiquvchi bilishi shart bo'lgan eng muhim jihat — loyihada **ikkita butunlay xilma-xil sayt** mavjud:

| Parametr | 1-Sayt: Markaziy CTF Platformasi | 2-Sayt: Zaifliklari bor Target Sayt |
| :--- | :--- | :--- |
| **Joylashuvi** | Markaziy Server (`https://educyber.uz:8080`) | Talaba VM ichida (`http://localhost:5000`) |
| **Katalogi** | `dashboard/templates` va `dashboard/static` | `stage2_web/app/templates` va `static` |
| **Maqsadi** | Musobaqani boshqarish, ballar, jonli matritsa | Pentest qilinadigan "qurbon" tizim |
| **Dizayn Uslubi** | **Cyberpunk / SOC Dark Neon / High-Tech Glass** | **Enterprise Corporate Portal / White-Collar Business** |
| **Foydalanuvchi** | Talaba (Portal), Hakam (Admin), Auditoriya (Matritsa) | Pentester (Zaiflik qidirayotgan talaba) |
| **O'zgartirish ruxsati** | UI/UX to'liq erkin, zamonaviy qilib qayta yoziladi | UI modernizatsiya qilinadi, **LEKIN formalar/inputlar buzilmasligi shart!** |

---

## 3. DINAMIK TOKEN VA FLAG DVIGATELI

Musobaqada ko'chirmakashlikni (plagiarizmni) 100% yo'q qilish uchun deterministik kriptografik formula ishlatiladi.

* Har bir talaba ro'yxatdan o'tganda unga individual token beriladi: masalan `APEX-ZLF9` yoki `APEX-7F92`.
* Flaglar formulasi:  
  `FLAG{prefix_HMAC_SHA256(MASTER_SALT, token:challenge_code)[:12]}`
* **Natija:** 
  - Talaba 1 (`APEX-ZLF9`) uchun `V1` flagi: `FLAG{v2_web_01_git_leak_9a2f1c84b0e3}`
  - Talaba 2 (`APEX-K7X2`) uchun `V1` flagi: `FLAG{v2_web_01_git_leak_4d7e01f5c8a2}`
* Talabalar bir-biridan flag ko'chirsa, server qabul qilmaydi!

---

## 4. 1-SAYT: MARKAZIY CTF PLATFORMASI — SAHIFALAR VA UX

Ushbu sayt `dashboard/server.py` orqali boshqariladi. Yangi UI quyidagi 4 ta asosiy sahifani o'z ichiga olishi shart:

### 4.1. Bosh Sahifa / Kirish Xabi (`/` va `/login`, `/register`)
* **URL:** `GET /`
* **UI Komponentlari:**
  - Markazda futuristik Cyberpunk login kartochkasi.
  - Tab 1: **"Tizimga Kirish (Login)"** — Maydonlar: `username`, `password`.
  - Tab 2: **"Ro'yxatdan O'tish (Register)"** — Maydonlar: `full_name`, `username`, `password`, `password_confirm`.
  - Pastki qismda: **"Katta Ekran Jonli Matritsasi"** havolasi (`/matrix`).
* **Stealth Admin Kirish:**
  - Agar foydalanuvchi `username` maydoniga `wow` (yoki `admin`, `wow?`) va `password` maydoniga `centerlar000` kiritsa — tizim uni avtomatik `/admin` paneliga yo'naltiradi. Hech qanday "Admin login" tugmasi bo'lmaydi!

### 4.2. Talaba Shaxsiy Portali (`/portal`)
* **URL:** `GET /portal` (Faqat tizimga kirgan talaba uchun, aks holda `/login` ga redirect).
* **UI Komponentlari:**
  1. **Token Hero Banner (Security Badge):**
     - Talabaning shaxsiy tokeni (masalan: `APEX-ZLF9`) ko'zga tashlanadigan yorqin neon badge shaklida ko'rsatiladi.
     - Yonida **"Nusxalash" (Copy)** tugmasi va bosilganda *"Nusxalandi!"* animatsiyasi.
     - Qo'llanma: *"Ushbu tokenni virtual mashinangizda `apex-init` buyrug'iga kiriting!"*
  2. **Statistika Vidjetlari:**
     - Jami to'plangan ball (`total_score` / 4500)
     - 1-Bosqich: Linux Tizim Auditi (`stage1_solved_count` / 7 topshiriq)
     - 2-Bosqich: Web Pentest (`stage2_solved_count` / 10 zaiflik)
     - 3-Bosqich: Hisobot Statusi (`Topshirildi` / `1200b to'planganda ochiladi`)
  3. **1-Bosqich Topshiriqlar Kartalari (7 ta karta - L1..L7):**
     - Har bir kartada: Kod (`L1`), Nom, Qiyinlik, Ball (`+50b`), Ta'rif, Holat (Yechilgan bo'lsa yashil galochka, yechilmagan bo'lsa qulf).
     - Flag kiritish uchun mini AJAX input va "Tekshirish" tugmasi.
  4. **2-Bosqich Veb Zaifliklar Kartalari (10 ta karta - V1..V10):**
     - Har bir kartada: Kod (`V1`..`V10`), Zaiflik nomi (OWASP Top 10), Ball (`100b`..`500b`), Holat.
     - Flag kiritish uchun mini AJAX input va "Tekshirish" tugmasi.
  5. **3-Bosqich Hisobot Yuklash Bloki (Incident Report):**
     - Agar 2-bosqich balli < 1200 bo'lsa: Blok qulflangan holatda turadi va *"2-bosqichda kamida 1200 ball to'plaganingizda ochiladi"* yozuvi chiqadi.
     - Agar ball >= 1200 bo'lsa: Qulf ochiladi, zamonaviy Drag & Drop fayl yuklash maydoni ochiladi (`.pdf`, `.docx`).
     - Hisobot yuklangach: *"Hisobotingiz hakamlar ko'rigida"* holati va hakam baholasa baho (`report_score`) hamda hakam izohi (`report_feedback`) ko'rsatiladi.

### 4.3. Katta Ekran Jonli Matritsasi (`/matrix`)
* **URL:** `GET /matrix` (Barcha uchun ochiq, projektorga chiqariladi).
* **UI Komponentlari:**
  1. **Top Header:**
     - Korporativ logo: **APEX GLOBAL TECHNOLOGIES — LIVE ATTACK MATRIX**
     - Jonli kiber-soat (`HH:MM:SS`)
     - Aloqa indikatori (`Jonli SSE Ulanish` yashil miltillovchi nuqta)
     - To'liq ekran tugmasi (`Fullscreen F11`)
  2. **Jonli Xabarlar Tasmasi (Attack Ticker):**
     - Yuqorida yuguruvchi satr: *"🔥 Ali Valiyev [V1: Information Disclosure] zaifligini fosh qildi! (+100 ball) • 💻 Dilshod [L2] topshirig'ini bajardi!"*
     - **DIQQAT:** Tokenlar yoki shaxsiy ID lar bu yerda HECH QACHON ko'rsatilmaydi!
  3. **Asosiy Matritsa Jadvali (Leaderboard & Attack Grid):**
     - Ustunlar:
       1. `#` (O'rin: 🥇, 🥈, 🥉, 4...)
       2. `Hujumchi / Ishtirokchi` (To'liq ism-familiya)
       3. `Bosqich` (Badge: `1-Linux (3/7)`, `2-Web (450b)`, `3-Report`, `G'olib`)
       4. `Jami Ball` (Yirik neon son)
       5. `V1` dan `V10` gacha 10 ta ustun:
          - Yechilgan bo'lsa: Yashil katakcha, ichida checkmark va ball (`+100`)
          - Yechilmagan bo'lsa: To'q qora katakcha, qulf belgisi
       6. `3-Bosqich (Hisobot)`: Status badge (`Qulflangan`, `Ochildi`, `Topshirildi`, `+850b`)

### 4.4. Hakamlar va Admin Paneli (`/admin`)
* **URL:** `GET /admin` (Faqat avtorizatsiyadan o'tgan admin uchun; boshqalarga `404 Not Found`).
* **UI Komponentlari:**
  1. Statistika kartalari (Jami ishtirokchilar, Faollar, Yakunlaganlar, Yuklangan hisobotlar).
  2. **Excel Eksport tugmasi:** Bir marta bosish bilan `CTF_v2_Natijalar_YYYYMMDD.xlsx` faylini yuklab beradi.
  3. **Ishtirokchilar Boshqaruv Jadvali:**
     - Har bir ishtirokchining 1-bosqich va 2-bosqichdagi aniq sarflagan vaqti (`1s 14d 22s`).
     - 3-Bosqich hisobotini yuklab olish va ko'rish havolasi.
     - **Baholash tugmasi (Modal):** Hakam 0 dan 1000 gacha ball qo'yadi va matnli feedback yozadi.
     - **Qayta sozlash (Reset) tugmasi:** Qoidabuzar talabaning ballarini tasdiqlash bilan nolga tushiradi.

---

## 5. 2-SAYT: ZAIFLIKLARI BOR VEB-TARGET — 10 TA OWASP TOP 10

Bu sayt talaba VM ichida `stage2_web/app/` katalogida ishlaydi (`http://localhost:5000`).
Uning dizaynini yangilashda **barcha backend marshrutlari, HTML forma `action`, `method` va `input` nomlari 100% o'zgarmasdan saqlanishi SHART!**

Quyida 10 ta zaiflikning frontend texnik xaritasi:

### V1 — Information Disclosure (`/.git/HEAD`)
* **Ball:** 100
* **Frontend vazifasi:** Sayt footerida yoki `robots.txt` da dasturchilar eslatmasi yoki git commitlari haqida nozik ishora bo'lishi mumkin. Fayl backendda statik mavjud: `/.git/HEAD`.

### V2 — User Enumeration & Response Header (`/login`)
* **Ball:** 150
* **Frontend Endpoint:** `POST /login`
* **Forma inputlari:**
  - `<input type="text" name="username">`
  - `<input type="password" name="password">`
* **Mantiq:** Agar mavjud foydalanuvchi (`asmith`, `admin`) kiritilib parol xato bo'lsa, server javobida `X-Apex-User-Status: UserExists` sarlavhasi va `Parol noto'g'ri!` xabari chiqadi. Agar mavjud bo'lmagan user kiritilsa `Foydalanuvchi topilmadi!` chiqadi. Flag to'g'ri login bo'lganda beriladi.

### V3 — Rate-Limit Bypass via `X-Forwarded-For` (`/portal/staff-login`)
* **Ball:** 200
* **Frontend Endpoint:** `POST /portal/staff-login`
* **Forma inputlari:**
  - `<input type="text" name="staff_id">` (To'g'ri qiymat: `APEX-EMP-9021`)
  - `<input type="password" name="pin">` (To'g'ri 4 xonali PIN: `7492`)
* **Mantiq:** 3 ta urinishdan keyin IP bloklanadi. Hujumchi HTTP sarlavhasiga `X-Forwarded-For: random_ip` qo'shib cheklovni chetlab o'tadi va PIN ni topadi.

### V4 — Insecure Direct Object Reference (IDOR) (`/portal/employee/contract`)
* **Ball:** 250
* **Frontend Endpoint:** `GET /portal/employee/contract?id=1`
* **Query param:** `id` (Parametr nomi: `id`)
* **Mantiq:** Boshqaruv panelida xodimning o'z shartnomasi `?id=3` bo'ladi. Hujumchi URL dagi `id` ni `1` (CEO Dr. Robert Vance) ga o'zgartirganda bosh direktorning maxfiy shartnomasi va flag ochiladi.

### V5 — Stored XSS & Admin Cookie Theft (`/support/ticket`)
* **Ball:** 250
* **Frontend Endpoint:** `POST /support/ticket`
* **Forma inputlari:**
  - `<input type="text" name="subject">`
  - `<textarea name="message"></textarea>`
* **Mantiq:** Foydalanuvchi yuborgan tiket admin panelida filtrlanmasdan ko'rsatiladi. XSS skript yuborilganda admin cookie (`apex_admin_session`) o'g'irlanadi va flag olinadi.

### V6 — LFI / Path Traversal (`/download` yoki `/portal/docs/view`)
* **Ball:** 300
* **Frontend Endpoint:** `GET /download?doc=../../vault/.env.vault`
* **Query param:** `doc` (Parametr nomi: `doc`)
* **Mantiq:** Hujjatlarni yuklab olish sahifasida `doc` parametri orqali serverning ichki `.env.vault` konfiguratsiya fayli o'qiladi.

### V7 — SQL Injection UNION-based (`/services/search`)
* **Ball:** 350
* **Frontend Endpoint:** `GET /services/search?q=' UNION SELECT ...`
* **Query param:** `q` (Qidiruv maydoni nomi: `q`)
* **Mantiq:** Qidiruv maydonida SQL Injection zaifligi mavjud. Natijalar jadvalida yashirin `apex_secrets` jadvalidagi flag chiqadi.

### V8 — Insecure File Upload / Webshell Bypass (`/careers/apply`)
* **Ball:** 400
* **Frontend Endpoint:** `POST /careers/apply`
* **Forma inputlari:**
  - `<input type="text" name="full_name">`
  - `<input type="email" name="email">`
  - `<input type="text" name="position">`
  - `<input type="file" name="resume">` (Fayl input nomi: `resume`)
* **Mantiq:** CV yuklash formasida MIME-type yoki kengaytma filtrini chetlab o'tib webshell yuklanadi va `/static/uploads/resumes/` dan ishga tushiriladi.

### V9 — JWT Role Manipulation / Privilege Escalation (`/admin/executive-board`)
* **Ball:** 500
* **Frontend Endpoint:** `GET /admin/executive-board`
* **Cookie nomi:** `apex_jwt`
* **Mantiq:** Foydalanuvchi JWT tokenidagi `"role": "guest"` ni `"role": "board_member"` ga o'zgartirib, kengash yashirin flagini qo'lga kiritadi.

### V10 — Remote Code Execution (RCE) (`/admin/diagnostics/ping`)
* **Ball:** 500
* **Frontend Endpoint:** `POST /admin/diagnostics/ping`
* **Forma inputlari:**
  - `<input type="text" name="ip">` (Input nomi: `ip`)
* **Mantiq:** Tarmoqni tekshirish uchun ping formasi: `127.0.0.1; cat /home/ubuntu/ctf-v2/stage2_web/app/vault/master_flag.txt`. Buyruq inyeksiyasi orqali bosh server flagi fosh qilinadi.

---

## 6. TO'LIQ BACKEND API, JSON PAYLOADLAR VA SHARTNOMALAR

Markaziy serverning barcha API endpointlari, JSON tuzilmalari va xatolik javoblari:

### 6.1. Ro'yxatdan O'tish: `POST /register`
* **URL:** `/register`
* **Method:** `POST`
* **Content-Type:** `application/x-www-form-urlencoded`
* **Request Body:**
  ```
  full_name=Rustam+Karimov&username=rustam_sec&password=SecurePass2026!&password_confirm=SecurePass2026!
  ```
* **Muvaffaqiyatli javob (Status 302 Redirect):**
  - Foydalanuvchi sessiyasi yaratiladi: `session['user_id']`, `session['username']`, `session['token']`.
  - Redirect: `/portal`
* **Xatolik javobi (Status 200 OK — index.html render):**
  - Jinja2 o'zgaruvchisi: `active_tab="register"`, `error="Bu username allaqachon ro'yxatdan o'tgan. Boshqa username tanlang."`

---

### 6.2. Tizimga Kirish: `POST /login`
* **URL:** `/login`
* **Method:** `POST`
* **Content-Type:** `application/x-www-form-urlencoded`
* **Request Body:**
  ```
  username=rustam_sec&password=SecurePass2026!
  ```
* **Muvaffaqiyatli javob (Status 302 Redirect):**
  - Oddiy talaba uchun -> `/portal`
  - Stealth Admin (`wow` / `centerlar000`) uchun -> `/admin`
* **Xatolik javobi (Status 200 OK — index.html render):**
  - Jinja2 o'zgaruvchisi: `active_tab="login"`, `error="Username yoki parol noto'g'ri!"`

---

### 6.3. Flag Tekshirish va Topshirish: `POST /api/submit_flag`
* **URL:** `/api/submit_flag`
* **Method:** `POST`
* **Content-Type:** `application/json` (yoki `application/x-www-form-urlencoded`)
* **Request Headers:**
  - `Content-Type: application/json`
  - `X-Requested-With: XMLHttpRequest` (AJAX bo'lsa)
* **Request Payload (JSON):**
  ```json
  {
    "flag": "FLAG{v2_linux_01_hidden_ls_a8f9c1e204b7}",
    "token": "APEX-ZLF9"
  }
  ```
  *(Eslatma: Agar talaba brauzer orqali tizimga kirgan bo'lsa, `token` yuborish ixtiyoriy, sessiyadan avtomatik aniqlanadi).*

* **Muvaffaqiyatli Javob (200 OK):**
  ```json
  {
    "success": true,
    "message": "Tabriklaymiz! Flag to'g'ri!",
    "code": "L1",
    "points": 50,
    "title": "Yashirin stansiya ma'lumotlari",
    "new_total_score": 550
  }
  ```

* **Xatolik Javoblari:**
  - **Noto'g'ri Flag (200 OK):**
    ```json
    {
      "success": false,
      "message": "Noto'g'ri flag! Qaytadan urinib ko'ring."
    }
    ```
  - **Allaqachon topshirilgan Flag (200 OK):**
    ```json
    {
      "success": false,
      "message": "Siz bu flagni allaqachon topshirgansiz!"
    }
    ```
  - **Autentifikatsiyadan o'tilmagan (401 Unauthorized):**
    ```json
    {
      "success": false,
      "message": "Avtorizatsiyadan o'tilmagan. Avval tizimga kiring!"
    }
    ```
  - **Bo'sh Flag (400 Bad Request):**
    ```json
    {
      "success": false,
      "message": "Flag kiritilmadi!"
    }
    ```

---

### 6.4. Jonli Matritsa Ma'lumotlari: `GET /api/live/matrix`
* **URL:** `/api/live/matrix`
* **Method:** `GET`
* **Response Payload (JSON):**
  ```json
  {
    "total_challenges": 10,
    "stage3_threshold": 1200,
    "challenges": [
      {
        "id": 1,
        "code": "V1",
        "title": "Yashirin Tizim Ma'lumotlari Oqishi",
        "points": 100,
        "difficulty": "Oson"
      },
      {
        "id": 2,
        "code": "V2",
        "title": "Xodimlar Pochtalarini Sanash",
        "points": 150,
        "difficulty": "Oson"
      }
    ],
    "participants": [
      {
        "id": 14,
        "full_name": "Rustam Karimov",
        "username": "rustam_sec",
        "current_stage": 2,
        "total_score": 750,
        "stage1_count": 5,
        "stage1_total": 7,
        "stage1_solved": false,
        "stage2_score": 500,
        "stage3_unlocked": false,
        "report_submitted": false,
        "report_score": 0,
        "matrix": [
          {
            "code": "V1",
            "points": 100,
            "solved": true,
            "solved_at": "2026-11-07 14:32:05"
          },
          {
            "code": "V2",
            "points": 150,
            "solved": false,
            "solved_at": null
          }
        ]
      }
    ],
    "feed": [
      {
        "id": 89,
        "participant_name": "Rustam Karimov",
        "event_type": "solve",
        "message": "🔥 Rustam Karimov [V1: Yashirin Tizim Ma'lumotlari Oqishi] zaifligini fosh qildi! (+100 ball)",
        "created_at": "2026-11-07 14:32:05"
      },
      {
        "id": 88,
        "participant_name": "Rustam Karimov",
        "event_type": "join",
        "message": "👋 Rustam Karimov arena safiga qo'shildi!",
        "created_at": "2026-11-07 14:00:12"
      }
    ]
  }
  ```
  *(Diqqat: Tokenlar hech qachon ushbu ochiq JSON da chiqmaydi).*

---

### 6.5. Real-Vaqt SSE Jonli Oqim: `GET /api/live/stream`
* **URL:** `/api/live/stream`
* **Method:** `GET`
* **Response Headers:**
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
  - `X-Accel-Buffering: no`
* **Stream Wire Format:**
  ```
  data: {"challenges": [...], "participants": [...], "feed": [...], "stage3_threshold": 1200, "total_challenges": 10}

  data: {"challenges": [...], "participants": [...], "feed": [...], "stage3_threshold": 1200, "total_challenges": 10}
  ```
* **JavaScript ulanish namunasi:**
  ```javascript
  const evtSource = new EventSource('/api/live/stream');
  evtSource.onmessage = function(event) {
      try {
          const matrixData = JSON.parse(event.data);
          updateMatrixUI(matrixData);
      } catch (err) {
          console.error("SSE parse xatosi:", err);
      }
  };
  evtSource.onerror = function() {
      console.warn("SSE aloqasi uzildi, qayta ulanilmoqda...");
  };
  ```

---

### 6.6. 3-Bosqich Hisobot Yuklash: `POST /portal/upload_report`
* **URL:** `/portal/upload_report`
* **Method:** `POST`
* **Content-Type:** `multipart/form-data`
* **Payload:**
  - `report`: Fayl ob'ekti (`.pdf`, `.docx`, `.doc`, `.zip`). Hajmi: maks 50MB.
* **Muvaffaqiyatli javob:** Status 302 Redirect `/portal`.

---

### 6.7. Admin Boshqaruv API lari (Faqat Admin Sessiyasi Uchun)

#### A. Hisobotni Baholash: `POST /admin/api/grade-report`
* **Request:** `participant_id=14&score=850&feedback=Ajoyib+hisobot,+zaifliklar+toliq+tahlil+qilingan.`
* **Response (JSON):**
  ```json
  {
    "status": "success",
    "message": "Baho muvaffaqiyatli saqlandi!",
    "new_total": 1600
  }
  ```

#### B. Ishtirokchi Natijalarini Qayta Nolga Tushirish: `POST /admin/api/reset-participant`
* **Request:** `participant_id=14`
* **Response (JSON):**
  ```json
  {
    "status": "success",
    "message": "Ishtirokchi natijalari to'liq qayta nollandi!"
  }
  ```

#### C. Natijalarni Excelga Eksport: `GET /admin/export/excel`
* **Javob:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx fayl oqimi).

---

## 7. DIZAYN TIZIMI (DESIGN TOKENS, CSS & TAILWIND CONFIG)

Yangi Frontend yuqori darajadagi zamonaviy **Cyberpunk / SOC Command Center** uslubida bo'lishi uchun quyidagi dizayn tokenlaridan foydalanadi:

### 7.1. CSS Maxsus O'zgaruvchilar (CSS Variables - `:root`):
```css
:root {
  /* Asosiy Fon Ranglari */
  --bg-space: #070a13;
  --bg-surface: #0d121f;
  --bg-card: rgba(15, 23, 42, 0.75);
  --bg-card-hover: rgba(22, 34, 61, 0.85);

  /* Neon Aksent Ranglar */
  --neon-cyan: #00e5ff;
  --neon-cyan-glow: rgba(0, 229, 255, 0.35);
  --neon-emerald: #00ff88;
  --neon-emerald-glow: rgba(0, 255, 136, 0.35);
  --neon-amber: #ffb700;
  --neon-amber-glow: rgba(255, 183, 0, 0.35);
  --neon-crimson: #ff3366;
  --neon-crimson-glow: rgba(255, 51, 102, 0.35);
  --neon-purple: #a855f7;

  /* Matn Ranglari */
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --text-dim: #64748b;

  /* Ramkalar va Nurlanishlar */
  --border-glass: 1px solid rgba(255, 255, 255, 0.08);
  --border-neon: 1px solid rgba(0, 229, 255, 0.3);
  --glow-cyan: 0 0 20px rgba(0, 229, 255, 0.25);
  --glow-emerald: 0 0 20px rgba(0, 255, 136, 0.25);

  /* Shriftlar */
  --font-display: 'Orbitron', 'Chakra Petch', sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Glassmorphism filtri */
  --backdrop-blur: blur(14px);
}
```

### 7.2. TailwindCSS Konfiguratsiyasi (`tailwind.config.js`):
```javascript
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#070a13',
          surface: '#0d121f',
          card: '#0f172a',
          cyan: '#00e5ff',
          emerald: '#00ff88',
          amber: '#ffb700',
          crimson: '#ff3366',
          purple: '#a855f7',
        }
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'neon-cyan': '0 0 25px rgba(0, 229, 255, 0.3)',
        'neon-emerald': '0 0 25px rgba(0, 255, 136, 0.3)',
      }
    }
  }
}
```

### 7.3. UI Elementlari Holatlari (UI State Matrix):
* **Topshiriq Kartasi (Unsolved):** Fon: `rgba(15, 23, 42, 0.7)`, Ramka: `1px solid rgba(255, 255, 255, 0.08)`. Input ochiq, kulrang qulf ikonasi.
* **Topshiriq Kartasi (Solved):** Fon: `rgba(0, 255, 136, 0.08)`, Ramka: `1px solid rgba(0, 255, 136, 0.4)`. Yashil galochka, "Yechildi! (+X ball)" nurlanishi.
* **Matritsa Katakchasi (Cell):** 
  - Yechilmagan: `42px x 42px`, to'q ko'k/qora, kichik qulf ikonasi.
  - Yechilgan: `42px x 42px`, zumrad yashil, ichida oq checkmark, mayin pulsatsiya animatsiyasi (`animation: pulse 2s infinite`).

---

## 8. XAVFSIZLIK, STEALTH ADMIN VA SSE JONLI OQIM QOIDALARI

1. **Token Maxfiyligi:**
   - Shaxsiy token faqat `/portal` sahifasida va faqat o'sha talabaning o'ziga ko'rsatiladi.
   - Matritsada (`/matrix`), jonli xabarlarda (`feed`), yoki ochiq API larda token chiqishi qat'iyan taqiqlanadi!
2. **Stealth Admin Himoyasi:**
   - Saytda hech qayerda `/admin` tugmasi yoki ssilka bo'lmaydi.
   - Bosh sahifa login formasida maxsus kombinatsiya kiritilgandagina adminlik faollashadi.
   - Tizimga kirmagan har qanday shaxs `/admin` sahifasiga to'g'ridan-to'g'ri murojaat qilganda `404 Not Found` standart sahifasi qaytadi.
3. **Plagiarizmga Qarshi:**
   - Flag topshirish faqat POST orqali qabul qilinadi. Har bir so'rov orqali ishtirokchining IP manzili va urinishlar soni log qilinadi.

---

## 9. XULOSA: YANGI AGENT UCHUN ANIQ KO'RSATMA

Ushbu spetsifikatsiya asosida yangi Frontend agenti:
1. `dashboard/templates/index.html` (Kirish, Ro'yxatdan o'tish, Stealth Admin xabi)
2. `dashboard/templates/portal.html` (Talaba kabineti, token nusxalash, topshiriqlar kartalari, AJAX submit, hisobot yuklash)
3. `dashboard/templates/matrix.html` (Projektor jonli matritsasi, SSE stream, fullscreen, yuguruvchi satr)
4. `dashboard/templates/admin.html` (Hakamlar boshqaruvi, baholash modali, Excel eksport)
5. `stage2_web/app/templates/*` (Korporativ target sayt ko'rinishini modernizatsiya qilish, forma parametrlarini saqlab qolgan holda)

fayllarini zamonaviy, responsiv va to'liq integratsiya qilingan holatda yaratishi mumkin. Barcha backend API lari ushbu hujjatdagi shartnomalar bilan 100% mos va ishchi holatda! 🚀
