#!/usr/bin/env python3
"""
stage1_linux/setup_stage1.py — 1-Bosqich (Linux Tizim Auditi) Dinamik O'rnatish
Har bir ishtirokchining shaxsiy Tokeni asosida 7 ta amaliy topshiriqni ~/apex_corp papkasida yaratadi.
"""

import os
import sys
import shutil
import tarfile
import subprocess
from pathlib import Path

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
sys.path.insert(0, PROJECT_ROOT)

from core_db import flag_engine


def setup_stage1(username: str = None, token: str = "APEX-DEFAULT", home_dir: str = None):
    target_user = username or os.environ.get("USER") or os.environ.get("LOGNAME") or "user"
    user_home = home_dir or os.path.expanduser(f"~{target_user}" if target_user != os.environ.get("USER") else "~")
    if not os.path.exists(user_home):
        user_home = os.path.expanduser("~")

    corp_dir = os.path.join(user_home, "apex_corp")
    print(f"[*] {target_user} uchun 1-bosqich (Apex Corp) muhiti tayyorlanmoqda... (Token: {token})")

    # Flaglarni hisoblash
    l1_flag = flag_engine.get_flag(token, "L1")
    l2_flag = flag_engine.get_flag(token, "L2")
    l3_flag = flag_engine.get_flag(token, "L3")
    l4_flag = flag_engine.get_flag(token, "L4")
    l5_flag = flag_engine.get_flag(token, "L5")
    l6_flag = flag_engine.get_flag(token, "L6")
    l7_flag = flag_engine.get_flag(token, "L7")

    # Eski papkani tozalash (chmod 000 yoki ruxsatlarni hisobga olgan holda)
    if os.path.exists(corp_dir):
        def _on_rm_error(func, path, exc_info):
            try:
                os.chmod(path, 0o777)
                func(path)
            except Exception:
                pass
        try:
            shutil.rmtree(corp_dir, onerror=_on_rm_error)
        except Exception:
            pass
        if os.path.exists(corp_dir):
            try:
                subprocess.run(["sudo", "-n", "rm", "-rf", corp_dir], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception:
                pass

    for sub in ["01_hidden_station", "02_system_logs", "03_employee_registry",
                "04_lost_backups", "05_restricted_vault", "06_archived_backups", "07_git_repository"]:
        os.makedirs(os.path.join(corp_dir, sub), exist_ok=True)

    # --------------------------------------------------------------------------
    # 01-TOPShIRIQ: Yashirin stansiya ma'lumotlari
    # --------------------------------------------------------------------------
    p1 = os.path.join(corp_dir, "01_hidden_station")
    with open(os.path.join(p1, "README.txt"), "w", encoding="utf-8") as f:
        f.write("""================================================================================
🏢 APEX GLOBAL TECHNOLOGIES — 01-TOPShIRIQ: YASHIRIN MA'LUMOT
================================================================================
Apex Corporation xavfsizlik nazorati stansiyasiga xush kelibsiz.
Administrator ushbu stansiya katalogiga favqulodda kirish kalitini joylashtirgan.
Biroq maxfiy tizim fayllari odatiy ro'yxatda ko'rinmasligi mumkin.

Topshiriq:
Katalogdagi barcha obyektlarni sinchkovlik bilan tekshiring va yashiringan
maxfiy tizim flagini fosh qiling!
================================================================================
""")
    with open(os.path.join(p1, "station_info.txt"), "w", encoding="utf-8") as f:
        f.write("Apex Corporation — Terminal stansiyasi #01\nTizim holati: Faol (Online)\nKatalog: Ichki monitoring va xavfsizlik\n")
    with open(os.path.join(p1, ".apex_sys_flag"), "w", encoding="utf-8") as f:
        f.write(f"{l1_flag}\n")

    # --------------------------------------------------------------------------
    # 02-TOPShIRIQ: Katta log faylining oxirini ko'rish
    # --------------------------------------------------------------------------
    p2 = os.path.join(corp_dir, "02_system_logs")
    with open(os.path.join(p2, "README.txt"), "w", encoding="utf-8") as f:
        f.write("""================================================================================
🏢 APEX GLOBAL TECHNOLOGIES — 02-TOPShIRIQ: MONITORING JURNALI TAHLILI
================================================================================
Server oxirgi ishga tushish paytida katta hajmli 'server_startup.log' monitoring
jurnalini yaratdi. Tizim xavfsiz holatga kelishi bilan, jurnalning eng oxirgi
yozuvlarida favqulodda xavfsizlik flagi qayd etilgan.

Topshiriq:
Ushbu katta hajmli jurnalning eng so'nggi xabarlarini tahlil qiling va
favqulodda tizim kalitini qo'lga kiriting!
================================================================================
""")
    with open(os.path.join(p2, "server_startup.log"), "w", encoding="utf-8") as f:
        for i in range(1, 221):
            m = i // 60
            s = i % 60
            cpu = (i * 7) % 100
            f.write(f"[2026-10-25 08:{m:02d}:{s:02d}] systemd[{1000+i}]: Service worker-{i} initialized. Status=ACTIVE cpu=0.{cpu:02d}%\n")
        f.write("[2026-10-25 08:59:50] apex-security-guard: All baseline microservices verified.\n")
        f.write("[2026-10-25 08:59:52] apex-audit-daemon: Synchronizing corporate ledger hashes.\n")
        f.write("[2026-10-25 08:59:55] apex-net-core: Internal loopback firewall rules loaded.\n")
        f.write("[2026-10-25 08:59:58] apex-emergency-sec: Emergency token successfully generated.\n")
        f.write(f"[2026-10-25 09:00:00] {l2_flag}\n")

    # --------------------------------------------------------------------------
    # 03-TOPShIRIQ: Xodimlar reestridan token qidirish
    # --------------------------------------------------------------------------
    p3 = os.path.join(corp_dir, "03_employee_registry")
    with open(os.path.join(p3, "README.txt"), "w", encoding="utf-8") as f:
        f.write("""================================================================================
🏢 APEX GLOBAL TECHNOLOGIES — 03-TOPShIRIQ: XODIMLAR REESTRIDAN QIDIRUV
================================================================================
Ushbu papkada kompaniyaning barcha xodimlari ro'yxati (employees.csv) saqlanmoqda.
Kiber-xavfsizlik bo'limi xodimlardan biri profili ichiga audit tekshiruvi uchun
maxsus flagni kiritib qo'ygan.

Topshiriq:
Yuzlab qatorli ma'lumotlar bazasi ichidan maxfiy flag kalitini qidirib toping!
================================================================================
""")
    with open(os.path.join(p3, "employees.csv"), "w", encoding="utf-8") as f:
        f.write("id,full_name,department,role,email,status\n")
        f.write("1,Dr. Robert Vance,Executive Board,CEO,ceo@apextech.com,Active\n")
        f.write("2,Elena Rostova,Information Security,CTO,erostova@apextech.com,Active\n")
        f.write("3,Adam Smith,Cloud Infrastructure,Lead Systems Engineer,asmith@apextech.com,Active\n")
        f.write("4,Sarah Connor,Cloud Infrastructure,Senior DevOps,sconnor@apextech.com,Active\n")
        for j in range(5, 61):
            f.write(f"{j},Employee_{j},Operations,Staff,staff_{j}@apextech.com,Active\n")
        f.write(f"61,Security Bot,Audit Special,{l3_flag},audit_bot@apextech.com,Active\n")
        for k in range(62, 120):
            f.write(f"{k},Consultant_{k},Logistics,Contractor,contractor_{k}@partner.org,Pending\n")

    # --------------------------------------------------------------------------
    # 04-TOPShIRIQ: Ichki arxivdan zaxira faylini topish
    # --------------------------------------------------------------------------
    p4 = os.path.join(corp_dir, "04_lost_backups")
    with open(os.path.join(p4, "README.txt"), "w", encoding="utf-8") as f:
        f.write("""================================================================================
🏢 APEX GLOBAL TECHNOLOGIES — 04-TOPShIRIQ: CHUQUR ARXIVDAN IZLASH
================================================================================
Tizim administratori server ko'chirilishi paytida xavfsizlik zaxira nusxalarini
juda ko'p qatlamli kataloglar ichiga saqlagan.
Fayl nomi: '.recovery_vault'

Topshiriq:
Barcha ichki kataloglarni qidirib, yashirin .recovery_vault faylini toping
va uning ichidagi maxfiy flagni qo'lga kiriting!
================================================================================
""")
    deep_path = os.path.join(p4, "archives", "2026", "q1", "cluster_09", "vault")
    os.makedirs(deep_path, exist_ok=True)
    with open(os.path.join(deep_path, ".recovery_vault"), "w", encoding="utf-8") as f:
        f.write(f"CRITICAL_RECOVERY_KEY={l4_flag}\n")

    # --------------------------------------------------------------------------
    # 05-TOPShIRIQ: Himoyalangan kassa ruxsatini tiklash
    # --------------------------------------------------------------------------
    p5 = os.path.join(corp_dir, "05_restricted_vault")
    with open(os.path.join(p5, "README.txt"), "w", encoding="utf-8") as f:
        f.write("""================================================================================
🏢 APEX GLOBAL TECHNOLOGIES — 05-TOPShIRIQ: RUXSATLARNI BOSHQARISH (CHMOD)
================================================================================
Xavfsizlik tizimi '.vault_passphrase.txt' maxfiy faylining barcha o'qish va
yozish ruxsatlarini (000 permissions) cheklab qo'ygan.
Hozirda faylni o'qish imkonsiz.

Topshiriq:
Fayl ruxsatlarini tekshiring, unga o'qish huquqini qaytaring va maxfiy flagni oling!
================================================================================
""")
    pass_file = os.path.join(p5, ".vault_passphrase.txt")
    with open(pass_file, "w", encoding="utf-8") as f:
        f.write(f"VAULT_ROOT_PASSWORD={l5_flag}\n")
    try:
        os.chmod(pass_file, 0000)
    except Exception:
        pass

    # --------------------------------------------------------------------------
    # 06-TOPShIRIQ: Hodisalar arxivi paketini ochish
    # --------------------------------------------------------------------------
    p6 = os.path.join(corp_dir, "06_archived_backups")
    with open(os.path.join(p6, "README.txt"), "w", encoding="utf-8") as f:
        f.write("""================================================================================
🏢 APEX GLOBAL TECHNOLOGIES — 06-TOPShIRIQ: ARXIV BILAN ISHLASH (TAR)
================================================================================
Tizim administratori kechagi kiber-hujum hisobotlarini 'backup.tar.gz' arxivi
ichiga siqib saqlagan.

Topshiriq:
Arxivni katalog ichiga oching va hodisalar jurnali ichidagi flagni toping!
================================================================================
""")
    tar_path = os.path.join(p6, "backup.tar.gz")
    tmp_dir = os.path.join(p6, "_temp_tar")
    os.makedirs(tmp_dir, exist_ok=True)
    with open(os.path.join(tmp_dir, "incident_summary.log"), "w", encoding="utf-8") as f:
        f.write(f"[INCIDENT-REPORT #2026-X4]: Breach prevented by security team. Key: {l6_flag}\n")
    with open(os.path.join(tmp_dir, "forensic_data.dump"), "w", encoding="utf-8") as f:
        f.write("0x41 0x50 0x45 0x58 0x20 0x53 0x45 0x43\n")

    with tarfile.open(tar_path, "w:gz") as tar:
        tar.add(os.path.join(tmp_dir, "incident_summary.log"), arcname="incident_summary.log")
        tar.add(os.path.join(tmp_dir, "forensic_data.dump"), arcname="forensic_data.dump")
    shutil.rmtree(tmp_dir, ignore_errors=True)

    # --------------------------------------------------------------------------
    # 07-TOPShIRIQ: Repozitoriy tarixidan o'chirilgan sir
    # --------------------------------------------------------------------------
    p7 = os.path.join(corp_dir, "07_git_repository")
    with open(os.path.join(p7, "README.txt"), "w", encoding="utf-8") as f:
        f.write("""================================================================================
🏢 APEX GLOBAL TECHNOLOGIES — 07-TOPShIRIQ: GIT COMMITLAR TARIXI
================================================================================
Ishlab chiquvchi dastlabki commitda 'config.env' fayliga maxfiy ishlab chiqarish
kalitini qo'shib qo'ygan. Keyingi commitda xatoni to'g'irlab, kalitni o'chirib
tashlagan (REDACTED).

Topshiriq:
'apex-api' repozitoriyasining commitlar tarixini (git log) tahlil qiling va
dastlabki commitdagi maxfiy flagni tiklang!
================================================================================
""")
    repo_dir = os.path.join(p7, "apex-api")
    if os.path.exists(repo_dir):
        shutil.rmtree(repo_dir, ignore_errors=True)
    os.makedirs(repo_dir, exist_ok=True)

    try:
        subprocess.run(["git", "init", "-q"], cwd=repo_dir, check=True)
        subprocess.run(["git", "config", "user.name", "Adam Smith"], cwd=repo_dir, check=True)
        subprocess.run(["git", "config", "user.email", "asmith@apextech.com"], cwd=repo_dir, check=True)

        with open(os.path.join(repo_dir, "README.md"), "w", encoding="utf-8") as f:
            f.write("# Apex Corporation Internal Gateway API\nIchki xizmatlar o'rtasida aloqa o'rnatish shlyuzi.\n")
        with open(os.path.join(repo_dir, "config.env"), "w", encoding="utf-8") as f:
            f.write(f"GATEWAY_HOST=0.0.0.0\nGATEWAY_PORT=5000\nSYS_LEAD=asmith\nSYS_PASSWORD=spring2026\nSECRET_INTEGRATION_KEY={l7_flag}\n")

        subprocess.run(["git", "add", "."], cwd=repo_dir, check=True)
        subprocess.run(["git", "commit", "-q", "-m", "feat: initial commit of internal gateway configuration"], cwd=repo_dir, check=True)

        # 2-commit (Redacted)
        with open(os.path.join(repo_dir, "config.env"), "w", encoding="utf-8") as f:
            f.write("GATEWAY_HOST=0.0.0.0\nGATEWAY_PORT=5000\nSYS_LEAD=asmith\nSYS_PASSWORD=REDACTED\nSECRET_INTEGRATION_KEY=REDACTED_BY_SECURITY_POLICY\n")
        subprocess.run(["git", "add", "config.env"], cwd=repo_dir, check=True)
        subprocess.run(["git", "commit", "-q", "-m", "security: redact credentials and secrets from gateway config"], cwd=repo_dir, check=True)
    except Exception as e:
        print(f"[!] Git repozitoriyasini yaratishda ogohlantirish: {e}")

    # README fayllari
    readme_text = f"""================================================================================
🚩 KIBERXAVFSIZLIK CTF v2 — 1-BOSQICH (LINUX MUHITI) QO'LLANMASI
================================================================================
Sizning shaxsiy laboratoriya tokeningiz: {token}

Barcha amaliy topshiriqlaringiz '~/apex_corp' katalogida joylashgan!
O'tish:
  cd ~/apex_corp

--------------------------------------------------------------------------------
🎯 1-BOSQICHNING 7 TA AMALIY TOPSHIRIG'I:
--------------------------------------------------------------------------------
  📁 01_hidden_station       → Yashirin stansiya ma'lumotlari           [+50 ball]
  📁 02_system_logs           → Server loglaridan favqulodda kalit       [+50 ball]
  📁 03_employee_registry     → Xodimlar reestridan token qidirish       [+75 ball]
  📁 04_lost_backups          → Ichki arxivdan zaxira faylini topish     [+75 ball]
  📁 05_restricted_vault      → Himoyalangan kassa ruxsatini tiklash     [+75 ball]
  📁 06_archived_backups      → Hodisalar arxivi paketini ochish         [+75 ball]
  📁 07_git_repository        → Repozitoriy tarixidan o'chirilgan sir    [+100 ball]
  ------------------------------------------------------------------------------
  Jami: 7 ta topshiriq / 500 ball!

📌 FLAG TOPSHIRISH:
  Topilgan flaglarni markaziy serverdagi shaxsiy kabinetingizga (Portal) kiritasiz!
================================================================================
"""
    try:
        with open(os.path.join(user_home, "README.txt"), "w", encoding="utf-8") as f:
            f.write(readme_text)
    except Exception:
        pass
    try:
        with open(os.path.join(corp_dir, "README.txt"), "w", encoding="utf-8") as f:
            f.write(readme_text)
    except Exception:
        pass

    print(f"[+] 1-bosqich topshiriqlari muvaffaqiyatli tayyorlandi: {corp_dir}")
    return True


if __name__ == "__main__":
    uname = sys.argv[1] if len(sys.argv) > 1 else None
    tok = sys.argv[2] if len(sys.argv) > 2 else "APEX-DEFAULT"
    setup_stage1(username=uname, token=tok)
