export interface QuizQuestionData {
  question: string;
  options: string[];
  correctOption: number; // Faqat serverda saqlanadi
  explanation?: string;
}

export interface QuizData {
  title: string;
  passingScore: number;
  maxAttempts: number;
  questions: QuizQuestionData[];
}

export interface LessonData {
  title: string;
  duration: string;
  isFree?: boolean;
  content: string; // Markdown konspekt
  labSlug?: string;
  quiz?: QuizData;
}

export interface ModuleData {
  title: string;
  duration: string;
  lessons: LessonData[];
}

export interface CourseData {
  id: number;
  slug: string;
  title: string;
  icon: string;
  desc: string;
  fullDesc: string;
  level: "Boshlang'ich" | "O'rta" | "Ilg'or" | "Barcha daraja";
  levelColor: string;
  color: "blue" | "purple" | "green" | "orange";
  accent: string;
  badge: string;
  bLabel: string;
  duration: string;
  tags: string[];
  instructor: {
    name: string;
    role: string;
    avatar: string;
    experience: string;
  };
  whatYouWillLearn: string[];
  prerequisites: string[];
  modules: ModuleData[];
}

export const CURRICULUM_COURSES: CourseData[] = [
  // ── 1. LINUX ASOSLARI VA CTF ─────────────────────────────────────────────
  {
    id: 1,
    slug: "course-linux",
    title: "Linux Asoslari va CTF Amaliyoti",
    icon: "🐧",
    desc: "Linux terminali, fayl huquqlari, quvurlar, CTF vazifalari va xavfsiz skriptlash",
    fullDesc:
      "Ushbu kursda talabalar Linux operatsion tizimining chuqur mexanizmlari, buyruqlar satri (CLI), fayl ruxsat huquqlari, matn filtrlash va CTF musobaqalarida kerak bo'ladigan asosiy ko'nikmalarni o'rganadilar. Konteynerlarda `noexec` himoyasi tufayli skriptlarni `bash script.sh` va `python3 script.py` orqali ishga tushirish xavfsiz o'rgatiladi.",
    level: "Boshlang'ich",
    levelColor: "badge-green",
    color: "blue",
    accent: "#38bdf8",
    badge: "badge-green",
    bLabel: "Boshlang'ich",
    duration: "12 soat",
    tags: ["Linux", "CLI", "CTF", "Chmod", "Pipes", "Bash"],
    instructor: {
      name: "Bobur Rustamov",
      role: "Linux Tizim Administratori & CTF Captain",
      avatar: "👨‍💻",
      experience: "7+ yil",
    },
    whatYouWillLearn: [
      "Linux fayl tizimi tuzilishi va ruxsat huquqlari (chmod, chown)",
      "Yashirin fayllar va kataloglarni topish (ls -la, find)",
      "Quvurlar va yo'naltirish (|, >, >>, base64)",
      "CTF skriptlarini noexec muhitda ishga tushirish (bash script.sh, python3 script.py)",
    ],
    prerequisites: ["Kompyuter savodxonligi"],
    modules: [
      {
        title: "1-Modul: Linux Fayl Tizimi va Huquqlar",
        duration: "3 soat",
        lessons: [
          {
            title: "Fayl Huquqlari va Ruxsatlar Tahlili (chmod)",
            duration: "25 daqiqa",
            isFree: true,
            labSlug: "linux-permissions",
            content: `### 📌 Dars Konspekti: Linuxda Fayl Huquqlari

Linux operatsion tizimida har bir fayl va katalog qat'iy uch toifadagi foydalanuvchilar uchun ruxsatlarga ega:
1. **User (u)** — Fayl egasi
2. **Group (g)** — Fayl tegishli bo'lgan guruh a'zolari
3. **Others (o)** — Tizimdagi barcha boshqa foydalanuvchilar

#### 🛠 Asosiy Huquqlar va Ularning Raqamli Ko'rinishi:
- **r (read)** = 4 (Faylni o'qish huquqi)
- **w (write)** = 2 (Faylga yozish yoki o'zgartirish huquqi)
- **x (execute)** = 1 (Faylni dastur sifatida bajarish huquqi)

\`\`\`bash
# Fayl huquqlarini batafsil ko'rish:
ls -la secret_data/confidential.txt

# Fayl egasiga o'qish huquqini berish:
chmod u+r secret_data/confidential.txt
# yoki to'liq 644 (rw-r--r--) o'rnatish:
chmod 644 secret_data/confidential.txt

# Fayl tarkibini o'qish:
cat secret_data/confidential.txt
\`\`\`

> [!IMPORTANT]
> **Mustaqil topshiriq:** Interaktiv terminalda \`secret_data/confidential.txt\` faylining huquqlarini tekshiring, unga \`chmod 644\` bering va flagni toping!`,
            quiz: {
              title: "Fayl Huquqlari Bo'yicha Mini-Test",
              passingScore: 70,
              maxAttempts: 3,
              questions: [
                {
                  question: "Linuxda 'rwxr-xr--' ruxsati sakkizlik (oktal) sanoq sistemasida qanday ifodalanadi?",
                  options: ["754", "644", "777", "755"],
                  correctOption: 0,
                  explanation: "rwx = 4+2+1=7, r-x = 4+0+1=5, r-- = 4+0+0=4. Jami: 754.",
                },
                {
                  question: "Faqat fayl egasiga o'qish va yozish huquqini beruvchi raqam qaysi?",
                  options: ["777", "600", "644", "755"],
                  correctOption: 1,
                  explanation: "600: egasi uchun 4+2=6, guruh va boshqalar uchun 0.",
                },
                {
                  question: "Fayl huquqlarini o'zgartirish uchun qaysi buyruq ishlatiladi?",
                  options: ["chown", "chmod", "touch", "ls -l"],
                  correctOption: 1,
                  explanation: "chmod (change mode) fayl huquqlarini boshqaradi.",
                },
                {
                  question: "Fayl egasini o'zgartirish uchun qaysi buyruq ishlatiladi?",
                  options: ["chown","chmod","useradd","chgrp"],
                  correctOption: 0,
                  explanation: "chown (change owner) fayl egasini boshqaradi.",
                },
                {
                  question: "noexec bilan mount qilingan katalogda skriptni ishga tushirishning xavfsiz yo'li qaysi?",
                  options: ["bash script.sh","./script.sh","run script.sh","exec script.sh"],
                  correctOption: 0,
                  explanation: "noexec bayrog'i to'g'ridan-to'g'ri binar ijroni bloklaydi, ammo interpretator orqali (bash script.sh) ishlatish mumkin.",
                },
              ],
            },
          },
          {
            title: "Yashirin Fayllar va Maxfiy Izlar (Hidden Files)",
            duration: "20 daqiqa",
            isFree: true,
            labSlug: "linux-hidden-files",
            content: `### 📌 Yashirin Fayllar Bilan Ishlash

Linuxda nomi nuqta (\`.\`) bilan boshlanuvchi fayllar va kataloglar sukut bo'yicha yashirin (hidden) hisoblanadi. Oddiy \`ls\` buyrug'i ularni ko'rsatmaydi.

\`\`\`bash
# Yashirin fayllarni ko'rish:
ls -a
ls -la

# Yashirin papkaga o'tish va o'qish:
cd .secret_folder
cat ..hidden_flag.txt
\`\`\`

> [!TIP]
> CTF musobaqalarida administratorlar yoki hujumchilar ko'pincha maxfiy konfiguratsiyalarni \`.secret\` yoki \`..flag\` kabi nomlar ostida yashiradilar.`,
            quiz: {
              title: "Yashirin Fayllar Mini-Testi",
              passingScore: 70,
              maxAttempts: 3,
              questions: [
                {
                  question: "Linuxda qaysi belgi bilan boshlangan fayllar yashirin hisoblanadi?",
                  options: ["Chiziqcha (-)", "Nuqta (.)", "Undov (!)", "Pastki chiziq (_)"],
                  correctOption: 1,
                  explanation: "Nuqta (.) bilan boshlanuvchi fayllar yashirin bo'ladi.",
                },
                {
                  question: "Yashirin fayllarni ro'yxatda ko'rsatish uchun ls buyrug'iga qaysi parametr beriladi?",
                  options: ["-h", "-a yoki -la", "-r", "-s"],
                  correctOption: 1,
                  explanation: "-a (all) barcha yashirin fayllarni ham chiqaradi.",
                },
                {
                  question: "Kataloglar ro'yxatidagi '..' nimani anglatadi?",
                  options: ["Joriy katalogni", "Bitta yuqori ota katalogni", "Ildiz katalogni", "O'chirilgan faylni"],
                  correctOption: 1,
                  explanation: ".. bitta yuqori katalogni bildiradi.",
                },
                {
                  question: "Joriy katalog va barcha quyi kataloglardagi '.txt' fayllarni topish buyrug'i qaysi?",
                  options: ["find . -name '*.txt'","ls *.txt -r","grep -r .txt","locate -a txt"],
                  correctOption: 0,
                  explanation: "find . -name '*.txt' rekursiv ravishda qidiradi.",
                },
                {
                  question: "Fayl nomining boshiga nuqta qo'yish orqali uni yashirish buyrug'i qaysi?",
                  options: ["mv file.txt .file.txt","hide file.txt","chmod +h file.txt","touch -h file.txt"],
                  correctOption: 0,
                  explanation: "mv yordamida fayl nomini nuqta bilan boshlanadigan qilib o'zgartirish uni yashiradi.",
                },
              ],
            },
          },
        ],
      },
      {
        title: "2-Modul: Matn Qidiruvi va Quvurlar (Pipes & Redirection)",
        duration: "4 soat",
        lessons: [
          {
            title: "Grep va Find bilan Rekursiv Qidiruv",
            duration: "30 daqiqa",
            isFree: false,
            labSlug: "linux-grep-find",
            content: `### 📌 Katta Fayllar Ichidan Qidiruv: Grep & Find

Tizimda minglab fayllar bo'lganda qo'lda qidirish imkonsiz. \`grep\` vositasi muntazam ifodalar (regex) asosida fayllar ichidan qidiradi.

\`\`\`bash
# Barcha papkalar ichidan rekursiv qidiruv:
grep -r "flag{" backup_archives/

# Katta-kichik harflarni inobatga olmaslik (-i) va qator raqami (-n):
grep -rin "password" /var/log/

# Nom bo'yicha fayl qidirish:
find . -name "*.txt" -exec grep -H "flag" {} \\;
\`\`\`

> [!IMPORTANT]
> **Mustaqil topshiriq:** \`backup_archives\` ichidagi fayllardan \`grep -r "flag{" backup_archives/\` orqali kerakli bayroqni toping!`,
            quiz: {
              title: "Grep va Find Mini-Testi",
              passingScore: 70,
              maxAttempts: 3,
              questions: [
                {
                  question: "Katalog ichidagi barcha fayllardan rekursiv qidirish uchun grep qaysi bayroq bilan ishlatiladi?",
                  options: ["-v", "-r yoki -R", "-c", "-l"],
                  correctOption: 1,
                  explanation: "-r rekursiv (barcha ichki papkalarda) qidiruvni faollashtiradi.",
                },
                {
                  question: "Qidiruvda katta-kichik harf farqini e'tiborsiz qoldirish qaysi parametr orqali amalga oshiriladi?",
                  options: ["-i", "-s", "-f", "-u"],
                  correctOption: 0,
                  explanation: "-i (case insensitive) parametr hisoblanadi.",
                },
                {
                  question: "Faqat mos kelmaydigan qatorlarni chiqarish uchun grep ga qaysi parametr beriladi?",
                  options: ["-v", "-n", "-x", "-m"],
                  correctOption: 0,
                  explanation: "-v (invert match) mos kelmagan qatorlarni ko'rsatadi.",
                },
                {
                  question: "Grep buyrug'ida qator raqamlarini ham ko'rsatish uchun qaysi flag ishlatiladi?",
                  options: ["-n","-c","-v","-l"],
                  correctOption: 0,
                  explanation: "-n flagi topilgan moslikning qator raqamini ko'rsatadi.",
                },
                {
                  question: "Grep buyrug'ida katta-kichik harflarni farqlamasdan (case-insensitive) qidirish kaliti qaysi?",
                  options: ["-i","-v","-s","-r"],
                  correctOption: 0,
                  explanation: "-i flagi harf registri farqini e'tiborsiz qoldiradi.",
                },
              ],
            },
          },
          {
            title: "Quvurlar (|) va Base64 Kodlash",
            duration: "25 daqiqa",
            isFree: false,
            labSlug: "linux-pipe-base64",
            content: `### 📌 Linux Quvurlari va Base64 Dekodlash

Linux falsafasining eng kuchli jihati — kichik dasturlarni quvur (\`|\`) orqali birlashtirishdir. Bir buyruqning chiqishi (stdout) ikkinchi buyruqning kirishiga (stdin) uzatiladi.

\`\`\`bash
# Base64 matnni terminalda dekodlash:
echo "ZmxhZ3tjeWJlcl90ZXN0fQ==" | base64 -d

# Faylni o'qish, dekodlash va filtrlash:
cat encoded_data.txt | base64 -d | grep 'flag{'
\`\`\`

> [!NOTE]
> Xavfsiz tizimlarda \`tmpfs\` qismida \`noexec\` o'rnatilgan bo'lsa, skriptni to'g'ridan-to'g'ri \`./script.sh\` qilib ishga tushirib bo'lmaydi. Bunday holda interpretator orqali \`bash script.sh\` yoki \`python3 script.py\` buyrug'i beriladi.`,
            quiz: {
              title: "Quvurlar va Base64 Mini-Testi",
              passingScore: 70,
              maxAttempts: 3,
              questions: [
                {
                  question: "Bir buyruq natijasini ikkinchisiga uzatish uchun Linuxda qaysi belgi ishlatiladi?",
                  options: [">", "| (Pipe)", "&", "$"],
                  correctOption: 1,
                  explanation: "| (pipe) quvuri ma'lumotlar oqimini ulaydi.",
                },
                {
                  question: "Base64 kodlangan qatorni asl holiga qaytarish (dekodlash) qaysi kalit bilan bajariladi?",
                  options: ["base64 -e", "base64 -d", "base64 -u", "base64 -r"],
                  correctOption: 1,
                  explanation: "-d (decode) shifrni ochadi.",
                },
                {
                  question: "noexec o'rnatilgan papkada shell skriptini qanday ishga tushirish kerak?",
                  options: ["./script.sh", "bash script.sh", "sudo ./script.sh", "chmod +x script.sh"],
                  correctOption: 1,
                  explanation: "noexec da binary bajarish taqiqlanadi, shuning uchun interpretator chaqiriladi: bash script.sh.",
                },
                {
                  question: "Linuxda buyruq xatolar oqimi (stderr) deskriptor raqami nechiga teng?",
                  options: ["2","1","0","3"],
                  correctOption: 0,
                  explanation: "0 = stdin, 1 = stdout, 2 = stderr.",
                },
                {
                  question: "Buyruq natijasini mavjud fayl oxiriga qo'shish (append) uchun qaysi operator ishlatiladi?",
                  options: [">>",">","|","&&"],
                  correctOption: 0,
                  explanation: ">> operatori mavjud faylni o'chirmasdan uning oxiriga yozadi.",
                },
              ],
            },
          },
        ],
      },
    ],
  },

  // ── 2. PYTHON VA SKRIPTLASH ──────────────────────────────────────────────
  {
    id: 2,
    slug: "course-python",
    title: "Python va Kiberxavfsizlikda Skriptlash",
    icon: "🐍",
    desc: "Tarmoq soketlari, avtomatlashtirish, xeshlar va kiberxavfsizlik skriptlari",
    fullDesc:
      "Python tili axloqiy xakerlik va kiberxavfsizlik bo'yicha eng ommabop dasturlash tilidir. Ushbu kursda tarmoq paketlari bilan ishlash, socket ulanishlari, hashlib bilan xesh hisoblash va xavfsizlik testlarini avtomatlashtirish o'rganiladi.",
    level: "O'rta",
    levelColor: "badge-blue",
    color: "green",
    accent: "#34d399",
    badge: "badge-blue",
    bLabel: "Amaliy",
    duration: "14 soat",
    tags: ["Python", "Sockets", "Hashlib", "Automation", "Scripts"],
    instructor: {
      name: "Jasur Mirzayev",
      role: "Security Engineer & Python Core Developer",
      avatar: "👨‍💻",
      experience: "6+ yil",
    },
    whatYouWillLearn: [
      "Python socket moduli orqali tarmoq skanerlash",
      "Kriptografik xeshlar (MD5, SHA-256) yaratish va lug'at hujumlari",
      "HTTP so'rovlar yuborish va API xavfsizligini tekshirish",
    ],
    prerequisites: ["Dasturlash asoslari"],
    modules: [
      {
        title: "1-Modul: Python Tarmoq Soketlari va Skanerlash",
        duration: "4 soat",
        lessons: [
          {
            title: "Socket Moduli va TCP Port Auditi",
            duration: "30 daqiqa",
            isFree: true,
            labSlug: "net-nmap-audit",
            content: `### 📌 Python Socket Yordamida Port Skaner

Tarmoq ulanishlarini tekshirish uchun Python-ning standart \`socket\` kutubxonasidan foydalanamiz.

\`\`\`python
import socket

def scan_port(host, port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(1.0)
    try:
        s.connect((host, port))
        print(f"[+] Port {port} ochiq!")
        banner = s.recv(1024)
        print(f"[*] Banner: {banner.decode('utf-8', errors='ignore')}")
    except:
        pass
    finally:
        s.close()

scan_port("127.0.0.1", 1337)
\`\`\`

> [!NOTE]
> Skriptni terminalda ishga tushirish uchun: \`python3 scanner.py\` buyrug'idan foydalaning.`,
            quiz: {
              title: "Python Socket Mini-Testi",
              passingScore: 70,
              maxAttempts: 3,
              questions: [
                {
                  question: "TCP ulanish hosil qilish uchun qaysi socket turi ishlatiladi?",
                  options: ["SOCK_DGRAM", "SOCK_STREAM", "SOCK_RAW", "SOCK_SEQPACKET"],
                  correctOption: 1,
                  explanation: "SOCK_STREAM TCP protokoli uchun ishlatiladi.",
                },
                {
                  question: "Soketda javob kutish vaqtini cheklash uchun qaysi metod chaqiriladi?",
                  options: ["settimeout()", "setlimit()", "sleep()", "wait()"],
                  correctOption: 0,
                  explanation: "settimeout(soniyalar) metodidan foydalaniladi.",
                },
                {
                  question: "noexec rejimida Python faylini qanday ishga tushirish tavsiya etiladi?",
                  options: ["./script.py", "python3 script.py", "run script.py", "exec script.py"],
                  correctOption: 1,
                  explanation: "To'g'ridan-to'g'ri interpretator orqali: python3 script.py.",
                },
                {
                  question: "TCP 3-bosqichli qo'l siqish (3-way handshake) tartibi qanday?",
                  options: ["SYN -> SYN-ACK -> ACK","ACK -> SYN -> ACK","SYN -> ACK -> FIN","CONNECT -> ACCEPT"],
                  correctOption: 0,
                  explanation: "TCP ulanish SYN, SYN-ACK, ACK ketma-ketligida o'rnatiladi.",
                },
                {
                  question: "Python socket dasturlashda mijoz ulanishini kutib qabul qilish metodi qaysi?",
                  options: ["accept()","connect()","listen()","bind()"],
                  correctOption: 0,
                  explanation: "accept() metodi kiruvchi yangi TCP ulanishini qabul qiladi.",
                },
              ],
            },
          },
        ],
      },
    ],
  },

  // ── 3. KRIPTOGRAFIYA VA CIA TRIADASI ────────────────────────────────────
  {
    id: 3,
    slug: "course-cryptography",
    title: "Kriptografiya va CIA Triadasi",
    icon: "🔐",
    desc: "Confidentiality, Integrity, Availability, klassik va zamonaviy shifrlar, xeshlar",
    fullDesc:
      "Axborot xavfsizligining poydevori bo'lgan CIA triadasi va kriptografiya tamoyillari. Sezar shifri, XOR, simmetrik va asimmetrik shifrlash, xesh funksiyalari (MD5, SHA-256) hamda ularga uyushtiriladigan hujumlar tahlil qilinadi.",
    level: "O'rta",
    levelColor: "badge-blue",
    color: "purple",
    accent: "#a855f7",
    badge: "badge-blue",
    bLabel: "Fundamental",
    duration: "10 soat",
    tags: ["CIA Triad", "Cryptography", "Hashing", "XOR", "Caesar", "MD5"],
    instructor: {
      name: "Sardor Rahimov",
      role: "Kiberxavfsizlik mutaxassisi (CISSP)",
      avatar: "👨‍🏫",
      experience: "8+ yil",
    },
    whatYouWillLearn: [
      "CIA triadasi (Maxfiylik, Butunlik, Foydalanish imkoniyati)",
      "Klassik shifrlar (Caesar ROT13, XOR shifrlash)",
      "Bir tomonlama xesh funksiyalari va ularni lug'at orqali ochish",
    ],
    prerequisites: ["Boshlang'ich kiberxavfsizlik bilimlari"],
    modules: [
      {
        title: "1-Modul: CIA Triadasi va Klassik Shifrlash",
        duration: "3 soat",
        lessons: [
          {
            title: "CIA Triadasi va Kiberxavfsizlik Tamoyillari",
            duration: "20 daqiqa",
            isFree: true,
            content: `### 📌 CIA Triadasi Nima?

Kiberxavfsizlikning 3 asosiy ustuni:
1. **Confidentiality (Maxfiylik)** — Ma'lumot faqat ruxsati bor shaxslarga ko'rinadi (Shifrlash, kirish nazorati).
2. **Integrity (Butunlik)** — Ma'lumot uzatish yoki saqlash jarayonida ruxsatsiz o'zgartirilmasligi (Xeshlar, HMAC, raqamli imzo).
3. **Availability (Foydalanish imkoniyati)** — Xizmat va ma'lumotlar kerakli vaqtda talabgorga mavjud bo'lishi (DDoS himoyasi, zaxira nusxalar).`,
            quiz: {
              title: "CIA Triadasi Testi",
              passingScore: 70,
              maxAttempts: 3,
              questions: [
                {
                  question: "CIA triadida 'I' harfi qaysi tamoyilni anglatadi?",
                  options: ["Internet", "Integrity (Butunlik)", "Infrastructure", "Identification"],
                  correctOption: 1,
                  explanation: "Integrity — ma'lumotlarning buzilmasligi va o'zgarmasligini ta'minlash.",
                },
                {
                  question: "DDoS hujumlari CIA triadasining qaysi ustuniga tahdid soladi?",
                  options: ["Confidentiality", "Integrity", "Availability (Foydalanish imkoniyati)", "Barchasiga"],
                  correctOption: 2,
                  explanation: "DDoS serverni band qilib, uning mavjudligini (Availability) yo'qotadi.",
                },
                {
                  question: "Parollarni xeshlash va shifrlash asosan qaysi tamoyilga xizmat qiladi?",
                  options: ["Confidentiality (Maxfiylik)", "Availability", "Scalability", "Speed"],
                  correctOption: 0,
                  explanation: "Shifrlash ma'lumot maxfiyligini saqlashning asosiy vositasidir.",
                },
                {
                  question: "Kiberxavfsizlikda ma'lumotning uzatish paytida o'zgarmaganligini tekshirish uchun nima ishlatiladi?",
                  options: ["Kriptografik xesh (nazorat summasi)","Faqat oddiy parol","Fayl hajmi","Cookie"],
                  correctOption: 0,
                  explanation: "Kriptografik xeshlar (SHA256, HMAC) yaxlitlikni tekshirish uchun xizmat qiladi.",
                },
                {
                  question: "DDoS hujumlari CIA triadasi tamoyillaridan qaysi biriga to'g'ridan-to'g'ri zarar yetkazadi?",
                  options: ["Mavjudlik (Availability)","Maxfiylik (Confidentiality)","Yaxlitlik (Integrity)","Avtorizatsiya"],
                  correctOption: 0,
                  explanation: "DDoS xizmatni ishdan chiqarib, uning foydalanuvchilar uchun mavjudligiga putur yetkazadi.",
                },
              ],
            },
          },
          {
            title: "Sezar Shifri va ROT13 Algoritmi",
            duration: "25 daqiqa",
            isFree: false,
            labSlug: "crypto-caesar",
            content: `### 📌 Sezar va ROT13 Shifri

Sezar shifrida alifbodagi har bir harf ma'lum qadamga siljitiladi. ROT13 — bu harflarni 13 qadamga siljitish bo'lib, uning qiziq tomoni shundaki, shifrlash va dekriptlash bir xil funksiya bilan bajariladi.

\`\`\`bash
# Linux terminalida ROT13 dekript qilish:
echo "synt{plore_pnrfne_ebg13_qrpelcgvba_fhpprff}" | tr 'A-Za-z' 'N-ZA-Mn-za-m'
\`\`\`

> [!IMPORTANT]
> **Mustaqil topshiriq:** \`crypto-caesar\` laboratoriyasiga kiring va ROT13 matnini yechib bayroqni yuboring!`,
            quiz: {
              title: "Klassik Shifrlash Mini-Testi",
              passingScore: 70,
              maxAttempts: 3,
              questions: [
                {
                  question: "ROT13 shifrida harf alifboda necha qadamga suriladi?",
                  options: ["3", "10", "13", "26"],
                  correctOption: 2,
                  explanation: "Rotate by 13 places (13 ta harfga siljish).",
                },
                {
                  question: "XOR shifrining asosiy xossasi nima? (A ^ K = C bo'lsa)",
                  options: ["C ^ K = A", "C ^ A = 0", "K ^ K = A", "C = A"],
                  correctOption: 0,
                  explanation: "XOR qaytar amali: shifrmatnga kalit qayta qo'llansa asl matn chiqadi.",
                },
                {
                  question: "MD5 xeshi necha bitdan iborat?",
                  options: ["64 bit", "128 bit", "256 bit", "512 bit"],
                  correctOption: 1,
                  explanation: "MD5 xeshi 128 bit (32 ta o'n oltilik belgi) ga teng.",
                },
                {
                  question: "XOR shifrlashda qaysi muhim matematik qaytariluvchanlik xossasi amal qiladi?",
                  options: ["(A ^ B) ^ B = A","A ^ A = 1","A ^ 0 = 0","A ^ B = B ^ A + 1"],
                  correctOption: 0,
                  explanation: "Bir xil kalit bilan ikki marta XOR qilinsa asl qiymat qaytadi: (A ^ B) ^ B = A.",
                },
                {
                  question: "Klassik almashtirish shifrlari (masalan, Sezar) nima sababli osonlikcha buziladi?",
                  options: ["Harflarning takrorlanish chastotasi tahlili (frequency analysis)","Kompyuter tezligi sababli","Faqat ingliz tilida ishlagani uchun","Kalit uzun bo'lgani uchun"],
                  correctOption: 0,
                  explanation: "Chastota tahlili orqali shifrmatndagi harflar taqsimotini aniqlab shifr oson ochiladi.",
                },
              ],
            },
          },
        ],
      },
    ],
  },

  // ── 4. MA'LUMOTLAR BAZASI VA POSTGRESQL ──────────────────────────────────
  {
    id: 4,
    slug: "course-database",
    title: "Ma'lumotlar Bazasi va PostgreSQL Xavfsizligi",
    icon: "🗄️",
    desc: "SQL so'rovlari, PostgreSQL xavfsiz konfiguratsiyasi, SQL Injection va himoya",
    fullDesc:
      "Zamonaviy ilovalarning yuragi ma'lumotlar bazasidir. Ushbu kursda PostgreSQL me'morchiligi, xavfsiz foydalanuvchilar va huquqlar (GRANT/REVOKE), SQL Injection zaifliklari va ulardan himoyalanish (Prepared Statements, ORM) amaliy o'rganiladi.",
    level: "O'rta",
    levelColor: "badge-blue",
    color: "blue",
    accent: "#38bdf8",
    badge: "badge-blue",
    bLabel: "Amaliy",
    duration: "10 soat",
    tags: ["PostgreSQL", "SQL", "SQL Injection", "Database Security"],
    instructor: {
      name: "Aziz Qosimov",
      role: "Lead Database Administrator & Security Architect",
      avatar: "👨‍💻",
      experience: "9+ yil",
    },
    whatYouWillLearn: [
      "SQL so'rovlari tuzilishi va ma'lumotlar manipulatsiyasi",
      "SQL Injection (UNION, Error-based) tahlili",
      "Parametrlashgan so'rovlar yordamida bazani himoyalash",
    ],
    prerequisites: ["Boshlang'ich SQL bilimlari"],
    modules: [
      {
        title: "1-Modul: SQL Injection va Himoya Usullari",
        duration: "3 soat",
        lessons: [
          {
            title: "SQL Injection Zaifligi va UNION Hujumi",
            duration: "30 daqiqa",
            isFree: true,
            labSlug: "web-sqli",
            content: `### 📌 SQL Injection Qanday Sodir Bo'ladi?

Dasturchi foydalanuvchi kiritgan ma'lumotni to'g'ridan-to'g'ri SQL qatoriga ulab (string concatenation) yuborsa, hujumchi maxsus belgi (\`'\`) orqali so'rov mantig'ini o'zgartirishi mumkin.

\`\`\`sql
-- Zaif so'rov:
SELECT id, title, author FROM books WHERE title LIKE '%input%'

-- Hujumchi kiritadi:
' UNION SELECT 1, flag_val, 'secret' FROM secrets --

-- Natijada birlashgan so'rov maxfiy ma'lumotni chiqaradi!
\`\`\`

#### 🛡 Qanday Himoyalanish Kerak?
Faqat parametrlashgan so'rovlar (Prepared Statements) yoki xavfsiz ORM ishlatish shart!`,
            quiz: {
              title: "SQL Injection Mini-Testi",
              passingScore: 70,
              maxAttempts: 3,
              questions: [
                {
                  question: "SQL Injection zaifligining asosiy sababi nima?",
                  options: ["Server xotirasi kamligi", "Foydalanuvchi ma'lumotini SQL so'roviga to'g'ridan-to'g'ri ulash", "HTTPS ishlatilmasligi", "Noto'g'ri port tanlanganligi"],
                  correctOption: 1,
                  explanation: "Filtrsiz qator ulanishi (concatenation) so'rov tuzilishini o'zgartiradi.",
                },
                {
                  question: "SQL Injectiondan himoyalanishning eng ishonchli usuli qaysi?",
                  options: [
                    "Faqat tirnoqlarni o'chirish",
                    "Parametrlashgan so'rovlar (Prepared Statements)",
                    "So'rovni base64 qilish",
                    "Firewall portini yopish",
                  ],
                  correctOption: 1,
                  explanation: "Parametrlashgan so'rovlarda ma'lumot buyruq sifatida bajarilmaydi.",
                },
                {
                  question: "SQL so'rovida qolgan qismni izohga aylantirish uchun qaysi belgi kiritiladi?",
                  options: ["//", "--", "/*", "##"],
                  correctOption: 1,
                  explanation: "Standart SQL da '-- ' izoh boshlanishini bildiradi.",
                },
                {
                  question: "SQL inyeksiyasidan 100% himoyalanishning eng ishonchli usuli qaysi?",
                  options: ["Parametrlangan so'rovlar (Prepared Statements / ORM)","Qora ro'yxat (Blacklist)","Harflarni katta qilish","MD5 xeshlash"],
                  correctOption: 0,
                  explanation: "Parametrlangan so'rovlar foydalanuvchi kiritgan ma'lumotni kod sifatida bajarilishiga yo'l qo'ymaydi.",
                },
                {
                  question: "UNION operatori yordamida ikkita so'rov natijasini birlashtirishda nimalar teng bo'lishi shart?",
                  options: ["Ustunlar soni va ularning ma'lumot turlari","Jadvallar nomi","WHERE shartlari","Baza versiyalari"],
                  correctOption: 0,
                  explanation: "UNION bajarilishi uchun ikkala SELECT so'rovida ustunlar soni va mos turlari teng bo'lishi shart.",
                },
              ],
            },
          },
        ],
      },
    ],
  },

  // ── 5. DJANGO WEB ARXITEKTURA VA HIMOYASI ───────────────────────────────
  {
    id: 5,
    slug: "course-django",
    title: "Django Web Arxitekturasi va Himoyasi",
    icon: "🎸",
    desc: "Django MVT, ORM xavfsizligi, CSRF himoyasi, seanslar va xavfsiz middleware",
    fullDesc:
      "Python-ning yetakchi web freymvorki Django xavfsizlikni birinchi o'ringa qo'yadi. Ushbu kursda Django orqali mustahkam web tizimlar qurish, CSRF tokenlari, XSS va clickjacking himoyasi, xavfsiz middleware konfiguratsiyasi o'rgatiladi.",
    level: "O'rta",
    levelColor: "badge-blue",
    color: "green",
    accent: "#34d399",
    badge: "badge-blue",
    bLabel: "Amaliy",
    duration: "11 soat",
    tags: ["Django", "Python", "CSRF", "ORM", "Web Security"],
    instructor: {
      name: "Jasur Mirzayev",
      role: "Backend Architect & Security Consultant",
      avatar: "👨‍💻",
      experience: "7+ yil",
    },
    whatYouWillLearn: [
      "Django arxitekturasi va ORM orqali avtomatik SQLi himoyasi",
      "CSRF tokenlari va SameSite cookie konfiguratsiyasi",
      "Xavfsiz autentifikatsiya va parol xeshlash siyosati",
    ],
    prerequisites: ["Python asoslari"],
    modules: [
      {
        title: "1-Modul: Django Xavfsizlik Asoslari",
        duration: "3 soat",
        lessons: [
          {
            title: "CSRF Himoyasi va Xavfsiz Formalar",
            duration: "25 daqiqa",
            isFree: true,
            content: `### 📌 Cross-Site Request Forgery (CSRF) Himoyasi

CSRF hujumida yot veb-sayt foydalanuvchining autentifikatsiyalangan seansidan foydalanib uning nomidan noqonuniy so'rov (masalan pul o'tkazish yoki parol o'zgartirish) yuboradi.

Django bunga qarshi:
1. Har bir formaga yashirin \`{% csrf_token %}\` qo'shadi.
2. Barcha POST, PUT, DELETE so'rovlarida token mavjudligi va Origin/Referer sarlavhalarini tekshiradi.`,
            quiz: {
              title: "Django CSRF Testi",
              passingScore: 70,
              maxAttempts: 3,
              questions: [
                {
                  question: "CSRF hujumining asosiy maqsadi nima?",
                  options: ["Foydalanuvchi ma'lumotlarini o'g'irlash", "Foydalanuvchi nomidan uning ruxsatisiz amal bajarish", "Serverni ortiqcha yuklash", "DNS yozuvlarini o'zgartirish"],
                  correctOption: 1,
                  explanation: "CSRF foydalanuvchi sessiyasi orqali soxta so'rov yuborishdir.",
                },
                {
                  question: "Django-da CSRF himoyasi qaysi HTTP metodlariga nisbatan majburiy qo'llaniladi?",
                  options: ["Faqat GET", "POST, PUT, DELETE, PATCH", "Faqat HEAD", "Faqat OPTIONS"],
                  correctOption: 1,
                  explanation: "Ma'lumotni o'zgartiruvchi metodlar (POST, PUT, DELETE) himoyalanadi.",
                },
                {
                  question: "Djangoda avtomatik SQL Injectiondan qaysi vosita himoya qiladi?",
                  options: ["Django ORM", "Django Admin", "Jinja2", "WSGI"],
                  correctOption: 0,
                  explanation: "Django ORM sukut bo'yicha barcha so'rovlarni parametrlaydi.",
                },
                {
                  question: "CSRF hujumiga qarshi SameSite cookie atributining eng qat'iy qiymati qaysi?",
                  options: ["Strict","Lax","None","Secure"],
                  correctOption: 0,
                  explanation: "SameSite=Strict uchinchi tomon saytlaridan keluvchi har qanday so'rovda cookie yuborilishini bloklaydi.",
                },
                {
                  question: "Django'da CSRF himoyasi qaysi arxitektura qatlami orqali avtomatik ta'minlanadi?",
                  options: ["CsrfViewMiddleware middleware","Faqat models.py","Faqat database router","URL patterns"],
                  correctOption: 0,
                  explanation: "CsrfViewMiddleware barcha POST/PUT/DELETE so'rovlarida token mavjudligini avtomatik tekshiradi.",
                },
              ],
            },
          },
        ],
      },
    ],
  },

  // ── 6. WEB DASTURLASH VA XAVFSIZLIK ASOSLARI ─────────────────────────────
  {
    id: 6,
    slug: "course-web",
    title: "Web Dasturlash va Xavfsizlik Asoslari",
    icon: "🌐",
    desc: "HTTP protokoli, DOM, XSS, IDOR zaifliklari va konfiguratsiya xavfsizligi",
    fullDesc:
      "Veb ilovalarning xavfsizligi butun internet xavfsizligining eng dolzarb jabhasidir. Kursda HTTP sarlavhalari, Cookie parametrlari (HttpOnly, Secure, SameSite), Reflected va Stored XSS, IDOR hamda ochiq qoldirilgan fayllar orqali ma'lumot sizishi amaliy laboratoriyalar orqali o'rganiladi.",
    level: "Boshlang'ich",
    levelColor: "badge-green",
    color: "orange",
    accent: "#f59e0b",
    badge: "badge-green",
    bLabel: "Boshlang'ich",
    duration: "13 soat",
    tags: ["Web Security", "XSS", "IDOR", "HTTP", "Cookies", "Robots.txt"],
    instructor: {
      name: "Sardor Rahimov",
      role: "Kiberxavfsizlik mutaxassisi (CISSP)",
      avatar: "👨‍🏫",
      experience: "8+ yil",
    },
    whatYouWillLearn: [
      "Reflected va DOM XSS hujumlarini aniqlash va himoyalash",
      "Insecure Direct Object References (IDOR) zaifliklari",
      "Robots.txt va ochiq qolgan .env fayllar tahlili",
    ],
    prerequisites: ["HTML va JavaScript asoslari"],
    modules: [
      {
        title: "1-Modul: XSS va IDOR Amaliyoti",
        duration: "4 soat",
        lessons: [
          {
            title: "Reflected XSS va Cookie Tahlili",
            duration: "25 daqiqa",
            isFree: true,
            labSlug: "web-xss",
            content: `### 📌 Cross-Site Scripting (XSS)

XSS zaifligi foydalanuvchi kiritgan filtrlanmagan JavaScript kodini brauzerda bajarilishiga olib keladi.

#### Xavflari:
- Foydalanuvchining seans cookie'larini o'g'irlash (\`document.cookie\`)
- Foydalanuvchi nomidan amallar bajarish
- Sahifaga soxta kirish shakllari qo'yish (phishing)`,
            quiz: {
              title: "XSS Mini-Testi",
              passingScore: 70,
              maxAttempts: 3,
              questions: [
                {
                  question: "XSS hujumi paytida JavaScript kodi qayerda bajariladi?",
                  options: ["Serverda", "Qurbonning brauzerida", "Routerda", "PostgreSQL bazasida"],
                  correctOption: 1,
                  explanation: "XSS mijoz (brauzer) tomonida bajariladi.",
                },
                {
                  question: "JavaScript orqali cookie o'g'irlanishini qaysi atribut bloklaydi?",
                  options: ["Secure", "HttpOnly", "SameSite=Lax", "Path=/"],
                  correctOption: 1,
                  explanation: "HttpOnly o'rnatilgan cookie'larga document.cookie orqali kirib bo'lmaydi.",
                },
                {
                  question: "IDOR qisqartmasi nimani anglatadi?",
                  options: [
                    "Insecure Direct Object Reference",
                    "Internal Domain Origin Request",
                    "Integrated Database Online Recovery",
                    "Internet Data Output Rate",
                  ],
                  correctOption: 0,
                  explanation: "Insecure Direct Object Reference (to'g'ridan-to'g'ri obyektga xavfsiz bo'lmagan havola).",
                },
                {
                  question: "Cookie'larning XSS orqali JavaScript yordamida o'g'irlanishini oldini oluvchi muhim flag qaysi?",
                  options: ["HttpOnly","SameSite","Path","Domain"],
                  correctOption: 0,
                  explanation: "HttpOnly flagi o'rnatilgan cookie'larga document.cookie orqali murojaat qilish imkonsiz.",
                },
                {
                  question: "Brauzerda skriptlarning faqat ruxsat etilgan manbalardan yuklanishini majburlaydigan sarlavha qaysi?",
                  options: ["Content-Security-Policy (CSP)","X-Content-Type-Options","Referrer-Policy","X-XSS-Protection"],
                  correctOption: 0,
                  explanation: "Content-Security-Policy skript, uslub va boshqa resurslarning ruxsat etilgan manbalarini belgilaydi.",
                },
              ],
            },
          },
          {
            title: "IDOR va Ochiq Qoldirilgan Konfiguratsiya Fayllari",
            duration: "25 daqiqa",
            isFree: false,
            labSlug: "web-idor",
            content: `### 📌 IDOR va Ochiq Fayllar Tahlili

Agar tizim API orqali \`/api/user?id=104\` chaqirilganda, so'rov yuboruvchining aynan shu profilga huquqi bor-yo'qligini tekshirmasa, hujumchi \`id=1\` deb o'zgartirib administrator ma'lumotlarini ko'rishi mumkin.

Shuningdek, \`/robots.txt\` faylida yashirilgan deb o'ylangan \`/.backup_secrets_2026/db.env\` yoki \`/.git\` katalogi kiberhujumchi uchun oson nishon bo'ladi.`,
            quiz: {
              title: "IDOR va Konfiguratsiya Testi",
              passingScore: 70,
              maxAttempts: 3,
              questions: [
                {
                  question: "IDOR zaifligining oldini olish uchun nima qilinishi shart?",
                  options: ["ID raqamini harfga almashtirish", "Server tomonida foydalanuvchining ushbu obyektga egalik huquqini tekshirish", "HTTPS ishlatish", "URL manzilini qisqartirish"],
                  correctOption: 1,
                  explanation: "Har bir so'rovda server tomoni avtorizatsiyasi (huquq) tekshirilishi shart.",
                },
                {
                  question: "robots.txt faylining asosiy vazifasi nima?",
                  options: [
                    "Parollarni saqlash",
                    "Qidiruv tizimi botlariga sayt qismlarini indekslash qoidalarini bildirish",
                    "Firewall qoidalarini o'rnatish",
                    "Foydalanuvchilarni bloklash",
                  ],
                  correctOption: 1,
                  explanation: "robots.txt faqat botlar uchun yo'riqnoma, u xavfsizlik himoyasi emas.",
                },
                {
                  question: "Production muhitida .git yoki .env fayllari ommaga ochiq bo'lishi qanday xavf tug'diradi?",
                  options: [
                    "Hech qanday xavf yo'q",
                    "Dastur kodi, maxfiy kalitlar va bazaviy parollarning sizib chiqishi",
                    "Sayt sekinlashishi",
                    "Domen muddati tugashi",
                  ],
                  correctOption: 1,
                  explanation: "Ushbu fayllarda eng maxfiy tizim kalitlari va parollar saqlanadi.",
                },
                {
                  question: "IDOR (Insecure Direct Object Reference) zaifligining asosiy sababi nima?",
                  options: ["Serverda obyektga kirishdan oldin foydalanuvchi huquqi tekshirilmasligi","Baza shifrlanmaganligi","Faqat GET so'rov ishlatilgani","Parolning soddaligi"],
                  correctOption: 0,
                  explanation: "Server mijoz uzatgan ID egasiga tegishli yoki yo'qligini tekshirmasdan ma'lumotni berishi IDOR zaifligini keltirib chiqaradi.",
                },
                {
                  question: "Qidiruv botlari saytning maxfiy yoki backup papkalariga kirmasligi uchun qaysi fayl qo'yiladi?",
                  options: ["robots.txt",".htaccess","sitemap.xml","manifest.json"],
                  correctOption: 0,
                  explanation: "robots.txt faylida Disallow direktivalari orqali robotlarga taqiqlangan yo'llar ko'rsatiladi.",
                },
              ],
            },
          },
        ],
      },
    ],
  },

  // ── 7. AMALIY KIBERXAVFSIZLIK VA PENETRATION TESTING ─────────────────────
  {
    id: 7,
    slug: "course-pentest",
    title: "Amaliy Kiberxavfsizlik va Penetration Testing",
    icon: "🎯",
    desc: "Axloqiy xakerlik, Nmap port auditi, Wireshark PCAP trafigi tahlili",
    fullDesc:
      "Tizimlarni himoyalash uchun avvalo hujumchilar qanday fikrlashini va harakatlanishini bilish zarur. Ushbu amaliy kursda tarmoq xizmatlari auditi (Nmap), ochiq paketlarni tutib tahlil qilish (Wireshark/PCAP) va zaifliklarni hisobot qilish o'rgatiladi.",
    level: "Ilg'or",
    levelColor: "badge-orange",
    color: "purple",
    accent: "#a855f7",
    badge: "badge-orange",
    bLabel: "Ilg'or",
    duration: "15 soat",
    tags: ["Penetration Testing", "Nmap", "Wireshark", "Network Security", "PCAP"],
    instructor: {
      name: "Bobur Rustamov",
      role: "Ethical Hacker (OSCP) & Security Consultant",
      avatar: "👨‍💻",
      experience: "8+ yil",
    },
    whatYouWillLearn: [
      "Nmap yordamida ochiq portlar va xizmat versiyalarini skanerlash",
      "Wireshark orqali ochiq HTTP/FTP trafigi va parollarni topish",
      "Zaifliklarni xavfsiz bartaraf etish bo'yicha tavsiyalar",
    ],
    prerequisites: ["Tarmoq protokollari asoslari"],
    modules: [
      {
        title: "1-Modul: Tarmoq Razvedkasi va Trafigi Tahlili",
        duration: "4 soat",
        lessons: [
          {
            title: "Nmap Port Skanerlash va Zaif Xizmatlar",
            duration: "30 daqiqa",
            isFree: true,
            labSlug: "net-nmap-audit",
            content: `### 📌 Nmap Bilan Tarmoq Auditi

Nmap tarmoqdagi barcha faol qurilmalar va ochiq portlarni aniqlaydi.

\`\`\`bash
# Xizmat versiyalari va bannerlarini aniqlash:
nmap -sV -sC -p 1-10000 192.168.1.50

# Natijalarni tahlil qilish:
cat network/nmap_scan.txt | grep '1337'
\`\`\``,
            quiz: {
              title: "Nmap Mini-Testi",
              passingScore: 70,
              maxAttempts: 3,
              questions: [
                {
                  question: "Nmap da xizmat versiyalarini aniqlash (Version Detection) qaysi bayroq bilan beriladi?",
                  options: ["-sV", "-sP", "-O", "-A"],
                  correctOption: 0,
                  explanation: "-sV xizmat versiyasini tekshiradi.",
                },
                {
                  question: "TCP SYN (yarim ochiq) yashirin skanerlash bayrog'i qaysi?",
                  options: ["-sT", "-sS", "-sU", "-sN"],
                  correctOption: 1,
                  explanation: "-sS (SYN stealth scan) to'liq ulanish qilmasdan skanerlaydi.",
                },
                {
                  question: "Wireshark fayllari odatda qaysi formatda saqlanadi?",
                  options: [".pcap / .pcapng", ".exe", ".txt", ".iso"],
                  correctOption: 0,
                  explanation: ".pcap (Packet Capture) formati standartdir.",
                },
                {
                  question: "Nmap'da ochiq portlarda ishlayotgan xizmatlar versiyasini aniqlash flagi qaysi?",
                  options: ["-sV","-sS","-O","-p-"],
                  correctOption: 0,
                  explanation: "-sV (service version) ochiq portlardagi xizmatlar banneri va versiyalarini aniqlaydi.",
                },
                {
                  question: "Nmap'da barcha 65535 ta portni to'liq skanerlash uchun qaysi parametr beriladi?",
                  options: ["-p-","-p 1-1000","-sT","-all"],
                  correctOption: 0,
                  explanation: "-p- kaliti 1 dan 65535 gacha bo'lgan barcha portlarni skanerlashni buyuradi.",
                },
              ],
            },
          },
          {
            title: "Tarmoq Trafigi Tahlili (Traffic Sniffing)",
            duration: "25 daqiqa",
            isFree: false,
            labSlug: "net-pcap-analysis",
            content: `### 📌 Ochiq Matnli Protokollar Xavfi

Shifrlanmagan HTTP va FTP protokollari orqali uzatilgan login va parollar tarmoq tinglovchi (sniffing) tomonidan ochiqcha o'qib olinishi mumkin.

\`\`\`bash
# Log fayldagi ushlangan parollarni tahlil qilish:
grep -i 'flag{' network/capture_traffic.log
\`\`\``,
            quiz: {
              title: "Traffic Sniffing Testi",
              passingScore: 70,
              maxAttempts: 3,
              questions: [
                {
                  question: "Qaysi protokol parollarni ochiq matn (shifrlanmagan) ko'rinishida uzatadi?",
                  options: ["HTTPS", "SSH", "HTTP va FTP", "SFTP"],
                  correctOption: 2,
                  explanation: "HTTP va FTP shifrlashsiz ishlaydi.",
                },
                {
                  question: "Tarmoq tinglash (sniffing) hujumlariga qarshi qanday himoyalanish kerak?",
                  options: [
                    "Shifrlangan protokollardan foydalanish (HTTPS, SSH, TLS)",
                    "Portlarni 80 ga o'zgartirish",
                    "Fayllarni .zip qilish",
                    "Brauzer keshini tozalash",
                  ],
                  correctOption: 0,
                  explanation: "TLS/HTTPS orqali butun trafik shifrlanadi.",
                },
                {
                  question: "Wiresharkda ma'lum bir IP manziliga tegishli paketlarni filtrlash qanday yoziladi?",
                  options: [
                    "ip.addr == 192.168.1.1",
                    "filter: 192.168.1.1",
                    "host = 192.168.1.1",
                    "search 192.168.1.1",
                  ],
                  correctOption: 0,
                  explanation: "ip.addr == X.X.X.X Wireshark displey filtri sintaksisidir.",
                },
                {
                  question: "Wireshark va tcpdump vositalari yozib oladigan standart tarmoq trafigi fayl formati qaysi?",
                  options: [".pcap / .pcapng",".log",".txt",".tar.gz"],
                  correctOption: 0,
                  explanation: ".pcap (packet capture) fayl formati tarmoq paketlarini to'liq saqlaydi.",
                },
                {
                  question: "Ochiq Wi-Fi tarmoqlarida parollar o'g'irlanmasligi uchun transport qatlamida qaysi protokol talab etiladi?",
                  options: ["TLS / HTTPS","HTTP 1.1","FTP","Telnet"],
                  correctOption: 0,
                  explanation: "TLS/HTTPS protokoli tarmoqdagi trafigini shifrlab, parollarning ochiq ketishini oldini oladi.",
                },
              ],
            },
          },
        ],
      },
    ],
  },
];
