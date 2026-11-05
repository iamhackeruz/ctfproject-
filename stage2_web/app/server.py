#!/usr/bin/env python3
"""
stage2_web/app/server.py — Apex Global Technologies Target Web Application
CTF v2 — 10 ta OWASP Top-10 / Realistik Zaifliklarga ega Veb Ilova
Port: 5000 (yoki APEX_PORT orqali)
"""

import os
import re
import sys
import time
import json
import sqlite3
import subprocess
from datetime import datetime
from flask import (
    Flask, request, render_template, render_template_string,
    jsonify, redirect, url_for, make_response, send_from_directory, abort
)
import jwt

# Loyihaning asosiy DB kutubxonasini ulash
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(CURRENT_DIR))
sys.path.insert(0, PROJECT_ROOT)

from core_db import db as ctf_db
from stage2_web.app.db_init import init_apex_db, DB_PATH as APEX_DB_PATH

app = Flask(__name__,
            static_folder=os.path.join(CURRENT_DIR, "static"),
            template_folder=os.path.join(CURRENT_DIR, "templates"))
app.config["SECRET_KEY"] = "apex_flask_session_secret_2026"
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB

JWT_SECRET = "apex2026"  # Zaif sir (V9 uchun oson brute-force yoki dictionary attack qilinadi)
JWT_ALGORITHM = "HS256"

# Rate limiting xotirasi (V3 uchun)
FAILED_ATTEMPTS = {}  # ip -> {"count": int, "blocked_until": float}

# Boshlang'ich bazani yaratish
if not os.path.exists(APEX_DB_PATH):
    init_apex_db(APEX_DB_PATH)

def get_db():
    conn = sqlite3.connect(APEX_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Helper: IP aniqlash (X-Forwarded-For hisobga olingan holda - V3 bypass)
def get_client_ip():
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    return request.remote_addr or "127.0.0.1"

# Helper: JWT tekshirish
def verify_jwt_token(token):
    if not token:
        return None
    # Agar oxiridagi nuqta tushib qolgan bo'lsa (none algoritmida 2 ta segment kelsa)
    if token.count(".") == 1:
        token = token + "."
    try:
        # None algoritmini va zaif secretni tekshirish
        unverified_header = jwt.get_unverified_header(token)
        if str(unverified_header.get("alg", "")).lower() == "none":
            return jwt.decode(token, options={"verify_signature": False})
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        return None

# ==============================================================================
# 1. ASOSIY SAHIFALAR VA OSINT MA'LUMOTLARI
# ==============================================================================

@app.route("/")
def index():
    """Bosh sahifa — Kompaniya profili, xizmatlari va xodimlari haqida OSINT signallari."""
    conn = get_db()
    services = conn.execute("SELECT * FROM services LIMIT 6").fetchall()
    employees = conn.execute("SELECT id, name, role, department, email FROM employees WHERE id IN (1, 2, 3)").fetchall()
    conn.close()
    return render_template("index.html", services=services, employees=employees)

@app.route("/about")
def about():
    """Kompaniya haqida batafsil ma'lumot (OSINT uchun kalit ma'lumotlar)."""
    return render_template("about.html")

@app.route("/challenges")
def challenges():
    """10 ta OWASP zaifliklarining interaktiv xaritasi va yo'riqnomasi."""
    return render_template("challenges.html")


# ==============================================================================
# 🚩 V1: INFORMATION DISCLOSURE / GIT LEAK (100 ball)
# ==============================================================================
@app.route("/.git/HEAD")
@app.route("/.git/<path:filename>")
def git_leak(filename="HEAD"):
    git_dir = os.path.join(CURRENT_DIR, ".git")
    file_path = os.path.join(git_dir, filename)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        with open(file_path, "r", errors="ignore") as f:
            content = f.read()
        resp = make_response(content, 200)
        resp.mimetype = "text/plain"
        return resp
    return "Not Found", 404

@app.route("/robots.txt")
def robots():
    content = (
        "User-agent: *\n"
        "Disallow: /portal/staff-login\n"
        "Disallow: /vault/\n"
        "Disallow: /admin/\n"
        "Disallow: /api/v1/internal/\n"
        "# Security Audit in progress. Apex Global Security Compliance.\n"
    )
    resp = make_response(content, 200)
    resp.mimetype = "text/plain"
    return resp

# ==============================================================================
# 🚩 V2: USER ENUMERATION / OSINT (150 ball)
# ==============================================================================
@app.route("/api/auth/verify-user", methods=["POST"])
@app.route("/login", methods=["GET", "POST"])
def user_enum():
    if request.method == "GET":
        return render_template("login.html")

    data = request.get_json(silent=True) or request.form
    username_or_email = data.get("username", "").strip().lower()
    password = data.get("password", "").strip()

    conn = get_db()
    user = conn.execute("SELECT * FROM employees WHERE email = ? OR email LIKE ?",
                        (username_or_email, f"{username_or_email}@%")).fetchone()
    conn.close()

    if user:
        # Xatolik xabarida foydalanuvchi borligi fosh bo'ladi va sarlavhada FLAG beriladi!
        resp = make_response(jsonify({
            "status": "error",
            "message": f"'{username_or_email}' tizimda tasdiqlandi, ammo kiritilgan parol noto'g'ri. Xodimlar Staff Portaliga ulanishi shart!",
            "exists": True
        }), 401)
        resp.headers["X-User-Status"] = "Account Found"
        resp.headers["X-Sec-Flag"] = "FLAG{v2_user_enum_apex_sec_83b1}"
        return resp
    else:
        resp = make_response(jsonify({
            "status": "error",
            "message": "Foydalanuvchi hisobi topilmadi. Iltimos pochta manzilini tekshiring.",
            "exists": False
        }), 404)
        return resp

# ==============================================================================
# 🚩 V3: BROKEN AUTHENTICATION & RATE-LIMIT BYPASS (200 ball)
# ==============================================================================
@app.route("/portal/staff-login", methods=["GET", "POST"])
@app.route("/portal/staff/login", methods=["GET", "POST"])
def staff_login():
    if request.method == "GET":
        return render_template("staff_login.html")

    ip = get_client_ip()
    now = time.time()
    real_client_ip = request.remote_addr or "127.0.0.1"

    # 1. Korporativ Xavfsizlik Qoidasi: Xodimlar portali faqat ichki korporativ tarmoq (127.0.0.1 yoki 127.0.0.0/8) uchun ochiq!
    if not (ip in ["127.0.0.1", "localhost"] or ip.startswith("127.")):
        return render_template("staff_login.html",
                               error=f"403 Taqiqlangan: Xodimlar portali faqat ichki korporativ tarmoq (127.0.0.1) uchun ochiq! Sizning IP: {ip}. Tashqaridan to'g'ridan-to'g'ri kirish cheklangan."), 403

    # 2. Rate limiting tekshiruvi (Mijoz va IP birikmasi bo'yicha)
    rate_key = f"{real_client_ip}_{ip}"
    if rate_key in FAILED_ATTEMPTS:
        attempt_data = FAILED_ATTEMPTS[rate_key]
        if attempt_data["count"] >= 4 and now < attempt_data["blocked_until"]:
            remaining = int(attempt_data["blocked_until"] - now)
            return render_template("staff_login.html",
                                   error=f"Xavfsizlik blokirovkasi! Ushbu IP ({ip}) dan juda ko'p muvaffaqiyatsiz urinishlar. {remaining} soniya kuting."), 429

    username = request.form.get("username", "").strip()
    password = request.form.get("password", "").strip()

    # To'g'ri hisob: asmith / spring2026
    conn = get_db()
    user = conn.execute("SELECT * FROM employees WHERE (email = ? OR email LIKE ?) AND password = ?",
                        (username, f"{username}@%", password)).fetchone()
    conn.close()

    if user:
        # Muvaffaqiyatli login! IP urinishlarini tozalash
        FAILED_ATTEMPTS.pop(rate_key, None)

        token_payload = {
            "sub": str(user["id"]),
            "email": user["email"],
            "name": user["name"],
            "role": "employee",  # Default ro'l: employee (V9 uchun superadmin ga manipulyatsiya qilinadi)
            "dept": user["department"],
            "iat": int(now),
            "exp": int(now + 86400)
        }
        token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

        resp = make_response(redirect(url_for("staff_dashboard")))
        resp.set_cookie("staff_session", token)
        return resp
    else:
        # Xato urinish
        if rate_key not in FAILED_ATTEMPTS:
            FAILED_ATTEMPTS[rate_key] = {"count": 1, "blocked_until": 0}
        else:
            FAILED_ATTEMPTS[rate_key]["count"] += 1
            if FAILED_ATTEMPTS[rate_key]["count"] >= 4:
                FAILED_ATTEMPTS[rate_key]["blocked_until"] = now + 60  # 60 soniyaga bloklash

        return render_template("staff_login.html",
                               error=f"Login yoki parol xato! IP: {ip}. Qolgan urinishlar: {max(0, 4 - FAILED_ATTEMPTS[rate_key]['count'])}"), 401

@app.route("/portal/staff/dashboard")
def staff_dashboard():
    token = request.cookies.get("staff_session")
    payload = verify_jwt_token(token)
    if not payload:
        return redirect(url_for("staff_login"))

    conn = get_db()
    user = conn.execute("SELECT * FROM employees WHERE id = ?", (payload["sub"],)).fetchone()
    conn.close()

    flag_v3 = "FLAG{v2_auth_bypass_headers_77c2}"
    return render_template("staff_dashboard.html", user=user, payload=payload, flag_v3=flag_v3)

# ==============================================================================
# 🚩 V4: IDOR (INSECURE DIRECT OBJECT REFERENCE) (250 ball)
# ==============================================================================
@app.route("/portal/employee/contract")
def employee_contract():
    token = request.cookies.get("staff_session")
    payload = verify_jwt_token(token)
    if not payload:
        return jsonify({"error": "Avtorizatsiyadan o'ting"}), 401

    emp_id = request.args.get("id", default=str(payload["sub"]))
    conn = get_db()
    emp = conn.execute("SELECT id, name, email, role, department, salary, contract_details FROM employees WHERE id = ?",
                       (emp_id,)).fetchone()
    conn.close()

    if not emp:
        return jsonify({"error": "Shartnoma topilmadi"}), 404

    # Agar ID=1 (CEO) so'ralsa, maxfiy shartnoma va V4 flagi qaytadi
    return jsonify({
        "employee_id": emp["id"],
        "name": emp["name"],
        "role": emp["role"],
        "department": emp["department"],
        "salary": emp["salary"],
        "contract": emp["contract_details"]
    })

# ==============================================================================
# 🚩 V5: STORED XSS / COOKIE THEFT (250 ball)
# ==============================================================================
@app.route("/support/ticket", methods=["GET", "POST"])
def support_ticket():
    conn = get_db()
    xss_alert = None
    if request.method == "POST":
        client_name = request.form.get("client_name", "Anonim")
        email = request.form.get("email", "client@corp.local")
        subject = request.form.get("subject", "Texnik savol")
        message = request.form.get("message", "")

        # XSS detektor va simulyatsiya qilingan admin javobi
        xss_detected = bool(re.search(r"<script|onerror|onload|javascript:|eval\(|<img|<iframe", message, re.IGNORECASE))
        if xss_detected:
            xss_alert = (
                "⚠️ [SECURITY ALERT]: Xavfsizlik bo'limi tizimida script/payload aniqlandi! "
                "Administrator brauzerida sessiya kuki fosh etildi: "
                "admin_auth_cookie=FLAG{v2_stored_xss_cookie_theft_55e5}; HttpOnly=False; Domain=apextech.com"
            )
            admin_reply = "⚠️ [XAVFSIZLIK TEKSHIRUVI]: Administrator murojaatni ko'rib chiqdi."
        else:
            admin_reply = "Xabaringiz navbatga qo'yildi. 24 soat ichida javob beriladi."

        conn.execute("""
            INSERT INTO support_tickets (client_name, email, subject, message, admin_reply)
            VALUES (?, ?, ?, ?, ?)
        """, (client_name, email, subject, message, admin_reply))
        conn.commit()

    tickets = conn.execute("SELECT * FROM support_tickets ORDER BY id DESC LIMIT 10").fetchall()
    conn.close()
    return render_template("support_ticket.html", tickets=tickets, xss_alert=xss_alert)

# ==============================================================================
# 🚩 V6: LFI / PATH TRAVERSAL (300 ball)
# ==============================================================================
@app.route("/download")
@app.route("/portal/docs/view")
def download_doc():
    filename = request.args.get("doc") or request.args.get("file")
    if not filename:
        return "Fayl nomi ko'rsatilmadi (?doc=privacy.pdf)", 400

    # LFI nishoni:
    base_dir = os.path.join(CURRENT_DIR, "static", "docs")
    target_path = os.path.normpath(os.path.join(base_dir, filename))

    # Anti-Sabotage / Scope Isolation:
    # 1. CTF ballar bazasini (/var/ctf/) yoki operatsion tizim sirlarini (/etc/shadow) o'qish qat'iyan man etiladi!
    forbidden_prefixes = ["/var/ctf", "/etc/shadow", "/proc/sys", "/root"]
    for fb in forbidden_prefixes:
        if target_path.startswith(fb):
            return "Xavfsizlik chegarasi (Sandbox)! CTF tizim va ballar bazasiga kirish taqiqlangan.", 403

    # 2. Faqat korporativ veb-ilova papkasi doirasidagi fayllarni (/app/stage2_web/app/) yoki zararsiz OS fayllarini o'qish mumkin
    allowed_app_dir = os.path.abspath(CURRENT_DIR)
    if not (target_path.startswith(allowed_app_dir) or target_path in ["/etc/passwd", "/etc/hosts", "/etc/issue"]):
        return "Xavfsizlik chegarasi (Sandbox)! Siz faqat ushbu korporativ veb-ilova doirasidagi fayllarni o'qiy olasiz.", 403

    if os.path.exists(target_path) and os.path.isfile(target_path):
        try:
            with open(target_path, "rb") as f:
                content = f.read()
            resp = make_response(content)
            resp.mimetype = "text/plain"
            return resp
        except Exception as e:
            return f"Faylni o'qishda xato: {str(e)}", 500
    return f"Fayl topilmadi: {filename}", 404

# ==============================================================================
# 🚩 V7: SQL INJECTION (UNION-BASED) (350 ball)
# ==============================================================================
@app.route("/services/search")
def search_services():
    query = request.args.get("q", "").strip()
    if not query:
        return redirect(url_for("services_page"))

    conn = get_db()
    # Xavfli xom SQL so'rov (Raw unparameterized query)
    sql = f"SELECT id, title, category, description FROM services WHERE title LIKE '%{query}%' OR description LIKE '%{query}%'"
    try:
        results = conn.execute(sql).fetchall()
        conn.close()
        return render_template("services.html", services=results, query=query)
    except Exception as e:
        conn.close()
        # SQL xatosini qaytarish (Error-based / Debugging SQLi)
        return render_template("services.html", error=f"Ma'lumotlar bazasi xatosi: {str(e)}", query=query)

@app.route("/services")
def services_page():
    conn = get_db()
    services = conn.execute("SELECT * FROM services").fetchall()
    conn.close()
    return render_template("services.html", services=services)

# ==============================================================================
# 🚩 V8: INSECURE FILE UPLOAD / WEBSHELL (400 ball)
# ==============================================================================
@app.route("/careers/apply", methods=["GET", "POST"])
def upload_resume():
    if request.method == "GET":
        return render_template("careers.html")

    uploaded_file = request.files.get("resume")
    if not uploaded_file or uploaded_file.filename == "":
        return render_template("careers.html", error="Fayl tanlanmadi"), 400

    filename = os.path.basename(uploaded_file.filename)
    lower_name = filename.lower()
    uploads_dir = os.path.join(CURRENT_DIR, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    unique_prefix = f"{int(time.time())}_{os.urandom(4).hex()}"
    save_path = os.path.join(uploads_dir, f"{unique_prefix}_{filename}")

    # 1. To'g'ridan-to'g'ri skriptlarni yuklashni bloklash (Blacklist)
    # Agar oddiy .php, .py, .sh yuklansa va Content-Type soxtalashtirilmagan bo'lsa
    content_type = uploaded_file.content_type or ""
    is_spoofed_mime = content_type in ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    
    if lower_name.endswith((".php", ".py", ".sh", ".exe", ".cgi", ".pl")) and not is_spoofed_mime:
        return render_template("careers.html",
                               error="Xavfsizlik filtri: Skriptlarni (.php, .py, .sh) to'g'ridan-to'g'ri yuklash taqiqlangan! Tizim faqat .pdf yoki .docx qabul qiladi."), 400

    uploaded_file.save(save_path)

    try:
        with open(save_path, "rb") as f:
            file_bytes = f.read()

        # Bypass usullari tekshiruvi:
        # A) Qo'shaloq kengaytma (.php.pdf, .py.pdf, va h.k.)
        # B) Muqobil kengaytmalar (.phtml, .php5, .phar, .shtml)
        # C) MIME-Type spoofing (Content-Type: application/pdf bilan .php yuborish)
        is_bypass = (
            any(ext in lower_name for ext in [".php.", ".py.", ".sh.", ".phtml.", ".phar."])
            or lower_name.endswith((".phtml", ".php5", ".phar", ".shtml"))
            or (lower_name.endswith((".php", ".py", ".sh")) and is_spoofed_mime)
        )

        has_webshell_code = bool(
            re.search(rb"(<\?php|system\(|exec\(|passthru\(|eval\(|shell_exec|import os|subprocess|#!/bin/|powershell|cmd)", file_bytes, re.I)
        )

        if is_bypass:
            if has_webshell_code:
                return render_template("careers.html",
                                       success=f"Fayl '{filename}' serverga yuklandi va tahlildan o'tkazildi! Webshell filtri muvaffaqiyatli aylanib o'tildi: FLAG{{v2_fileupload_bypass_webshell_22h8}}")
            else:
                return render_template("careers.html",
                                       error="Fayl formati qabul qilindi, ammo uning ichida hech qanday buyruq/webshell kodi aniqlanmadi."), 400
        else:
            return render_template("careers.html",
                                   success=f"Rezyume '{filename}' qabul qilindi. HR bo'limi ko'rib chiqadi.")
    except Exception as e:
        return render_template("careers.html", error=f"Xatolik: {str(e)}"), 500

# ==============================================================================
# 🚩 V9: PRIVILEGE ESCALATION (JWT ROLE MANIPULATION) (500 ball)
# ==============================================================================
@app.route("/admin/executive-board")
def executive_board():
    token = request.cookies.get("staff_session")
    payload = verify_jwt_token(token)

    if not payload:
        return redirect(url_for("staff_login"))

    role = payload.get("role", "employee")
    if role not in ["superadmin", "director", "admin"]:
        return render_template("admin_forbidden.html", role=role), 403

    flag_v9 = "FLAG{v2_priv_esc_jwt_admin_takeover_11i9}"
    return render_template("admin_board.html", payload=payload, flag_v9=flag_v9)

# ==============================================================================
# 🚩 V10: REMOTE CODE EXECUTION (RCE) / VAULT BREACH (500 ball)
# ==============================================================================
@app.route("/admin/diagnostics/ping", methods=["GET", "POST"])
def ping_utility():
    token = request.cookies.get("staff_session")
    payload = verify_jwt_token(token)

    if not payload or payload.get("role") not in ["superadmin", "director", "admin"]:
        return redirect(url_for("executive_board"))

    output = ""
    host = ""
    if request.method == "POST":
        host = request.form.get("host", "").strip()
        if host:
            # Anti-Sabotage Filter (Zararli / Vandalizm buyruqlarini bloklash):
            # Tizimni o'chirish, konteynerni to'xtatish yoki CTF ballar bazasini buzish qat'iyan taqiqlanadi!
            destructive_patterns = [
                r"\brm\b", r"\bmkfs\b", r"\bdd\b", r"\bshutdown\b", r"\breboot\b",
                r"\bkill\b", r"\bpkill\b", r"\bkillall\b", r">.*ctf", r"/var/ctf",
                r":\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;", r"\bchmod\s+000\b", r">.*apex_corp"
            ]
            for pat in destructive_patterns:
                if re.search(pat, host, re.IGNORECASE):
                    output = "⚠️ [XAVFSIZLIK CHEGARASI]: Tizimni buzish, o'chirish yoki CTF ballar bazasiga zarar yetkazuvchi buyruqlar bloklandi! CTF qoidalariga rioya qiling."
                    return render_template("admin_ping.html", host=host, output=output)

            # Xavfli Command Injection teshigi (faqat tahliliy buyruqlar: ls, cat, id, whoami, pwd, head va h.k.)!
            cmd = f"ping -c 2 {host}"
            try:
                output = subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT, timeout=4).decode("utf-8", errors="ignore")
            except subprocess.TimeoutExpired:
                output = "Vaqt chegarasi tugadi (Timeout)!"
            except subprocess.CalledProcessError as e:
                output = e.output.decode("utf-8", errors="ignore")
            except Exception as e:
                output = str(e)

    return render_template("admin_ping.html", host=host, output=output)

# ==============================================================================
# 🎯 WEB INTERFACE FLAG SUBMISSION API
# ==============================================================================
@app.route("/api/ctf/submit-flag", methods=["POST"])
def submit_flag_api():
    """Veb sahifaning o'zidan flag topshirish API."""
    data = request.get_json(silent=True) or request.form
    username = data.get("username", "").strip()
    username = re.sub(r"[^a-zA-Z0-9_\-\.]", "", username)
    flag = data.get("flag", "").strip()

    if not username or not flag:
        return jsonify({"status": "error", "message": "Foydalanuvchi va Flag kiritilishi shart!"}), 400

    participant = ctf_db.get_participant_by_user(username)
    if not participant:
        participant = ctf_db.register_participant(username, username.capitalize())

    # 1. 1-bosqich flagi sifatida tekshirish
    ok1, msg1 = ctf_db.submit_stage1_flag(username, flag)
    if ok1:
        return jsonify({"status": "success", "message": msg1})

    # 2. 2-bosqich flagi sifatida tekshirish
    ok2, msg2, details = ctf_db.submit_stage2_flag(participant["id"], flag, request.remote_addr)
    return jsonify({
        "status": "success" if ok2 else "error",
        "message": msg2 if ok2 else msg1,
        "details": details
    })

@app.route("/api/ctf/status", methods=["GET"])
def get_status_api():
    """Ishtirokchi joriy holati va 10 ta zaiflik progressini olish."""
    username = request.args.get("username", "").strip()
    if not username:
        return jsonify({"status": "error", "message": "Username ko'rsatilmadi"}), 400

    participant = ctf_db.get_participant_by_user(username)
    if not participant:
        participant = ctf_db.register_participant(username, username.capitalize())

    conn = ctf_db.get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT c.code, c.title, c.points, s.solved_at
        FROM challenges c
        LEFT JOIN solves s ON c.id = s.challenge_id AND s.participant_id = ?
        ORDER BY c.id ASC
    """, (participant["id"],))
    challenges = [dict(r) for r in cur.fetchall()]
    conn.close()

    stage1_tasks = ctf_db.get_stage1_progress(participant["id"])

    return jsonify({
        "status": "success",
        "participant": participant,
        "challenges": challenges,
        "stage1_tasks": stage1_tasks
    })

if __name__ == "__main__":
    port = int(os.getenv("APEX_PORT", 5000))
    print(f"[*] Apex Target Web App ishga tushmoqda: http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
