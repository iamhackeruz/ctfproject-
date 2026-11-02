#!/usr/bin/env python3
"""
CyberEdu Isolated Vulnerable Web Labs
Tarkibida 4 ta mustaqil zaif veb-laboratoriya mavjud:
1. web-xss: Reflected XSS va Cookie/DOM tekshiruvi
2. web-sqli: SQLite asosidagi SQL Injection (Login Bypass va UNION attack)
3. web-idor: Avtorizatsiyasiz ID o'zgartirish (IDOR)
4. web-exposed-files: robots.txt va ochiq qoldirilgan .env / backup fayllar
"""

import os
import sys
import json
import sqlite3
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

LAB_TYPE = os.environ.get("LAB_TYPE", "web-sqli")
FLAG = os.environ.get("FLAG", "flag{cyberedu_demo_flag_1337}")
PORT = int(os.environ.get("PORT", "8080"))

# SQLite bazasini xotirada yaratish (web-sqli uchun)
sqli_db = sqlite3.connect(":memory:", check_same_thread=False)
sqli_cursor = sqli_db.cursor()
sqli_cursor.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, role TEXT);")
sqli_cursor.execute("CREATE TABLE secrets (id INTEGER PRIMARY KEY, key_name TEXT, flag_val TEXT);")
sqli_cursor.execute("CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT, author TEXT);")

sqli_cursor.execute("INSERT INTO users VALUES (1, 'admin', 'SuperComplexPass#992', 'admin');")
sqli_cursor.execute("INSERT INTO users VALUES (2, 'guest', 'guest123', 'student');")
sqli_cursor.execute("INSERT INTO secrets VALUES (1, 'flag', ?);", (FLAG,))
sqli_cursor.execute("INSERT INTO books VALUES (1, 'Linux asoslari', 'Linus T.');")
sqli_cursor.execute("INSERT INTO books VALUES (2, 'Kiberxavfsizlik darsligi', 'CyberEdu Team');")
sqli_cursor.execute("INSERT INTO books VALUES (3, 'Tarmoq protokollari', 'Vint C.');")
sqli_db.commit()

class LabHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Jim rejim (shovqinli loglar yo'q)
        return

    def send_html(self, content, status=200, extra_headers=None):
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(content.encode("utf-8"))

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else ""
        form_data = urllib.parse.parse_qs(body)

        if LAB_TYPE == "web-sqli":
            username = form_data.get("username", [""])[0]
            password = form_data.get("password", [""])[0]
            if username:
                try:
                    # Vulnerable login bypass SQL injection
                    raw_sql = f"SELECT id, username, role FROM users WHERE username = '{username}' AND password = '{password}'"
                    user = sqli_cursor.execute(raw_sql).fetchone()
                    if user:
                        self.send_html(f"<div>Kirish muvaffaqiyatli! Xush kelibsiz, {user[1]}. Maxfiy flag: {FLAG}</div>")
                        return
                    else:
                        self.send_html("<div class='error'>Login yoki parol noto'g'ri</div>", status=401)
                        return
                except Exception as e:
                    self.send_html(f"<div class='error'>SQL Xatosi: {str(e)}</div>", status=500)
                    return

        if LAB_TYPE == "web-xss":
            q = form_data.get("q", [""])[0]
            self.send_html(f"<div class='result-box'>POST Qidiruv: <strong>{q}</strong></div>")
            return

        self.send_json({"success": True, "message": "POST qabul qilindi", "path": path})

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # ── 1. WEB-XSS LAB ──────────────────────────────────────────────
        if LAB_TYPE == "web-xss":
            search_query = query.get("q", [""])[0]
            rendered_result = ""
            if search_query:
                # Zaiflik: Foydalanuvchi kiritgan qidiruv matni to'g'ridan-to'g'ri filtrsiz ekranga chiqariladi (Reflected XSS)
                rendered_result = f"""
                <div class="result-box">
                    <p>Qidiruv natijalari: <strong>{search_query}</strong></p>
                    <div class="alert-info">Hech qanday ommaviy xabar topilmadi.</div>
                </div>
                """

            html = f"""<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <title>CyberEdu Lab: XSS Vulnerability</title>
    <style>
        body {{ background: #0b0f19; color: #e2e8f0; font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; margin: 0; }}
        .card {{ max-width: 650px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 28px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }}
        h2 {{ color: #38bdf8; margin-top: 0; }}
        input[type=text] {{ width: 100%; box-sizing: border-box; padding: 12px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; margin-bottom: 12px; font-size: 15px; }}
        button {{ background: #0284c7; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }}
        button:hover {{ background: #0369a1; }}
        .result-box {{ margin-top: 20px; padding: 15px; background: #0f172a; border-radius: 8px; border-left: 4px solid #38bdf8; }}
        .badge {{ display: inline-block; padding: 4px 10px; background: #064e3b; color: #34d399; border-radius: 4px; font-size: 12px; margin-bottom: 16px; }}
    </style>
    <script>
        // Administrator simulyatsiyasi (Admin sessiya cookie va flag'i)
        document.cookie = "admin_session=xss_super_secret_cookie_77; path=/";
        document.cookie = "secret_flag={FLAG}; path=/";
    </script>
</head>
<body>
    <div class="card">
        <span class="badge">Zaiflik: Reflected XSS</span>
        <h2>💬 CyberEdu Mehmonlar Kitobi va Qidiruv</h2>
        <p>Mehmonlar xabarlari bazasidan kerakli kalit so'zni qidiring.</p>
        <form method="GET">
            <input type="text" name="q" placeholder="Qidiruv so'zini kiriting (masalan: salom)..." value="{search_query}">
            <button type="submit">Qidirish</button>
        </form>
        {rendered_result}
    </div>
</body>
</html>"""
            self.send_html(html)
            return

        # ── 2. WEB-SQLI LAB ─────────────────────────────────────────────
        if LAB_TYPE == "web-sqli":
            search_book = query.get("title", [""])[0]
            books_html = ""
            error_html = ""

            if search_book:
                try:
                    # Zaiflik: Parametrlashsiz string concatenation orqali SQL bajarilishi
                    raw_sql = f"SELECT id, title, author FROM books WHERE title LIKE '%{search_book}%'"
                    res = sqli_cursor.execute(raw_sql).fetchall()
                    for b in res:
                        books_html += f"<tr><td>{b[0]}</td><td>{b[1]}</td><td>{b[2]}</td></tr>"
                except Exception as e:
                    error_html = f"<div style='color: #ef4444; margin-top: 10px;'>SQL Xatosi: {str(e)}</div>"

            html = f"""<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <title>CyberEdu Lab: SQL Injection</title>
    <style>
        body {{ background: #0b0f19; color: #e2e8f0; font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; margin: 0; }}
        .card {{ max-width: 720px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 28px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }}
        h2 {{ color: #a855f7; margin-top: 0; }}
        input[type=text] {{ width: 100%; box-sizing: border-box; padding: 12px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; margin-bottom: 12px; font-size: 15px; }}
        button {{ background: #9333ea; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
        th, td {{ padding: 10px; border: 1px solid #334155; text-align: left; }}
        th {{ background: #1e293b; color: #a855f7; }}
        .badge {{ display: inline-block; padding: 4px 10px; background: #4c1d95; color: #c084fc; border-radius: 4px; font-size: 12px; margin-bottom: 16px; }}
    </style>
</head>
<body>
    <div class="card">
        <span class="badge">Zaiflik: SQL Injection (UNION Attack)</span>
        <h2>📚 Elektron Kutubxona Qidiruvi</h2>
        <p>Kitob nomi bo'yicha qidiring yoki bazadagi maxfiy ma'lumotlarni chiqarib oling.</p>
        <form method="GET">
            <input type="text" name="title" placeholder="Kitob nomini kiriting..." value="{search_book}">
            <button type="submit">Qidirish</button>
        </form>
        {error_html}
        {f"<table><tr><th>ID</th><th>Nomi</th><th>Muallif</th></tr>{books_html}</table>" if books_html else ""}
    </div>
</body>
</html>"""
            self.send_html(html)
            return

        # ── 3. WEB-IDOR LAB ─────────────────────────────────────────────
        if LAB_TYPE == "web-idor":
            if path == "/api/user":
                target_id = query.get("id", ["104"])[0]
                # Zaiflik: Sessiya huquqi tekshirilmasdan istalgan ID qaytariladi (IDOR)
                if target_id == "1" or target_id.lower() == "admin":
                    self.send_json({
                        "id": 1,
                        "username": "admin_tizim",
                        "full_name": "Bosh Tizim Administratori",
                        "role": "admin",
                        "email": "root@cyberedu.local",
                        "balance_uzs": 95000000,
                        "confidential_note": f"MAXFIY_FLAG: {FLAG}"
                    })
                    return
                elif target_id == "104":
                    self.send_json({
                        "id": 104,
                        "username": "student_ali",
                        "full_name": "Ali Valiyev",
                        "role": "student",
                        "email": "ali@cyberedu.uz",
                        "balance_uzs": 15000,
                        "confidential_note": "Oddiy talaba hisobi. Maxfiy ma'lumot yo'q."
                    })
                    return
                else:
                    self.send_json({"error": "Foydalanuvchi topilmadi"}, status=404)
                    return

            html = f"""<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <title>CyberEdu Lab: IDOR Vulnerability</title>
    <style>
        body {{ background: #0b0f19; color: #e2e8f0; font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; margin: 0; }}
        .card {{ max-width: 650px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 28px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }}
        h2 {{ color: #10b981; margin-top: 0; }}
        .badge {{ display: inline-block; padding: 4px 10px; background: #064e3b; color: #34d399; border-radius: 4px; font-size: 12px; margin-bottom: 16px; }}
        .profile-box {{ background: #0f172a; border-radius: 8px; padding: 20px; margin-top: 20px; }}
        .row {{ display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #1e293b; padding-bottom: 8px; }}
        .row:last-child {{ border-bottom: none; }}
        .label {{ color: #94a3b8; }}
        .val {{ font-weight: bold; color: #fff; }}
        code {{ background: #022c22; color: #6ee7b7; padding: 2px 6px; border-radius: 4px; }}
    </style>
</head>
<body>
    <div class="card">
        <span class="badge">Zaiflik: Insecure Direct Object Reference (IDOR)</span>
        <h2>👤 Talabalar Profili Kabineti</h2>
        <p>Siz talaba <code>Ali Valiyev (ID: 104)</code> sifatida tizimdasiz.</p>
        <p>Ma'lumotlar <code>/api/user?id=104</code> API oxirgi nuqtasidan olinmoqda.</p>
        <div class="profile-box">
            <div class="row"><span class="label">Foydalanuvchi ID:</span><span class="val">104</span></div>
            <div class="row"><span class="label">F.I.SH:</span><span class="val">Ali Valiyev</span></div>
            <div class="row"><span class="label">Roli:</span><span class="val">student</span></div>
            <div class="row"><span class="label">Email:</span><span class="val">ali@cyberedu.uz</span></div>
        </div>
        <p style="margin-top: 20px; font-size: 13px; color: #94a3b8;">
            Maslahat: Brauzerda yoki API orqali <code>/api/user?id=1</code> ga so'rov yuborib ko'ring.
        </p>
    </div>
</body>
</html>"""
            self.send_html(html)
            return

        # ── 4. WEB-EXPOSED-FILES LAB ────────────────────────────────────
        if LAB_TYPE == "web-exposed-files":
            if path == "/robots.txt":
                robots = """User-agent: *
Disallow: /admin
Disallow: /.backup_secrets_2026/
Disallow: /.git
"""
                self.send_html(robots, extra_headers={"Content-Type": "text/plain; charset=utf-8"})
                return

            if path in ["/.backup_secrets_2026/", "/.backup_secrets_2026", "/.backup_secrets_2026/db.env"]:
                leak = f"""# CYBEREDU PORTAL BACKUP CONFIG
DB_HOST=10.0.0.55
DB_USER=cyber_admin
DB_PASS=SuperSecr3tDBP@ss!
FLAG_PRODUCTION={FLAG}
"""
                self.send_html(leak, extra_headers={"Content-Type": "text/plain; charset=utf-8"})
                return

            if path in ["/.git", "/.git/", "/.git/HEAD"]:
                git_head = f"""ref: refs/heads/master
# Commit message: Update leaked flag: {FLAG}
"""
                self.send_html(git_head, extra_headers={"Content-Type": "text/plain; charset=utf-8"})
                return

            html = f"""<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <title>CyberEdu Lab: Information Disclosure</title>
    <style>
        body {{ background: #0b0f19; color: #e2e8f0; font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; margin: 0; }}
        .card {{ max-width: 650px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 28px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }}
        h2 {{ color: #f59e0b; margin-top: 0; }}
        .badge {{ display: inline-block; padding: 4px 10px; background: #78350f; color: #fde68a; border-radius: 4px; font-size: 12px; margin-bottom: 16px; }}
        code {{ background: #1e293b; color: #38bdf8; padding: 2px 6px; border-radius: 4px; }}
    </style>
</head>
<body>
    <div class="card">
        <span class="badge">Zaiflik: Exposed Sensitive Files / Misconfiguration</span>
        <h2>🌐 CyberEdu Tashkiliy Portali</h2>
        <p>Ushbu veb-serverda administrator ba'zi maxfiy konfiguratsiya va zaxira fayllarini ochiq qoldirgan.</p>
        <p>Qidiruv tizimlari indekslamasligi uchun qaysi standart fayldan foydalaniladi?</p>
        <p style="margin-top: 20px; font-size: 13px; color: #94a3b8;">
            Maslahat: Server ildizidagi <code>/robots.txt</code> yoki <code>.git</code> fayllarini tekshiring.
        </p>
    </div>
</body>
</html>"""
            self.send_html(html)
            return

        self.send_html("Not Found", status=404)

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), LabHandler)
    print(f"[*] CyberEdu Lab ({LAB_TYPE}) ishga tushdi: port {PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
