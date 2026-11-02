export interface Lesson {
  id?: number;
  title: string;
  duration: string;
  isFree?: boolean;
  accessType?: string;
  isLocked?: boolean;
  lockedMessage?: string;
  content?: string | null;
  labSlug?: string | null;
}

export interface CourseModule {
  title: string;
  duration: string;
  lessons: Lesson[];
}

export interface Course {
  id: number;
  icon: string;
  title: string;
  desc: string;
  fullDesc: string;
  lessons: number;
  students: number;
  duration: string;
  level: "Boshlang'ich" | "O'rta" | "Ilg'or" | "Barcha daraja";
  levelColor: string;
  color: "blue" | "purple" | "green" | "orange";
  accent: string;
  badge: string;
  bLabel: string;
  tags: string[];
  instructor: {
    name: string;
    role: string;
    avatar: string;
    experience: string;
  };
  whatYouWillLearn: string[];
  prerequisites: string[];
  accessType?: string;
  priceUzs?: number;
  modules: CourseModule[];
}

export const coursesData: Course[] = [
  {
    id: 1,
    icon: "🛡️",
    title: "Kiberxavfsizlik Asoslari",
    desc: "Hujumlar, himoya tizimlari va zaifliklar bo'yicha mustahkam fundamental bilimlar",
    fullDesc:
      "Ushbu kurs kiberxavfsizlik sohasiga endi qadam qo'yayotganlar uchun mo'ljallangan. Siz axborot xavfsizligining uchta asosiy tamoyili (CIA triad), zamonaviy tahdidlar, ijtimoiy muhandislik (social engineering), fishing hujumlari va asosiy himoya mexanizmlari bilan tanishasiz.",
    lessons: 24,
    students: 142,
    duration: "14 soat",
    level: "Boshlang'ich",
    levelColor: "badge-green",
    color: "blue",
    accent: "#38bdf8",
    badge: "badge-green",
    bLabel: "Boshlang'ich",
    tags: ["CIA Triad", "Firewall", "Encryption", "Threats"],
    instructor: {
      name: "Sardor Rahimov",
      role: "Kiberxavfsizlik mutaxassisi (CISSP)",
      avatar: "👨‍💻",
      experience: "7+ yil tajriba"
    },
    whatYouWillLearn: [
      "Kiberxavfsizlikning fundamental qonun-qoidalari va atamalari",
      "Keng tarqalgan kiberhujum turlari (DDoS, MITM, Phishing, Ransomware)",
      "Shifrlash (kriptografiya) usullari va SSL/TLS sertifikatlari",
      "Xavfsiz tarmoq me'morchiligi va xavfsizlik devorlari (Firewall)",
      "Axborot xavfsizligi auditi va gigiyena qoidalariga rioya qilish"
    ],
    prerequisites: [
      "Boshlang'ich kompyuter savodxonligi",
      "Internet ishlash prinsiplari haqida umumiy tushuncha"
    ],
    modules: [
      {
        title: "1-Modul: Kiberxavfsizlikka Kirish",
        duration: "3 soat",
        lessons: [
          { title: "Kiberxavfsizlik nima va u nima uchun muhim?", duration: "18 daqiqa", isFree: true },
          { title: "CIA Triad: Maxfiylik, Butunlik, Foydalanish ochiqligi", duration: "25 daqiqa", isFree: true },
          { title: "Hujumchilar turlari: White Hat, Black Hat, Gray Hat", duration: "20 daqiqa" },
          { title: "Kiberhujumlar evolyutsiyasi va statistika", duration: "22 daqiqa" }
        ]
      },
      {
        title: "2-Modul: Zamonaviy Tahdidlar va Hujum Vektorlari",
        duration: "4 soat",
        lessons: [
          { title: "Ijtimoiy muhandislik (Social Engineering) va fishing", duration: "35 daqiqa" },
          { title: "Zararli dasturlar: Virus, Trojan, Ransomware", duration: "30 daqiqa" },
          { title: "Man-in-the-Middle (MitM) va tarmoq tinglash", duration: "28 daqiqa" },
          { title: "Parollarni buzish texnikalari va brute-force", duration: "32 daqiqa" }
        ]
      },
      {
        title: "3-Modul: Himoya Mexanizmlari va Kriptografiya",
        duration: "4.5 soat",
        lessons: [
          { title: "Simmetrik va asimmetrik shifrlash asoslari", duration: "40 daqiqa" },
          { title: "Xesh funksiyalari (SHA-256, MD5) va ularning roli", duration: "25 daqiqa" },
          { title: "Xavfsizlik devorlari (Firewall) va IDS/IPS tizimlari", duration: "38 daqiqa" },
          { title: "Ko'p bosqichli autentifikatsiya (MFA/2FA)", duration: "24 daqiqa" }
        ]
      },
      {
        title: "4-Modul: Yakuniy Amaliyot va Test",
        duration: "2.5 soat",
        lessons: [
          { title: "Kompaniya xavfsizlik siyosatini tahlil qilish (Case Study)", duration: "45 daqiqa" },
          { title: "Yakuniy test va sertifikat olish", duration: "30 daqiqa" }
        ]
      }
    ]
  },
  {
    id: 2,
    icon: "🌐",
    title: "Kompyuter Tarmoqlari",
    desc: "TCP/IP, OSI model, routing, switching va tarmoq protokollari bo'yicha to'liq qo'llanma",
    fullDesc:
      "Tarmoqlarni bilmasdan turib kiberxavfsizlik mutaxassisi bo'lish imkonsiz. Ushbu kursda siz kompyuter tarmoqlarining qanday ishlashini noldan boshlab o'rganasiz: paketlar qanday uzatiladi, router va switchlar qanday ishlaydi, DNS va DHCP protokollari xavfsizligi.",
    lessons: 32,
    students: 98,
    duration: "18 soat",
    level: "O'rta",
    levelColor: "badge-blue",
    color: "purple",
    accent: "#818cf8",
    badge: "badge-blue",
    bLabel: "O'rta",
    tags: ["TCP/IP", "OSI Model", "Routing", "Wireshark"],
    instructor: {
      name: "Jasur Bekmirzayev",
      role: "Network Architect & CCNA instruktor",
      avatar: "👨‍🏫",
      experience: "9+ yil tajriba"
    },
    whatYouWillLearn: [
      "OSI va TCP/IP 7 qatlamli modelining har bir bosqichini chuqur tushunish",
      "IPv4 va IPv6 adreslash, subnetting (maskalar hisoblash)",
      "Wireshark orqali tarmoq paketlarini ushlash va tahlil qilish",
      "DNS, DHCP, ARP, ICMP va HTTP/HTTPS protokollarining ishlashi",
      "VLAN sozlash va routerlararo yo'naltirish (Routing)"
    ],
    prerequisites: [
      "Kiberxavfsizlik asoslari yoki umumiy IT tushunchalari"
    ],
    modules: [
      {
        title: "1-Modul: Tarmoq Modellariga Kirish",
        duration: "4 soat",
        lessons: [
          { title: "Tarmoq arxitekturasi va topologiyalar", duration: "25 daqiqa", isFree: true },
          { title: "OSI 7 qatlamli modeli to'liq tahlili", duration: "45 daqiqa", isFree: true },
          { title: "TCP/IP modeli va OSI bilan solishtirish", duration: "30 daqiqa" },
          { title: "Paket inkapsulyatsiyasi va dekapsulyatsiyasi", duration: "35 daqiqa" }
        ]
      },
      {
        title: "2-Modul: IP Adreslash va Subnetting",
        duration: "5 soat",
        lessons: [
          { title: "IPv4 strukturasi va klasslar", duration: "40 daqiqa" },
          { title: "Subnet mask hisoblash amaliyoti (Subnetting)", duration: "60 daqiqa" },
          { title: "IPv6 haqida tushuncha va farqlar", duration: "30 daqiqa" }
        ]
      },
      {
        title: "3-Modul: Wireshark orqali Tarmoq Tahlili",
        duration: "5.5 soat",
        lessons: [
          { title: "Wireshark o'rnatish va interfeys bilan tanishish", duration: "20 daqiqa" },
          { title: "TCP 3-way Handshake tahlili", duration: "40 daqiqa" },
          { title: "DNS va HTTP so'rovlarini tahlil qilish", duration: "35 daqiqa" },
          { title: "Tarmoqdagi shubhali trafikni aniqlash", duration: "45 daqiqa" }
        ]
      },
      {
        title: "4-Modul: Yakuniy Amaliyot",
        duration: "3.5 soat",
        lessons: [
          { title: "Cisco Packet Tracer da tarmoq loyihalash", duration: "60 daqiqa" },
          { title: "Tarmoq xavfsizligi bo'yicha imtihon", duration: "40 daqiqa" }
        ]
      }
    ]
  },
  {
    id: 3,
    icon: "🐧",
    title: "Linux & Kali Linux",
    desc: "Terminal, buyruqlar, bash skriptlar va Kali Linux xavfsizlik toollari to'plami",
    fullDesc:
      "Linux kiberxavfsizlik olamining yuragidir. Kali Linux esa etuk xavfsizlik tekshiruvchilari uchun maxsus tayyorlangan vositadir. Ushbu amaliy kursda siz terminaldan qo'rqmaslikni, avtomatlashtirish skriptlari yozishni va Kali'dagi asosiy toollardan mohirona foydalanishni o'rganasiz.",
    lessons: 40,
    students: 201,
    duration: "22 soat",
    level: "Barcha daraja",
    levelColor: "badge-purple",
    color: "green",
    accent: "#a78bfa",
    badge: "badge-purple",
    bLabel: "Barcha daraja",
    tags: ["Bash", "Linux CLI", "Kali Tools", "Automation"],
    instructor: {
      name: "Alisher Umarov",
      role: "DevOps & Linux Security Engineer",
      avatar: "🐧",
      experience: "8+ yil tajriba"
    },
    whatYouWillLearn: [
      "Linux fayl tizimi iyerarxiyasi va asosiy terminal buyruqlari",
      "Foydalanuvchilar, guruhlar va ruxsatnomalar (chmod, chown)",
      "Jarayonlar (processes) va xizmatlar (systemd) boshqaruvi",
      "Bash skript yozish va muntazam vazifalarni cron orqali avtomatlashtirish",
      "Kali Linux'dagi Nmap, Netcat, John the Ripper toollari bilan ishlash"
    ],
    prerequisites: [
      "VirtualBox yoki VMware o'rnatish imkoniyati bor kompyuter"
    ],
    modules: [
      {
        title: "1-Modul: Linux Asoslari va O'rnatish",
        duration: "5 soat",
        lessons: [
          { title: "VirtualBox'ga Kali Linux o'rnatish bosqichma-bosqich", duration: "30 daqiqa", isFree: true },
          { title: "Linux terminali bilan birinchi tanishuv", duration: "30 daqiqa", isFree: true },
          { title: "Fayllar va kataloglar bilan ishlash (ls, cd, mkdir, rm)", duration: "40 daqiqa" },
          { title: "Matn muharrirlari: Nano va Vim asoslari", duration: "35 daqiqa" }
        ]
      },
      {
        title: "2-Modul: Huquqlar va Xavfsizlik",
        duration: "6 soat",
        lessons: [
          { title: "Linux fayl huquqlari (rwx, chmod, chown)", duration: "45 daqiqa" },
          { title: "Sudo va Root foydalanuvchisi xavfsizligi", duration: "35 daqiqa" },
          { title: "Paketlar boshqaruvi: apt va dpkg", duration: "30 daqiqa" },
          { title: "Tarmoq konfiguratsiyasi: ip, ifconfig, netstat", duration: "40 daqiqa" }
        ]
      },
      {
        title: "3-Modul: Bash Skriptlar va Avtomatlashtirish",
        duration: "6 soat",
        lessons: [
          { title: "Bash sintaksisi: o'zgaruvchilar va if/else shartlari", duration: "45 daqiqa" },
          { title: "Sikllar (for, while) va funksiyalar", duration: "50 daqiqa" },
          { title: "Tarmoq skanerlovchi oddiy Bash skript yozish", duration: "55 daqiqa" }
        ]
      },
      {
        title: "4-Modul: Kali Linux Toollari bilan Ishlash",
        duration: "5 soat",
        lessons: [
          { title: "Nmap orqali portlarni tekshirish", duration: "45 daqiqa" },
          { title: "Netcat (Shveysariya pichog'i) imkoniyatlari", duration: "35 daqiqa" },
          { title: "John the Ripper bilan xesh ochish", duration: "40 daqiqa" }
        ]
      }
    ]
  },
  {
    id: 4,
    icon: "⚔️",
    title: "Penetration Testing",
    desc: "Axloqiy hacking metodlari, zaifliklarni topish, exploit va hisobot tayyorlash",
    fullDesc:
      "Tizimlarni himoya qilish uchun avval tajovuzkor qanday fikrlashini tushunish lozim. Ushbu kurs axloqiy xakerlik (Ethical Hacking) va pentesting bosqichlarini qamrab oladi: axborot to'plash, skanerlash, ekspluatatsiya va xavfsizlik hisobotlarini tayyorlash.",
    lessons: 28,
    students: 76,
    duration: "20 soat",
    level: "Ilg'or",
    levelColor: "badge-orange",
    color: "orange",
    accent: "#fb923c",
    badge: "badge-orange",
    bLabel: "Ilg'or",
    tags: ["Metasploit", "Nmap", "Burp Suite", "Privilege Escalation"],
    instructor: {
      name: "Davron Qodirov",
      role: "Lead Penetration Tester (OSCP certified)",
      avatar: "⚔️",
      experience: "10+ yil tajriba"
    },
    whatYouWillLearn: [
      "Penetration testing metodologiyalari (PTES, NIST)",
      "Tizimlarni skanerlash va xizmatlar zaifliklarini aniqlash",
      "Metasploit Framework yordamida ekspluatatsiya qilish",
      "Huquqlarni oshirish (Privilege Escalation: Linux & Windows)",
      "Professional hisobot (Audit Report) yozish madaniyati"
    ],
    prerequisites: [
      "Linux va kompyuter tarmoqlarini yaxshi bilish",
      "Boshlang'ich dasturlash yoki skripting bilimlari"
    ],
    modules: [
      {
        title: "1-Modul: Pentest Metodologiyasi va Tayyorgarlik",
        duration: "4 soat",
        lessons: [
          { title: "Pentest turlari va qonuniy me'yorlar", duration: "30 daqiqa", isFree: true },
          { title: "Laboratoriya muhitini qurish (Metasploitable2/3)", duration: "45 daqiqa", isFree: true },
          { title: "Passive va Active Reconnaissance", duration: "40 daqiqa" }
        ]
      },
      {
        title: "2-Modul: Skanerlash va Zaifliklarni Qidirish",
        duration: "5 soat",
        lessons: [
          { title: "Nmap skripting engine (NSE) bilan ishlash", duration: "45 daqiqa" },
          { title: "Nessus va OpenVAS zaiflik skanerlari", duration: "50 daqiqa" },
          { title: "Zaiflik ma'lumotlar bazalari (CVE, Exploit-DB)", duration: "35 daqiqa" }
        ]
      },
      {
        title: "3-Modul: Ekspluatatsiya va Metasploit",
        duration: "6 soat",
        lessons: [
          { title: "Metasploit arxitekturasi va msfconsole", duration: "50 daqiqa" },
          { title: "Meterpreter sessiyasi bilan boshqaruv", duration: "55 daqiqa" },
          { title: "Payload yaratish: msfvenom imkoniyatlari", duration: "45 daqiqa" }
        ]
      },
      {
        title: "4-Modul: Post-Exploitation va Hisobot",
        duration: "5 soat",
        lessons: [
          { title: "Linux Privilege Escalation usullari", duration: "60 daqiqa" },
          { title: "Izlarni tozalash va audit hisoboti tuzish", duration: "45 daqiqa" }
        ]
      }
    ]
  },
  {
    id: 5,
    icon: "🔍",
    title: "OSINT & Razvedka",
    desc: "Ochiq manbalardan ma'lumot yig'ish, raqamli izlarni tahlil qilish va razvedka usullari",
    fullDesc:
      "OSINT (Open Source Intelligence) — ochiq manbalardan qonuniy ravishda axborot to'plash san'atidir. Ushbu kurs orqali siz domens, IP manzillar, elektron pochtalar va ijtimoiy tarmoqlardagi ma'lumotlarni tahlil qilib, to'liq razvedka o'tkazishni o'rganasiz.",
    lessons: 18,
    students: 64,
    duration: "11 soat",
    level: "O'rta",
    levelColor: "badge-blue",
    color: "blue",
    accent: "#38bdf8",
    badge: "badge-blue",
    bLabel: "O'rta",
    tags: ["OSINT", "Maltego", "Shodan", "Recon-ng"],
    instructor: {
      name: "Mohira Salimova",
      role: "OSINT tahlilchi va axborot xavfsizligi mutaxassisi",
      avatar: "🔍",
      experience: "5+ yil tajriba"
    },
    whatYouWillLearn: [
      "Google Dorking va ilg'or qidiruv operatorlari",
      "Shodan va Censys orqali internetga ulangan qurilmalarni topish",
      "Domen va IP razvedkasi (Whois, DNS dump, reverse IP)",
      "Maltego vositasida obyektlararo aloqalarni vizuallashtirish",
      "Ijtimoiy tarmoqlar va metama'lumotlarni (EXIF) tekshirish"
    ],
    prerequisites: [
      "Kiberxavfsizlik asoslari tushunchalari"
    ],
    modules: [
      {
        title: "1-Modul: OSINT Asoslari va Qidiruv Vositalari",
        duration: "3 soat",
        lessons: [
          { title: "OSINT nima va uning sohadagi o'rni?", duration: "25 daqiqa", isFree: true },
          { title: "Google Dorking sirlari va amaliy misollar", duration: "40 daqiqa", isFree: true },
          { title: "Maxsus qidiruv tizimlari (Wayback Machine, Pastebin)", duration: "30 daqiqa" }
        ]
      },
      {
        title: "2-Modul: Texnik Razvedka (Infratuzilma)",
        duration: "4.5 soat",
        lessons: [
          { title: "Shodan bilan IoT qurilmalarni izlash", duration: "45 daqiqa" },
          { title: "Domen va subdomenlarni aniqlash (Sublist3r, Amass)", duration: "50 daqiqa" },
          { title: "Email va akkauntlarni tekshirish (theHarvester, Holehe)", duration: "40 daqiqa" }
        ]
      },
      {
        title: "3-Modul: Maltego va Grafik Tahlil",
        duration: "3.5 soat",
        lessons: [
          { title: "Maltego o'rnatish va API kalitlarini ulash", duration: "35 daqiqa" },
          { title: "Kompleks razvedka keysi: Kompaniya tahlili", duration: "60 daqiqa" }
        ]
      }
    ]
  },
  {
    id: 6,
    icon: "🕸️",
    title: "Veb Ilovalar Xavfsizligi",
    desc: "OWASP Top 10, SQL Injection, XSS, CSRF va veb zaifliklarni aniqlash hamda himoyalash",
    fullDesc:
      "Zamonaviy dasturlarning aksariyati veb orqali ishlaydi. Ushbu kursda siz OWASP Top 10 ro'yxatiga kirgan barcha asosiy veb-zaifliklarni, ularning paydo bo'lish sabablari, ekspluatatsiyasi va kod darajasida ularni qanday to'g'irlashni amalda o'rganasiz.",
    lessons: 22,
    students: 115,
    duration: "16 soat",
    level: "O'rta",
    levelColor: "badge-blue",
    color: "purple",
    accent: "#a78bfa",
    badge: "badge-blue",
    bLabel: "O'rta",
    tags: ["OWASP", "SQL Injection", "XSS", "Burp Suite"],
    instructor: {
      name: "Farrux Islomov",
      role: "Application Security Engineer",
      avatar: "👨‍💻",
      experience: "6+ yil tajriba"
    },
    whatYouWillLearn: [
      "OWASP Top 10 ning eng so'nggi standartlari",
      "Burp Suite proksisi orqali HTTP so'rovlarni o'zgartirish va tahlil qilish",
      "SQL Injection (Error-based, Blind, Union) turlari va himoyasi",
      "XSS (Stored, Reflected, DOM) hujumlari va CSP choralari",
      "Autentifikatsiya va avtorizatsiya nuqsonlari (IDOR, Broken Access)"
    ],
    prerequisites: [
      "HTML, JavaScript va backend asoslari haqida tushuncha",
      "HTTP/HTTPS protokoli bilimlari"
    ],
    modules: [
      {
        title: "1-Modul: Veb Xavfsizlik Asoslari va Burp Suite",
        duration: "4 soat",
        lessons: [
          { title: "Veb ilovalar qanday ishlaydi va zaiflik nuqtalari", duration: "25 daqiqa", isFree: true },
          { title: "Burp Suite o'rnatish va brauzer sozlash", duration: "35 daqiqa", isFree: true },
          { title: "Burp Repeater va Intruder modullari", duration: "45 daqiqa" }
        ]
      },
      {
        title: "2-Modul: Inyeksiya Hujumlari (SQLi)",
        duration: "4.5 soat",
        lessons: [
          { title: "SQL Injection qanday yuz beradi?", duration: "40 daqiqa" },
          { title: "Union-based SQLi amaliyoti", duration: "50 daqiqa" },
          { title: "sqlmap vositasi va xavfsiz kodlash (Prepared Statements)", duration: "45 daqiqa" }
        ]
      },
      {
        title: "3-Modul: XSS va CSRF Hujumlari",
        duration: "4.5 soat",
        lessons: [
          { title: "Cross-Site Scripting (XSS) turlari", duration: "45 daqiqa" },
          { title: "Cookie o'g'irlash va sessiyani egallash", duration: "40 daqiqa" },
          { title: "CSRF tokenlari va SameSite cookie parametrlari", duration: "35 daqiqa" }
        ]
      },
      {
        title: "4-Modul: Amaliy Laboratoriya (DVWA / PortSwigger)",
        duration: "3 soat",
        lessons: [
          { title: "PortSwigger Web Security Academy laboratoriyasi", duration: "60 daqiqa" },
          { title: "Veb ilova xavfsizlik auditi loyihasi", duration: "45 daqiqa" }
        ]
      }
    ]
  }
];

export function getCourseById(id: number | string): Course | undefined {
  const numId = typeof id === "string" ? parseInt(id, 10) : id;
  return coursesData.find((c) => c.id === numId);
}
