#!/usr/bin/env python3
"""
stage2_web/app/db_init.py — Apex Global Technologies Corporate Database
Token asosida dinamik Web zaifliklar bazasi va maxfiy fayllarni tayyorlash.
"""

import os
import sys
import sqlite3

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = CURRENT_DIR
STAGE2_DIR = os.path.dirname(APP_DIR)
PROJECT_ROOT = os.path.dirname(STAGE2_DIR)
sys.path.insert(0, PROJECT_ROOT)

from core_db import flag_engine

DB_PATH = os.getenv("APEX_DB_PATH", os.path.join(CURRENT_DIR, "apex_corp.db"))


def init_apex_db(db_path: str = DB_PATH, token: str = "APEX-DEFAULT"):
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)

    # Flaglarni hisoblash
    v1_flag = flag_engine.get_flag(token, "V1")
    v4_flag = flag_engine.get_flag(token, "V4")
    v6_flag = flag_engine.get_flag(token, "V6")
    v7_flag = flag_engine.get_flag(token, "V7")
    v10_flag = flag_engine.get_flag(token, "V10")

    # 🚩 V1: Git Leak faylini yaratish
    git_dir = os.path.join(CURRENT_DIR, ".git")
    os.makedirs(git_dir, exist_ok=True)
    head_file = os.path.join(git_dir, "HEAD")
    with open(head_file, "w", encoding="utf-8") as f:
        f.write(f"ref: refs/heads/main\n# APEX GLOBAL TECHNOLOGIES SOURCE LEAK\n# COMMIT_ID: c0ffee991a2bc4500018274\n# DEVELOPER_NOTE: Flag for internal audit: {v1_flag}\n")

    # 🚩 V6 & V10: Vault fayllarini yangilash
    vault_dir = os.path.join(CURRENT_DIR, "vault")
    os.makedirs(vault_dir, exist_ok=True)
    env_content = f"# APEX ENTERPRISE VAULT CONFIGURATION\nVAULT_VERSION=2.4.1\nVAULT_SECURITY_TIER=CRITICAL\nLFI_AUDIT_KEY={v6_flag}\n"
    with open(os.path.join(vault_dir, ".env"), "w", encoding="utf-8") as f:
        f.write(env_content)
    with open(os.path.join(vault_dir, ".env.vault"), "w", encoding="utf-8") as f:
        f.write(env_content)

    master_flag_file = os.path.join(vault_dir, "master_flag.txt")
    with open(master_flag_file, "w", encoding="utf-8") as f:
        f.write(f"================================================================================\nAPEX MASTER ROOT VAULT FLAG (RCE BREACH):\n{v10_flag}\n================================================================================\n")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        department TEXT NOT NULL,
        salary TEXT NOT NULL,
        contract_details TEXT NOT NULL
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS enterprise_secrets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        secret_key TEXT NOT NULL,
        classification TEXT NOT NULL,
        description TEXT NOT NULL
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS support_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_name TEXT NOT NULL,
        email TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        admin_reply TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 🚩 V4: Xodimlar jadvali (Direktor shartnomasi ichidagi IDOR flag)
    cur.execute("DELETE FROM employees;")
    employees = [
        (1, "Dr. Robert Vance", "ceo@apextech.com", "Vance$Apex$2026!Master", "CEO", "Executive Board", "$250,000",
         f"CONFIDENTIAL: Korporativ boshqaruv shartnomasi #AGT-001. Maxfiy kirish kodi: {v4_flag}. Bank rekvizitlari: CH-9821-4401."),
        (2, "Elena Rostova", "erostova@apextech.com", "ElenaRostova#Secure99", "CTO", "Information Security", "$180,000",
         "Shartnoma #AGT-002: Bosh texnologiya xavfsizligi kafolati."),
        (3, "Adam Smith", "asmith@apextech.com", "spring2026", "Systems Engineer", "Cloud Infrastructure", "$85,000",
         "Shartnoma #AGT-104: Tizim ma'murligi va serverlar nazorati. O'z lavozim vazifalariga ko'ra oddiy muhandis hisobi."),
        (4, "Sarah Connor", "sconnor@apextech.com", "Terminator#2026", "DevOps Engineer", "Cloud Infrastructure", "$95,000",
         "Shartnoma #AGT-105: CI/CD quvurlari va Docker konteynerlar boshqaruvi."),
        (5, "Michael Chang", "mchang@apextech.com", "Chang$Financials!44", "CFO", "Finance & Audit", "$160,000",
         "Shartnoma #AGT-003: Moliyaviy oqimlar va choraklik daromadlar auditi.")
    ]
    cur.executemany("INSERT INTO employees VALUES (?, ?, ?, ?, ?, ?, ?, ?)", employees)

    cur.execute("DELETE FROM services;")
    services = [
        (1, "Apex Shield Enterprise", "Cybersecurity", "Next-gen xavfsizlik devori va real-vaqt tahdidlarni aniqlash tizimi."),
        (2, "Apex Cloud Infrastructure", "Cloud Services", "Yuqori unumdorlikka ega xavfsiz korporativ bulutli klasterlar."),
        (3, "Apex Forensic Audit", "Audit & Compliance", "Kiberxavfsizlik hodisalarini tahlil qilish va zaxira nusxalar tekshiruvi."),
        (4, "Apex ZeroTrust Gateway", "Access Control", "Korxona xodimlari uchun ko'p bosqichli Zero Trust autentifikatsiya shlyuzi."),
        (5, "Apex Threat Hunting", "Intelligence", "Proaktiv tarmoq skaneri va anomaliyalarni sun'iy intellekt orqali aniqlash.")
    ]
    cur.executemany("INSERT INTO services VALUES (?, ?, ?, ?)", services)

    # 🚩 V7: Maxfiy jadval (SQLi flag)
    cur.execute("DELETE FROM enterprise_secrets;")
    secrets = [
        (1, v7_flag, "TOP_SECRET_LEVEL_4", "Markaziy Korporativ Ma'lumotlar Bazasi shifrlash kaliti va zaxira shlyuzi."),
        (2, "DB_MASTER_KEY_0x9923AFB412", "CONFIDENTIAL", "Bosh MySQL klasteri ma'muriy paroli."),
        (3, "SWIFT_GATEWAY_TOKEN_PRIVATE", "RESTRICTED", "Banklararo xalqaro to'lov shlyuzining API tokenni.")
    ]
    cur.executemany("INSERT INTO enterprise_secrets VALUES (?, ?, ?, ?)", secrets)

    cur.execute("DELETE FROM support_tickets;")
    tickets = [
        (1, "David Miller", "dmiller@partner.com", "API Integratsiyasi haqida", "Salom, biz Apex Shield API bilan ulanishda 403 xatolik olayapmiz.", "Ko'rib chiqildi, IP oq ro'yxatga olindi.")
    ]
    cur.executemany("INSERT INTO support_tickets (id, client_name, email, subject, message, admin_reply) VALUES (?, ?, ?, ?, ?, ?)", tickets)

    conn.commit()
    conn.close()
    print(f"[+] Apex Corp Database yangilandi (Token: {token}): {db_path}")


if __name__ == "__main__":
    t = sys.argv[1] if len(sys.argv) > 1 else "APEX-DEFAULT"
    init_apex_db(token=t)
