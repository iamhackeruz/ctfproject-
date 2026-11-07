#!/usr/bin/env python3
"""
test_concurrent_users.py — CTF v2 Ko'p Foydalanuvchili Parallel Test Simulyatsiyasi
6 ta real talaba hisobini bir vaqtda yaratib, 1-bosqichdan 3-bosqichgacha to'liq testdan o'tkazadi.
"""

import os
import sys
import time
import json
import io
import jwt
import urllib.request
import urllib.parse
import threading
from concurrent.futures import ThreadPoolExecutor

PROJECT_ROOT = "/home/user/ctf-v2"
sys.path.insert(0, PROJECT_ROOT)

from core_db import db as ctf_db
from stage2_web.app.server import JWT_SECRET

WEB_URL = os.getenv("WEB_URL", "http://127.0.0.1:5000")
DASHBOARD_URL = os.getenv("DASHBOARD_URL", "http://127.0.0.1:8080")

# Ishtirokchilar profillari (turli darajadagi hujumchilar)
STUDENTS = [
    {
        "username": "jasur_pro",
        "full_name": "Jasur Rahimov (Kiber-Ekspert)",
        "phone": "+998901111111",
        "target_solves": ["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10"], # Barchasini yechadi (3000b)
        "submits_report": True,
        "judge_score": 480
    },
    {
        "username": "dilshod_sec",
        "full_name": "Dilshod Karimov",
        "phone": "+998902222222",
        "target_solves": ["V1", "V2", "V3", "V6", "V7", "V9"], # 100+150+200+300+350+500 = 1600b
        "submits_report": True,
        "judge_score": 420
    },
    {
        "username": "malika_cyber",
        "full_name": "Malika Umarova",
        "phone": "+998903333333",
        "target_solves": ["V1", "V3", "V4", "V5", "V8"], # 100+200+250+250+400 = 1200b (Chegaradan o'tadi)
        "submits_report": True,
        "judge_score": 380
    },
    {
        "username": "bekzod_dev",
        "full_name": "Bekzod Toshmatov",
        "phone": "+998904444444",
        "target_solves": ["V1", "V2", "V3", "V5"], # 100+150+200+250 = 700b (<1200b)
        "submits_report": False,
        "judge_score": 0
    },
    {
        "username": "shahnoza_it",
        "full_name": "Shahnoza Alimova",
        "phone": "+998905555555",
        "target_solves": ["V1", "V2"], # 100+150 = 250b (<1200b)
        "submits_report": False,
        "judge_score": 0
    },
    {
        "username": "alisher_linux",
        "full_name": "Alisher Qodirov",
        "phone": "+998906666666",
        "target_solves": [], # Faqat 1-bosqichni yechadi
        "submits_report": False,
        "judge_score": 0
    }
]

ALL_FLAGS = {
    "V1":  "FLAG{v2_infoleak_git_exposed_91a2}",
    "V2":  "FLAG{v2_user_enum_apex_sec_83b1}",
    "V3":  "FLAG{v2_auth_bypass_headers_77c2}",
    "V4":  "FLAG{v2_idor_confidential_contract_66d4}",
    "V5":  "FLAG{v2_stored_xss_cookie_theft_55e5}",
    "V6":  "FLAG{v2_lfi_path_traversal_master_44f6}",
    "V7":  "FLAG{v2_sqli_union_secret_extract_33g7}",
    "V8":  "FLAG{v2_fileupload_bypass_webshell_22h8}",
    "V9":  "FLAG{v2_priv_esc_jwt_admin_takeover_11i9}",
    "V10": "FLAG{v2_rce_apex_vault_breach_00j0}"
}

STAGE1_FLAG = "FLAG{v2_linux_corporate_foothold_apex_7781}"

test_results = {}
results_lock = threading.Lock()

def http_post_json(url, data):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode("utf-8"))

def simulate_student(student):
    u = student["username"]
    fn = student["full_name"]
    res = {
        "user": u,
        "errors": [],
        "stage1_ok": False,
        "stage2_solves": 0,
        "stage2_score": 0,
        "stage3_unlocked": False,
        "report_submitted": False,
        "total_score": 0
    }

    try:
        # [Qadam 1]: Ro'yxatdan o'tish
        p = ctf_db.register_participant(u, fn, phone=student["phone"])
        pid = p["id"]

        # [Qadam 2]: 1-Bosqich (Linux Foothold)
        # Talaba yashirin kassadagi flagni topadi va yuboradi
        ok1, msg1 = ctf_db.submit_stage1_flag(u, STAGE1_FLAG)
        if ok1:
            res["stage1_ok"] = True
        else:
            res["errors"].append(f"Stage 1 xatosi: {msg1}")

        # [Qadam 3]: 2-Bosqich (Web Pentest)
        # Talaba rejalashtirilgan zaifliklarni fosh qilib, HTTP API orqali flag yuboradi
        for v_code in student["target_solves"]:
            flag = ALL_FLAGS[v_code]
            payload = {"username": u, "flag": flag}
            try:
                api_resp = http_post_json(f"{WEB_URL}/api/ctf/submit-flag", payload)
                if api_resp.get("status") == "success":
                    res["stage2_solves"] += 1
                else:
                    res["errors"].append(f"{v_code} submit rad etildi: {api_resp.get('message')}")
            except Exception as e:
                res["errors"].append(f"{v_code} HTTP so'rov xatosi: {e}")
            time.sleep(0.1) # Qisqa realistik tanaffus

        # Holatni bazadan yangilash
        p_up = ctf_db.get_participant_by_user(u)
        res["stage2_score"] = p_up["stage2_score"]
        res["stage3_unlocked"] = bool(p_up["stage3_unlocked"])
        res["total_score"] = p_up["total_score"]

        # [Qadam 4]: 3-Bosqich (Reporting)
        # Agar 1200 ballga yetgan bo'lsa va hisobot topshirishi kerak bo'lsa
        if student["submits_report"]:
            if res["stage3_unlocked"]:
                report_file = f"/tmp/{u}_report.md"
                with open(report_file, "w") as f:
                    f.write("# Simulated CTF v2 Penetration Testing Report\n\nAll findings detailed here.")
                ok3, msg3 = ctf_db.submit_report(pid, report_file)
                if ok3:
                    res["report_submitted"] = True
                    # Hakam bahosi
                    j_score = student["judge_score"]
                    conn = ctf_db.get_connection()
                    conn.execute("UPDATE participants SET report_score=?, total_score=total_score+? WHERE id=?",
                                 (j_score, j_score, pid))
                    conn.commit()
                    conn.close()
                    res["total_score"] += j_score
                else:
                    res["errors"].append(f"Hisobot topshirish xatosi: {msg3}")
            else:
                res["errors"].append("Hisobot topshira olmadi (1200 ballga yetmagan)")

    except Exception as exc:
        res["errors"].append(f"Kutilmagan xatolik: {exc}")

    with results_lock:
        test_results[u] = res

def main():
    print("====================================================================")
    print("  🚀 CTF v2 — 6 TA FOYDALANUVCHILI PARALLEL TEST BOSHLANDI")
    print("====================================================================")
    print(f"[*] Web Server nishoni:      {WEB_URL}")
    print(f"[*] Live Dashboard nishoni:  {DASHBOARD_URL}")
    print(f"[*] Ishtirokchilar soni:     {len(STUDENTS)} ta bir vaqtda")
    print("--------------------------------------------------------------------\n")

    start_time = time.time()

    # Parallel 6 ta oqimda (ThreadPoolExecutor) bir vaqtning o'zida ishga tushirish
    with ThreadPoolExecutor(max_workers=6) as executor:
        executor.map(simulate_student, STUDENTS)

    elapsed = time.time() - start_time

    print("\n====================================================================")
    print(f"  🏁 TEST YAKUNLANDI (Sarflangan vaqt: {elapsed:.2f} soniya)")
    print("====================================================================\n")

    # Natijalarni tahlil qilish
    total_errors = 0
    for u, r in test_results.items():
        err_count = len(r["errors"])
        total_errors += err_count
        status_icon = "✅" if err_count == 0 else "⚠️"
        print(f"{status_icon} [{u:<15}] | 1-Bosqich: {'OK' if r['stage1_ok'] else 'FAIL'} | 2-Bosqich: {r['stage2_solves']}/10 ({r['stage2_score']}b) | 3-Bosqich: {'OCHILDI' if r['stage3_unlocked'] else 'QULFLI'} | Hisobot: {'TOP' if r['report_submitted'] else '-'} | Jami: {r['total_score']} ball")
        if err_count > 0:
            for e in r["errors"]:
                print(f"    ❌ {e}")

    # Katta Ekran Matritsasini jonli tekshirish
    print("\n--------------------------------------------------------------------")
    print("[*] Katta Ekran (Projektor) API holatini tekshirish...")
    try:
        matrix_req = urllib.request.urlopen(f"{DASHBOARD_URL}/api/live/matrix", timeout=5)
        matrix_data = json.loads(matrix_req.read().decode("utf-8"))
        print(f"    ✔ Jami ishtirokchilar matritsada: {len(matrix_data['participants'])} ta")
        print(f"    ✔ Yetakchi: {matrix_data['participants'][0]['full_name']} — {matrix_data['participants'][0]['total_score']} ball")
        print(f"    ✔ Yangiliklar lentasi (Ticker feed): {len(matrix_data['feed'])} ta jonli xabar")
    except Exception as e:
        print(f"    ❌ Dashboard API bilan aloqa xatosi: {e}")
        total_errors += 1

    print("====================================================================")
    if total_errors == 0:
        print("  🎉 XULOSA: BARCHA 6 TA TALABA PARALLEL TESTDAN 100% XATOSIZ O'TDI!")
        print("  Qulflashlar, poygalar (race conditions) yoki DB xatoliklari aniqlanmadi!")
    else:
        print(f"  ⚠️ XULOSA: {total_errors} ta xatolik aniqlandi. Tahlil talab etiladi.")
    print("====================================================================\n")

if __name__ == "__main__":
    main()
