# 🚩 Apex Corp CTF v2 — Professional Kiberxavfsizlik Arenasi (Token-Based Dynamic Flags)

Ushbu platforma zamonaviy korporativ infratuzilmalarni audit qilish, penetratsion testlash (Web Pentest), OSINT va xavfsizlik hisobotlarini tuzish ko'nikmalarini baholash uchun mo'ljallangan **3 bosqichli professional CTF musobaqa tizimidir**.

---

## 🏗️ Yangi Arxitektura: Markaziy Server & Shaxsiy Virtual Mashinalar (OVA)

Har bir ishtirokchining o'z laboratoriyasida to'qnashuvlarsiz ishlashi va flaglarni bir-biriga ulashishini (cheating/leak) oldini olish uchun tizim **Shaxsiy Token orqali Dinamik Flaglar** arxitekturasiga o'tkazildi:

```
┌─────────────────────────────────────────────────────────────────┐
│              MARKAZIY SERVER (Statik IP: 8080)                  │
│  1. Veb-Sayt: Ro'yxatdan o'tish (/register) va Kirish (/login)  │
│  2. Shaxsiy Kabinet (/portal): Har bir talabaga APEX-XXXX token │
│  3. Dinamik Flag Tekshiruvi: Shaxsiy token bo'yicha baholash    │
│  4. Katta Ekran: Jonli Hujum Matritsasi & Scoreboard (SSE)      │
│  5. Hakamlar Paneli (/admin): Natijalar, Excel eksport, Report  │
└────────────────────────────────▲────────────────────────────────┘
                                 │
                 Flag topshirish │ (Sayt orqali yoki check CLI)
                                 │
┌────────────────────────────────┴────────────────────────────────┐
│               ISHTIROKCHI VIRTUAL MASHINASI (OVA)               │
│  1. Talaba VMni yoqadi va terminalda buyruq beradi:             │
│     👉 apex-init                                                │
│  2. Saytdan olgan shaxsiy Tokenini kiritadi (masalan APEX-7F92) │
│  3. Barcha 17 ta topshiriq (L1..L7 va V1..V10) shu token        │
│     asosida generatsiya qilinadi:                               │
│     • 1-Bosqich (Linux Audit):  ~/apex_corp                     │
│     • 2-Bosqich (Web Pentest):  http://localhost:5000           │
│  4. Boshqa talabaning flagi sizga umuman to'g'ri kelmaydi!      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏆 1. Musobaqa Bosqichlari (3-Tier Lifecycle)

### 1-Bosqich: Linux Asoslari va Tizim Auditi (Jami 500 ball)
* Katalog: `~/apex_corp`
* **7 ta amaliy topshiriq:**
  1. `L1` (50 ball) — `01_hidden_station` (Yashirin fayllar: `ls -la`)
  2. `L2` (50 ball) — `02_system_logs` (Katta log oxiri: `tail -n 20`)
  3. `L3` (75 ball) — `03_employee_registry` (Xodimlar bazasidan qidirish: `grep`)
  4. `L4` (75 ball) — `04_lost_backups` (Chuqur kataloglardan fayl izlash: `find`)
  5. `L5` (75 ball) — `05_restricted_vault` (Fayl ruxsatlarini tiklash: `chmod`)
  6. `L6` (75 ball) — `06_archived_backups` (Siqilgan arxivni ochish: `tar -xzf`)
  7. `L7` (100 ball) — `07_git_repository` (Git commitlar tarixidan tiklash: `git log -p`)

### 2-Bosqich: Web Pentest — OWASP Top 10 Zaifliklar (Jami 3000 ball)
* Veb-sayt: `http://localhost:5000`
* Tizim xodimi: `asmith` / `spring2026`
* **10 ta korporativ zaiflik:**
  1. `V1` (100 ball) — Information Disclosure (`/.git/HEAD`)
  2. `V2` (150 ball) — User Enumeration & Response Header (`/login`)
  3. `V3` (200 ball) — Rate-Limit Bypass via `X-Forwarded-For` (`/portal/staff-login`)
  4. `V4` (250 ball) — Insecure Direct Object Reference (IDOR) (`/portal/employee/contract?id=1`)
  5. `V5` (250 ball) — Stored XSS & Admin Cookie Theft (`/support/ticket`)
  6. `V6` (300 ball) — LFI / Path Traversal (`/download?doc=../../vault/.env.vault`)
  7. `V7` (350 ball) — SQL Injection UNION-based (`/services/search`)
  8. `V8` (400 ball) — Insecure File Upload / Webshell Bypass (`/careers/apply`)
  9. `V9` (500 ball) — JWT Role Manipulation / Privilege Escalation (`/admin/executive-board`)
  10. `V10` (500 ball) — Remote Code Execution (RCE) (`/admin/diagnostics/ping`)

### 3-Bosqich: Professional Hodisa Hisoboti (Incident Report) (1000 ball)
* 2-bosqichda kamida **1200 ball** to'plagan ishtirokchilar uchun avtomatik ochiladi.
* Ishtirokchilar o'z portalida hisobot faylini (PDF yoki DOCX) yuklaydilar.
* Hakamlar paneli orqali hisobotlar xavfsiz tekshirilib baholanadi.

---

## 🚀 2. Tizimni Ishga Tushirish

### A. Markaziy Serverda (Sizning statik IP serveringizda):
```bash
# 1. Baza va talablar
bash install.sh

# 2. Markaziy Portal va Katta Ekran Matritsasini ishga tushirish (Port: 8080)
python3 dashboard/server.py &
```
* **Veb Portal (Ro'yxatdan o'tish):** `http://<SERVER_IP>:8080/register`
* **Katta Ekran (Jonli Matritsa):** `http://<SERVER_IP>:8080`
* **Hakamlar/Admin Paneli:** `http://<SERVER_IP>:8080/admin` (Parol: `admin2026`)

---

### B. Ishtirokchi Virtual Mashinasida (OVA):
1. Talaba markaziy saytdan ro'yxatdan o'tadi va o'zining **shaxsiy Tokenini** (masalan `APEX-7F92`) oladi.
2. Talaba virtual mashinani yoqadi va terminalda yozadi:
   ```bash
   apex-init
   ```
3. O'z tokenini kiritadi. Laboratoriya bir zumda faollashadi:
   * `cd ~/apex_corp` — 1-bosqich topshiriqlari
   * `http://localhost:5000` — 2-bosqich Web pentest
4. Topilgan flaglarni markaziy saytdagi **Shaxsiy Kabinetga (Portal)** kiritadi!
   (Yoki terminalda `check FLAG{...}` buyrug'i orqali ham tekshirishi mumkin).

---

## 🔒 3. Cheat-Proof (Flag almashishdan 100% himoya)

* Flaglar matematik HMAC-SHA256 formulasi asosida har bir token uchun maxsus hosil qilinadi:
  `FLAG{prefix_hash}`
* Agar **Ali** o'z flagini **Vali**ga bersa, Vali uni kiritganida tizim:
  `❌ Noto'g'ri flag! Flag sizning shaxsiy tokeningizga tegishli emas.`
  deb xatolik qaytaradi va ball bermaydi.
