# 🏢 APEX GLOBAL TECHNOLOGIES — CTF v2 PLATFORM
## FRONTEND RE-ARCHITECTURE & PRODUCT SPECIFICATION (PRD)
> **Hujjat maqsadi:** Yangi Frontend dasturchisi (yoki AI Agent) ushbu kiberxavfsizlik CTF musobaqasi platformasining to'liq biznes mantiqini, arxitekturasini, foydalanuvchilar yo'lini va barcha API/Backend shartnomalarini tushunishi hamda zamonaviy, jozibador va yuqori darajadagi UI/UX yaratishi uchun to'liq texnik qo'llanma.

---

## 📑 MUNDARIJA
1. [Loyiha haqida umumiy tushuncha (Overview & Mission)](#1-loyiha-haqida-umumiy-tushuncha)
2. [Tizim Arxitekturasi (Client-Server Architecture)](#2-tizim-arxitekturasi)
3. [Musobaqa Qoidalari va 3 ta Bosqich](#3-musobaqa-qoidalari-va-3-ta-bosqich)
4. [Foydalanuvchi Rollari va Ssenariylari (User Personas)](#4-foydalanuvchi-rollari-va-ssenariylari)
5. [Sahifalar Xaritasi va UI Talablari (Information Architecture)](#5-sahifalar-xaritasi-va-ui-talablari)
6. [Backend API va SSE Stream Shartnomalari (API Contracts)](#6-backend-api-va-sse-stream-shartnomalari)
7. [Dizayn Tizimi va Estetika (Cyberpunk / SOC Design System)](#7-dizayn-tizimi-va-estetika)
8. [Xavfsizlik va Yashirinlik Qoidalari (Security Constraints)](#8-xavfsizlik-va-yashirinlik-qoidalari)

---

## 1. LOYIHA HAQIDA UMUMIY TUSHUNCHA

**Apex Global Technologies CTF v2** — bu korporativ darajadagi amaliy kiberxavfsizlik musobaqasi platformasi bo'lib, axborot xavfsizligi bo'yicha mutaxassislar, talabalar va pentesterlarning amaliy ko'nikmalarini baholash uchun yaratilgan.

### Platformaning asosiy maqsadi:
* Ishtirokchilarni haqiqiy korporativ infratuzilmaga uyushtiriladigan kiber-hujumlarni tahlil qilish, Linux tizim auditini o'tkazish, OWASP Top 10 veb zaifliklarini fosh qilish va professional kiberxavfsizlik hisobotini (Incident Report) tuzishga o'rgatish.
* **Ko'chirmakashlikni (Plagiarizm / Flag sharing) 100% yo'q qilish:** Har bir ishtirokchiga individual **Shaxsiy Token** (masalan `APEX-ZLF9`) beriladi. Tizimdagi barcha 17 ta flag ushbu token asosida deterministik kriptografik formula (HMAC-SHA256) bilan generatsiya qilinadi. Bitta talabaning topgan flagi ikkinchi talabaga umuman to'g'ri kelmaydi!

---

## 2. TIZIM ARXITEKTURASI

Tizim taqsimlangan **Mijoz-Server (Client-Server)** modeli asosida ishlaydi:

```
                  ┌─────────────────────────────────────────────────────────────┐
                  │            MARKAZIY SERVER (educyber.uz)                    │
                  │   • Web Dashboard (Port 8080 orqali Nginx proksida)          │
                  │   • SQLite Database (/var/ctf/ctf_v2.db)                    │
                  │   • Real-vaqt SSE Stream (/api/live/stream)                 │
                  │   • Markaziy Flag Engine (HMAC-SHA256 tekshiruv)             │
                  └───────────────▲───────────────────────────────▲─────────────┘
                                  │                               │
                      HTTP / SSE  │                   POST JSON   │
                      (Brauzer)   │                   (/api/submit)│
                                  │                               │
         ┌────────────────────────┴────────┐             ┌────────┴────────────────────────┐
         │ TALABA NOMI: Ali (APEX-ZLF9)    │             │ TALABA NOMI: Vali (APEX-K7X2)   │
         │ VIRTUALBOX VM (OVA)             │             │ VIRTUALBOX VM (OVA)             │
         │ • ~/apex_corp (7 ta Linux topsh)│             │ • ~/apex_corp (7 ta Linux topsh)│
         │ • localhost:5000 (OWASP Web)    │             │ • localhost:5000 (OWASP Web)    │
         │ • CLI: apex-init, check         │             │ • CLI: apex-init, check         │
         └─────────────────────────────────┘             └─────────────────────────────────┘
```

1. **Markaziy Server (educyber.uz):**
   * Barcha ishtirokchilar ro'yxatdan o'tadi, tizimga kiradi va o'z Shaxsiy Portallariga kiradi.
   * Katta zaldagi projektor/ekran uchun real-vaqtdagi **Jonli Hujum Matritsasi (Live Attack Matrix)** uzatiladi.
   * Flag topshirilganda server uni darhol hisoblab, ball qo'shadi va jonli matritsani yangilaydi.
   * Hakamlar (Admin) uchun yashirin boshqaruv paneli joylashgan.
2. **Talaba Virtual Mashinasi (Ubuntu OVA):**
   * Har bir talabaning shaxsiy kompyuterida alohida izolyatsiyalangan Ubuntu VM ochiladi.
   * VM ichida 1-bosqich topshiriqlari (`~/apex_corp`) va 2-bosqich veb ilovasi (`http://localhost:5000`) ishlaydi.
   * Talaba VM yoqilganda `apex-init` buyrug'i orqali saytdan olgan tokenini kiritadi va uning laboratoriyasi o'z tokeniga moslashtiriladi.

---

## 3. MUSOBAQA QOIDALARI VA 3 TA BOSQICH

Musobaqa jami **4500 ball**dan iborat bo'lib, 3 ta ketma-ket bosqichni o'z ichiga oladi:

### 1-Bosqich: Korporativ Linux Tizim Auditi (Jami 500 ball)
Topshiriqlar VM ichida `~/apex_corp` katalogida joylashgan:
* `L1` (50 ball) — Yashirin stansiya ma'lumotlari (`01_hidden_station/.apex_sys_flag`)
* `L2` (50 ball) — Server loglaridan favqulodda kalit (`02_system_logs/server_startup.log`)
* `L3` (75 ball) — Xodimlar reestridan token qidirish (`03_employee_registry/employees.csv`)
* `L4` (75 ball) — Ichki chuqur arxivdan zaxira faylini topish (`04_lost_backups/.../.recovery_vault`)
* `L5` (75 ball) — Himoyalangan kassa ruxsatini tiklash (chmod 000) (`05_restricted_vault/.vault_passphrase.txt`)
* `L6` (75 ball) — Hodisalar arxivi paketini ochish (tar.gz) (`06_archived_backups/backup.tar.gz`)
* `L7` (100 ball) — Git commitlar tarixidan o'chirilgan sirni tiklash (`07_git_repository/apex-api`)

### 2-Bosqich: OWASP Top 10 Web Zaifliklar Eksploitatsiyasi (Jami 3000 ball)
VM ichida `http://localhost:5000` manzilida ishlayotgan Apex Corp ichki portali:
* `V1` (100 ball) — Information Disclosure (`/.git/HEAD`)
* `V2` (150 ball) — User Enumeration & Response Header (`/login`)
* `V3` (200 ball) — Rate-Limit Bypass via `X-Forwarded-For` (`/portal/staff-login`)
* `V4` (250 ball) — IDOR (Insecure Direct Object Reference) (`/portal/employee/contract?id=1`)
* `V5` (250 ball) — Stored XSS & Admin Cookie Theft (`/support/ticket`)
* `V6` (300 ball) — LFI / Path Traversal (`/download?doc=../../vault/.env.vault`)
* `V7` (350 ball) — SQL Injection UNION-based (`/services/search`)
* `V8` (400 ball) — Insecure File Upload / Webshell Bypass (`/careers/apply`)
* `V9` (500 ball) — JWT Role Manipulation / Privilege Escalation (`/admin/executive-board`)
* `V10` (500 ball) — Remote Code Execution (RCE) (`/admin/diagnostics/ping`)

### 3-Bosqich: Professional Hodisa Hisoboti (Incident Report) (Jami 1000 ball)
* **Qachon ochiladi:** 2-bosqichda kamida **1200 ball** to'plagan ishtirokchilar uchun portalda avtomatik ochiladi (unlock bo'ladi).
* Ishtirokchi qilingan hujumlar, zaifliklar va ularni to'g'irlash bo'yicha PDF yoki DOCX formatida hisobot tayyorlab, portalga yuklaydi.
* Hakamlar hay'ati admin panel orqali hisobotni ko'rib chiqib, 0 dan 1000 ballgacha baholaydi va tahliliy izoh (feedback) qoldiradi.

---

## 4. FOYDALANUVCHI ROLLARI VA SSENARIYLARI

Platformada **3 xil foydalanuvchi tajribasi (UX)** mavjud:

### 1. Ishtirokchi (Talaba / Ethical Hacker)
* Saytga kiradi (`/`), Ro'yxatdan o'tadi (`Ism-familiya`, `username`, `parol`).
* Tizim unga avtomatik **Shaxsiy Token** beradi (masalan: `APEX-ZLF9`).
* Shaxsiy kabinetiga (`/portal`) o'tadi:
  - O'z tokenini ko'radi va bir marta bosish bilan nusxalab oladi.
  - O'zining jami to'plagan balli, joriy o'rni va bosqichini ko'radi.
  - Barcha 17 ta topshiriqning interaktiv kartochkalari (yechilgan/yechilmagan holati).
  - Har bir kartochkada darhol flag kiritish uchun AJAX maydoni mavjud.
  - 1200 ball to'plagach, 3-bosqich hisobot yuklash bo'limi ochiladi.

### 2. Tomoshabinlar / Zaldagi Katta Ekran (Projektor Matritsasi)
* Katta ekranda `/matrix` sahifasi to'liq ekran (F11) rejimida ochiq turadi.
* **Hech qanday sahifani qayta yuklash (refresh) talab qilinmaydi:** Server-Sent Events (SSE) orqali har safar kimdir flag topshirsa, jadval jonli animatsiya bilan qayta saralanadi.
* Yuqori qismda kiber-xabarlar yuguruvchi satri (Live Ticker) bo'ladi.
* **Xavfsizlik:** Matritsada ishtirokchilarning tokenlari yoki maxfiy kalitlari **hech qachon** ko'rsatilmaydi!

### 3. Hakam / Administrator (Stealth Admin)
* **Yashirin kirish:** Saytda alohida "Admin Login" tugmasi yo'q! Admin oddiy bosh sahifadagi login formaga maxsus login va parolni kiritadi:
  - Login: `wow` (yoki `admin`, `wow?`)
  - Parol: `centerlar000`
* Tizim avtomatik admin ekanligini bilib, uni `/admin` paneliga yo'naltiradi.
* Agar oddiy foydalanuvchi `/admin` manzilini qo'lda terib kirmoqchi bo'lsa, tizim stealth 404 (Not Found) qaytaradi.
* Admin panelida:
  - Barcha talabalar ro'yxati, real-vaqt saralanishi.
  - Talabalar topshirgan hisobot fayllarini (PDF/DOCX) brauzerda ko'rish va yuklab olish.
  - Hisobotni baholash (0..1000) va izoh qoldirish.
  - Natijalarni Excel (.xlsx) formatida bir zumda eksport qilish.
  - Qoidabuzar talabaning ballarini nolga tushirish (Reset).

---

## 5. SAHIFALAR XARITASI VA UI TALABLARI

Yangi Frontend quyidagi 4 ta asosiy sahifa va modallarni o'z ichiga olishi kerak:

```
/ (Bosh Sahifa) ──┬──> [Tab 1: Kirish (Login)] ──> Talaba bo'lsa -> /portal
                  │                            ──> Admin bo'lsa  -> /admin
                  ├──> [Tab 2: Ro'yxatdan o'tish (Register)] ──> /portal
                  └──> [Link: Katta Ekran Jonli Matritsasi] ──> /matrix

/portal (Talaba Shaxsiy Kabineti)
├── Token ko'rsatish va nusxalash kartasi (Hero Banner)
├── Progress Dashboard (Jami Ball, O'rin, 1-Bosqich, 2-Bosqich, 3-Bosqich)
├── 1-Bosqich (Linux Audit - 7 ta topshiriq kartasi + Flag submit input)
├── 2-Bosqich (Web Pentest - 10 ta topshiriq kartasi + Flag submit input)
└── 3-Bosqich (Hisobot yuklash drag & drop formasi + baho va feedback)

/matrix (Katta Ekran Jonli Matritsasi - Projektor rejimi)
├── Header: Logo, Jonli Soat, Musobaqa Statusi, To'liq ekran tugmasi (Fullscreen)
├── Yuguruvchi xabarlar tasmasi (Live Attack Ticker)
└── Asosiy Matritsa Jadvali:
    ├── Reyting (#, 🥇, 🥈, 🥉)
    ├── Haker (Ism-Familiya)
    ├── Bosqich holati (1-Linux / 2-Web / 3-Report / Tugatgan)
    ├── Jami Ball
    ├── 10 ta Veb zaiflik katakchalari (V1..V10) — Yechilgan (Yashil/Check) yoki Qulflangan
    └── 3-Bosqich statusi (Qulflangan / Ochildi / Topshirildi / Baholandi)

/admin (Hakamlar va Admin Paneli - Faqat ruxsat berilganlar uchun)
├── Statistika bloklari (Jami qatnashchilar, Faollar, Yakunlaganlar, Excel export)
├── Ishtirokchilar jadvali (Barcha bosqichlar progressi va vaqtlari)
├── Hisobotlarni baholash modali (Baholash, feedback yozish)
└── Ishtirokchini qayta sozlash (Reset) amallari
```

---

## 6. BACKEND API VA SSE STREAM SHARTNOMALARI

Yangi frontend backend bilan to'liq integratsiya bo'lishi uchun quyidagi endpointlarni ishlatadi:

### 1. Autentifikatsiya va Ro'yxatdan O'tish

#### A. Ro'yxatdan o'tish: `POST /register`
* **Form-data / URL-encoded:**
  - `full_name`: Talabaning to'liq ismi (masalan: `Ali Valiyev`)
  - `username`: Login (kichik harflarda, probellarsiz, masalan: `alivaliyev`)
  - `password`: Parol
  - `password_confirm`: Parolni tasdiqlash
* **Muvaffaqiyatli bo'lsa:** Redirect `/portal` ga (va sessiya o'rnatiladi).
* **Xatolik bo'lsa:** Sahifada `error` xabari ko'rsatiladi.

#### B. Tizimga kirish: `POST /login`
* **Form-data / URL-encoded:**
  - `username`: Foydalanuvchi logini (yoki Admin login: `wow`)
  - `password`: Parol
* **Muvaffaqiyatli bo'lsa:**
  - Agar admin bo'lsa: Redirect `/admin`
  - Agar talaba bo'lsa: Redirect `/portal`
* **Xatolik bo'lsa:** Sahifada `error` xabari ko'rsatiladi.

#### C. Chiqish: `GET /logout`
* Sessiyani tozalaydi va `/` bosh sahifaga yo'naltiradi.

---

### 2. Flag Topshirish API: `POST /api/submit_flag`
Talaba portal orqali (AJAX) yoki terminaldagi `check` buyrug'i orqali flag yuborganda ishlaydi.

* **Headers:** `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "flag": "FLAG{v2_linux_01_hidden_ls_a8f9c1e204b7}",
    "token": "APEX-ZLF9"
  }
  ```
  *(Izoh: Agar foydalanuvchi brauzerda tizimga kirgan bo'lsa, `token` yuborish shart emas, sessiyadan olinadi).*

* **Response (Muvaffaqiyatli - 200 OK):**
  ```json
  {
    "success": true,
    "message": "Tabriklaymiz! Flag to'g'ri!",
    "code": "L1",
    "points": 50,
    "title": "Yashirin stansiya ma'lumotlari",
    "new_total_score": 50
  }
  ```

* **Response (Xatolik - 200 OK yoki 400):**
  ```json
  {
    "success": false,
    "message": "Noto'g'ri flag! Qaytadan urinib ko'ring."
  }
  ```

---

### 3. Hisobot Yuklash: `POST /portal/upload_report`
* **Headers:** `multipart/form-data`
* **Form field:** `report` (Fayl: `.pdf`, `.docx`, `.doc`, `.zip`)
* **Muvaffaqiyatli bo'lsa:** Faylni saqlaydi, bazaga yozadi va `/portal` ga redirect qiladi.

---

### 4. Jonli Matritsa Ma'lumotlari: `GET /api/live/matrix`
* **Response (JSON):**
  ```json
  {
    "total_challenges": 10,
    "stage3_threshold": 1200,
    "challenges": [
      { "id": 1, "code": "V1", "title": "Information Disclosure", "points": 100, "difficulty": "Oson" },
      { "id": 2, "code": "V2", "title": "User Enumeration", "points": 150, "difficulty": "Oson" }
    ],
    "participants": [
      {
        "id": 1,
        "full_name": "Ali Valiyev",
        "username": "alivaliyev",
        "current_stage": 2,
        "total_score": 450,
        "stage1_solved": false,
        "stage1_count": 3,
        "stage1_total": 7,
        "stage2_score": 300,
        "stage3_unlocked": false,
        "report_submitted": false,
        "report_score": 0,
        "matrix": [
          { "code": "V1", "points": 100, "solved": true, "solved_at": "2026-11-07 14:20:11" },
          { "code": "V2", "points": 150, "solved": false, "solved_at": null }
        ]
      }
    ],
    "feed": [
      {
        "id": 101,
        "event_type": "solve",
        "message": "🔥 Ali Valiyev [V1: Information Disclosure] zaifligini fosh qildi! (+100 ball)",
        "created_at": "2026-11-07 14:20:11"
      },
      {
        "id": 100,
        "event_type": "join",
        "message": "👋 Ali Valiyev arena safiga qo'shildi!",
        "created_at": "2026-11-07 14:00:00"
      }
    ]
  }
  ```

---

### 5. Real-Vaqt SSE Stream: `GET /api/live/stream`
* **Mimetype:** `text/event-stream`
* Matritsa sahifasi ushbu manzilga JavaScript `EventSource` orqali ulanadi:
  ```javascript
  const evtSource = new EventSource('/api/live/stream');
  evtSource.onmessage = function(event) {
      const data = JSON.parse(event.data);
      renderMatrix(data); // Har safar o'zgarish bo'lganda ekran darhol yangilanadi!
  };
  ```

---

### 6. Admin API Endpointlari (Faqat Admin uchun)
* `POST /admin/api/grade-report`:
  - Body: `participant_id`, `score` (0..1000), `feedback` (matn)
* `POST /admin/api/reset-participant`:
  - Body: `participant_id`
* `POST /admin/api/add-participant`:
  - Body: `username`, `full_name`, `phone`
* `GET /admin/export/excel`:
  - Excel faylini avtomatik generatsiya qilib yuklab beradi (`.xlsx`).
* `GET /admin/report/download/<participant_id>`:
  - Talabaning yuklagan hisobot faylini yuklab olish.

---

## 7. DIZAYN TIZIMI VA ESTETIKA (CYBERPUNK / SOC AESTHETICS)

Eski dizayn "g'alati" ko'ringanining sababi — kiberxavfsizlik ruhidagi zamonaviy premium estetika yetishmaganida edi. Yangi frontend **quyidagi dizayn tamoyillariga** asoslanishi shart:

### 1. Ranglar Palitrasi (Color Palette):
* **Background Dark:** `#070a13` (Chuqur kosmik obsidian)
* **Surface / Cards:** `rgba(15, 23, 42, 0.75)` (Glassmorphism, orqa fon blur: `backdrop-filter: blur(12px)`)
* **Neon Cyan (Birlamchi brend rangi):** `#00e5ff` (Aksentlar, ramkalar, faol elementlar)
* **Neon Emerald (Yechilgan flaglar):** `#00ff88` (Muvaffaqiyat, ballar)
* **Warning Amber (Kutilayotgan holatlar):** `#ffb700` (Hisobot kutilyapti, o'rta qiyinlik)
* **Critical Crimson (Qulflangan / Xato):** `#ff3366` (Xatolar, yuqori xavf darajasi)
* **Text Primary:** `#ffffff`
* **Text Muted:** `#94a3b8`

### 2. Shriftlar (Typography):
* **Sarlavhalar va Ko'rsatkichlar:** `Orbitron`, `Chakra Petch`, yoki zamonaviy `Plus Jakarta Sans` / `Inter` (Font-weight: 700 / 800)
* **Kodlar, Flaglar va Tokenlar:** `JetBrains Mono` yoki `Fira Code` (Monospace, har doim aniq va nusxalash oson bo'lishi kerak).

### 3. Vizual Effektlar va Mikro-animatsiyalar:
* **Glow & Border:** Kartochkalarda ingichka neon chegaralar (`1px solid rgba(0, 229, 255, 0.2)`) va hover bo'lganda mayin nurlanish (`box-shadow: 0 0 20px rgba(0, 229, 255, 0.25)`).
* **Matritsa Katakchalari:** Yechilgan katakchalar shunchaki yashil emas, ichida chiroyli belgi (masalan yashil galochka yoki qalqon) va ball yozuvi bilan animatsiyalangan bo'lishi kerak.
* **Token Banneri:** Talaba portalidagi Shaxsiy Token alohida ko'rkam "Security Badge / Hardware Key" shaklida yaratilib, uning yonida "Nusxalash" (Copy) tugmasi va nusxalanganda "Nusxalandi!" bildirishnomasi bo'lishi kerak.
* **Toast Bildirishnomalari:** Flag topshirilganda sahifa qayta yuklanmasdan, ekranning tepa-o'ng burchagida zamonaviy cyberpunk uslubidagi bildirishnoma (Toast) paydo bo'lishi va balga qo'shilishi kerak.

---

## 8. XAVFSIZLIK VA YASHIRINLIK QOIDALARI

Frontend ishlab chiqishda quyidagi 3 ta xavfsizlik qoidasiga **qat'iy rioya qilinishi shart**:

1. **Token Hech Qachon Ommaga Chiqmasligi Shart:**
   - Shaxsiy token faqat va faqat o'sha talabaning o'z portalida (`/portal`) ko'rinadi.
   - Katta ekran matritsasida (`/matrix`) yoki umumiy API javoblarida tokenlar ko'rsatilmaydi yoki yuborilmaydi!
2. **Stealth Admin Yashirinligi:**
   - Saytda `/admin` havolasi yoki "Admin panelga o'tish" degan tugma bo'lmasligi kerak.
   - Faqat bosh sahifadagi kirish formasi orqali `wow` / `centerlar000` kiritilgandagina adminlik faollashadi. Begona foydalanuvchiga `/admin` sahifasi standart 404 xatosini berishi shart.
3. **Plagiarizmdan Himoya:**
   - Ishtirokchilar bir-birining flaglarini ko'ra olmasligi uchun har bir flag faqat token asosida hisoblanadi. Frontendda barcha flag topshirish formasi xavfsiz CSRF va JSON tekshiruvidan o'tadi.

---

## 9. XULOSA VA KEYINGI QADAM (FRONTEND AGENTI UCHUN)

Yangi frontend agenti ushbu hujjatni o'qib, mavjud `dashboard/templates` va `dashboard/static` papkalarini zamonaviy, toza, responsiv (mobil va planshetlarga ham mos) hamda haqiqiy kiberxavfsizlik musobaqasiga munosib darajada qayta yaratishi mumkin.

Barcha backend logikasi, sessiyalar, SSE oqimlari va API endpointlari yuqoridagi spetsifikatsiyaga mos ravishda to'liq tayyor va ishchi holatda! 🚀
