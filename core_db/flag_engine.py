#!/usr/bin/env python3
"""
core_db/flag_engine.py — Deterministic Token-Based Flag Engine
Har bir ishtirokchi uchun individual va takrorlanmas flaglarni generatsiya qilish va tekshirish.
"""

import hashlib
import hmac
import re
import random
import string
from typing import Dict, Optional, Tuple, Any

# Yagona maxfiy tuz (Central Server va VM bir xil formuladan foydalanadi)
MASTER_SALT = "APEX_CORP_CTF_MASTER_SECRET_2026_DYNAMIC_SALT"

CHALLENGES: Dict[str, Dict[str, Any]] = {
    # 1-BOSQICH: Linux Tizim Auditi (7 ta amaliy topshiriq)
    "L1": {
        "code": "L1",
        "title": "Yashirin stansiya ma'lumotlari",
        "stage": 1,
        "points": 50,
        "category": "Linux CLI",
        "difficulty": "Oson",
        "prefix": "v2_linux_01_hidden_ls",
        "folder": "01_hidden_station",
        "description": "01_hidden_station katalogidagi yashirin fayllardan (.apex_sys_flag) favqulodda kirish kalitini toping."
    },
    "L2": {
        "code": "L2",
        "title": "Server loglaridan favqulodda kalit",
        "stage": 1,
        "points": 50,
        "category": "Log Analysis",
        "difficulty": "Oson",
        "prefix": "v2_linux_02_tail_log",
        "folder": "02_system_logs",
        "description": "Katta hajmli server_startup.log faylining eng so'nggi xabarlarini tahlil qiling va favqulodda tizim kalitini oling."
    },
    "L3": {
        "code": "L3",
        "title": "Xodimlar reestridan token qidirish",
        "stage": 1,
        "points": 75,
        "category": "Text Filtering",
        "difficulty": "O'rta",
        "prefix": "v2_linux_03_grep_filter",
        "folder": "03_employee_registry",
        "description": "employees.csv faylidan xavfsizlik audit boti (Security Bot) flagini qidirib toping."
    },
    "L4": {
        "code": "L4",
        "title": "Ichki arxivdan zaxira faylini topish",
        "stage": 1,
        "points": 75,
        "category": "File Search",
        "difficulty": "O'rta",
        "prefix": "v2_linux_04_find_path",
        "folder": "04_lost_backups",
        "description": "lost_backups katalogidagi chuqur papkalar ichidan yashirilgan .recovery_vault faylini toping."
    },
    "L5": {
        "code": "L5",
        "title": "Himoyalangan kassa ruxsatini tiklash",
        "stage": 1,
        "points": 75,
        "category": "Permissions",
        "difficulty": "O'rta",
        "prefix": "v2_linux_05_chmod_perms",
        "folder": "05_restricted_vault",
        "description": "restricted_vault ichidagi confidential.key fayliga kirish huquqini (chmod) tiklab, flagni o'qing."
    },
    "L6": {
        "code": "L6",
        "title": "Hodisalar arxivi paketini ochish",
        "stage": 1,
        "points": 75,
        "category": "Archives",
        "difficulty": "O'rta",
        "prefix": "v2_linux_06_tar_extract",
        "folder": "06_archived_backups",
        "description": "archived_backups ichidagi backup.tar.gz arxivini oching va incident_summary.log faylini o'qing."
    },
    "L7": {
        "code": "L7",
        "title": "Repozitoriy tarixidan o'chirilgan sir",
        "stage": 1,
        "points": 100,
        "category": "Git Forensics",
        "difficulty": "Qiyin",
        "prefix": "v2_linux_07_git_history",
        "folder": "07_git_repository",
        "description": "git_repository katalogida git commitlar tarixi orqali o'chirib yuborilgan maxfiy kalitni tiklang."
    },

    # 2-BOSQICH: Web Pentest (10 ta zaiflik)
    "V1": {
        "code": "V1",
        "title": "Yashirin Tizim Ma'lumotlari Oqishi",
        "stage": 2,
        "points": 100,
        "category": "Information Disclosure",
        "difficulty": "Oson",
        "prefix": "v2_infoleak_git_exposed",
        "endpoint": "/.git/HEAD",
        "description": "Ochiq qolgan .git katalogi orqali commit tarixidagi maxfiy flagni fosh qiling."
    },
    "V2": {
        "code": "V2",
        "title": "Xodimlar Pochtalarini Sanash",
        "stage": 2,
        "points": 150,
        "category": "User Enumeration",
        "difficulty": "Oson",
        "prefix": "v2_user_enum_apex_sec",
        "endpoint": "/login",
        "description": "Login formasida xodim pochtasini kiritganda javob headeri (X-Sec-Flag) orqali flagni oling."
    },
    "V3": {
        "code": "V3",
        "title": "Autentifikatsiya Cheklovini Buzish",
        "stage": 2,
        "points": 200,
        "category": "Rate-Limit Bypass",
        "difficulty": "O'rta",
        "prefix": "v2_auth_bypass_headers",
        "endpoint": "/portal/staff-login",
        "description": "X-Forwarded-For sarlavhasi orqali blokirovkani chetlab o'tib, asmith hisobi bilan xodim kabinetiga kiring."
    },
    "V4": {
        "code": "V4",
        "title": "Xodim Maxfiy Shartnomasini O'qish",
        "stage": 2,
        "points": 250,
        "category": "IDOR",
        "difficulty": "O'rta",
        "prefix": "v2_idor_confidential_contract",
        "endpoint": "/portal/employee/contract?id=1",
        "description": "ID=1 parametri bilan Direktorning (Dr. Robert Vance) maxfiy shartnomasi va flagni tortib oling."
    },
    "V5": {
        "code": "V5",
        "title": "Mijozlar Chatida Cookie O'g'irlash",
        "stage": 2,
        "points": 250,
        "category": "Stored XSS",
        "difficulty": "O'rta",
        "prefix": "v2_stored_xss_cookie_theft",
        "endpoint": "/support/ticket",
        "description": "Ticket formasiga XSS skripti kiritib administrator sesiyasi cookie flagini qo'lga kiriting."
    },
    "V6": {
        "code": "V6",
        "title": "Server Konfiguratsiya Faylini O'qish",
        "stage": 2,
        "points": 300,
        "category": "LFI / Path Traversal",
        "difficulty": "Qiyin",
        "prefix": "v2_lfi_path_traversal_master",
        "endpoint": "/download?doc=../../vault/.env.vault",
        "description": "Path traversal orqali serverning ichki vault/.env.vault konfiguratsiya faylini o'qing."
    },
    "V7": {
        "code": "V7",
        "title": "Maxfiy Ombor Ma'lumotlarini Olish",
        "stage": 2,
        "points": 350,
        "category": "SQL Injection",
        "difficulty": "Qiyin",
        "prefix": "v2_sqli_union_secret_extract",
        "endpoint": "/services/search?q=' UNION SELECT 1,secret_key,classification,description FROM enterprise_secrets--",
        "description": "Qidiruv maydonida SQLi orqali enterprise_secrets maxfiy jadvalidan flagni chiqarib oling."
    },
    "V8": {
        "code": "V8",
        "title": "Filtrni Buzib Webshell Yuklash",
        "stage": 2,
        "points": 400,
        "category": "File Upload Bypass",
        "difficulty": "Qiyin",
        "prefix": "v2_fileupload_bypass_webshell",
        "endpoint": "/careers/apply",
        "description": "Filtrni chetlab o'tib webshell faylini serverga yuklang va tahlil natijasidagi flagni oling."
    },
    "V9": {
        "code": "V9",
        "title": "Boshqaruv Kengashini Egallash",
        "stage": 2,
        "points": 500,
        "category": "Privilege Escalation",
        "difficulty": "Kritik",
        "prefix": "v2_priv_esc_jwt_admin_takeover",
        "endpoint": "/admin/executive-board",
        "description": "JWT tokendagi rolni manipulyatsiya qilib Superadmin panelini to'liq qo'lga kiriting."
    },
    "V10": {
        "code": "V10",
        "title": "Bosh Serverni Masofadan Buzish (RCE)",
        "stage": 2,
        "points": 500,
        "category": "Remote Code Execution",
        "difficulty": "Kritik",
        "prefix": "v2_rce_apex_vault_breach",
        "endpoint": "/admin/diagnostics/ping",
        "description": "Tarmoq diagnostika utilitasida buyruq inyeksiyasi orqali master_flag.txt faylini o'qing."
    }
}

def normalize_token(token: Optional[str]) -> str:
    """Tokenni tozalash va standart formatga keltirish."""
    if not token:
        return "APEX-DEFAULT"
    cleaned = token.strip().upper()
    return cleaned

def generate_random_token() -> str:
    """Yangi ishtirokchi uchun qulay 8 belgili token yaratish: APEX-XXXX (masalan APEX-7F92)."""
    chars = string.ascii_uppercase + string.digits
    # Adashmaslik uchun 0, O, 1, I kabi chalkash belgilarni chiqaramiz
    safe_chars = [c for c in chars if c not in ("0", "O", "1", "I")]
    suffix = "".join(random.choices(safe_chars, k=4))
    return f"APEX-{suffix}"

def compute_flag_hash(token: str, challenge_code: str) -> str:
    """HMAC-SHA256 yordamida deterministik 8 xonali hesh hisoblash."""
    norm_token = normalize_token(token)
    message = f"{norm_token}:{challenge_code}".encode("utf-8")
    return hmac.new(MASTER_SALT.encode("utf-8"), message, hashlib.sha256).hexdigest()[:8]

def get_flag(token: str, challenge_code: str) -> str:
    """Berilgan token va topshiriq kodi uchun unikal flag qaytarish."""
    info = CHALLENGES.get(challenge_code)
    if not info:
        return ""
    h = compute_flag_hash(token, challenge_code)
    return f"FLAG{{{info['prefix']}_{h}}}"

def get_all_flags(token: str) -> Dict[str, str]:
    """Token uchun barcha 17 ta topshiriq flaglarini lug'atda qaytarish."""
    return {code: get_flag(token, code) for code in CHALLENGES}

def verify_submitted_flag(token: str, submitted_flag: str) -> Optional[str]:
    """
    Kiritilgan flag ushbu ishtirokchining qaysi topshirig'iga tegishli ekanini aniqlash.
    Agar mos kelsa topshiriq kodi (masalan 'L1' yoki 'V4') qaytadi, aks holda None.
    """
    clean_sub = submitted_flag.strip()
    if not clean_sub:
        return None

    for code in CHALLENGES:
        expected = get_flag(token, code)
        if clean_sub == expected:
            return code
    return None

if __name__ == "__main__":
    # Test namoyishi
    t1 = "APEX-A7F2"
    t2 = "APEX-B8C3"
    print(f"Token {t1} uchun L1:", get_flag(t1, "L1"))
    print(f"Token {t2} uchun L1:", get_flag(t2, "L1"))
    print(f"Token {t1} uchun V10:", get_flag(t1, "V10"))
    print(f"Token {t2} uchun V10:", get_flag(t2, "V10"))
    assert get_flag(t1, "L1") != get_flag(t2, "L1"), "Flaglar turlicha bo'lishi shart!"
    assert verify_submitted_flag(t1, get_flag(t1, "V4")) == "V4"
    assert verify_submitted_flag(t2, get_flag(t1, "V4")) is None, "Birovning flagi o'tmasligi kerak!"
    print("[+] Testlar muvaffaqiyatli yakunlandi!")
