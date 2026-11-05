#!/usr/bin/env python3
"""
core_db/analytics.py — CTF v2 Ishtirokchilar vaqti, bosqichlar tahlili va Excel (.xlsx) eksport moduli
"""

import os
import sys
import io
import sqlite3
from datetime import datetime
from typing import List, Dict, Any, Optional

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
sys.path.insert(0, PROJECT_ROOT)

from core_db import db as ctf_db


def parse_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    clean = dt_str.split("+")[0].strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d"):
        try:
            return datetime.strptime(clean, fmt)
        except ValueError:
            pass
    return None


def format_duration(seconds: Optional[float]) -> str:
    if seconds is None or seconds < 0:
        return "—"
    sec = int(seconds)
    if sec == 0:
        return "0 soniya"
    m, s = divmod(sec, 60)
    h, m = divmod(m, 60)
    parts = []
    if h > 0:
        parts.append(f"{h} soat")
    if m > 0:
        parts.append(f"{m} daqiqa")
    if s > 0 or not parts:
        parts.append(f"{s} soniya")
    return " ".join(parts)


def format_duration_short(seconds: Optional[float]) -> str:
    if seconds is None or seconds < 0:
        return "—"
    sec = int(seconds)
    if sec == 0:
        return "0s"
    m, s = divmod(sec, 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h}s {m}d {s}s"
    if m > 0:
        return f"{m}d {s}s"
    return f"{s}s"


def get_detailed_participants_data(db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Barcha ishtirokchilarning 1-bosqich, 2-bosqich va hisobot vaqtlari hamda ballarini hisoblash."""
    conn = ctf_db.get_connection(db_path)
    cur = conn.cursor()

    cur.execute("""
        SELECT id, username, full_name, phone, telegram_id, current_stage,
               stage1_solved, stage1_time, stage2_score, stage3_unlocked,
               report_file, report_submitted_at, report_score, total_score, created_at, last_seen
        FROM participants
        ORDER BY total_score DESC, stage2_score DESC, id ASC
    """)
    rows = cur.fetchall()

    results = []
    for r in rows:
        p = dict(r)
        pid = p["id"]
        created_dt = parse_datetime(p.get("created_at"))

        # 1-Bosqich (Linux) tahlili
        cur.execute("""
            SELECT task_code, points_awarded, solved_at
            FROM stage1_solves
            WHERE participant_id = ?
            ORDER BY solved_at ASC
        """, (pid,))
        s1_rows = cur.fetchall()
        s1_count = len(s1_rows)
        s1_points = sum(x["points_awarded"] for x in s1_rows) if s1_rows else (500 if p["stage1_solved"] else 0)

        s1_first_dt = parse_datetime(s1_rows[0]["solved_at"]) if s1_rows else None
        s1_last_dt = parse_datetime(s1_rows[-1]["solved_at"]) if s1_rows else parse_datetime(p.get("stage1_time"))

        # 1-bosqich vaqti: birinchi harakatdan oxirgi flaggacha
        s1_start = created_dt or s1_first_dt
        s1_duration = None
        if s1_last_dt and s1_start:
            delta = (s1_last_dt - s1_start).total_seconds()
            s1_duration = max(0, delta)

        # 2-Bosqich (Web Pentest) tahlili
        cur.execute("""
            SELECT c.code, s.points_awarded, s.solved_at
            FROM solves s
            JOIN challenges c ON s.challenge_id = c.id
            WHERE s.participant_id = ?
            ORDER BY s.solved_at ASC
        """, (pid,))
        s2_rows = cur.fetchall()
        s2_count = len(s2_rows)
        s2_codes = [x["code"] for x in s2_rows]
        s2_codes_str = ", ".join(s2_codes) if s2_codes else "—"

        s2_first_dt = parse_datetime(s2_rows[0]["solved_at"]) if s2_rows else None
        s2_last_dt = parse_datetime(s2_rows[-1]["solved_at"]) if s2_rows else None

        # 2-bosqich boshlanishi: 1-bosqich tugagan payt (yoki ro'yxatdan o'tgan payt)
        s2_start = s1_last_dt or s1_start
        s2_duration = None
        if s2_last_dt and s2_start:
            delta = (s2_last_dt - s2_start).total_seconds()
            s2_duration = max(0, delta)

        # 3-Bosqich (Hisobot)
        report_file = p.get("report_file")
        report_filename = os.path.basename(report_file) if report_file else None
        report_dt = parse_datetime(p.get("report_submitted_at"))
        report_submitted = bool(report_file)

        # Jami sarflangan vaqt
        last_activity_dt = report_dt or s2_last_dt or s1_last_dt or parse_datetime(p.get("last_seen")) or created_dt
        total_duration = None
        if last_activity_dt and created_dt:
            total_duration = max(0, (last_activity_dt - created_dt).total_seconds())

        # To'liq yakunlaganlik holati:
        # 1-bosqich yakunlangan (stage1_solved=1 yoki s1_count >= 7) VA
        # (2-bosqichda kamida 1200 ball olgan / 3-bosqich ochilgan / yoki 10 ta zaiflik yechilgan)
        is_completed = bool(
            (p["stage1_solved"] or s1_count >= 7) and 
            (p["stage3_unlocked"] or p["stage2_score"] >= 1200 or s2_count >= 10 or report_submitted)
        )
        status_label = "To'liq Yakunlagan" if is_completed else "Jarayonda"

        results.append({
            "id": pid,
            "username": p["username"],
            "full_name": p["full_name"],
            "phone": p.get("phone") or "—",
            "telegram_id": p.get("telegram_id") or "—",
            "current_stage": p["current_stage"],
            "is_completed": is_completed,
            "status_label": status_label,
            # Stage 1
            "stage1_count": s1_count,
            "stage1_total": 7,
            "stage1_points": s1_points,
            "stage1_solved": bool(p["stage1_solved"] or s1_count >= 7),
            "stage1_duration_sec": s1_duration,
            "stage1_duration_str": format_duration(s1_duration),
            "stage1_duration_short": format_duration_short(s1_duration),
            "stage1_start": s1_start.strftime("%Y-%m-%d %H:%M:%S") if s1_start else "—",
            "stage1_end": s1_last_dt.strftime("%Y-%m-%d %H:%M:%S") if s1_last_dt else "—",
            # Stage 2
            "stage2_count": s2_count,
            "stage2_total": 10,
            "stage2_codes": s2_codes_str,
            "stage2_points": p["stage2_score"],
            "stage2_duration_sec": s2_duration,
            "stage2_duration_str": format_duration(s2_duration),
            "stage2_duration_short": format_duration_short(s2_duration),
            "stage2_start": s2_start.strftime("%Y-%m-%d %H:%M:%S") if s2_start else "—",
            "stage2_end": s2_last_dt.strftime("%Y-%m-%d %H:%M:%S") if s2_last_dt else "—",
            # Stage 3
            "report_submitted": report_submitted,
            "report_filename": report_filename or "—",
            "report_submitted_at": report_dt.strftime("%Y-%m-%d %H:%M:%S") if report_dt else "—",
            # Jami
            "total_score": p["total_score"],
            "total_duration_sec": total_duration,
            "total_duration_str": format_duration(total_duration),
            "total_duration_short": format_duration_short(total_duration),
            "created_at": created_dt.strftime("%Y-%m-%d %H:%M:%S") if created_dt else "—",
            "last_activity": last_activity_dt.strftime("%Y-%m-%d %H:%M:%S") if last_activity_dt else "—"
        })

    conn.close()

    # Saralash: Birinchi to'liq yakunlaganlar (ball bo'yicha kamayish, vaqt bo'yicha o'sish),
    # keyin jarayondagilar
    def sort_key(item):
        completed_prio = 0 if item["is_completed"] else 1
        score_prio = -item["total_score"]
        dur_prio = item["total_duration_sec"] if item["total_duration_sec"] is not None else 999999999
        return (completed_prio, score_prio, dur_prio)

    results.sort(key=sort_key)

    # O'rin (Rank) raqamlash
    for idx, item in enumerate(results, start=1):
        item["rank"] = idx

    return results


def build_ctf_excel_workbook(db_path: Optional[str] = None) -> openpyxl.Workbook:
    """Barcha ishtirokchilar uchun bitta konsolidatsiyalangan, ajratilgan va ranglangan Excel fayl yaratish."""
    participants = get_detailed_participants_data(db_path)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "CTF Natijalari (Barchasi)"
    ws.views.sheetView[0].showGridLines = True

    # Ranglar palitrasi
    TITLE_FILL = PatternFill(start_color="0D1B2A", end_color="0D1B2A", fill_type="solid")
    SUB_FILL = PatternFill(start_color="1B263B", end_color="1B263B", fill_type="solid")
    HEADER_FILL = PatternFill(start_color="1F3A60", end_color="1F3A60", fill_type="solid")

    SECTION_DONE_FILL = PatternFill(start_color="2E7D32", end_color="2E7D32", fill_type="solid")
    SECTION_PROG_FILL = PatternFill(start_color="D35400", end_color="D35400", fill_type="solid")

    ROW_DONE_FILL = PatternFill(start_color="E8F5E9", end_color="E8F5E9", fill_type="solid")       # Yumshoq Yashil
    ROW_DONE_ALT = PatternFill(start_color="F1F8E9", end_color="F1F8E9", fill_type="solid")
    ROW_PROG_FILL = PatternFill(start_color="FFF8E1", end_color="FFF8E1", fill_type="solid")       # Yumshoq Sariq/Amber
    ROW_PROG_ALT = PatternFill(start_color="FFFDE7", end_color="FFFDE7", fill_type="solid")

    WHITE_BOLD = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    TITLE_FONT = Font(name="Calibri", size=16, bold=True, color="FFFFFF")
    SUB_FONT = Font(name="Calibri", size=10, italic=True, color="A0AEC0")
    HEADER_FONT = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    BOLD_FONT = Font(name="Calibri", size=10, bold=True, color="000000")
    REG_FONT = Font(name="Calibri", size=10, color="000000")

    THIN_BORDER = Border(
        left=Side(style="thin", color="CBD5E0"),
        right=Side(style="thin", color="CBD5E0"),
        top=Side(style="thin", color="CBD5E0"),
        bottom=Side(style="thin", color="CBD5E0")
    )
    CENTER_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)
    LEFT_ALIGN = Alignment(horizontal="left", vertical="center")
    RIGHT_ALIGN = Alignment(horizontal="right", vertical="center")

    # 1. Sarlavha Paneli
    ws.merge_cells("A1:P1")
    title_cell = ws["A1"]
    title_cell.value = "🚩 KIBERXAVFSIZLIK CTF v2 — YAKUNIY MUSOBAQA NATIJALARI"
    title_cell.font = TITLE_FONT
    title_cell.fill = TITLE_FILL
    title_cell.alignment = CENTER_ALIGN
    ws.row_dimensions[1].height = 36

    ws.merge_cells("A2:P2")
    sub_cell = ws["A2"]
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    completed_count = sum(1 for p in participants if p["is_completed"])
    in_progress_count = len(participants) - completed_count
    sub_cell.value = f"Hisobot shakllantirilgan vaqt: {now_str}  |  Jami Ishtirokchilar: {len(participants)} nafar  |  To'liq Yakunlaganlar: {completed_count}  |  Jarayondagilar: {in_progress_count}"
    sub_cell.font = SUB_FONT
    sub_cell.fill = SUB_FILL
    sub_cell.alignment = CENTER_ALIGN
    ws.row_dimensions[2].height = 22

    # Ustun sarlavhalari
    headers = [
        "№",
        "Holati",
        "To'liq Ism-Familiya",
        "Login (Username)",
        "Telefon Raqami",
        "Telegram",
        "1-Bosqich (Linux)",
        "1-Bosqich Ball",
        "1-Bosqich Sarflangan Vaqt",
        "2-Bosqich (Web)",
        "2-Bosqich Yechilgan Zaifliklar",
        "2-Bosqich Ball",
        "2-Bosqich Sarflangan Vaqt",
        "3-Bosqich (Hisobot)",
        "Jami Ball",
        "Jami Sarflangan Vaqt"
    ]

    current_row = 4

    def write_table_headers(row_idx):
        ws.row_dimensions[row_idx].height = 28
        for col_idx, h in enumerate(headers, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=h)
            cell.font = HEADER_FONT
            cell.fill = HEADER_FILL
            cell.alignment = CENTER_ALIGN
            cell.border = THIN_BORDER

    # Ishtirokchilarni 2 guruhga ajratish:
    completed_list = [p for p in participants if p["is_completed"]]
    in_progress_list = [p for p in participants if not p["is_completed"]]

    # -------------------------------------------------------------------------
    # 1-GURUH: TO'LIQ YAKUNLAGAN ISHTIROKCHILAR
    # -------------------------------------------------------------------------
    ws.merge_cells(f"A{current_row}:P{current_row}")
    sec1 = ws[f"A{current_row}"]
    sec1.value = f"🏆 TO'LIQ YAKUNLAGAN ISHTIROKCHILAR ({len(completed_list)} nafar)"
    sec1.font = Font(name="Calibri", size=12, bold=True, color="FFFFFF")
    sec1.fill = SECTION_DONE_FILL
    sec1.alignment = LEFT_ALIGN
    ws.row_dimensions[current_row].height = 26
    current_row += 1

    write_table_headers(current_row)
    current_row += 1

    if not completed_list:
        ws.merge_cells(f"A{current_row}:P{current_row}")
        empty_c = ws[f"A{current_row}"]
        empty_c.value = "Hozircha hech kim musobaqani to'liq yakunlamadi."
        empty_c.font = Font(name="Calibri", size=10, italic=True, color="718096")
        empty_c.alignment = CENTER_ALIGN
        current_row += 1
    else:
        for p in completed_list:
            row_fill = ROW_DONE_FILL if p["rank"] % 2 == 1 else ROW_DONE_ALT
            ws.row_dimensions[current_row].height = 22

            row_data = [
                p["rank"],
                "✅ To'liq Yakunlagan",
                p["full_name"],
                f"@{p['username']}",
                p["phone"],
                f"@{p['telegram_id']}" if str(p['telegram_id']).isdigit() is False else str(p['telegram_id']),
                f"{p['stage1_count']}/7 topshiriq",
                p["stage1_points"],
                p["stage1_duration_str"],
                f"{p['stage2_count']}/10",
                p["stage2_codes"],
                p["stage2_points"],
                p["stage2_duration_str"],
                f"✅ {p['report_filename']}" if p["report_submitted"] else "❌ Topshirilmadi",
                p["total_score"],
                p["total_duration_str"]
            ]

            for col_idx, val in enumerate(row_data, start=1):
                cell = ws.cell(row=current_row, column=col_idx, value=val)
                cell.fill = row_fill
                cell.border = THIN_BORDER
                cell.font = BOLD_FONT if col_idx in [1, 2, 8, 12, 15] else REG_FONT
                if col_idx in [1, 2, 5, 6, 7, 8, 10, 12, 14, 15]:
                    cell.alignment = CENTER_ALIGN
                elif col_idx in [9, 13, 16]:
                    cell.alignment = CENTER_ALIGN
                else:
                    cell.alignment = LEFT_ALIGN
            current_row += 1

    current_row += 2  # Bo'sh qator

    # -------------------------------------------------------------------------
    # 2-GURUH: JARAYONDAGI ISHTIROKCHILAR (Hali tugata olmaganlar)
    # -------------------------------------------------------------------------
    ws.merge_cells(f"A{current_row}:P{current_row}")
    sec2 = ws[f"A{current_row}"]
    sec2.value = f"⏳ JARAYONDAGI ISHTIROKCHILAR — HALI TUGATA OLMAGANLAR ({len(in_progress_list)} nafar)"
    sec2.font = Font(name="Calibri", size=12, bold=True, color="FFFFFF")
    sec2.fill = SECTION_PROG_FILL
    sec2.alignment = LEFT_ALIGN
    ws.row_dimensions[current_row].height = 26
    current_row += 1

    write_table_headers(current_row)
    current_row += 1

    if not in_progress_list:
        ws.merge_cells(f"A{current_row}:P{current_row}")
        empty_c2 = ws[f"A{current_row}"]
        empty_c2.value = "Barcha ishtirokchilar topshiriqlarni yakunlagan!"
        empty_c2.font = Font(name="Calibri", size=10, italic=True, color="718096")
        empty_c2.alignment = CENTER_ALIGN
        current_row += 1
    else:
        for p in in_progress_list:
            row_fill = ROW_PROG_FILL if p["rank"] % 2 == 1 else ROW_PROG_ALT
            ws.row_dimensions[current_row].height = 22

            row_data = [
                p["rank"],
                "⏳ Jarayonda",
                p["full_name"],
                f"@{p['username']}",
                p["phone"],
                f"@{p['telegram_id']}" if str(p['telegram_id']).isdigit() is False else str(p['telegram_id']),
                f"{p['stage1_count']}/7 topshiriq",
                p["stage1_points"],
                p["stage1_duration_str"],
                f"{p['stage2_count']}/10",
                p["stage2_codes"],
                p["stage2_points"],
                p["stage2_duration_str"],
                f"✅ {p['report_filename']}" if p["report_submitted"] else "❌ Topshirilmadi",
                p["total_score"],
                p["total_duration_str"]
            ]

            for col_idx, val in enumerate(row_data, start=1):
                cell = ws.cell(row=current_row, column=col_idx, value=val)
                cell.fill = row_fill
                cell.border = THIN_BORDER
                cell.font = BOLD_FONT if col_idx in [1, 2, 8, 12, 15] else REG_FONT
                if col_idx in [1, 2, 5, 6, 7, 8, 10, 12, 14, 15]:
                    cell.alignment = CENTER_ALIGN
                elif col_idx in [9, 13, 16]:
                    cell.alignment = CENTER_ALIGN
                else:
                    cell.alignment = LEFT_ALIGN
            current_row += 1

    # Ustunlar kengligini avtomatik to'g'rilash
    col_widths = {
        1: 6,   # №
        2: 20,  # Holati
        3: 26,  # Ism
        4: 18,  # Login
        5: 18,  # Telefon
        6: 16,  # Telegram
        7: 18,  # S1 Vazifalar
        8: 14,  # S1 Ball
        9: 24,  # S1 Vaqti
        10: 16, # S2 Zaifliklar
        11: 28, # S2 Kodlar
        12: 14, # S2 Ball
        13: 24, # S2 Vaqti
        14: 24, # Hisobot
        15: 14, # Jami Ball
        16: 24  # Jami Vaqti
    }
    for col_idx, width in col_widths.items():
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = width

    return wb


def export_excel_bytes(db_path: Optional[str] = None) -> io.BytesIO:
    """Excel faylini xotirada (BytesIO) yaratib qaytarish."""
    wb = build_ctf_excel_workbook(db_path)
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def export_excel_file(file_path: str, db_path: Optional[str] = None) -> str:
    """Excel faylini diskka saqlash."""
    wb = build_ctf_excel_workbook(db_path)
    os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
    wb.save(file_path)
    return file_path
