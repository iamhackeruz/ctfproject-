/**
 * Muhit o'zgaruvchilari va sirlarining xavfsizlik talablariga mosligini tekshirish.
 * OWASP va Production Xavfsizlik Talablari:
 * 1. NODE_ENV === "production" bo'lganda ALLOW_TEST_ACCOUNTS=true bo'lishi qat'iyan taqiqlanadi.
 * 2. SESSION_SECRET, FLAG_SECRET, DAEMON_SECRET, TOTP_ENCRYPTION_KEY, CRON_SECRET, ADMIN_RESET_TOKEN mavjud va kamida 32 belgi.
 * 3. Barcha sirlar bir-biridan butunlay farqli (o'zaro unikal) bo'lishi shart.
 * 4. Sirlar andoza / placeholder (default) qiymatlarga ega bo'lmasligi shart.
 * 5. DATABASE_URL paroli kamida 16 belgidan iborat kuchli parol bo'lishi shart.
 */

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
}

const FORBIDDEN_PLACEHOLDER_SUBSTRINGS = [
  "change-in-prod",
  "supersecret",
  "change_me",
  "default_secret",
  "placeholder",
  "example",
  "12345678",
  "cyberedu_secret_pass_2026",
];

export function validateEnvSecrets(customEnv?: NodeJS.ProcessEnv): EnvValidationResult {
  const env = customEnv || process.env;
  const errors: string[] = [];
  const isProd = env.NODE_ENV === "production";

  const sessionSecret = (env.SESSION_SECRET || "").trim();
  const flagSecret = (env.FLAG_SECRET || "").trim();
  const daemonSecret = (env.DAEMON_SECRET || env.SIDECAR_SECRET || "").trim();
  const totpKey = (env.TOTP_ENCRYPTION_KEY || "").trim();
  const cronSecret = (env.CRON_SECRET || "").trim();
  const adminResetToken = (env.ADMIN_RESET_TOKEN || "").trim();
  const dbUrl = (env.DATABASE_URL || "").trim();
  const allowTestAccounts = (env.ALLOW_TEST_ACCOUNTS || "").trim().toLowerCase();

  // 1. Production rejimida ALLOW_TEST_ACCOUNTS tekshiruvi
  if (isProd && (allowTestAccounts === "true" || allowTestAccounts === "1" || allowTestAccounts === "yes")) {
    errors.push("Production muhitida ALLOW_TEST_ACCOUNTS=true bo'lishi qat'iyan taqiqlanadi! Test hisoblariga ruxsat faqat development muhitida mumkin.");
  }

  // 2. Har bir sirning mavjudligi va uzunligi
  const secretEntries = [
    { name: "SESSION_SECRET", val: sessionSecret, requiredInDev: true, minLen: 32 },
    { name: "FLAG_SECRET", val: flagSecret, requiredInDev: true, minLen: 32 },
    { name: "DAEMON_SECRET", val: daemonSecret, requiredInDev: true, minLen: 32 },
    { name: "TOTP_ENCRYPTION_KEY", val: totpKey, requiredInDev: false, minLen: 32 },
    { name: "CRON_SECRET", val: cronSecret, requiredInDev: false, minLen: 32 },
    { name: "ADMIN_RESET_TOKEN", val: adminResetToken, requiredInDev: false, minLen: 32 },
  ];

  for (const s of secretEntries) {
    const isRequired = isProd || s.requiredInDev;
    if (isRequired && !s.val) {
      errors.push(`${s.name} muhit o'zgaruvchisi topilmadi${isProd ? " (Production'da majburiy)" : ""}`);
    } else if (s.val && s.val.length < s.minLen) {
      errors.push(`${s.name} yetarli darajada uzun emas (${s.val.length} < ${s.minLen})`);
    }

    // Production'da andoza / placeholder sirlardan foydalanish taqiqlanadi
    if (isProd && s.val) {
      const lower = s.val.toLowerCase();
      for (const placeholder of FORBIDDEN_PLACEHOLDER_SUBSTRINGS) {
        if (lower.includes(placeholder)) {
          errors.push(`${s.name} xavfli andoza (placeholder: '${placeholder}') qiymatni o'z ichiga olgan. Haqiqiy tasodifiy sir qo'yilishi shart!`);
          break;
        }
      }
    }
  }

  // 3. Sirlarning bir-biridan farqli (o'zaro unikal) ekanligi
  const activeSecrets = secretEntries.filter((s) => s.val.length > 0);
  for (let i = 0; i < activeSecrets.length; i++) {
    for (let j = i + 1; j < activeSecrets.length; j++) {
      if (activeSecrets[i].val === activeSecrets[j].val) {
        errors.push(`${activeSecrets[i].name} va ${activeSecrets[j].name} bir xil bo'lishi mumkin emas! Har bir sir alohida unikal bo'lishi shart.`);
      }
    }
  }

  // 4. Ma'lumotlar bazasi URL'i va paroli tekshiruvi
  if (!dbUrl) {
    errors.push("DATABASE_URL muhit o'zgaruvchisi topilmadi");
  } else if (!dbUrl.includes(":") || !dbUrl.includes("@")) {
    errors.push("DATABASE_URL parolsiz yoki noto'g'ri formatda");
  } else {
    // Parolni ajratib olish: proto://user:password@host...
    const match = dbUrl.match(/^[a-zA-Z0-9+]+:\/\/[^:]+:([^@]+)@/);
    if (!match || !match[1]) {
      errors.push("DATABASE_URL tarkibida foydalanuvchi paroli aniqlanmadi");
    } else {
      const dbPassword = decodeURIComponent(match[1]);
      if (isProd) {
        if (dbPassword.length < 16) {
          errors.push(`DATABASE_URL dagi ma'lumotlar bazasi paroli yetarli darajada xavfsiz emas (${dbPassword.length} < 16 belgi)`);
        }
        const lowerDbPass = dbPassword.toLowerCase();
        for (const placeholder of FORBIDDEN_PLACEHOLDER_SUBSTRINGS) {
          if (lowerDbPass.includes(placeholder)) {
            errors.push(`DATABASE_URL dagi ma'lumotlar bazasi paroli andoza ('${placeholder}') bo'lmasligi shart!`);
            break;
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Tizim yuklanishida tekshirish (agarda xato bo'lsa va production bo'lsa ishga tushishni to'xtatadi)
 */
export function assertEnvSecrets(customEnv?: NodeJS.ProcessEnv): void {
  const result = validateEnvSecrets(customEnv);
  const env = customEnv || process.env;
  if (!result.valid) {
    const errorMsg = `\n❌ [XAVFSIZLIK XATOSI] Muhit sirlari xavfsizlik talablariga javob bermaydi:\n - ${result.errors.join("\n - ")}\n`;
    console.error(errorMsg);

    // Docker image yig'ish (next build) vaqtida sirlar konteyner qatlamiga tushib qolmasligi uchun
    // faqat ogohlantirish beramiz. Runtime'da (server ishga tushganda yoki testlarda) esa qat'iy to'xtatamiz.
    const isBuildPhase =
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.npm_lifecycle_event === "build";

    if (env.NODE_ENV === "production" && !isBuildPhase) {
      throw new Error(`Kritik xavfsizlik: Sirlar noto'g'ri sozlanganligi sababli tizim to'xtatildi:\n - ${result.errors.join("\n - ")}`);
    }
  }
}
