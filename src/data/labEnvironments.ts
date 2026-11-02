export interface LabFile {
  path: string; // relative path, e.g. "documents/reports/secret.txt"
  content: string;
  isExecutable?: boolean;
}

export interface CourseLabConfig {
  courseId: number;
  courseTitle: string;
  welcomeMessage: string;
  taskGuide: string;
  files: LabFile[];
}

export const courseLabEnvironments: Record<number, CourseLabConfig> = {
  // Course 1: Kiberxavfsizlik Asoslari
  1: {
    courseId: 1,
    courseTitle: "Kiberxavfsizlik Asoslari",
    welcomeMessage: `[+] Kiberxavfsizlik Asoslari laboratoriyasiga xush kelibsiz!
Mavjud vazifa: Kriptografik xeshlar va tizim xavfsizlik siyosatini tahlil qiling.
Qo'llanmani o'qish uchun: cat VAZIFA.txt`,
    taskGuide: `=== 1-KURS: KIBERXAVFSIZLIK ASOSLARI AMALIY VAZIFASI ===
1. 'ls -la' buyrug'i orqali joriy papkadagi barcha fayllarni ko'ring.
2. 'cat hashes.txt' orqali parollarning MD5/SHA256 xeshlarini tahlil qiling.
3. 'cat security_policy.txt' faylini o'qib, zaifliklarni aniqlang.
4. 'cat flag.txt' orqali kiberxavfsizlik bayrog'ini oling!
`,
    files: [
      {
        path: "VAZIFA.txt",
        content: `=== KIBERXAVFSIZLIK ASOSLARI AMALIYOTI ===
1. Tizim xavfsizligini ta'minlashda CIA Triad (Confidentiality, Integrity, Availability) tamoyillariga rioya qiling.
2. 'cat hashes.txt' faylida foydalanuvchilarning xeshlangan parollari keltirilgan.
3. 'cat flag.txt' faylini o'qib topshiriqni yakunlang.
`
      },
      {
        path: "flag.txt",
        content: "flag{cyber_edu_cia_triad_mastered_2026}\n"
      },
      {
        path: "hashes.txt",
        content: `user:admin      hash(MD5): 21232f297a57a5a743894a0e4a801fc3 (admin)
user:sardor     hash(MD5): 5f4dcc3b5aa765d61d8327deb882cf99 (password)
user:operator   hash(SHA256): 8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918 (admin)
`
      },
      {
        path: "security_policy.txt",
        content: `KOMPANIYA XAVFSIZLIK AUDITI:
- 22/SSH porti ochiq, root kirishiga ruxsat berilgan (ZAIFLIK!)
- Parollar minimal 6 belgi (Tavsiya: minimal 12 belgi va MFA)
- Firewall IDS/IPS qoidalari yangilanmagan
`
      }
    ]
  },

  // Course 2: Kompyuter Tarmoqlari
  2: {
    courseId: 2,
    courseTitle: "Kompyuter Tarmoqlari",
    welcomeMessage: `[+] Kompyuter Tarmoqlari laboratoriyasi faol!
Mavjud vazifa: Tarmoq trafigi, marshrutlash (routing) va paketlarni tekshiring.
Qo'llanma: cat VAZIFA.txt`,
    taskGuide: `=== 2-KURS: KOMPYUTER TARMOQLARI AMALIYOTI ===
1. 'ifconfig' yoki 'ip a' orqali tarmoq interfeyslarini ko'ring.
2. 'cat routing_table.conf' orqali marshrutlash qoidalarini tekshiring.
3. 'cat packets_dump.log' orqali ushlangan tarmoq paketlarini tahlil qiling.
`,
    files: [
      {
        path: "VAZIFA.txt",
        content: `=== TARMOQ AMALIY MASHG'ULOTI ===
Sizga korxona routeri va paketlar jurnali taqdim etilgan.
- 'cat packets_dump.log' - Tarmoqdagi shubhali paketlar tahlili
- 'cat routing_table.conf' - Standart shlyuz (Gateway) sozlamalari
- 'cat flag.txt' - Tarmoq bayrog'i
`
      },
      {
        path: "flag.txt",
        content: "flag{tcp_3way_handshake_wireshark_pro}\n"
      },
      {
        path: "packets_dump.log",
        content: `15:20:01.102 IP 192.168.1.45.54321 > 192.168.1.1.80: Flags [S], seq 100234
15:20:01.104 IP 192.168.1.1.80 > 192.168.1.45.54321: Flags [S.], seq 458921, ack 100235
15:20:01.105 IP 192.168.1.45.54321 > 192.168.1.1.80: Flags [.], ack 458922
15:20:02.341 IP 10.0.0.99.1337 > 192.168.1.1.22: Flags [S] (SHUBHALI PORT SCAN!)
`
      },
      {
        path: "routing_table.conf",
        content: `Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         192.168.1.1     0.0.0.0         UG    100    0        0 eth0
192.168.1.0     0.0.0.0         255.255.255.0   U     100    0        0 eth0
10.0.0.0        192.168.1.254   255.0.0.0       UG    200    0        0 eth1
`
      }
    ]
  },

  // Course 3: Linux & Kali Linux (Rich nested directory structure for 'find', 'grep', 'chmod')
  3: {
    courseId: 3,
    courseTitle: "Linux & Kali Linux",
    welcomeMessage: `[+] Linux & Kali Linux Maxsus Laboratoriyasi!
Mavjud vazifa: Katta kataloglar iyerarxiyasida 'find', 'grep' va 'chmod' bilan ishlash.
Barcha vazifalarni o'qish uchun: cat VAZIFA.txt`,
    taskGuide: `=== 3-KURS: LINUX VA FIND BUYRUQLARI AMALIYOTI ===
1. 'cat VAZIFA.txt' - Barcha topshiriqlar ro'yxatini oching.
2. 'find . -name "*secret*"' - Yashirin ma'lumotlarni qidirish.
3. 'find . -name ".*"' - Yashirin fayllarni topish.
4. 'find . -name "*.sh"' - Skriptlarni topib, 'chmod +x' qilish.
5. 'grep -rn "FLAG" .' - Barcha fayllar ichidan bayroqni qidirish.
`,
    files: [
      {
        path: "VAZIFA.txt",
        content: `================================================================
             LINUX 'FIND' VA AMALIYOT TOPSHIRIQLARI
================================================================
Quyidagi vazifalarni bajaring:

[VAZIFA 1]: Yashirin flagni toping!
   Kataloglar juda ko'p. Maxfiy faylni 'find' yordamida qidiring:
   Buyruq: find . -name "*flag*"
   Yoki yashirin fayllar ichidan: find . -name ".*flag*"

[VAZIFA 2]: Parollar yoki kalit so'zlarni qidirish!
   Fayllar ichidan 'PASSWORD' yoki 'TOKEN' so'zini 'grep' bilan toping:
   Buyruq: grep -rn "PASSWORD" .

[VAZIFA 3]: Skriptga ijro huquqini bering!
   'scripts/system_backup.sh' skriptiga ijro huquqi yo'q.
   Buyruq: chmod +x scripts/system_backup.sh
   Keyin uni ishga tushiring: ./scripts/system_backup.sh

[VAZIFA 4]: Katta log fayllarni aniqlash!
   Hajmi bo'yicha qidirish: find . -size +1k
================================================================
`
      },
      // Deep directories and nested files:
      {
        path: "documents/reports/2026/quarter_1_audit.txt",
        content: `Audit hisoboti: Tizimda Linux ruxsatnomalari tekshirildi.\nHech qanday ruxsatsiz kirish qayd etilmadi.`
      },
      {
        path: "documents/reports/2026/confidential_memo.txt",
        content: `MAXFIY XAT: Yangi server parollari xavfsiz seyfda saqlanmoqda.`
      },
      {
        path: "documents/drafts/notes.txt",
        content: `Terminal buyruqlari eslatmasi:\n- find /path -name filename\n- grep -r "pattern" /path\n- tar -czvf archive.tar.gz folder`
      },
      {
        path: "var/log/auth.log",
        content: `Oct 28 12:00:01 kali sshd[1024]: Accepted password for root from 192.168.1.5 port 44321
Oct 28 12:05:12 kali sshd[1055]: Failed password for invalid user admin from 203.0.113.19 port 51234
Oct 28 12:05:15 kali sshd[1058]: Failed password for invalid user guest from 203.0.113.19 port 51236
Oct 28 12:05:20 kali sshd[1060]: ROOT LOGIN SUCCESS: PASSWORD_ACCEPTED
`
      },
      {
        path: "var/log/nginx/access.log",
        content: `192.168.1.10 - - [28/Oct/2026:12:00:00 +0500] "GET /index.html HTTP/1.1" 200 1024
192.168.1.55 - - [28/Oct/2026:12:01:22 +0500] "POST /api/login HTTP/1.1" 200 48
`
      },
      {
        path: "var/backups/old_configs/settings.bak",
        content: `PORT=8080\nDEBUG=false\nDB_HOST=127.0.0.1\nDB_PASS=SUPER_SECRET_DB_PASSWORD_2026\n`
      },
      {
        path: "system/config/firewall.rules",
        content: `-A INPUT -p tcp --dport 22 -j ACCEPT\n-A INPUT -p tcp --dport 80 -j ACCEPT\n-A INPUT -j DROP\n`
      },
      {
        path: "scripts/system_backup.sh",
        content: `#!/bin/bash
echo "[*] Tizim zaxiralanmoqda..."
echo "[+] Zaxira fayli yaratildi: /var/backups/backup_ok.tar.gz"
echo "[🎉] TABRIKLAYMIZ! Skript muvaffaqiyatli ishga tushirildi!"
`,
        isExecutable: false // Initially not executable, student must chmod +x!
      },
      {
        path: "hidden_vault/.secret_flag.txt",
        content: "flag{linux_find_ninja_master_2026}\n"
      },
      {
        path: "flag.txt",
        content: "flag{linux_terminal_basic_level_completed}\n"
      }
    ]
  },

  // Course 4: Penetration Testing
  4: {
    courseId: 4,
    courseTitle: "Penetration Testing",
    welcomeMessage: `[+] Axloqiy Hacking va Pentest laboratoriyasi!
Mavjud vazifa: Zaifliklarni aniqlash, exploit va imtiyozlarni oshirish (Privilege Escalation).
Qo'llanma: cat VAZIFA.txt`,
    taskGuide: `=== 4-KURS: PENETRATION TESTING AMALIYOTI ===
1. 'cat targets.txt' - Skanerlanishi kerak bo'lgan serverlar.
2. 'cat vulnerable_service.py' - Zaif Python ilovasini tekshiring.
3. 'python3 exploit_demo.py' - Ekspluatatsiyani amalga oshiring.
`,
    files: [
      {
        path: "VAZIFA.txt",
        content: `=== AXLOQIY HACKING TOPSHIRIQLARI ===
1. 'targets.txt' ro'yxatidagi IP manzillarni tekshiring.
2. 'exploits/' papkasida zaiflik namunasi mavjud.
3. 'cat flag.txt' orqali Root huquqidagi bayroqni oling.
`
      },
      {
        path: "targets.txt",
        content: `Target 1: 192.168.1.100 (Metasploitable2)\nTarget 2: 192.168.1.105 (Windows Server 2019)\n`
      },
      {
        path: "exploits/ftp_vsftpd_234.py",
        content: `#!/usr/bin/env python3
print("[*] vsftpd 2.3.4 Backdoor tekshirilmoqda...")
print("[+] Backdoor port 6200 ochildi!")
print("[#] Root shell qo'lga kiritildi! UID=0")
`
      },
      {
        path: "flag.txt",
        content: "flag{root_privilege_escalation_metasploit}\n"
      }
    ]
  },

  // Course 5: OSINT & Razvedka
  5: {
    courseId: 5,
    courseTitle: "OSINT & Razvedka",
    welcomeMessage: `[+] OSINT & Ochiq Manbalardan Razvedka laboratoriyasi!
Mavjud vazifa: Raqamli izlar, domenlar va metama'lumotlarni tahlil qilish.
Qo'llanma: cat VAZIFA.txt`,
    taskGuide: `=== 5-KURS: OSINT RAZVEDKASI AMALIYOTI ===
1. 'cat target_company_dossier.txt' - Obyekt haqida ma'lumotlar.
2. 'cat subdomains_found.txt' - Aniqlangan subdomenlar ro'yxati.
3. 'cat metadata_exif.txt' - Fotosuratdan olingan GPS koordinatalar.
`,
    files: [
      {
        path: "VAZIFA.txt",
        content: `=== OSINT RAZVEDKA TOPSHIRIG'I ===
- Obyekt: 'CyberCorp Global' tashkiloti
- 'cat target_company_dossier.txt' - Korxona auditi
- 'cat metadata_exif.txt' - Fotosurat metama'lumotlaridan manzilni topish
- 'cat flag.txt' - Razvedka flagi
`
      },
      {
        path: "target_company_dossier.txt",
        content: `Kompaniya: CyberCorp Global LLC
Domen: cybercorp-target.local
Direktor: Alex Morgan (Email: a.morgan@cybercorp-target.local)
Xodimlar soni: ~150 nafar
Server provayderi: AS13335 (Cloudflare)
`
      },
      {
        path: "subdomains_found.txt",
        content: `vpn.cybercorp-target.local (192.168.10.2)\nmail.cybercorp-target.local (192.168.10.5)\ndev-admin.cybercorp-target.local (192.168.10.99) [OCHIQ ADMIN PANEL!]\n`
      },
      {
        path: "metadata_exif.txt",
        content: `Camera: Apple iPhone 14 Pro
GPS Latitude: 41 deg 18' 31.22" N (Toshkent)
GPS Longitude: 69 deg 14' 4.56" E
Software: iOS 16.5
Date/Time: 2026-10-24 14:22:10
`
      },
      {
        path: "flag.txt",
        content: "flag{osint_digital_footprint_uncovered}\n"
      }
    ]
  },

  // Course 6: Veb Ilovalar Xavfsizligi
  6: {
    courseId: 6,
    courseTitle: "Veb Ilovalar Xavfsizligi",
    welcomeMessage: `[+] Veb Ilovalar Xavfsizligi & OWASP Top 10 laboratoriyasi!
Mavjud vazifa: SQL Injection, XSS va autentifikatsiya zaifliklarini laboratoriyada sinash.
Qo'llanma: cat VAZIFA.txt`,
    taskGuide: `=== 6-KURS: VEB XAVFSIZLIGI AMALIYOTI ===
1. 'cat sql_injection_lab.py' - Zaif SQL so'rovi namunasini ko'ring.
2. 'cat users_dump.sql' - Ma'lumotlar bazasi jadvalini tahlil qiling.
3. 'cat xss_payloads.txt' - XSS hujumlari namunalari.
`,
    files: [
      {
        path: "VAZIFA.txt",
        content: `=== OWASP TOP 10 AMALIY LAB ===
1. 'sql_injection_lab.py' skriptini ishga tushiring: python3 sql_injection_lab.py
2. SQL Injection payload: ' OR '1'='1
3. 'cat flag.txt' - Veb xavfsizlik flagi
`
      },
      {
        path: "sql_injection_lab.py",
        content: `#!/usr/bin/env python3
import sys

print("=== Zaif Veb Avtorizatsiya Simulyatori ===")
username = "' OR '1'='1"
query = f"SELECT * FROM users WHERE username = '{username}' AND password = 'password'"
print(f"[SQL So'rov]: {query}")
print("[+] SQL Injection muvaffaqiyatli! Admin sessiyasi ochildi: SESSION_TOKEN=admin_9824")
`
      },
      {
        path: "users_dump.sql",
        content: `INSERT INTO users (id, username, role, password_hash) VALUES
(1, 'admin', 'administrator', '$2y$10$e84jd82...'),
(2, 'moderator', 'staff', '$2y$10$k19sd34...'),
(3, 'student', 'user', '$2y$10$999aa12...');
`
      },
      {
        path: "xss_payloads.txt",
        content: `<script>alert('XSS zaifligi!')</script>
<img src=x onerror=alert(document.cookie)>
<svg onload=alert(1)>
`
      },
      {
        path: "flag.txt",
        content: "flag{owasp_sql_injection_web_defense_2026}\n"
      }
    ]
  }
};

export function getLabConfigForCourse(courseId: number): CourseLabConfig {
  return courseLabEnvironments[courseId] || courseLabEnvironments[1];
}
