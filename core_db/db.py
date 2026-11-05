#!/usr/bin/env python3
"""
core_db/db.py — CTF v2 Database Helper Module
Barcha komponentlar (Web Target, Dashboard, Bot, Admin) uchun yagona baza interfeysi.
"""

import os
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any

LOCAL_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ctf_v2.db")
DB_PATH = os.getenv("CTF_DB_PATH", "/var/ctf/ctf_v2.db")
SCHEMA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")

STAGE3_UNLOCK_SCORE = 1200  # 1200 ball to'planganda 3-bosqich (Reporting) ochiladi!
STAGE1_SOLVE_POINTS = 500   # 1-bosqichni to'liq yechganlik uchun jami ball
STAGE1_FLAG = "FLAG{v2_linux_corporate_foothold_apex_7781}"  # Zaxira master flag

# 1-bosqich: 7 ta amaliy topshiriq (Jami 500 ball)
STAGE1_TASKS = [
    {
        "code": "L1",
        "title": "Yashirin stansiya ma'lumotlari",
        "points": 50,
        "flag": "FLAG{v2_linux_01_hidden_ls_4821}",
        "folder": "01_hidden_station",
    },
    {
        "code": "L2",
        "title": "Server loglaridan favqulodda kalit",
        "points": 50,
        "flag": "FLAG{v2_linux_02_tail_log_3910}",
        "folder": "02_system_logs",
    },
    {
        "code": "L3",
        "title": "Xodimlar reestridan token qidirish",
        "points": 75,
        "flag": "FLAG{v2_linux_03_grep_filter_8824}",
        "folder": "03_employee_registry",
    },
    {
        "code": "L4",
        "title": "Ichki arxivdan zaxira faylini topish",
        "points": 75,
        "flag": "FLAG{v2_linux_04_find_path_1749}",
        "folder": "04_lost_backups",
    },
    {
        "code": "L5",
        "title": "Himoyalangan kassa ruxsatini tiklash",
        "points": 75,
        "flag": "FLAG{v2_linux_05_chmod_perms_9201}",
        "folder": "05_restricted_vault",
    },
    {
        "code": "L6",
        "title": "Hodisalar arxivi paketini ochish",
        "points": 75,
        "flag": "FLAG{v2_linux_06_tar_extract_6530}",
        "folder": "06_archived_backups",
    },
    {
        "code": "L7",
        "title": "Repozitoriy tarixidan o'chirilgan sir",
        "points": 100,
        "flag": "FLAG{v2_linux_07_git_history_7718}",
        "folder": "07_git_repository",
    },
]

STAGE1_FLAGS_MAP = {t["flag"]: t for t in STAGE1_TASKS}


def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    global DB_PATH
    target = db_path or DB_PATH
    target_dir = os.path.dirname(os.path.abspath(target))
    try:
        os.makedirs(target_dir, exist_ok=True)
    except PermissionError:
        # Agar /var/ctf ga huquq bo'lmasa, lokal papkaga o'tish
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

    # Avtomatik jadvallarni tekshirish va yaratish
    try:
        check_table = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='participants'").fetchone()
        if not check_table:
            with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
                conn.executescript(f.read())
            conn.commit()
        else:
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
    """Bazani yaratish va jadvallarni sozlash."""
    conn = get_connection(db_path)
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        conn.executescript(f.read())
    conn.commit()
    conn.close()

def register_participant(username: str, full_name: str, phone: Optional[str] = None,
                         telegram_id: Optional[int] = None, ssh_password: Optional[str] = None) -> Dict[str, Any]:
    """Yangi ishtirokchi ro'yxatdan o'tkazish yoki mavjudini olish."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM participants WHERE username = ? OR (telegram_id IS NOT NULL AND telegram_id = ?)",
                (username, telegram_id))
    existing = cur.fetchone()
    if existing:
        conn.close()
        return dict(existing)

    cur.execute("""
        INSERT INTO participants (username, full_name, phone, telegram_id, ssh_password, current_stage, stage1_solved, stage2_score, stage3_unlocked, total_score)
        VALUES (?, ?, ?, ?, ?, 1, 0, 0, 0, 0)
    """, (username, full_name, phone, telegram_id, ssh_password))
    participant_id = cur.lastrowid

    # Activity feed xabari
    cur.execute("""
        INSERT INTO activity_feed (participant_id, participant_name, event_type, message)
        VALUES (?, ?, 'join', ?)
    """, (participant_id, full_name, f"👋 {full_name} (@{username}) CTF arenasiga qo'shildi!"))

    conn.commit()
    cur.execute("SELECT * FROM participants WHERE id = ?", (participant_id,))
    res = dict(cur.fetchone())
    conn.close()
    return res

def get_participant_by_user(username: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM participants WHERE username = ?", (username,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None

def get_participant_by_tg(telegram_id: int) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM participants WHERE telegram_id = ?", (telegram_id,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None

def get_stage1_progress(participant_id: int) -> List[Dict[str, Any]]:
    """Ishtirokchining 1-bosqich (7 ta Linux topshiriq) holatini olish."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT task_code, points_awarded, solved_at FROM stage1_solves WHERE participant_id = ?", (participant_id,))
    solved_map = {row["task_code"]: dict(row) for row in cur.fetchall()}
    conn.close()

    result = []
    for t in STAGE1_TASKS:
        code = t["code"]
        is_solved = code in solved_map
        result.append({
            "code": code,
            "title": t["title"],
            "points": t["points"],
            "folder": t["folder"],
            "flag": t["flag"],
            "solved": is_solved,
            "solved_at": solved_map[code]["solved_at"] if is_solved else None
        })
    return result

def submit_stage1_flag(username: str, flag: str) -> Tuple[bool, str]:
    """1-bosqich (Linux CTF) flagini qabul qilish."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM participants WHERE username = ?", (username,))
    p = cur.fetchone()
    if not p:
        conn.close()
        return False, "Ishtirokchi topilmadi."

    flag_clean = flag.strip()

    stage2_brief = (
        "\n\n🎯 2-BOSQICH (WEB PENTEST) NISHON MA'LUMOTLARI:\n"
        "   🌐 Veb Portal:        http://localhost:5000\n"
        "   👤 Xizmat Logini:     asmith (yoki asmith@apextech.com)\n"
        "   🔑 Xizmat Paroli:     spring2026\n"
        "   🏆 3-Bosqich sharti:  10 ta zaiflikdan kamida 1200 ball to'plash\n"
        "   📌 Holatni ko'rish:   status"
    )

    if p["stage1_solved"]:
        conn.close()
        return True, f"Siz 1-bosqichni allaqachon muvaffaqiyatli yakunlagansiz!{stage2_brief}"

    # Zaxira master flag (testlar yoki to'liq topshirish uchun)
    if flag_clean == STAGE1_FLAG:
        for t in STAGE1_TASKS:
            cur.execute("""
                INSERT OR IGNORE INTO stage1_solves (participant_id, task_code, flag_submitted, points_awarded)
                VALUES (?, ?, ?, ?)
            """, (p["id"], t["code"], t["flag"], t["points"]))

        cur.execute("""
            UPDATE participants
            SET stage1_solved = 1,
                stage1_flag = ?,
                stage1_time = CURRENT_TIMESTAMP,
                current_stage = CASE WHEN current_stage < 2 THEN 2 ELSE current_stage END,
                total_score = total_score + ?
            WHERE id = ? AND stage1_solved = 0
        """, (flag_clean, STAGE1_SOLVE_POINTS, p["id"]))

        cur.execute("""
            INSERT INTO activity_feed (participant_id, participant_name, event_type, message)
            VALUES (?, ?, 'stage1_pass', ?)
        """, (p["id"], p["full_name"], f"🐧 {p['full_name']} 1-bosqich (Linux Muhiti) ni to'liq yakunladi va 2-bosqich (Web Pentest) ga o'tdi! (+500 ball)"))

        conn.commit()
        conn.close()
        return True, f"Ajoyib! 1-bosqich to'liq topshirildi (+{STAGE1_SOLVE_POINTS} ball). 2-bosqich (Web Pentest) ochildi!{stage2_brief}"

    # Yangi 7 ta Linux amaliy topshiriqlaridan biri
    if flag_clean in STAGE1_FLAGS_MAP:
        task = STAGE1_FLAGS_MAP[flag_clean]
        cur.execute("SELECT id FROM stage1_solves WHERE participant_id = ? AND task_code = ?", (p["id"], task["code"]))
        already = cur.fetchone()
        if already:
            conn.close()
            return False, f"⚠️ Ushbu topshiriq ({task['code']}: {task['title']}) allaqachon topshirilgan!"

        cur.execute("""
            INSERT INTO stage1_solves (participant_id, task_code, flag_submitted, points_awarded)
            VALUES (?, ?, ?, ?)
        """, (p["id"], task["code"], flag_clean, task["points"]))

        cur.execute("UPDATE participants SET total_score = total_score + ? WHERE id = ?", (task["points"], p["id"]))

        cur.execute("SELECT COUNT(*), COALESCE(SUM(points_awarded), 0) FROM stage1_solves WHERE participant_id = ?", (p["id"],))
        row = cur.fetchone()
        solved_count = row[0]
        s1_pts = row[1]
        total_tasks = len(STAGE1_TASKS)

        cur.execute("""
            INSERT INTO activity_feed (participant_id, participant_name, event_type, message)
            VALUES (?, ?, 'stage1_task', ?)
        """, (p["id"], p["full_name"], f"💻 {p['full_name']} Linux [{task['code']}]: {task['title']} topshirig'ini bajardi! (+{task['points']}b)"))

        if solved_count >= total_tasks:
            cur.execute("""
                UPDATE participants
                SET stage1_solved = 1,
                    stage1_flag = ?,
                    stage1_time = CURRENT_TIMESTAMP,
                    current_stage = CASE WHEN current_stage < 2 THEN 2 ELSE current_stage END
                WHERE id = ?
            """, (flag_clean, p["id"]))

            cur.execute("""
                INSERT INTO activity_feed (participant_id, participant_name, event_type, message)
                VALUES (?, ?, 'stage1_pass', ?)
            """, (p["id"], p["full_name"], f"🎉 {p['full_name']} 1-bosqich (Linux) barcha 7 ta topshirig'ini to'liq yakunladi va 2-bosqichga o'tdi!"))

            conn.commit()
            conn.close()
            return True, f"🎉 TABRIKLAYMIZ! 1-bosqichning barcha {total_tasks} ta topshirig'i yakunlandi (+{task['points']} ball, Jami {s1_pts} ball). 2-bosqich ochildi!{stage2_brief}"

        conn.commit()
        conn.close()
        return True, f"✅ Barakalla! {task['code']}: {task['title']} muvaffaqiyatli topshirildi (+{task['points']} ball).\n📊 1-bosqich progressi: {solved_count}/{total_tasks} ta topshiriq bajarildi. Yana {total_tasks - solved_count} ta qoldi."

    conn.close()
    return False, "Noto'g'ri flag! Qaytadan urinib ko'ring."


def submit_stage2_flag(participant_id: int, flag: str, ip_address: Optional[str] = None) -> Tuple[bool, str, Dict[str, Any]]:
    """2-bosqich (Web Pentest) 10 ta zaiflikdan birining flagini tekshirish."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM participants WHERE id = ?", (participant_id,))
    p = cur.fetchone()
    if not p:
        conn.close()
        return False, "Ishtirokchi topilmadi.", {}

    flag_clean = flag.strip()

    # Mos keluvchi zaiflikni topish
    cur.execute("SELECT * FROM challenges WHERE flag_pattern = ?", (flag_clean,))
    ch = cur.fetchone()

    if not ch:
        # Attempts log
        cur.execute("INSERT INTO attempts (participant_id, stage, flag_given, is_correct, ip_address) VALUES (?, 2, ?, 0, ?)",
                    (participant_id, flag_clean, ip_address))
        conn.commit()
        conn.close()
        return False, "Noto'g'ri flag! Qaytadan urinib ko'ring.", {}

    # Allaqachon yechilganmi?
    cur.execute("SELECT * FROM solves WHERE participant_id = ? AND challenge_id = ?", (participant_id, ch["id"]))
    if cur.fetchone():
        conn.close()
        return False, f"Ushbu zaiflik ({ch['code']}: {ch['title']}) uchun flag allaqachon topshirilgan!", dict(ch)

    # To'g'ri solve yozish
    points = ch["points"]
    cur.execute("""
        INSERT INTO solves (participant_id, challenge_id, flag_submitted, points_awarded)
        VALUES (?, ?, ?, ?)
    """, (participant_id, ch["id"], flag_clean, points))

    # Ballarni atomar yangilash (Race condition oldini olish)
    cur.execute("""
        UPDATE participants
        SET stage2_score = stage2_score + ?,
            total_score = total_score + ?,
            stage3_unlocked = CASE WHEN (stage2_score + ?) >= ? THEN 1 ELSE stage3_unlocked END,
            current_stage = CASE WHEN (stage2_score + ?) >= ? AND current_stage < 3 THEN 3 ELSE current_stage END,
            last_seen = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (points, points, points, STAGE3_UNLOCK_SCORE, points, STAGE3_UNLOCK_SCORE, participant_id))

    # Yangilangan qiymatlarni bazadan olish
    cur.execute("SELECT stage2_score, total_score, stage3_unlocked FROM participants WHERE id = ?", (participant_id,))
    updated_p = cur.fetchone()
    new_stage2_score = updated_p["stage2_score"]
    stage3_val = updated_p["stage3_unlocked"]
    unlocked_stage3_now = bool(stage3_val and not p["stage3_unlocked"])

    # Activity feed
    msg = f"🔥 {p['full_name']} [{ch['code']}: {ch['title']}] zaifligini fosh qildi! (+{points} ball)"
    cur.execute("""
        INSERT INTO activity_feed (participant_id, participant_name, event_type, message)
        VALUES (?, ?, 'solve', ?)
    """, (participant_id, p["full_name"], msg))

    if unlocked_stage3_now:
        unlock_msg = f"🚀 TABRIKLAYMIZ! {p['full_name']} {new_stage2_score} ball to'pladi va 3-bosqich (Reporting) ga yo'llanma oldi!"
        cur.execute("""
            INSERT INTO activity_feed (participant_id, participant_name, event_type, message)
            VALUES (?, ?, 'stage_unlock', ?)
        """, (participant_id, p["full_name"], unlock_msg))

    conn.commit()
    conn.close()

    resp_data = {
        "challenge_code": ch["code"],
        "challenge_title": ch["title"],
        "points_earned": points,
        "current_stage2_score": new_stage2_score,
        "stage3_unlocked": bool(stage3_val),
        "newly_unlocked_stage3": unlocked_stage3_now
    }

    success_msg = f"✅ Qabul qilindi! {ch['code']} ({ch['title']}) muvaffaqiyatli yechildi! (+{points} ball). Jami Web ballingiz: {new_stage2_score} ball."
    if unlocked_stage3_now:
        success_msg += f"\n\n🎉 Ajoyib! Siz {STAGE3_UNLOCK_SCORE} ballik marrani zabt etdingiz va 3-BOSQICH (REPORTING) OCHILDI!"

    return True, success_msg, resp_data

def submit_report(participant_id: int, report_file_path: str) -> Tuple[bool, str]:
    """3-bosqich (Hisobot) faylini saqlash va xavfsizlik tekshiruvidan o'tkazish."""
    # Xavfsizlik skaneri (Antivirus, Macro, OLE, PDF exploit tekshiruvi)
    try:
        from stage3_reporting.sanitizer import check_file_safety
        is_safe, scan_msg, meta = check_file_safety(report_file_path)
        if not is_safe:
            return False, f"Xavfsizlik tekshiruvidan o'tmadi: {scan_msg}"
    except Exception as e:
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
    """Hisobot topshirgan ishtirokchilar ro'yxati (unread yoki all)."""
    conn = get_connection()
    cur = conn.cursor()
    if filter_mode == "unread":
        cur.execute("""
            SELECT id, username, full_name, phone, telegram_id,
                   stage1_solved, stage2_score, total_score,
                   report_file, report_submitted_at, report_score, report_feedback, report_read
            FROM participants
            WHERE report_file IS NOT NULL AND (report_read = 0 OR report_read IS NULL)
            ORDER BY report_submitted_at DESC
        """)
    else:
        cur.execute("""
            SELECT id, username, full_name, phone, telegram_id,
                   stage1_solved, stage2_score, total_score,
                   report_file, report_submitted_at, report_score, report_feedback, report_read
            FROM participants
            WHERE report_file IS NOT NULL
            ORDER BY report_submitted_at DESC
        """)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

def get_report_by_participant(participant_id: int) -> Optional[Dict[str, Any]]:
    """Alohida bir ishtirokchining hisobot ma'lumotlarini olish."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, username, full_name, phone, telegram_id,
               stage1_solved, stage2_score, total_score,
               report_file, report_submitted_at, report_score, report_feedback, report_read
        FROM participants
        WHERE id = ? AND report_file IS NOT NULL
    """, (participant_id,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None

def mark_report_read(participant_id: int, is_read: int = 1) -> bool:
    """Hisobotni o'qilgan (1) yoki o'qilmagan (0) deb belgilash."""
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

    # 10 ta challenges
    cur.execute("SELECT id, code, title, points, difficulty FROM challenges ORDER BY id ASC")
    challenges = [dict(r) for r in cur.fetchall()]

    # Ishtirokchilar va ularning solves
    cur.execute("""
        SELECT id, username, full_name, current_stage, stage1_solved,
               stage2_score, stage3_unlocked, report_file, report_score, total_score, last_seen
        FROM participants
        ORDER BY total_score DESC, stage2_score DESC, id ASC
    """)
    participants_raw = cur.fetchall()

    # Barcha solves xaritasini olish
    cur.execute("SELECT participant_id, challenge_id, solved_at FROM solves")
    all_solves = cur.fetchall()
    solves_map: Dict[int, Dict[int, str]] = {}
    for s in all_solves:
        pid = s["participant_id"]
        cid = s["challenge_id"]
        if pid not in solves_map:
            solves_map[pid] = {}
        solves_map[pid][cid] = s["solved_at"]

    # 1-bosqich yechilgan topshiriqlar soni
    cur.execute("SELECT participant_id, COUNT(*) FROM stage1_solves GROUP BY participant_id")
    s1_solves_map = dict(cur.fetchall())

    participants_list = []
    for p in participants_raw:
        pid = p["id"]
        user_solves = solves_map.get(pid, {})
        s1_count = len(STAGE1_TASKS) if p["stage1_solved"] else s1_solves_map.get(pid, 0)

        # Har bir V1..V10 uchun holat
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

    # So'nggi 15 ta activity feed voqealari
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
