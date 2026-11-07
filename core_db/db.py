#!/usr/bin/env python3
"""
core_db/db.py — CTF v2 Database Helper Module (Token-Based Dynamic Flags)
Barcha komponentlar (Web Target, Dashboard, Student Portal, Admin) uchun yagona baza interfeysi.
"""

import os
import sqlite3
import hashlib
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
LOCAL_DB_PATH = os.path.join(CURRENT_DIR, "ctf_v2.db")
DB_PATH = os.getenv("CTF_DB_PATH", "/var/ctf/ctf_v2.db")
SCHEMA_PATH = os.path.join(CURRENT_DIR, "schema.sql")

from core_db import flag_engine

STAGE3_UNLOCK_SCORE = 1200  # 1200 ball to'planganda 3-bosqich (Reporting) ochiladi!
STAGE1_SOLVE_POINTS = 500   # 1-bosqichni to'liq yechganlik uchun jami ball
STAGE1_FLAG = "FLAG{v2_linux_corporate_foothold_apex_7781}"  # Zaxira master flag

STAGE1_TASKS = [
    {
        "code": "L1",
        "title": "Yashirin stansiya ma'lumotlari",
        "points": 50,
        "folder": "01_hidden_station",
    },
    {
        "code": "L2",
        "title": "Server loglaridan favqulodda kalit",
        "points": 50,
        "folder": "02_system_logs",
    },
    {
        "code": "L3",
        "title": "Xodimlar reestridan token qidirish",
        "points": 75,
        "folder": "03_employee_registry",
    },
    {
        "code": "L4",
        "title": "Ichki arxivdan zaxira faylini topish",
        "points": 75,
        "folder": "04_lost_backups",
    },
    {
        "code": "L5",
        "title": "Himoyalangan kassa ruxsatini tiklash",
        "points": 75,
        "folder": "05_restricted_vault",
    },
    {
        "code": "L6",
        "title": "Hodisalar arxivi paketini ochish",
        "points": 75,
        "folder": "06_archived_backups",
    },
    {
        "code": "L7",
        "title": "Repozitoriy tarixidan o'chirilgan sir",
        "points": 100,
        "folder": "07_git_repository",
    },
]


def hash_password(password: str) -> str:
    """Parolni SHA256 bilan heshlash."""
    return hashlib.sha256(f"apex_salt_{password}".encode("utf-8")).hexdigest()


def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    global DB_PATH
    target = db_path or DB_PATH
    target_dir = os.path.dirname(os.path.abspath(target))
    try:
        os.makedirs(target_dir, exist_ok=True)
    except PermissionError:
        DB_PATH = LOCAL_DB_PATH
        target = LOCAL_DB_PATH
        os.makedirs(os.path.dirname(os.path.abspath(target)), exist_ok=True)
    conn = sqlite3.connect(target, timeout=10.0)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode = WAL")
    except sqlite3.OperationalError:
        pass
    conn.execute("PRAGMA busy_timeout = 5000")
    conn.execute("PRAGMA foreign_keys = ON")

    # Avtomatik jadvallarni tekshirish va migratsiya
    try:
        check_table = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='participants'").fetchone()
        if not check_table:
            with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
                conn.executescript(f.read())
            conn.commit()
        else:
            # Ustunlarni tekshirish va yetishmayotganlarini qo'shish (Auto-migration)
            columns = [row["name"] for row in conn.execute("PRAGMA table_info(participants)").fetchall()]
            if "token" not in columns:
                conn.execute("ALTER TABLE participants ADD COLUMN token TEXT")
                conn.commit()
                # Mavjud userlarga unikal token berish
                users = conn.execute("SELECT id FROM participants WHERE token IS NULL OR token = ''").fetchall()
                for u in users:
                    conn.execute("UPDATE participants SET token = ? WHERE id = ?", (flag_engine.generate_random_token(), u["id"]))
                conn.commit()
            if "password_hash" not in columns:
                conn.execute("ALTER TABLE participants ADD COLUMN password_hash TEXT")
                conn.commit()
            
            # stage1_solves jadvalini tekshirish
            conn.execute("""
                CREATE TABLE IF NOT EXISTS stage1_solves (
                    id             INTEGER PRIMARY KEY AUTOINCREMENT,
                    participant_id INTEGER NOT NULL,
                    task_code      TEXT NOT NULL,
                    flag_submitted TEXT NOT NULL,
                    points_awarded INTEGER NOT NULL,
                    solved_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
                    UNIQUE(participant_id, task_code)
                )
            """)
            conn.commit()
    except Exception:
        pass

    return conn


def init_db(db_path: Optional[str] = None):
    """Bazani to'liq yangidan yaratish."""
    conn = get_connection(db_path)
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        conn.executescript(f.read())
    conn.commit()
    conn.close()


def register_participant(username: str, full_name: str, password: Optional[str] = None,
                         phone: Optional[str] = None, telegram_id: Optional[int] = None,
                         ssh_password: Optional[str] = None, token: Optional[str] = None) -> Dict[str, Any]:
    """Yangi ishtirokchini ro'yxatdan o'tkazish va unga shaxsiy Token taqdim etish."""
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM participants WHERE username = ?", (username.strip(),))
    existing = cur.fetchone()
    if existing:
        conn.close()
        return dict(existing)

    user_token = token or flag_engine.generate_random_token()
    p_hash = hash_password(password) if password else (hash_password(ssh_password) if ssh_password else None)

    cur.execute("""
        INSERT INTO participants (username, full_name, token, password_hash, phone, telegram_id, ssh_password, current_stage, stage1_solved, stage2_score, stage3_unlocked, total_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 0, 0, 0)
    """, (username.strip(), full_name.strip(), user_token, p_hash, phone, telegram_id, ssh_password))
    participant_id = cur.lastrowid

    # Activity feed (xavfsizlik uchun Token matritsada ko'rsatilmaydi)
    cur.execute("""
        INSERT INTO activity_feed (participant_id, participant_name, event_type, message)
        VALUES (?, ?, 'join', ?)
    """, (participant_id, full_name.strip(), f"👋 {full_name.strip()} arena safiga qo'shildi!"))

    conn.commit()
    cur.execute("SELECT * FROM participants WHERE id = ?", (participant_id,))
    res = dict(cur.fetchone())
    conn.close()
    return res


def authenticate_participant(username: str, password: str) -> Optional[Dict[str, Any]]:
    """Portalga kirishda ishtirokchi logini va parolini tekshirish."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM participants WHERE username = ?", (username.strip(),))
    p = cur.fetchone()
    conn.close()
    if not p:
        return None

    expected_hash = hash_password(password)
    if p["password_hash"] == expected_hash:
        return dict(p)
    # Zaxira: agar eski plain text parol bo'lsa
    if p["ssh_password"] == password:
        return dict(p)
    return None


def get_participant_by_user(username: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM participants WHERE username = ?", (username.strip(),))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def get_participant_by_token(token: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    norm = flag_engine.normalize_token(token)
    cur.execute("SELECT * FROM participants WHERE token = ?", (norm,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def get_participant_by_id(participant_id: int) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM participants WHERE id = ?", (participant_id,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def submit_flag_dynamic(participant_id: int, flag: str, ip_address: Optional[str] = None) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Shaxsiy Token asosida dinamik flag topshirish (L1..L7 va V1..V10 uchun universal).
    """
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM participants WHERE id = ?", (participant_id,))
    p = cur.fetchone()
    if not p:
        conn.close()
        return False, "Ishtirokchi topilmadi.", {}

    token = p["token"] or "APEX-DEFAULT"
    flag_clean = flag.strip()

    # Flag aynan shu ishtirokchining qaysi topshirig'iga tegishli ekanini tekshiramiz
    matched_code = flag_engine.verify_submitted_flag(token, flag_clean)

    # Zaxira: agar eski master flag kiritilgan bo'lsa
    if not matched_code and flag_clean == STAGE1_FLAG:
        matched_code = "L_MASTER"

    if not matched_code:
        cur.execute("INSERT INTO attempts (participant_id, stage, flag_given, is_correct, ip_address) VALUES (?, ?, ?, 0, ?)",
                    (participant_id, p["current_stage"], flag_clean, ip_address))
        conn.commit()
        conn.close()
        return False, "❌ Noto'g'ri flag! Flag sizning shaxsiy tokeningizga tegishli emas yoki noto'g'ri kiritildi.", {}

    # 1. LINUX TOPShIRIQLARI (L1..L7)
    if matched_code.startswith("L"):
        if matched_code == "L_MASTER":
            for t in STAGE1_TASKS:
                cur.execute("""
                    INSERT OR IGNORE INTO stage1_solves (participant_id, task_code, flag_submitted, points_awarded)
                    VALUES (?, ?, ?, ?)
                """, (participant_id, t["code"], flag_clean, t["points"]))
            cur.execute("""
                UPDATE participants
                SET stage1_solved = 1, current_stage = CASE WHEN current_stage < 2 THEN 2 ELSE current_stage END,
                    total_score = total_score + ?
                WHERE id = ? AND stage1_solved = 0
            """, (STAGE1_SOLVE_POINTS, participant_id))
            conn.commit()
            conn.close()
            return True, f"🎉 1-bosqich (Linux) to'liq topshirildi (+{STAGE1_SOLVE_POINTS} ball)!", {"code": "L_ALL", "points": STAGE1_SOLVE_POINTS}

        task_info = flag_engine.CHALLENGES[matched_code]
        cur.execute("SELECT id FROM stage1_solves WHERE participant_id = ? AND task_code = ?", (participant_id, matched_code))
        if cur.fetchone():
            conn.close()
            return False, f"⚠️ Ushbu topshiriq ({matched_code}: {task_info['title']}) allaqachon topshirilgan!", {"code": matched_code}

        points = task_info["points"]
        cur.execute("""
            INSERT INTO stage1_solves (participant_id, task_code, flag_submitted, points_awarded)
            VALUES (?, ?, ?, ?)
        """, (participant_id, matched_code, flag_clean, points))

        cur.execute("UPDATE participants SET total_score = total_score + ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?", (points, participant_id))

        # 1-bosqich to'liq yakunlandimi?
        cur.execute("SELECT COUNT(*) FROM stage1_solves WHERE participant_id = ?", (participant_id,))
        solved_count = cur.fetchone()[0]
        total_s1 = len(STAGE1_TASKS)

        cur.execute("""
            INSERT INTO activity_feed (participant_id, participant_name, event_type, message)
            VALUES (?, ?, 'stage1_task', ?)
        """, (participant_id, p["full_name"], f"💻 {p['full_name']} [{matched_code}: {task_info['title']}] topshirig'ini bajardi! (+{points} ball)"))

        if solved_count >= total_s1:
            cur.execute("""
                UPDATE participants
                SET stage1_solved = 1, current_stage = CASE WHEN current_stage < 2 THEN 2 ELSE current_stage END
                WHERE id = ?
            """, (participant_id,))
            cur.execute("""
                INSERT INTO activity_feed (participant_id, participant_name, event_type, message)
                VALUES (?, ?, 'stage1_pass', ?)
            """, (participant_id, p["full_name"], f"🎉 {p['full_name']} 1-bosqich (Linux) barcha topshiriqlarini yakunladi va 2-bosqichga o'tdi!"))

        conn.commit()
        conn.close()
        return True, f"✅ Barakalla! [{matched_code}: {task_info['title']}] muvaffaqiyatli topshirildi (+{points} ball)!", {"code": matched_code, "points": points, "title": task_info["title"]}

    # 2. WEB TOPShIRIQLARI (V1..V10)
    if matched_code.startswith("V"):
        task_info = flag_engine.CHALLENGES[matched_code]
        cur.execute("SELECT id FROM challenges WHERE code = ?", (matched_code,))
        ch_row = cur.fetchone()
        ch_id = ch_row["id"] if ch_row else int(matched_code[1:])

        cur.execute("SELECT id FROM solves WHERE participant_id = ? AND challenge_id = ?", (participant_id, ch_id))
        if cur.fetchone():
            conn.close()
            return False, f"⚠️ Ushbu zaiflik ({matched_code}: {task_info['title']}) allaqachon topshirilgan!", {"code": matched_code}

        points = task_info["points"]
        cur.execute("""
            INSERT INTO solves (participant_id, challenge_id, flag_submitted, points_awarded)
            VALUES (?, ?, ?, ?)
        """, (participant_id, ch_id, flag_clean, points))

        cur.execute("""
            UPDATE participants
            SET stage2_score = stage2_score + ?,
                total_score = total_score + ?,
                stage3_unlocked = CASE WHEN (stage2_score + ?) >= ? THEN 1 ELSE stage3_unlocked END,
                current_stage = CASE WHEN (stage2_score + ?) >= ? AND current_stage < 3 THEN 3 ELSE current_stage END,
                last_seen = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (points, points, points, STAGE3_UNLOCK_SCORE, points, STAGE3_UNLOCK_SCORE, participant_id))

        cur.execute("SELECT stage2_score, stage3_unlocked FROM participants WHERE id = ?", (participant_id,))
        up_p = cur.fetchone()
        unlocked_now = bool(up_p["stage3_unlocked"] and not p["stage3_unlocked"])

        cur.execute("""
            INSERT INTO activity_feed (participant_id, participant_name, event_type, message)
            VALUES (?, ?, 'solve', ?)
        """, (participant_id, p["full_name"], f"🔥 {p['full_name']} [{matched_code}: {task_info['title']}] zaifligini fosh qildi! (+{points} ball)"))

        if unlocked_now:
            cur.execute("""
                INSERT INTO activity_feed (participant_id, participant_name, event_type, message)
                VALUES (?, ?, 'stage_unlock', ?)
            """, (participant_id, p["full_name"], f"🚀 TABRIKLAYMIZ! {p['full_name']} {up_p['stage2_score']} ball to'plab 3-bosqich (Reporting) ga yo'llanma oldi!"))

        conn.commit()
        conn.close()
        return True, f"🔥 Ajoyib! [{matched_code}: {task_info['title']}] muvaffaqiyatli fosh qilindi (+{points} ball)!", {"code": matched_code, "points": points, "title": task_info["title"]}

    conn.close()
    return False, "Noma'lum xatolik yuz berdi.", {}


def get_participant_portal_data(participant_id: int) -> Dict[str, Any]:
    """Ishtirokchi shaxsiy portali uchun to'liq progress va topshiriqlar ro'yxati."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM participants WHERE id = ?", (participant_id,))
    p_row = cur.fetchone()
    if not p_row:
        conn.close()
        return {}

    participant = dict(p_row)

    # 1-bosqich solves
    cur.execute("SELECT task_code, solved_at FROM stage1_solves WHERE participant_id = ?", (participant_id,))
    s1_map = {r["task_code"]: r["solved_at"] for r in cur.fetchall()}

    # 2-bosqich solves
    cur.execute("""
        SELECT c.code, s.solved_at
        FROM solves s
        JOIN challenges c ON s.challenge_id = c.id
        WHERE s.participant_id = ?
    """, (participant_id,))
    s2_map = {r["code"]: r["solved_at"] for r in cur.fetchall()}

    conn.close()

    stage1_tasks = []
    for code, info in flag_engine.CHALLENGES.items():
        if info["stage"] == 1:
            is_solved = code in s1_map
            stage1_tasks.append({
                **info,
                "solved": is_solved,
                "solved_at": s1_map.get(code)
            })

    stage2_tasks = []
    for code, info in flag_engine.CHALLENGES.items():
        if info["stage"] == 2:
            is_solved = code in s2_map
            stage2_tasks.append({
                **info,
                "solved": is_solved,
                "solved_at": s2_map.get(code)
            })

    return {
        "participant": participant,
        "token": participant.get("token"),
        "stage1_tasks": stage1_tasks,
        "stage2_tasks": stage2_tasks,
        "stage1_solved_count": len(s1_map),
        "stage1_total_count": len(stage1_tasks),
        "stage2_solved_count": len(s2_map),
        "stage2_total_count": len(stage2_tasks),
        "stage3_threshold": STAGE3_UNLOCK_SCORE
    }


def submit_report(participant_id: int, report_file_path: str) -> Tuple[bool, str]:
    """3-bosqich (Hisobot) faylini qabul qilish."""
    try:
        from stage3_reporting.sanitizer import check_file_safety
        is_safe, scan_msg, meta = check_file_safety(report_file_path)
        if not is_safe:
            return False, f"Xavfsizlik tekshiruvidan o'tmadi: {scan_msg}"
    except Exception:
        pass

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM participants WHERE id = ?", (participant_id,))
    p = cur.fetchone()
    if not p:
        conn.close()
        return False, "Ishtirokchi topilmadi."

    if not p["stage3_unlocked"]:
        conn.close()
        return False, f"Siz hali 3-bosqichga o'tmagansiz (Kamida {STAGE3_UNLOCK_SCORE} ball to'plashingiz kerak)."

    cur.execute("""
        UPDATE participants
        SET report_file = ?,
            report_submitted_at = CURRENT_TIMESTAMP,
            report_read = 0,
            current_stage = 4
        WHERE id = ?
    """, (report_file_path, participant_id))

    cur.execute("""
        INSERT INTO activity_feed (participant_id, participant_name, event_type, message)
        VALUES (?, ?, 'report_submit', ?)
    """, (participant_id, p["full_name"], f"📝 {p['full_name']} musobaqa hisobotini hakamlarga topshirdi!"))

    conn.commit()
    conn.close()
    return True, "Hisobotingiz qabul qilindi! Hakamlar ko'rib chiqib, qo'shimcha ball berishadi."


def get_reports(filter_mode: str = "all") -> List[Dict[str, Any]]:
    """Hisobot topshirgan ishtirokchilar ro'yxati."""
    conn = get_connection()
    cur = conn.cursor()
    query = """
        SELECT id, username, full_name, phone, telegram_id, token,
               stage1_solved, stage2_score, total_score,
               report_file, report_submitted_at, report_score, report_feedback, report_read
        FROM participants
        WHERE report_file IS NOT NULL
    """
    if filter_mode == "unread":
        query += " AND (report_read = 0 OR report_read IS NULL)"
    query += " ORDER BY report_submitted_at DESC"

    cur.execute(query)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def get_report_by_participant(participant_id: int) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, username, full_name, phone, telegram_id, token,
               stage1_solved, stage2_score, total_score,
               report_file, report_submitted_at, report_score, report_feedback, report_read
        FROM participants
        WHERE id = ? AND report_file IS NOT NULL
    """, (participant_id,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def mark_report_read(participant_id: int, is_read: int = 1) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE participants SET report_read = ? WHERE id = ?", (is_read, participant_id))
    conn.commit()
    conn.close()
    return True


def get_live_matrix_data() -> Dict[str, Any]:
    """Projektor va Katta Ekran jonli matritsasi uchun to'liq ma'lumotlar."""
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT id, code, title, points, difficulty FROM challenges ORDER BY id ASC")
    challenges = [dict(r) for r in cur.fetchall()]

    cur.execute("""
        SELECT id, username, full_name, token, current_stage, stage1_solved,
               stage2_score, stage3_unlocked, report_file, report_score, total_score, last_seen
        FROM participants
        ORDER BY total_score DESC, stage2_score DESC, id ASC
    """)
    participants_raw = cur.fetchall()

    cur.execute("SELECT participant_id, challenge_id, solved_at FROM solves")
    all_solves = cur.fetchall()
    solves_map: Dict[int, Dict[int, str]] = {}
    for s in all_solves:
        pid = s["participant_id"]
        cid = s["challenge_id"]
        if pid not in solves_map:
            solves_map[pid] = {}
        solves_map[pid][cid] = s["solved_at"]

    cur.execute("SELECT participant_id, COUNT(*) FROM stage1_solves GROUP BY participant_id")
    s1_solves_map = dict(cur.fetchall())

    participants_list = []
    for p in participants_raw:
        pid = p["id"]
        user_solves = solves_map.get(pid, {})
        s1_count = len(STAGE1_TASKS) if p["stage1_solved"] else s1_solves_map.get(pid, 0)

        matrix_row = []
        for ch in challenges:
            cid = ch["id"]
            is_solved = cid in user_solves
            matrix_row.append({
                "code": ch["code"],
                "points": ch["points"],
                "solved": is_solved,
                "solved_at": user_solves.get(cid)
            })

        participants_list.append({
            "id": pid,
            "username": p["username"],
            "full_name": p["full_name"],
            "current_stage": p["current_stage"],
            "stage1_solved": bool(p["stage1_solved"]),
            "stage1_count": s1_count,
            "stage1_total": len(STAGE1_TASKS),
            "stage2_score": p["stage2_score"],
            "stage3_unlocked": bool(p["stage3_unlocked"]),
            "report_submitted": bool(p["report_file"]),
            "report_score": p["report_score"],
            "total_score": p["total_score"],
            "matrix": matrix_row
        })

    cur.execute("SELECT id, participant_name, event_type, message, created_at FROM activity_feed ORDER BY id DESC LIMIT 15")
    feed = [dict(r) for r in cur.fetchall()]

    conn.close()
    return {
        "challenges": challenges,
        "participants": participants_list,
        "feed": feed,
        "stage3_threshold": STAGE3_UNLOCK_SCORE,
        "total_challenges": len(challenges)
    }
