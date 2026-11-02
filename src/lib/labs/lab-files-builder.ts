import { generateUserFlag } from "../terminal/flags";
import { LabFileItem } from "../terminal/types";

/**
 * Terminal laboratoriyalari uchun har bir talabaning shaxsiy dinamik flag'i bilan
 * fayllar to'plamini shakllantiradi.
 */
export function buildLabFiles(
  labSlugOrId: string | number,
  userId: string
): LabFileItem[] {
  const dynamicFlag = generateUserFlag(labSlugOrId, userId);
  const slug = String(labSlugOrId);

  // 1. Linux Permissions
  if (slug === "linux-permissions" || slug === "lab-linux-1" || slug === "1") {
    return [
      {
        path: "secret_data/confidential.txt",
        content: `MAXFIY HUJJAT (CONFIDENTIAL)\nUshbu fayl ruxsatlari cheklangan edi.\nTabriklaymiz! Sizning bayrog'ingiz: ${dynamicFlag}\n`,
      },
      {
        path: "README.txt",
        content:
          "Vazifa: secret_data katalogidagi confidential.txt faylining huquqlarini oching va flagni o'qing.\n",
      },
    ];
  }

  // 2. Linux Hidden Files
  if (slug === "linux-hidden-files" || slug === "lab-linux-2" || slug === "2") {
    return [
      {
        path: ".secret_folder/..hidden_flag.txt",
        content: `Yashirin fayllar topshirig'i muvaffaqiyatli bajarildi!\nFlag: ${dynamicFlag}\n`,
      },
      {
        path: "instructions.txt",
        content:
          "Vazifa: Ushbu tizimda yashirin katalog va fayllar mavjud. Barcha yashirin fayllarni toping.\n",
      },
    ];
  }

  // 3. Linux Grep & Find
  if (slug === "linux-grep-find" || slug === "lab-linux-3") {
    return [
      {
        path: "backup_archives/logs/syslog_01.txt",
        content: "INFO: System started successfully\nDEBUG: Initializing subsystem 1\n",
      },
      {
        path: "backup_archives/logs/syslog_02.txt",
        content: "WARN: High memory usage detected\nDEBUG: Subsystem idle\n",
      },
      {
        path: "backup_archives/data/secrets_dump.dat",
        content: `[CONFIG]\nkey_01=alpha\nkey_02=beta\nFLAG_ENTRY=${dynamicFlag}\nkey_03=gamma\n`,
      },
      {
        path: "README.txt",
        content:
          "Vazifa: backup_archives/ katalogidagi yuzlab fayllar orasidan 'flag{' matnini qidiring.\n",
      },
    ];
  }

  // 4. Linux Log Analysis
  if (slug === "linux-log-analysis" || slug === "lab-linux-4") {
    return [
      {
        path: "logs/auth.log",
        content: `Mar 12 04:12:01 server sshd[1240]: Failed password for invalid user admin from 192.168.1.105 port 54122 ssh2
Mar 12 04:12:05 server sshd[1241]: Failed password for invalid user root from 192.168.1.105 port 54124 ssh2
Mar 12 04:12:10 server sshd[1242]: Failed password for invalid user support from 192.168.1.105 port 54126 ssh2
Mar 12 04:15:32 server sshd[1250]: Accepted password for sec_officer from 10.0.0.12 port 48922 ssh2 [session_note: ${dynamicFlag}]
Mar 12 04:16:01 server sudo[1255]: sec_officer : TTY=pts/0 ; PWD=/home/sec_officer ; USER=root ; COMMAND=/bin/cat /etc/shadow
`,
      },
      {
        path: "README.txt",
        content:
          "Vazifa: logs/auth.log faylini tahlil qiling. Muvaffaqiyatli kirish seansi qatoridan flagni toping.\n",
      },
    ];
  }

  // 5. Linux Pipes & Base64
  if (slug === "linux-pipe-base64" || slug === "lab-linux-5") {
    const rawContent = `Tabriklaymiz, Base64 dekodlash muvaffaqiyatli yakunlandi!\nFlag: ${dynamicFlag}\n`;
    const b64 = Buffer.from(rawContent, "utf-8").toString("base64");
    return [
      {
        path: "encoded_data.txt",
        content: `${b64}\n`,
      },
      {
        path: "README.txt",
        content:
          "Vazifa: encoded_data.txt faylida Base64 bilan kodlangan xabarni dekodlab, flagni oling.\n",
      },
    ];
  }

  // 6. Network Nmap Audit
  if (slug === "net-nmap-audit" || slug === "lab-net-1") {
    return [
      {
        path: "network/nmap_scan.txt",
        content: `Starting Nmap 7.94 ( https://nmap.org ) at 2026-03-12 14:00 UTC
Nmap scan report for target.internal (10.10.10.25)
Host is up (0.0021s latency).
Not shown: 996 closed tcp ports (reset)
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.6 (Ubuntu Linux; protocol 2.0)
80/tcp   open  http    nginx 1.18.0 (Ubuntu)
443/tcp  open  ssl/http nginx 1.18.0 (Ubuntu)
1337/tcp open  elite   CyberEdu-Custom-Daemon/2.0 banner [${dynamicFlag}]
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
`,
      },
      {
        path: "README.txt",
        content:
          "Vazifa: network/nmap_scan.txt faylida 1337 portida aniqlangan xizmat banneridan flagni toping.\n",
      },
    ];
  }

  // 7. Network PCAP Analysis
  if (slug === "net-pcap-analysis" || slug === "lab-net-2") {
    return [
      {
        path: "network/capture_traffic.log",
        content: `GET /index.html HTTP/1.1
Host: internal.portal.local
User-Agent: Mozilla/5.0

HTTP/1.1 200 OK
Content-Type: text/html

POST /api/login HTTP/1.1
Host: internal.portal.local
Content-Type: application/x-www-form-urlencoded
Content-Length: 68

username=administrator&auth_token=${dynamicFlag}&action=grant_access
`,
      },
      {
        path: "README.txt",
        content:
          "Vazifa: network/capture_traffic.log faylida ushlangan tarmoq trafigidan ochiq flagni toping.\n",
      },
    ];
  }

  // Standart fallback
  return [
    {
      path: "flag.txt",
      content: `${dynamicFlag}\n`,
    },
    {
      path: "README.txt",
      content: "Vazifa: flag.txt faylini o'qing va topshiring.\n",
    },
  ];
}
