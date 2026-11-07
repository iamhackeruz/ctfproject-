#!/usr/bin/env python3
"""
dashboard/server.py — CTF v2 Central Server:
- Katta Ekran (Projektor) Jonli Hujum Matritsasi & Scoreboard
- Ishtirokchilar Shaxsiy Portali & Token Berish
- Dinamik Flag Qabul Qilish (API)
- Admin Boshqaruv Paneli
Port: 8080 (yoki DASHBOARD_PORT)
"""

import os
import sys
import time
import json
import sqlite3
from datetime import datetime
from werkzeug.utils import secure_filename
from flask import Flask, render_template, jsonify, request, Response, send_file, session, redirect, url_for

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
sys.path.insert(0, PROJECT_ROOT)

from core_db import db as ctf_db
from core_db import flag_engine
from core_db import analytics

app = Flask(__name__,
            static_folder=os.path.join(CURRENT_DIR, "static"),
            template_folder=os.path.join(CURRENT_DIR, "templates"))
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "ctf_apex_corp_session_secret_2026")
UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, "stage3_reporting", "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin2026")


# ==============================================================================
# ASOSIY VA MATRITSA SAHIFALARI
# ==============================================================================

@app.route("/")
def home():
    """Bosh sahifa: Kirish va Ro'yxatdan o'tish xabi. Agar kirgan bo'lsa to'g'ri portalga."""
    if "user_id" in session:
        return redirect(url_for("portal"))
    return render_template("index.html", active_tab="login")

@app.route("/matrix")
def matrix_view():
    """Katta ekran (Projektor) jonli matritsa ko'rinishi."""
    current_user = None
    if "user_id" in session:
        current_user = ctf_db.get_participant_by_id(session["user_id"])
    return render_template("matrix.html", current_user=current_user)


# ==============================================================================
# ISHTIROKCHILAR AUTENTIFIKATSIYASI VA PORTAL
# ==============================================================================

@app.route("/register", methods=["GET", "POST"])
def register():
    """Yangi ishtirokchini ro'yxatdan o'tkazish va unga shaxsiy Token taqdim etish."""
    if "user_id" in session:
        return redirect(url_for("portal"))

    if request.method == "POST":
        full_name = request.form.get("full_name", "").strip()
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "").strip()
        password_confirm = request.form.get("password_confirm", "").strip()

        if not full_name or not username or not password:
            return render_template("index.html", active_tab="register", error="Barcha maydonlar to'ldirilishi shart!")

        if password != password_confirm:
            return render_template("index.html", active_tab="register", error="Kiritilgan parollar mos kelmadi!")

        # Mavjudlikni tekshirish
        existing = ctf_db.get_participant_by_user(username)
        if existing:
            return render_template("index.html", active_tab="register", error="Bu username allaqachon ro'yxatdan o'tgan. Boshqa username tanlang.")

        try:
            participant = ctf_db.register_participant(
                username=username,
                full_name=full_name,
                password=password
            )
            session["user_id"] = participant["id"]
            session["username"] = participant["username"]
            session["token"] = participant["token"]
            return redirect(url_for("portal"))
        except Exception as e:
            return render_template("index.html", active_tab="register", error=f"Ro'yxatdan o'tishda xatolik: {str(e)}")

    return render_template("index.html", active_tab="register")


@app.route("/login", methods=["GET", "POST"])
def login():
    """Ishtirokchi login sahifasi."""
    if "user_id" in session:
        return redirect(url_for("portal"))

    if request.method == "POST":
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "").strip()

        participant = ctf_db.authenticate_participant(username, password)
        if participant:
            session["user_id"] = participant["id"]
            session["username"] = participant["username"]
            session["token"] = participant["token"]
            return redirect(url_for("portal"))
        else:
            return render_template("index.html", active_tab="login", error="Username yoki parol noto'g'ri!")

    return render_template("index.html", active_tab="login")


@app.route("/logout")
def logout():
    """Tizimdan chiqish."""
    session.clear()
    return redirect(url_for("login"))


@app.route("/portal")
def portal():
    """Ishtirokchining shaxsiy kabineti (Token, Topshiriqlar ro'yxati, Flag topshirish)."""
    if "user_id" not in session:
        return redirect(url_for("login"))

    portal_data = ctf_db.get_participant_portal_data(session["user_id"])
    if not portal_data or not portal_data.get("participant"):
        session.clear()
        return redirect(url_for("login"))

    return render_template("portal.html", **portal_data)


@app.route("/portal/upload_report", methods=["POST"])
def upload_report():
    """3-bosqich Incident Report faylini yuklash."""
    if "user_id" not in session:
        return redirect(url_for("login"))

    if "report" not in request.files:
        return redirect(url_for("portal"))

    file = request.files["report"]
    if file.filename == "":
        return redirect(url_for("portal"))

    filename = secure_filename(file.filename)
    user_prefix = f"user_{session['user_id']}_{int(time.time())}"
    save_path = os.path.join(app.config["UPLOAD_FOLDER"], f"{user_prefix}_{filename}")
    file.save(save_path)

    ok, msg = ctf_db.submit_report(session["user_id"], save_path)
    return redirect(url_for("portal"))


# ==============================================================================
# DINAMIK FLAG TOPSHIRISH API (AJAX & CLI)
# ==============================================================================

@app.route("/api/submit_flag", methods=["POST"])
def api_submit_flag():
    """
    Shaxsiy token asosida dinamik flag tekshirish API.
    Sessiya orqali yoki JSON dagi token orqali tekshiradi.
    """
    user_id = session.get("user_id")
    data = request.get_json(silent=True) or request.form

    flag = data.get("flag", "").strip()
    if not flag:
        return jsonify({"success": False, "message": "Flag kiritilmadi!"}), 400

    # Agar sessiya bo'lmasa, tokendan qidirish
    if not user_id:
        req_token = data.get("token", "").strip().upper()
        if req_token:
            p = ctf_db.get_participant_by_token(req_token)
            if p:
                user_id = p["id"]

    if not user_id:
        return jsonify({"success": False, "message": "Avtorizatsiyadan o'tilmagan. Avval tizimga kiring!"}), 401

    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    ok, msg, res_data = ctf_db.submit_flag_dynamic(user_id, flag, client_ip)

    p_updated = ctf_db.get_participant_by_id(user_id)
    new_total = p_updated["total_score"] if p_updated else 0

    return jsonify({
        "success": ok,
        "message": msg,
        "code": res_data.get("code"),
        "points": res_data.get("points", 0),
        "title": res_data.get("title", ""),
        "new_total_score": new_total
    })


# ==============================================================================
# LIVE STREAM VA MATRITSA API
# ==============================================================================

@app.route("/api/live/matrix")
def api_matrix():
    """Jonli matritsa ma'lumotlari JSON shaklida."""
    data = ctf_db.get_live_matrix_data()
    return jsonify(data)

@app.route("/api/live/stream")
def sse_stream():
    """Server-Sent Events (SSE) orqali jonli ma'lumot uzatish."""
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
            except Exception:
                pass
            time.sleep(2)

    return Response(event_stream(), mimetype="text/event-stream")


# ==============================================================================
# ADMIN BOSHQARUV PANEL
# ==============================================================================

@app.route("/admin")
def admin_panel():
    auth_pass = request.args.get("key") or request.cookies.get("admin_key")
    is_authenticated = (auth_pass == ADMIN_PASSWORD)
    data = ctf_db.get_live_matrix_data() if is_authenticated else None
    detailed = analytics.get_detailed_participants_data() if is_authenticated else []
    return render_template("admin.html", authenticated=is_authenticated, data=data, detailed=detailed, admin_key=ADMIN_PASSWORD)

@app.route("/admin/export/excel")
def admin_export_excel():
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
    key = request.headers.get("X-Admin-Key") or request.form.get("key")
    if key != ADMIN_PASSWORD:
        return jsonify({"status": "error", "message": "Admin paroli xato"}), 403

    conn = ctf_db.get_connection()
    cur = conn.cursor()
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

    return jsonify({"status": "success", "message": f"{deleted_count} ta sinov foydalanuvchisi tozalandi!"})

@app.route("/admin/api/reset-participant", methods=["POST"])
def admin_reset_participant():
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

    return jsonify({"status": "success", "message": "Ishtirokchi natijalari to'liq qayta nollandi!"})

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
    print(f"[*] CTF v2 Central Server (Portal + Matrix) ishga tushmoqda: http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
