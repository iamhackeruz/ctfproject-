-- CTF v2 Central Unified Database Schema
-- SQLite WAL mode for high concurrency during live competitions

PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;

-- Ishtirokchilar / Talabalar jadvali
CREATE TABLE IF NOT EXISTS participants (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    username          TEXT UNIQUE NOT NULL,
    full_name         TEXT NOT NULL,
    token             TEXT UNIQUE NOT NULL, -- Shaxsiy identifikatsiya kodi (masalan: APEX-7F92)
    password_hash     TEXT,
    phone             TEXT,
    telegram_id       INTEGER UNIQUE,
    ssh_password      TEXT,
    current_stage     INTEGER DEFAULT 1,    -- 1: Linux CTF, 2: Web Pentest, 3: Reporting, 4: Finished
    stage1_solved     INTEGER DEFAULT 0,
    stage1_flag       TEXT,
    stage1_time       DATETIME,
    stage2_score      INTEGER DEFAULT 0,
    stage3_unlocked   INTEGER DEFAULT 0,    -- 1 bo'lganda Reporting ochiladi (score >= 1200)
    report_file       TEXT,                 -- Yuklangan hisobot fayli (PDF/DOCX)
    report_submitted_at DATETIME,
    report_score      INTEGER DEFAULT 0,    -- Hakamlar qo'ygan ball (0-1000)
    report_feedback   TEXT,                 -- Hakamlar izohi
    report_read       INTEGER DEFAULT 0,    -- Admin tomonidan o'qilganlik holati (0: o'qilmagan, 1: o'qilgan)
    total_score       INTEGER DEFAULT 0,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen         DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 1-bosqich: Linux amaliy topshiriqlari (L1..L7)
CREATE TABLE IF NOT EXISTS stage1_solves (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL,
    task_code      TEXT NOT NULL,
    flag_submitted TEXT NOT NULL,
    points_awarded INTEGER NOT NULL,
    solved_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
    UNIQUE(participant_id, task_code)
);

-- 2-bosqich: 10 ta Web Zaifliklar
CREATE TABLE IF NOT EXISTS challenges (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    code          TEXT UNIQUE NOT NULL, -- V1, V2, ... V10
    title         TEXT NOT NULL,
    vuln_type     TEXT NOT NULL,
    difficulty    TEXT NOT NULL,        -- Oson, O'rta, Qiyin, Kritik
    points        INTEGER NOT NULL,
    flag_pattern  TEXT NOT NULL,
    description   TEXT
);

-- Topshirilgan Web flaglar (muvaffaqiyatli solves)
CREATE TABLE IF NOT EXISTS solves (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL,
    challenge_id   INTEGER NOT NULL,
    flag_submitted TEXT NOT NULL,
    points_awarded INTEGER NOT NULL,
    solved_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
    FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
    UNIQUE(participant_id, challenge_id)
);

-- Barcha urinishlar logi (xato va to'g'ri)
CREATE TABLE IF NOT EXISTS attempts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER,
    stage          INTEGER,
    challenge_code TEXT,
    flag_given     TEXT,
    is_correct     INTEGER,
    ip_address     TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Jonli ekran (Live Ticker / News Feed)
CREATE TABLE IF NOT EXISTS activity_feed (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id   INTEGER,
    participant_name TEXT NOT NULL,
    event_type       TEXT NOT NULL, -- solve, stage_unlock, report_submit, lead_change, join
    message          TEXT NOT NULL,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Boshlang'ich 10 ta Web zaiflikni kiritish
INSERT OR IGNORE INTO challenges (id, code, title, vuln_type, difficulty, points, flag_pattern, description) VALUES
(1,  'V1',  'Yashirin Tizim Ma''lumotlari Oqishi', 'Information Disclosure', 'Oson',   100, 'FLAG{v2_infoleak_git_exposed}',     'Ochiq .git katalogi orqali commit tarixidagi maxfiy flagni fosh qiling'),
(2,  'V2',  'Xodimlar Pochtalarini Sanash',         'User Enumeration',       'Oson',   150, 'FLAG{v2_user_enum_apex_sec}',      'Login sahifasida xatolik sarlavhalari orqali xodimlarni aniqlash'),
(3,  'V3',  'Autentifikatsiya Cheklovini Buzish',  'Rate-Limit Bypass',      'O''rta',  200, 'FLAG{v2_auth_bypass_headers}',     'X-Forwarded-For orqali cheklovni aylanib o''tib xodim hisobiga kirish'),
(4,  'V4',  'Xodim Maxfiy Shartnomasini O''qish',  'IDOR',                   'O''rta',  250, 'FLAG{v2_idor_confidential_contract}', 'ID parametrini o''zgartirib direktor profili va shartnomasini tortib olish'),
(5,  'V5',  'Mijozlar Chatida Cookie O''g''irlash',  'Stored XSS',             'O''rta',  250, 'FLAG{v2_stored_xss_cookie_theft}',  'Ticket formasiga XSS payload kiritib administrator sesiyasini qo''lga kiritish'),
(6,  'V6',  'Server Konfiguratsiya Faylini O''qish', 'LFI / Path Traversal',   'Qiyin',  300, 'FLAG{v2_lfi_path_traversal_master}', 'Hujjat yuklab olish parametri orqali server ichki vault/.env.vault faylini o''qish'),
(7,  'V7',  'Maxfiy Ombor Ma''lumotlarini Olish',   'SQL Injection (UNION)',  'Qiyin',  350, 'FLAG{v2_sqli_union_secret_extract}', 'Qidiruv parametrida SQLi orqali enterprise_secrets jadvalidan flagni olish'),
(8,  'V8',  'Filtrni Buzib Webshell Yuklash',      'File Upload Bypass',     'Qiyin',  400, 'FLAG{v2_fileupload_bypass_webshell}', 'Fayl tekshiruvini chetlab o''tib webshell yuklash va buyruq bajarish'),
(9,  'V9',  'Boshqaruv Kengashini Egallash',        'Privilege Escalation',   'Kritik', 500, 'FLAG{v2_priv_esc_jwt_admin_takeover}', 'JWT tokenni manipulyatsiya qilib Superadmin panelini to''liq qo''lga kiritish'),
(10, 'V10', 'Bosh Serverni Masofadan Buzish (RCE)', 'Remote Code Execution',   'Kritik', 500, 'FLAG{v2_rce_apex_vault_breach}',     'Tarmoq diagnostika utilitasida buyruq inyeksiyasi orqali master_flag.txt flagini olish');

CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(username);
CREATE INDEX IF NOT EXISTS idx_participants_token ON participants(token);
CREATE INDEX IF NOT EXISTS idx_participants_stage ON participants(current_stage);
CREATE INDEX IF NOT EXISTS idx_solves_user ON solves(participant_id);
CREATE INDEX IF NOT EXISTS idx_activity_time ON activity_feed(created_at);
