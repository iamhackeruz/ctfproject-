export interface LabDefinition {
  id: string;
  slug: string;
  title: string;
  category: "Linux" | "Kriptografiya" | "Web" | "Tarmoq";
  difficulty: "Oson" | "O'rta" | "Qiyin";
  points: number;
  type: "terminal" | "static" | "web-instance";
  description: string;
  hint1: string;
  hint2: string;
  hint3: string;
  guide: string;
  courseId?: number;
}

export const DEFAULT_LABS: LabDefinition[] = [
  // ── 1. LINUX (5 ta lab) ──────────────────────────────────────────────────
  {
    id: "lab-linux-1",
    slug: "linux-permissions",
    title: "Fayl Huquqlari va Ruxsatlar (File Permissions)",
    category: "Linux",
    difficulty: "Oson",
    points: 50,
    type: "terminal",
    description:
      "Tizimda `secret_data` nomli katalog mavjud. Ushbu katalog ichidagi `confidential.txt` faylining ruxsat huquqlarini o'rganing va flagni o'qing. Agar huquqlar cheklangan bo'lsa, `chmod` orqali kerakli ruxsatni bering.",
    hint1: "ls -la buyrug'i yordamida fayl huquqlarini tekshiring (-rwxrwxrwx).",
    hint2: "Fayl egasi o'qiy olishi uchun chmod u+r yoki chmod 644 confidential.txt buyrug'ini sinab ko'ring.",
    hint3: "chmod 644 secret_data/confidential.txt && cat secret_data/confidential.txt",
    guide:
      "1. secret_data katalogiga o'ting: cd secret_data\n2. Fayl huquqini ko'ring: ls -l (faylda o'qish huquqi yo'q)\n3. O'qish huquqini bering: chmod 644 confidential.txt\n4. Flagni o'qing: cat confidential.txt",
    courseId: 1,
  },
  {
    id: "lab-linux-2",
    slug: "linux-hidden-files",
    title: "Yashirin Fayllar va Kataloglar (Hidden Files)",
    category: "Linux",
    difficulty: "Oson",
    points: 50,
    type: "terminal",
    description:
      "Administrator tizimda muhim ma'lumotlarni yashirin fayl va kataloglar ichida qoldirgan. Linuxda nuqta (.) bilan boshlanuvchi fayllarni toping va flagni o'qing.",
    hint1: "Oddiy ls buyrug'i nuqta bilan boshlanuvchi fayllarni ko'rsatmaydi.",
    hint2: "Barcha yashirin fayllarni ko'rish uchun `ls -la` yoki `ls -a` flagidan foydalaning.",
    hint3: "cat .secret_folder/..hidden_flag.txt",
    guide:
      "1. ls -la bilan joriy papkadagi yashirin .secret_folder ni toping.\n2. cd .secret_folder\n3. ls -la bilan ..hidden_flag.txt faylini toping va o'qing: cat ..hidden_flag.txt",
    courseId: 1,
  },
  {
    id: "lab-linux-3",
    slug: "linux-grep-find",
    title: "Matn va Fayllarni Qidirish (Grep & Find)",
    category: "Linux",
    difficulty: "O'rta",
    points: 75,
    type: "terminal",
    description:
      "Katta `backup_archives` katalogi ichida yuzlab soxta fayllar va qatorlar bor. `grep` va `find` yordamida aynan `flag{` qatorini o'z ichiga olgan faylni toping.",
    hint1: "Barcha fayllar ichidan rekursiv qidirish uchun `grep -r 'qidiruv_sozi' papka/` ishlatiladi.",
    hint2: "Katta yoki kichik harflarni inobatga olmaslik uchun -i, qator raqamini ko'rish uchun -n qo'shing.",
    hint3: "grep -r 'flag{' backup_archives/",
    guide:
      "1. grep -r 'flag{' backup_archives/ buyrug'i to'g'ridan-to'g'ri kerakli fayl va flagni topadi.",
    courseId: 1,
  },
  {
    id: "lab-linux-4",
    slug: "linux-log-analysis",
    title: "Tizim Jurnallari Tahlili (Log Analysis)",
    category: "Linux",
    difficulty: "Qiyin",
    points: 100,
    type: "terminal",
    description:
      "Serverga uyushtirilgan shubhali kiberhujum bo'yicha `logs/auth.log` faylini tahlil qiling. Hujumchi muvaffaqiyatli kirgan va qoldirgan maxfiy izni toping.",
    hint1: "Log faylida 'Accepted password' yoki 'Failed password' qatorlarini qidiring.",
    hint2: "grep 'Accepted' logs/auth.log yoki grep 'flag' logs/auth.log buyruqlarini sinab ko'ring.",
    hint3: "grep -i 'flag{' logs/auth.log yoki tail -n 50 logs/auth.log",
    guide:
      "1. grep 'Accepted' logs/auth.log orqali so'nggi muvaffaqiyatli seansni va u bilan birga yozilgan flag izohini ko'ring.",
    courseId: 5,
  },
  {
    id: "lab-linux-5",
    slug: "linux-pipe-base64",
    title: "Linux Quvurlari va Base64 (Pipes & Base64)",
    category: "Linux",
    difficulty: "O'rta",
    points: 75,
    type: "terminal",
    description:
      "`encoded_data.txt` faylida Base64 bilan kodlangan ma'lumotlar mavjud. Linux `cat`, `grep` va `base64 -d` quvur (pipe `|`) mexanizmi orqali flagni oching.",
    hint1: "Linuxda bir buyruq natijasini ikkinchisiga uzatish uchun `|` (pipe) belgisi ishlatiladi.",
    hint2: "Base64 matnni ochish uchun `base64 -d` buyrug'i xizmat qiladi.",
    hint3: "cat encoded_data.txt | base64 -d | grep 'flag{'",
    guide:
      "1. cat encoded_data.txt | base64 -d buyrug'ini bering, matn dekodlanadi va flag paydo bo'ladi.",
    courseId: 1,
  },

  // ── 2. KRIPTOGRAFIYA (4 ta lab) ──────────────────────────────────────────
  {
    id: "lab-crypto-1",
    slug: "crypto-caesar",
    title: "Sezar Rotatsiya Shifri (Caesar Cipher)",
    category: "Kriptografiya",
    difficulty: "Oson",
    points: 50,
    type: "static",
    description:
      "Quyidagi xabar Sezar (ROT13) algoritmi orqali siljitib shifrlangan. Uni oching va flagni toping.\n\nShifrlangan matn: `synt{plore_pnrfne_ebg13_qrpelcgvba_fhpprff}`",
    hint1: "Har bir harf alifboda ma'lum qadamga (ROT13 da 13 ta harfga) siljigan.",
    hint2: "Linux terminalida `tr 'A-Za-z' 'N-ZA-Mn-za-m'` yoki CyberChef ROT13 dan foydalanishingiz mumkin.",
    hint3: "Terminalda: echo 'synt{plore_pnrfne_ebg13_qrpelcgvba_fhpprff}' | tr 'A-Za-z' 'N-ZA-Mn-za-m'",
    guide:
      "ROT13 yechilganda flag chiqadi: flag{cyber_caesar_rot13_decryption_success}",
    courseId: 4,
  },
  {
    id: "lab-crypto-2",
    slug: "crypto-base64-hex",
    title: "Ko'p Qatlamli Kodlash (Hex & Base64)",
    category: "Kriptografiya",
    difficulty: "O'rta",
    points: 75,
    type: "static",
    description:
      "Hujumchi maxfiy xabarni ikki qatlamli qilib yashirgan: Avval Hex (o'n oltilik) sanoq sistemasiga, so'ng Base64 ga o'girilgan.\n\nKodlangan matn: `NjY2YzYxNjc3YjYzNzk2MjY1NzI1ZjY4NjU3ODVmMzIzNjM0MzkzMDM3MzMzNDM1MzQzNzdk`",
    hint1: "Avval tashqi qatlamni yeching: Base64 -> Hex matnga aylanadi.",
    hint2: "Keyin Hex matnni ASCII matnga (xxd -r -p yoki CyberChef From Hex) o'giring.",
    hint3: "echo 'NjY2YzYxNjc3YjYzNzk2MjY1NzI1ZjY4NjU3ODVmMzIzNjM0MzkzMDM3MzMzNDM1MzQzNzdk' | base64 -d | xxd -r -p",
    guide:
      "1. base64 -d yordamida hex qator olinadi: 666c61677b63796265725f6865785f32363439303733343534377d\n2. xxd -r -p orqali flag olinadi.",
    courseId: 4,
  },
  {
    id: "lab-crypto-3",
    slug: "crypto-xor",
    title: "Bir Baytli XOR Shifrlash (Single-Byte XOR)",
    category: "Kriptografiya",
    difficulty: "Qiyin",
    points: 100,
    type: "static",
    description:
      "Matn barcha baytlari sirli 1 baytli kalit (0x42) bilan XOR amali yordamida shifrlangan. Hex ko'rinishidagi shifrmatn berilgan:\n\nHex: `242e232539213b2027301d3a2d301d3127213027361d203b36271d29273b1d76703f`",
    hint1: "XOR xossasi: agar A ^ K = C bo'lsa, C ^ K = A bo'ladi.",
    hint2: "Flag 'flag{' bilan boshlanishini bilgan holda, birinchi bayt 0x24 ^ 0x66 ('f') = 0x42 ekanligini hisoblang.",
    hint3: "CyberChef da 'From Hex' -> 'XOR (Key: 42, UTF-8/HEX)' dan foydalaning.",
    guide:
      "1. Kalit: 0x42 (belgi 'B').\n2. Barcha baytlar 0x42 bilan XOR qilinganda flag chiqadi: flag{cyber_xor_secret_byte_key_42}",
    courseId: 4,
  },
  {
    id: "lab-crypto-4",
    slug: "crypto-hash-crack",
    title: "MD5 Parol Xeshini Buzish (Hash Cracking)",
    category: "Kriptografiya",
    difficulty: "O'rta",
    points: 100,
    type: "static",
    description:
      "Administrator bazasidan sizdirilgan MD5 xeshi berilgan:\n\nMD5: `5ebe2294ecd0e0f08eab7690d2a6ee69`\n\nLug'at (wordlist) yoki mashhur xesh bazalari yordamida asl parolni toping va `flag{parol}` formatida yuboring.",
    hint1: "MD5 bir tomonlama funksiya, uni faqat lug'at (rainbow table / brute-force) bilan buzish mumkin.",
    hint2: "CrackStation, CyberChef yoki md5decrypt vositalarini sinab ko'ring.",
    hint3: "Ushbu xesh ingliz tilidagi eng mashhur so'zlardan biriga ('secret') tegishli.",
    guide:
      "1. MD5 xeshni CrackStation.net ga kiritamiz.\n2. Natija: 'secret'.\n3. Flag: flag{secret}",
    courseId: 4,
  },

  // ── 3. WEB (4 ta izolyatsiyalangan lab) ───────────────────────────────────
  {
    id: "lab-web-1",
    slug: "web-xss",
    title: "Reflected XSS va Cookie/DOM Tahlili",
    category: "Web",
    difficulty: "O'rta",
    points: 100,
    type: "web-instance",
    description:
      "Mehmonlar qidiruvi sahifasida Reflected XSS zaifligi mavjud. Qidiruv shakliga kiruvchi parametrlarni tahlil qiling va sahifadagi maxfiy administrator cookie'sidagi flagni oling.",
    hint1: "Qidiruv maydoniga `<script>` yoki `<img>` tegi kiritib ko'ring.",
    hint2: "Brauzer konsolini (F12) oching va `document.cookie` qiymatini tekshiring.",
    hint3: "Brauzer DevTools -> Application -> Cookies bo'limidan `secret_flag` nomli cookie qiymatini oling.",
    guide:
      "1. Web lab instansiyasini ishga tushiring.\n2. F12 orqali Console'da `document.cookie` ni ko'ring.\n3. Undagi `secret_flag=flag{...}` ni nusxalang.",
    courseId: 3,
  },
  {
    id: "lab-web-2",
    slug: "web-sqli",
    title: "SQL Injection: UNION Qidiruv Hujumi",
    category: "Web",
    difficulty: "Qiyin",
    points: 120,
    type: "web-instance",
    description:
      "Elektron kutubxona qidiruvida zaif SQL so'rovi mavjud. UNION SELECT operatori orqali maxfiy `secrets` jadvalidagi flagni chiqarib oling.",
    hint1: "Klassik tirnoq belgisini kiritib SQL xatoligini qo'zg'ating: `'`.",
    hint2: "Kutubxona jadvali 3 ta ustunga ega: id, title, author. `UNION SELECT 1, 2, 3` so'rovini sinab ko'ring.",
    hint3: "' UNION SELECT 1, flag_val, 'admin' FROM secrets --",
    guide:
      "1. Qidiruv maydoniga `' UNION SELECT 1, flag_val, 'secret' FROM secrets --` kiritiladi.\n2. Ekranda flag paydo bo'ladi.",
    courseId: 3,
  },
  {
    id: "lab-web-3",
    slug: "web-idor",
    title: "IDOR: Boshqa Foydalanuvchi Profiliga Kirish",
    category: "Web",
    difficulty: "O'rta",
    points: 100,
    type: "web-instance",
    description:
      "Talabalar profili tizimida avtorizatsiya tekshiruvi yetarli emas. Oddiy talaba (ID: 104) nomidan so'rov yuborilyapti, ammo parametrdagi ID ni o'zgartirib administratorning maxfiy ma'lumotlarini oling.",
    hint1: "Sahifa qaysi API oxirgi nuqtasidan ma'lumot olayotganiga e'tibor bering: `/api/user?id=104`.",
    hint2: "Brauzer manzil satrida yoki tarmoq (Network) so'rovida `id=1` yoki `id=admin` qilib ko'ring.",
    hint3: "URL manziliga `/api/user?id=1` deb yozing va JSON javobdagi `confidential_note` dan flagni oling.",
    guide:
      "1. Brauzerda `/api/user?id=1` ga o'ting.\n2. Chiqqan JSON ichidagi confidential_note flagini oling.",
    courseId: 3,
  },
  {
    id: "lab-web-4",
    slug: "web-exposed-files",
    title: "Ochiq Qoldirilgan Konfiguratsiya Fayllari",
    category: "Web",
    difficulty: "Oson",
    points: 80,
    type: "web-instance",
    description:
      "Administrator serverda qidiruv tizimlaridan yashirish uchun fayllar ro'yxatini qoldirgan. Standart qoidalarga muvofiq ochiq qolgan backup yoki konfiguratsiyani toping.",
    hint1: "Qidiruv robotlari saytga kirganda avval qaysi faylni tekshiradi?",
    hint2: "Sayt manziliga `/robots.txt` qo'shib kiring va taqiqlangan yo'llarni ko'ring.",
    hint3: "robots.txt dagi `/.backup_secrets_2026/db.env` fayliga kiring.",
    guide:
      "1. `/robots.txt` ni oching.\n2. Undagi `/.backup_secrets_2026/` manziliga o'ting.\n3. `db.env` ichidagi FLAG_PRODUCTION ni oling.",
    courseId: 3,
  },

  // ── 4. TARMOQ (2 ta lab) ─────────────────────────────────────────────────
  {
    id: "lab-net-1",
    slug: "net-nmap-audit",
    title: "Nmap Port Skanerlash va Zaif Xizmatlar",
    category: "Tarmoq",
    difficulty: "O'rta",
    points: 75,
    type: "terminal",
    description:
      "Serverda oldin o'tkazilgan tarmoq auditi natijalari `network/nmap_scan.txt` faylida saqlangan. Natijalarni tahlil qiling va 1337 portida ishlayotgan xizmat banneridagi flagni toping.",
    hint1: "`network/nmap_scan.txt` faylini ko'rish uchun `cat` yoki `less` ishlating.",
    hint2: "grep '1337' network/nmap_scan.txt yoki banner qatorlarini qidiring.",
    hint3: "cat network/nmap_scan.txt | grep -A 5 '1337/tcp'",
    guide:
      "1. cat network/nmap_scan.txt | grep 'flag{' orqali 1337-portdagi xizmat banneridan flag olinadi.",
    courseId: 2,
  },
  {
    id: "lab-net-2",
    slug: "net-pcap-analysis",
    title: "Tarmoq Trafigi Tahlili (Traffic Sniffing)",
    category: "Tarmoq",
    difficulty: "Qiyin",
    points: 100,
    type: "terminal",
    description:
      "`network/capture_traffic.log` faylida ushlangan ochiq HTTP va FTP trafigi mavjud. Hujjat ichidan ochiq matn ko'rinishida yuborilgan autentifikatsiya ma'lumotlarini va flagni aniqlang.",
    hint1: "Ochiq matnli protokollarda (HTTP, FTP) parollar 'USER', 'PASS' yoki 'Authorization' qatorlarida ketadi.",
    hint2: "grep -i 'pass' network/capture_traffic.log yoki grep 'flag{' qilib ko'ring.",
    hint3: "grep -i 'flag{' network/capture_traffic.log",
    guide:
      "1. grep 'flag{' network/capture_traffic.log buyrug'i orqali ochiq HTTP POST so'rovidagi flag olinadi.",
    courseId: 2,
  },
];
