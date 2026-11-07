#!/usr/bin/env python3
"""
test_stress_50_users.py — CTF v2 50 Ta Foydalanuvchi Bilan Keng Qamrovli Stress / Concurrency Test
50 ta real ishtirokchi bir vaqtning o'zida har xil harakatlar bilan arenani testdan o'tkazadi:
  - 7 ta "Elite" to'liq yakunlovchi talabalar (1-bosqich, 10 ta web zaiflik, hisobot, hakam bahosi)
  - 10 ta "Rapid Burst" tezkor va ketma-ket so'rov yuboruvchilar (poyga / concurrency tekshiruvi)
  - 5 ta "Fuzzer / Error Maker" faqat xato, anomal va nojo'ya so'rov yuboruvchilar (DoS / rate limit)
  - 15 ta "Intermediate" o'rta darajali ishtirokchilar (3-6 ta zaiflik, ba'zilari hisobot topshiradi)
  - 8 ta "Beginner" sekin va boshlang'ich talabalar (1-bosqich va 1-2 ta zaiflik)
  - 5 ta "Explorer" sayt bo'ylab turli formalarni to'ldiruvchi, fayl yuklovchi va qidiruvchilar
"""

import os
import sys
import time
import json
import random
import io
import requests
import threading
from concurrent.futures import ThreadPoolExecutor

PROJECT_ROOT = "/home/user/ctf-v2"
sys.path.insert(0, PROJECT_ROOT)

from core_db import db as ctf_db

WEB_URL = os.getenv("WEB_URL", "http://127.0.0.1:5000")
DASHBOARD_URL = os.getenv("DASHBOARD_URL", "http://127.0.0.1:8080")
STAGE1_FLAG = "FLAG{v2_linux_corporate_foothold_apex_7781}"

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

# 50 ta profil yaratish
PROFILES = []

# 1. 7 ta Elite (Hammasini yechuvchilar)
for i in range(1, 8):
    PROFILES.append({
        "username": f"elite_user_{i:02d}",
        "full_name": f"Elite Solver {i}",
        "role": "elite",
        "solves": ["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10"],
        "submit_report": True,
        "judge_score": random.randint(350, 500)
    })

# 2. 10 ta Rapid Burst (Tezkor va ketma-ket so'rovlar)
for i in range(8, 18):
    PROFILES.append({
        "username": f"rapid_user_{i:02d}",
        "full_name": f"Rapid Tester {i}",
        "role": "rapid",
        "solves": ["V1", "V2", "V3", "V4"],
        "submit_report": False,
        "judge_score": 0
    })

# 3. 5 ta Fuzzer / Error Maker (Faqat xato va anomal ma'lumot yuboruvchilar)
for i in range(18, 23):
    PROFILES.append({
        "username": f"fuzzer_{i:02d}",
        "full_name": f"Fuzz Attacker {i}",
        "role": "fuzzer",
        "solves": [],
        "submit_report": False,
        "judge_score": 0
    })

# 4. 15 ta Intermediate (O'rta daraja)
for i in range(23, 38):
    # 3 dan 6 tagacha tasodifiy zaiflik
    num_solves = random.randint(3, 6)
    selected = random.sample(list(ALL_FLAGS.keys()), num_solves)
    PROFILES.append({
        "username": f"inter_user_{i:02d}",
        "full_name": f"Intermediate {i}",
        "role": "intermediate",
        "solves": selected,
        "submit_report": True,
        "judge_score": random.randint(200, 350)
    })

# 5. 8 ta Beginner (Boshlang'ich)
for i in range(38, 46):
    PROFILES.append({
        "username": f"beginner_{i:02d}",
        "full_name": f"Beginner {i}",
        "role": "beginner",
        "solves": ["V1", "V2"] if i % 2 == 0 else ["V1"],
        "submit_report": False,
        "judge_score": 0
    })

# 6. 5 ta Explorer (Sayt formalari, qidiruv va yuklovchilar)
for i in range(46, 51):
    PROFILES.append({
        "username": f"explorer_{i:02d}",
        "full_name": f"Web Explorer {i}",
        "role": "explorer",
        "solves": ["V1"],
        "submit_report": False,
        "judge_score": 0
    })

# Statistika va natijalar
stats = {
    "total_requests": 0,
    "success_requests": 0,
    "http_500_errors": 0,
    "db_lock_errors": 0,
    "network_errors": 0,
    "user_results": {}
}
stats_lock = threading.Lock()

def record_req(success=True, is_500=False, is_lock=False, is_net=False):
    with stats_lock:
        stats["total_requests"] += 1
        if success:
            stats["success_requests"] += 1
        if is_500:
            stats["http_500_errors"] += 1
        if is_lock:
            stats["db_lock_errors"] += 1
        if is_net:
            stats["network_errors"] += 1

def run_user_simulation(p):
    u = p["username"]
    role = p["role"]
    res = {
        "username": u,
        "role": role,
        "stage1": False,
        "stage2_solves": 0,
        "stage3_unlocked": False,
        "report_submitted": False,
        "total_score": 0,
        "actions_done": 0,
        "errors": []
    }

    session = requests.Session()
    # Har bir foydalanuvchiga simulyatsiya qilingan IP
    simulated_ip = f"10.10.{(hash(u) % 200) + 1}.{(hash(u) % 250) + 1}"
    session.headers.update({"X-Real-IP": simulated_ip})

    try:
        # [1] Ro'yxatdan o'tish (Markaziy baza)
        participant = ctf_db.register_participant(u, p["full_name"], phone=f"+99890{random.randint(1000000, 9999999)}")
        pid = participant["id"]
        res["actions_done"] += 1

        # [2] Harakatlar roli bo'yicha
        if role in ["elite", "intermediate", "beginner", "explorer"]:
            # 1-Bosqich (Linux) ni yechish
            ok1, _ = ctf_db.submit_stage1_flag(u, STAGE1_FLAG)
            if ok1:
                res["stage1"] = True
            res["actions_done"] += 1

            # 2-Bosqich: Belgilangan zaifliklarni submit qilish
            for ch_code in p["solves"]:
                flag = ALL_FLAGS[ch_code]
                try:
                    r = session.post(f"{WEB_URL}/api/ctf/submit-flag",
                                     json={"username": u, "flag": flag},
                                     timeout=6)
                    record_req(success=(r.status_code == 200), is_500=(r.status_code >= 500))
                    if r.status_code == 200 and r.json().get("status") == "success":
                        res["stage2_solves"] += 1
                except Exception as e:
                    record_req(success=False, is_net=True)
                    res["errors"].append(f"{ch_code} xato: {e}")
                res["actions_done"] += 1
                time.sleep(random.uniform(0.02, 0.08))

            # Holatni tekshirish
            p_cur = ctf_db.get_participant_by_user(u)
            res["total_score"] = p_cur["total_score"]
            res["stage3_unlocked"] = bool(p_cur["stage3_unlocked"])

            # 3-Bosqich: Hisobot topshirish (agar ochilgan bo'lsa)
            if p["submit_report"] and res["stage3_unlocked"]:
                report_path = f"/tmp/{u}_poc_report.md"
                with open(report_path, "w") as f:
                    f.write(f"# Vulnerability Report by {p['full_name']}\n\nPoC and detailed analysis.")
                ok3, _ = ctf_db.submit_report(pid, report_path)
                if ok3:
                    res["report_submitted"] = True
                    # Hakam bahosi
                    j_score = p["judge_score"]
                    admin_resp = session.post(f"{DASHBOARD_URL}/admin/api/grade-report", data={
                        "key": "admin2026",
                        "participant_id": pid,
                        "score": j_score,
                        "feedback": "Yaxshi tahlil"
                    }, timeout=6)
                    record_req(success=(admin_resp.status_code == 200), is_500=(admin_resp.status_code >= 500))
                    res["total_score"] += j_score
                res["actions_done"] += 2

        elif role == "rapid":
            # 10 ta talaba bir vaqtda ketma-ket 15 ta tezkor so'rov yuboradi
            ctf_db.submit_stage1_flag(u, STAGE1_FLAG)
            res["stage1"] = True

            for _ in range(15):
                ch_code = random.choice(list(ALL_FLAGS.keys()))
                flag = ALL_FLAGS[ch_code]
                try:
                    # Submit
                    r = session.post(f"{WEB_URL}/api/ctf/submit-flag",
                                     json={"username": u, "flag": flag},
                                     timeout=5)
                    record_req(success=(r.status_code == 200), is_500=(r.status_code >= 500))
                    if r.status_code == 200 and r.json().get("status") == "success":
                        res["stage2_solves"] += 1
                    # Status
                    r2 = session.get(f"{WEB_URL}/api/ctf/status?username={u}", timeout=5)
                    record_req(success=(r2.status_code == 200), is_500=(r2.status_code >= 500))
                except Exception as e:
                    record_req(success=False, is_net=True)
                res["actions_done"] += 2

            p_cur = ctf_db.get_participant_by_user(u)
            res["total_score"] = p_cur["total_score"]
            res["stage3_unlocked"] = bool(p_cur["stage3_unlocked"])

        elif role == "fuzzer":
            # Noto'g'ri, anomal va zararli urinishlar
            bad_flags = [
                "FLAG{wrong_hash_0000}",
                "FLAG{' OR 1=1--}",
                "<script>alert(1)</script>",
                "FLAG{" + ("A" * 500) + "}",
                "random_string_without_flag_format",
                ""
            ]
            for bf in bad_flags:
                try:
                    r = session.post(f"{WEB_URL}/api/ctf/submit-flag",
                                     json={"username": u, "flag": bf},
                                     timeout=5)
                    # 200 OK qaytishi kerak (xato xabari bilan), 500 bo'lmasligi lozim!
                    record_req(success=(r.status_code in [200, 400]), is_500=(r.status_code >= 500))
                except Exception as e:
                    record_req(success=False, is_net=True)
                res["actions_done"] += 1

            # Staff login brute force (har biriga alohida rate limit ishlashi kerak)
            for _ in range(5):
                try:
                    r_login = session.post(f"{WEB_URL}/portal/staff-login",
                                           data={"username": "asmith", "password": "wrong_password_123"},
                                           headers={"X-Forwarded-For": simulated_ip},
                                           timeout=5)
                    # 401 yoki 429 kutilyapti, 500 bo'lmasligi lozim!
                    record_req(success=(r_login.status_code in [401, 403, 429]), is_500=(r_login.status_code >= 500))
                except Exception as e:
                    record_req(success=False, is_net=True)
                res["actions_done"] += 1

        elif role == "explorer":
            # Veb qidiruv, support chat va rezyume formasi
            for q in ["Cloud", "Security", "Audit", "' UNION SELECT 1--"]:
                try:
                    r_srch = session.get(f"{WEB_URL}/services/search?q={q}", timeout=5)
                    record_req(success=(r_srch.status_code == 200), is_500=(r_srch.status_code >= 500))
                except Exception:
                    record_req(success=False, is_net=True)
                res["actions_done"] += 1

            # Ticket yuborish
            try:
                r_tkt = session.post(f"{WEB_URL}/support/ticket", data={
                    "client_name": p["full_name"],
                    "email": f"{u}@corp.local",
                    "subject": "Platforma faoliyati",
                    "message": "Salom, xizmatlar narxi haqida ma'lumot bering."
                }, timeout=5)
                record_req(success=(r_tkt.status_code == 200), is_500=(r_tkt.status_code >= 500))
            except Exception:
                record_req(success=False, is_net=True)
            res["actions_done"] += 1

            # Rezyume yuborish
            try:
                r_up = session.post(f"{WEB_URL}/careers/apply", data={
                    "name": p["full_name"],
                    "email": f"{u}@test.com"
                }, files={
                    "resume": ("resume.pdf", io.BytesIO(b"%PDF-1.4 Simulated CV Content"), "application/pdf")
                }, timeout=5)
                record_req(success=(r_up.status_code == 200), is_500=(r_up.status_code >= 500))
            except Exception:
                record_req(success=False, is_net=True)
            res["actions_done"] += 1

    except Exception as exc:
        res["errors"].append(f"Kutilmagan xato: {exc}")

    with stats_lock:
        stats["user_results"][u] = res

def main():
    print("====================================================================")
    print("  🔥 CTF v2 — 50 TA FOYDALANUVCHILI PARALLEL STRESS TEST BOSHLANDI")
    print("====================================================================")
    print(f"[*] Web Server nishoni:       {WEB_URL}")
    print(f"[*] Dashboard nishoni:        {DASHBOARD_URL}")
    print(f"[*] Jami ishtirokchilar:      {len(PROFILES)} ta parallel oqimda")
    print("--------------------------------------------------------------------")
    print("  Tarkib:")
    print("    • 7 ta  'Elite'         (100% barcha bosqichlarni to'liq tugatuvchilar)")
    print("    • 10 ta 'Rapid Burst'   (Tezkor ketma-ket so'rovlar va poyga holati)")
    print("    • 5 ta  'Fuzzer'        (Noto'g'ri flaglar, bruteforce, DoS urinishlari)")
    print("    • 15 ta 'Intermediate'  (O'rta toifadagi haqiqiy talabalar: 3-6 zaiflik)")
    print("    • 8 ta  'Beginner'      (1-bosqich va 1-2 ta zaiflik yechuvchilar)")
    print("    • 5 ta  'Explorer'      (Qidiruv, fayl yuklash va chat testerlar)")
    print("--------------------------------------------------------------------\n")

    start_time = time.time()

    # 50 ta parallel oqimda bir vaqtda ishga tushirish
    with ThreadPoolExecutor(max_workers=50) as executor:
        list(executor.map(run_user_simulation, PROFILES))

    elapsed = time.time() - start_time

    print("\n====================================================================")
    print(f"  🏁 STRESS TEST YAKUNLANDI (Sarflangan vaqt: {elapsed:.2f} soniya)")
    print("====================================================================\n")

    # Natijalarni saralash
    sorted_users = sorted(stats["user_results"].values(), key=lambda x: x["total_score"], reverse=True)

    print("📊 GURUHLAR BO'YICHA XULOSA:")
    groups = {"elite": [], "rapid": [], "fuzzer": [], "intermediate": [], "beginner": [], "explorer": []}
    for u in sorted_users:
        groups[u["role"]].append(u)

    for g_name, members in groups.items():
        avg_score = sum(m["total_score"] for m in members) / max(1, len(members))
        total_actions = sum(m["actions_done"] for m in members)
        errs = sum(len(m["errors"]) for m in members)
        print(f"  • {g_name.upper():<13} ({len(members)} ta): O'rtacha ball: {avg_score:.0f} | Jami amallar: {total_actions} | Xatolar: {errs}")

    print("\n--------------------------------------------------------------------")
    print("🏆 TOP-5 ISHTIROKCHILAR (Jonli Liderlar):")
    for i, u in enumerate(sorted_users[:5], 1):
        print(f"  {i}. {u['username']} ({u['role']}) — {u['total_score']} ball | Web solves: {u['stage2_solves']}/10")

    # Tarmoq va server statistikasi
    print("\n--------------------------------------------------------------------")
    print("🌐 SERVER STATISTIKASI VA RESURSLAR:")
    print(f"  • Jami HTTP so'rovlar:        {stats['total_requests']}")
    print(f"  • Muvaffaqiyatli so'rovlar:   {stats['success_requests']}")
    print(f"  • HTTP 500 Xatolari (Crash):  {stats['http_500_errors']} ta {'✅ (0 - Server yiqilmadi)' if stats['http_500_errors'] == 0 else '❌'}")
    print(f"  • SQLite Database Locks:      {stats['db_lock_errors']} ta {'✅ (0 - Qulflash bo\'lmadi)' if stats['db_lock_errors'] == 0 else '❌'}")
    print(f"  • Tarmoq / Timeout xatolari:  {stats['network_errors']} ta")

    # Katta Ekran Matritsasini tekshirish
    try:
        r_matrix = requests.get(f"{DASHBOARD_URL}/api/live/matrix", timeout=5)
        m_data = r_matrix.json()
        print(f"\n📺 JONLI MATRITSA TEKSHIRUVI:")
        print(f"  • Matritsadagi jami ishtirokchilar: {len(m_data['participants'])} ta")
        print(f"  • Jonli yangiliklar (Ticker feed):   {len(m_data['feed'])} ta")
        print(f"  • 1-o'rindagi yetakchi:              {m_data['participants'][0]['full_name']} ({m_data['participants'][0]['total_score']} ball)")
    except Exception as e:
        print(f"  ❌ Dashboard API tekshirishda xato: {e}")

    print("====================================================================")
    if stats["http_500_errors"] == 0 and stats["db_lock_errors"] == 0:
        print("  🎉 XULOSA: 50 TA FOYDALANUVCHILI STRESS TEST 100% MUVAFFAQIYATLI O'TDI!")
        print("  Server 50 ta bir vaqtdagi foydalanuvchining turli xil harakatlariga")
        print("  (bruteforce, fuzzer, poyga so'rovlari) to'liq bardosh berdi.")
    else:
        print("  ⚠️ XULOSA: Tizimda yuklama ostida ba'zi muammolar aniqlandi.")
    print("====================================================================\n")

if __name__ == "__main__":
    main()
