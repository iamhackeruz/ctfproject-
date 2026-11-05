#!/usr/bin/env python3
"""
dashboard/server.py — CTF v2 Katta Ekran (Projektor) Jonli Hujum Matritsasi va Admin Paneli
Port: 8080 (yoki DASHBOARD_PORT)
"""

import os
import sys
import time
import json
import sqlite3
from datetime import datetime
from flask import Flask, render_template, jsonify, request, Response, send_file

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
sys.path.insert(0, PROJECT_ROOT)

from core_db import db as ctf_db
from core_db import analytics

app = Flask(__name__,
            static_folder=os.path.join(CURRENT_DIR, "static"),
            template_folder=os.path.join(CURRENT_DIR, "templates"))
app.config["SECRET_KEY"] = "ctf_dashboard_secret_2026"

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin2026")

@app.route("/")
def big_screen_matrix():
    """Katta ekran (Projektor) jonli matritsa ko'rinishi."""
    return render_template("matrix.html")

@app.route("/admin")
def admin_panel():
    """Hakamlar va o'qituvchilar uchun boshqaruv paneli."""
    auth_pass = request.args.get("key") or request.cookies.get("admin_key")
    is_authenticated = (auth_pass == ADMIN_PASSWORD)
    data = ctf_db.get_live_matrix_data() if is_authenticated else None
    detailed = analytics.get_detailed_participants_data() if is_authenticated else []
    return render_template("admin.html", authenticated=is_authenticated, data=data, detailed=detailed, admin_key=ADMIN_PASSWORD)

@app.route("/admin/export/excel")
def admin_export_excel():
    """Barcha ishtirokchilar natijalarini to'liq bitta Excel (.xlsx) fayl qilib yuklab olish."""
    auth_pass = request.args.get("key") or request.cookies.get("admin_key")
    if auth_pass != ADMIN_PASSWORD:
        return "Ruxsat yo'q: Admin paroli talab etiladi", 403

    excel_stream = analytics.export_excel_bytes()
    filename = f"CTF_v2_Natijalar_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return send_file(
        excel_stream,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename
    )

@app.route("/admin/api/clean-dummy-users", methods=["POST"])
def admin_clean_dummy_users():
    """Eski testlardan qolgan sinov (dummy) foydalanuvchilarini tozalash."""
    key = request.headers.get("X-Admin-Key") or request.form.get("key")
    if key != ADMIN_PASSWORD:
        return jsonify({"status": "error", "message": "Admin paroli xato"}), 403

    conn = ctf_db.get_connection()
    cur = conn.cursor()
    # Dummy foydalanuvchilarni o'chirish (talaba1, talaba2, user kabi haqiqiy akkauntlarga tegilmaydi)
    cur.execute("""
        DELETE FROM participants 
        WHERE username LIKE 'elite_%' 
           OR username LIKE 'beginner_%' 
           OR username LIKE 'inter_%' 
           OR username LIKE 'explorer_%'
           OR username LIKE 'rapid_%'
           OR username LIKE 'fuzzer_%'
    """)
    deleted_count = cur.rowcount
    conn.commit()
    conn.close()

    return jsonify({"status": "success", "message": f"{deleted_count} ta sinov foydalanuvchisi muvaffaqiyatli tozalandi!"})

@app.route("/admin/api/reset-participant", methods=["POST"])
def admin_reset_participant():
    """Alohida bir ishtirokchini boshidan nollash."""
    key = request.headers.get("X-Admin-Key") or request.form.get("key")
    if key != ADMIN_PASSWORD:
        return jsonify({"status": "error", "message": "Admin paroli xato"}), 403

    participant_id = int(request.form.get("participant_id", 0))
    if not participant_id:
        return jsonify({"status": "error", "message": "Ishtirokchi ID si kiritilmadi"}), 400

    conn = ctf_db.get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM stage1_solves WHERE participant_id = ?", (participant_id,))
    cur.execute("DELETE FROM solves WHERE participant_id = ?", (participant_id,))
    cur.execute("DELETE FROM attempts WHERE participant_id = ?", (participant_id,))
    cur.execute("""
        UPDATE participants
        SET current_stage = 1,
            stage1_solved = 0,
            stage1_flag = NULL,
            stage1_time = NULL,
            stage2_score = 0,
            stage3_unlocked = 0,
            report_file = NULL,
            report_submitted_at = NULL,
            report_score = 0,
            total_score = 0
        WHERE id = ?
    """, (participant_id,))
    conn.commit()
    conn.close()

    return jsonify({"status": "success", "message": f"Ishtirokchi natijalari to'liq qayta nollandi!"})

@app.route("/api/live/matrix")
def api_matrix():
    """Jonli matritsa ma'lumotlari JSON shaklida."""
    data = ctf_db.get_live_matrix_data()
    return jsonify(data)

@app.route("/api/live/stream")
def sse_stream():
    """Server-Sent Events (SSE) orqali sahifani yangilamasdan real-vaqt ma'lumot uzatish."""
    def event_stream():
        last_hash = ""
        while True:
            try:
                data = ctf_db.get_live_matrix_data()
                data_json = json.dumps(data)
                curr_hash = hash(data_json)
                if curr_hash != last_hash:
                    last_hash = curr_hash
                    yield f"data: {data_json}\n\n"
            except Exception as e:
                pass
            time.sleep(2)  # Har 2 soniyada tekshirish

    return Response(event_stream(), mimetype="text/event-stream")

@app.route("/admin/api/add-participant", methods=["POST"])
def admin_add_participant():
    key = request.headers.get("X-Admin-Key") or request.form.get("key")
    if key != ADMIN_PASSWORD:
        return jsonify({"status": "error", "message": "Admin paroli xato"}), 403

    username = request.form.get("username", "").strip()
    full_name = request.form.get("full_name", "").strip()
    phone = request.form.get("phone", "").strip() or None
    if not username or not full_name:
        return jsonify({"status": "error", "message": "Barcha maydonlar to'ldirilishi shart"}), 400

    p = ctf_db.register_participant(username, full_name, phone=phone)
    return jsonify({"status": "success", "participant": p})

@app.route("/admin/api/grade-report", methods=["POST"])
def admin_grade_report():
    key = request.headers.get("X-Admin-Key") or request.form.get("key")
    if key != ADMIN_PASSWORD:
        return jsonify({"status": "error", "message": "Admin paroli xato"}), 403

    participant_id = int(request.form.get("participant_id"))
    score = int(request.form.get("score", 0))
    feedback = request.form.get("feedback", "")

    conn = ctf_db.get_connection()
    cur = conn.cursor()
    cur.execute("SELECT total_score, report_score FROM participants WHERE id = ?", (participant_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"status": "error", "message": "Topilmadi"}), 404

    # Agar avval baholangan bo'lsa, faqat farqini qo'shish/ayirish
    old_report_score = row["report_score"] or 0
    score_diff = score - old_report_score
    new_total = row["total_score"] + score_diff

    cur.execute("""
        UPDATE participants
        SET report_score = ?,
            report_feedback = ?,
            total_score = ?
        WHERE id = ?
    """, (score, feedback, new_total, participant_id))

    cur.execute("""
        INSERT INTO activity_feed (participant_id, participant_name, event_type, message)
        SELECT id, full_name, 'report_graded', '📑 Hakamlar ' || full_name || ' ning hisobotiga ' || ? || ' ball baho berishdi!'
        FROM participants WHERE id = ?
    """, (score, participant_id))

    conn.commit()
    conn.close()

    return jsonify({"status": "success", "message": "Baho muvaffaqiyatli saqlandi!", "new_total": new_total})

@app.route("/admin/report/preview/<int:participant_id>")
def preview_report(participant_id):
    """Admin uchun hisobotni brauzerda 100% xavfsiz ko'rish (Sanitized Text Extractor)."""
    auth_pass = request.args.get("key") or request.cookies.get("admin_key")
    if auth_pass != ADMIN_PASSWORD:
        return jsonify({"error": "Avtorizatsiya talab etiladi"}), 403

    conn = ctf_db.get_connection()
    row = conn.execute("SELECT full_name, report_file, report_score FROM participants WHERE id = ?", (participant_id,)).fetchone()
    conn.close()

    if not row or not row["report_file"] or not os.path.exists(row["report_file"]):
        return jsonify({"error": "Hisobot fayli topilmadi"}), 404

    from stage3_reporting.sanitizer import check_file_safety, extract_safe_text
    is_safe, scan_msg, meta = check_file_safety(row["report_file"])
    safe_content = extract_safe_text(row["report_file"])

    return jsonify({
        "full_name": row["full_name"],
        "filename": os.path.basename(row["report_file"]),
        "is_safe": is_safe,
        "scan_status": scan_msg,
        "content": safe_content,
        "report_score": row["report_score"]
    })

@app.route("/admin/report/download/<int:participant_id>")
def download_report_file(participant_id):
    """Hisobot faylini xavfsiz yuklab olish."""
    auth_pass = request.args.get("key") or request.cookies.get("admin_key")
    if auth_pass != ADMIN_PASSWORD:
        return "Ruxsat yo'q", 403

    conn = ctf_db.get_connection()
    row = conn.execute("SELECT report_file FROM participants WHERE id = ?", (participant_id,)).fetchone()
    conn.close()

    if not row or not row["report_file"] or not os.path.exists(row["report_file"]):
        return "Fayl topilmadi", 404

    return send_file(row["report_file"], as_attachment=True)

if __name__ == "__main__":
    port = int(os.getenv("DASHBOARD_PORT", 8080))
    print(f"[*] CTF v2 Live Matrix Dashboard ishga tushmoqda: http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
