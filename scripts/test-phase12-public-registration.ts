try {
  process.loadEnvFile();
} catch {}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require("module");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request: string, parent: unknown, isMain: boolean, options: unknown) {
  if (request.startsWith("@/")) {
    const sub = request.slice(2);
    const resolvedPath = path.resolve(__dirname, "../src", sub);
    return origResolve.call(this, resolvedPath, parent, isMain, options);
  }
  return origResolve.call(this, request, parent, isMain, options);
};

import { chromium, Browser, BrowserContext } from "playwright";
import { prisma } from "../src/lib/db";
import { Role } from "@prisma/client";
import { hashPassword } from "../src/lib/security/password";
import { generateVerificationToken, pruneUnverifiedAccounts } from "../src/lib/services/email-verification";

let passCount = 0;
let failCount = 0;

function assert(condition: unknown, msg: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${msg}`);
    failCount++;
    throw new Error(`Assertion failed: ${msg}`);
  }
  passCount++;
  console.log(`  ✅ [PASS] ${msg}`);
}

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

async function main() {
  console.log("\n========================================================");
  console.log("   12-BOSQICH: OCHIQ RO'YXATDAN O'TISH & EMAIL VERIFIKATSIYA TESTLARI");
  console.log("========================================================\n");

  const ts = Date.now();
  const testPassword = "Password#Secure2026!";

  // ──────────────────────────────────────────────────────────
  // 1. DEFAULT: ALLOW_PUBLIC_REGISTRATION=false
  // ──────────────────────────────────────────────────────────
  console.log("--- 1. Standart holatda ochiq ro'yxatdan o'tish yopiqligi (Default OFF) ---");

  const noInviteRes = await fetch(`${BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "register",
      name: "Default NoInvite",
      email: `noinvite_${ts}@cyberedu.uz`,
      password: testPassword,
    }),
  });
  const noInviteData = await noInviteRes.json();
  assert(noInviteRes.status === 403, "Taklif kodisiz ochiq ro'yxatdan o'tish 403 bilan rad etildi (default OFF)");
  assert(noInviteData.error && noInviteData.error.includes("yopiq"), "Xato xabarida ochiq ro'yxatdan o'tish yopiqligi ko'rsatildi");

  // ──────────────────────────────────────────────────────────
  // 2. TAKLIF KODI BILAN RO'YXATDAN O'TISH DARHOL FAOLLASHISHI
  // ──────────────────────────────────────────────────────────
  console.log("\n--- 2. Taklif kodi orqali ro'yxatdan o'tish (Darhol emailVerified: true) ---");
  const inviteCodeStr = `INV_${ts}`;
  const inviteCode = await prisma.invitationCode.create({
    data: {
      code: inviteCodeStr,
      maxUses: 5,
      usedCount: 0,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdBy: "test-admin",
    },
  });

  const inviteRegEmail = `invite_student_${ts}@cyberedu.uz`;
  const inviteRegRes = await fetch(`${BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "register",
      name: "Invite Student",
      email: inviteRegEmail,
      password: testPassword,
      inviteCode: inviteCodeStr,
    }),
  });
  const inviteRegData = await inviteRegRes.json();
  assert(inviteRegRes.ok && inviteRegData.success, "Taklif kodi bilan ro'yxatdan o'tish muvaffaqiyatli o'tdi");

  const createdInviteUser = await prisma.user.findUnique({
    where: { email: inviteRegEmail },
  });
  assert(createdInviteUser !== null, "Taklif kodi orqali foydalanuvchi bazada yaratildi");
  assert(createdInviteUser?.emailVerified === true, "Taklif kodi orqali yaratilgan foydalanuvchi darhol emailVerified=true");
  assert(createdInviteUser?.verificationTokenHash === null, "Taklif kodi foydalanuvchisida verificationTokenHash yo'q");

  // ──────────────────────────────────────────────────────────
  // 3. OCHIQ RO'YXATDAN O'TISH FAOLLASHTIRILGANDA (ALLOW_PUBLIC_REGISTRATION=true)
  // ──────────────────────────────────────────────────────────
  console.log("\n--- 3. ALLOW_PUBLIC_REGISTRATION=true himoyalari ---");
  const publicTestIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
  const publicHeaders = {
    "Content-Type": "application/json",
    "x-test-allow-public-reg": "true",
    "x-forwarded-for": publicTestIp,
  };

  // 3.1 Anti-enumeration (Mavjud email bilan ro'yxatdan o'tish bir xil javob qaytaradi)
  console.log("\n--- 3.1 Anti-enumeration tekshiruvi ---");
  const existingEmailRes = await fetch(`${BASE_URL}/api/auth`, {
    method: "POST",
    headers: publicHeaders,
    body: JSON.stringify({
      action: "register",
      name: "Existing Person",
      email: inviteRegEmail, // Mavjud email
      password: testPassword,
      captchaToken: "test-captcha-token-valid",
    }),
  });
  const existingEmailData = await existingEmailRes.json();
  assert(existingEmailRes.status === 200 && existingEmailData.success, "Mavjud email bilan ro'yxatdan o'tish 200 OK qaytardi");
  assert(
    existingEmailData.requiresEmailVerification === true,
    "Anti-enumeration: requiresEmailVerification=true qaytarilib email mavjudligi fosh qilinmadi"
  );
  assert(
    existingEmailData.message.includes("Tasdiqlash havolasi"),
    "Anti-enumeration: standart bir xil xabar qaytarildi"
  );

  // 3.2 Muvaffaqiyatli ochiq ro'yxatdan o'tish (emailVerified=false, token yaratildi)
  console.log("\n--- 3.2 Yangi talaba ochiq ro'yxatdan o'tishi ---");
  const publicEmail = `public_student_${ts}@cyberedu.uz`;
  const publicRegRes = await fetch(`${BASE_URL}/api/auth`, {
    method: "POST",
    headers: publicHeaders,
    body: JSON.stringify({
      action: "register",
      name: "Public Student",
      email: publicEmail,
      password: testPassword,
      captchaToken: "test-captcha-token-valid",
    }),
  });
  const publicRegData = await publicRegRes.json();
  assert(publicRegRes.ok && publicRegData.success, "Ochiq ro'yxatdan o'tish so'rovi muvaffaqiyatli qabul qilindi");
  assert(publicRegData.requiresEmailVerification === true, "requiresEmailVerification=true qaytarildi");

  const unverifiedUser = await prisma.user.findUnique({
    where: { email: publicEmail },
  });
  assert(unverifiedUser !== null, "Foydalanuvchi ma'lumotlar bazasida yaratildi");
  assert(unverifiedUser?.emailVerified === false, "Foydalanuvchining emailVerified qiymati false");
  assert(
    typeof unverifiedUser?.verificationTokenHash === "string" && unverifiedUser.verificationTokenHash.length === 64,
    "SHA-256 xeshlangan tasdiqlash tokeni saqlandi"
  );
  assert(
    unverifiedUser?.verificationExpires !== null && unverifiedUser!.verificationExpires > new Date(),
    "Tasdiqlash tokeni muddati (30 daqiqa) to'g'ri o'rnatildi"
  );
  assert(
    unverifiedUser?.dailyTerminalQuotaMinutes === 60 && unverifiedUser?.dailyLabQuotaMinutes === 30,
    "Ochiq ro'yxatdan o'tgan foydalanuvchiga cheklangan standart kvotalar berildi (60/30 daqiqa)"
  );

  // 3.3 Tasdiqlanmagan foydalanuvchi tizimga kira olmasligi (403 Forbidden)
  console.log("\n--- 3.3 Tasdiqlanmagan hisob login to'sig'i ---");
  const unverifiedLoginRes = await fetch(`${BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "login",
      emailOrUsername: publicEmail,
      password: testPassword,
    }),
  });
  const unverifiedLoginData = await unverifiedLoginRes.json();
  assert(unverifiedLoginRes.status === 403, "Tasdiqlanmagan hisob login qilganda 403 qaytarildi");
  assert(
    unverifiedLoginData.error && unverifiedLoginData.error.includes("tasdiqlanmagan"),
    "Xato xabarida pochtani tasdiqlash talab qilindi"
  );

  // 3.4 IP bo'yicha kunlik ro'yxatdan o'tishlar limiti (max 3/day)
  console.log("\n--- 3.4 IP bo'yicha kunlik limit (429 Too Many Requests) ---");
  const dummyIp = `192.0.2.${Math.floor(Math.random() * 200) + 10}`;

  await prisma.user.createMany({
    data: [
      {
        email: `iplimit1_${ts}@cyberedu.uz`,
        name: "IP Test 1",
        passwordHash: await hashPassword(testPassword),
        role: Role.student,
        registrationIp: dummyIp,
        createdAt: new Date(),
      },
      {
        email: `iplimit2_${ts}@cyberedu.uz`,
        name: "IP Test 2",
        passwordHash: await hashPassword(testPassword),
        role: Role.student,
        registrationIp: dummyIp,
        createdAt: new Date(),
      },
      {
        email: `iplimit3_${ts}@cyberedu.uz`,
        name: "IP Test 3",
        passwordHash: await hashPassword(testPassword),
        role: Role.student,
        registrationIp: dummyIp,
        createdAt: new Date(),
      },
    ],
  });

  const ipLimitRes = await fetch(`${BASE_URL}/api/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-test-allow-public-reg": "true",
      "x-forwarded-for": dummyIp,
    },
    body: JSON.stringify({
      action: "register",
      name: "IP Test Exceeded",
      email: `iplimit_exceeded_${ts}@cyberedu.uz`,
      password: testPassword,
      captchaToken: "test-captcha-token-valid",
    }),
  });
  const ipLimitData = await ipLimitRes.json();
  assert(ipLimitRes.status === 429, "Kunlik 3 tadan oshiq ro'yxatdan o'tish 429 bilan to'xtatildi");
  assert(ipLimitData.error && ipLimitData.error.includes("limitdan oshdi"), "IP limiti haqida aniq ogohlantirish berildi");

  // ──────────────────────────────────────────────────────────
  // 4. VERIFIKATSIYA TOKENI ENDPOINTI (/api/auth/verify-email)
  // ──────────────────────────────────────────────────────────
  console.log("\n--- 4. /api/auth/verify-email xavfsizligi ---");

  // 4.1 Yaroqsiz token
  const badTokenRes = await fetch(`${BASE_URL}/api/auth/verify-email?token=invalid_dummy_token_123`);
  assert(badTokenRes.status === 400, "Mavjud bo'lmagan token 400 qaytardi");

  // 4.2 Muddati o'tgan token
  const { rawToken: expiredRaw, tokenHash: expiredHash } = generateVerificationToken();
  const expiredEmail = `expired_${ts}@cyberedu.uz`;
  await prisma.user.create({
    data: {
      email: expiredEmail,
      name: "Expired Student",
      passwordHash: await hashPassword(testPassword),
      role: Role.student,
      emailVerified: false,
      verificationTokenHash: expiredHash,
      verificationExpires: new Date(Date.now() - 60 * 1000), // 1 daqiqa oldin o'tgan
    },
  });

  const expiredRes = await fetch(`${BASE_URL}/api/auth/verify-email?token=${expiredRaw}`);
  const expiredData = await expiredRes.json();
  assert(expiredRes.status === 400, "Muddati o'tgan token 400 qaytardi");
  assert(expiredData.error && expiredData.error.includes("tugagan"), "Muddati o'tganligi haqida xabar berildi");

  // 4.3 Haqiqiy token bilan tasdiqlash
  const { rawToken: validRaw, tokenHash: validHash, expiresAt: validExp } = generateVerificationToken();
  const validEmail = `valid_verify_${ts}@cyberedu.uz`;
  const createdForVerify = await prisma.user.create({
    data: {
      email: validEmail,
      name: "Valid Student",
      passwordHash: await hashPassword(testPassword),
      role: Role.student,
      emailVerified: false,
      verificationTokenHash: validHash,
      verificationExpires: validExp,
    },
  });

  const verifySuccessRes = await fetch(`${BASE_URL}/api/auth/verify-email?token=${validRaw}`);
  const verifySuccessData = await verifySuccessRes.json();
  assert(verifySuccessRes.ok && verifySuccessData.success, "Haqiqiy token bilan pochtani tasdiqlash 200 OK bo'ldi");

  // Bazadagi holatni tekshirish
  const updatedVerifiedUser = await prisma.user.findUnique({
    where: { id: createdForVerify.id },
  });
  assert(updatedVerifiedUser?.emailVerified === true, "Bazada emailVerified=true ga o'zgardi");
  assert(updatedVerifiedUser?.verificationTokenHash === null, "Ishlatilgan token xeshi null ga tozalandi");
  assert(updatedVerifiedUser?.verificationExpires === null, "verificationExpires tozalandi");

  // 4.4 Replay attack: Ishlatilgan tokenni qayta yuborish
  const replayRes = await fetch(`${BASE_URL}/api/auth/verify-email?token=${validRaw}`);
  assert(replayRes.status === 400, "Ishlatilgan tokenni qayta yuborish (replay) 400 bilan rad etildi");

  // 4.5 Tasdiqlangan foydalanuvchi endi login qila olishi
  const nowLoginRes = await fetch(`${BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "login",
      emailOrUsername: validEmail,
      password: testPassword,
    }),
  });
  const nowLoginData = await nowLoginRes.json();
  assert(nowLoginRes.ok && nowLoginData.success, "Pochtasi tasdiqlangan foydalanuvchi tizimga muvaffaqiyatli kirdi");

  // ──────────────────────────────────────────────────────────
  // 5. 7 KUNDAN OSHGAN TASDIQLANMAGAN HISOBLARNI TOZALASH (PRUNING)
  // ──────────────────────────────────────────────────────────
  console.log("\n--- 5. 7 kundan oshgan hisoblarni avtomatik tozalash (Pruning) ---");
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  // Eski tasdiqlanmagan
  const oldUnverified = await prisma.user.create({
    data: {
      email: `old_unverified_${ts}@cyberedu.uz`,
      name: "Old Unverified",
      passwordHash: await hashPassword(testPassword),
      role: Role.student,
      emailVerified: false,
      createdAt: eightDaysAgo,
    },
  });

  // Yangi tasdiqlanmagan
  const freshUnverified = await prisma.user.create({
    data: {
      email: `fresh_unverified_${ts}@cyberedu.uz`,
      name: "Fresh Unverified",
      passwordHash: await hashPassword(testPassword),
      role: Role.student,
      emailVerified: false,
      createdAt: twoDaysAgo,
    },
  });

  // Eski tasdiqlangan (o'chirilmasligi kerak!)
  const oldVerified = await prisma.user.create({
    data: {
      email: `old_verified_${ts}@cyberedu.uz`,
      name: "Old Verified",
      passwordHash: await hashPassword(testPassword),
      role: Role.student,
      emailVerified: true,
      createdAt: eightDaysAgo,
    },
  });

  const prunedCount = await pruneUnverifiedAccounts();
  assert(prunedCount >= 1, "pruneUnverifiedAccounts() kamida 1 ta eski hisobni tozaladi");

  const checkOldUnverified = await prisma.user.findUnique({ where: { id: oldUnverified.id } });
  const checkFreshUnverified = await prisma.user.findUnique({ where: { id: freshUnverified.id } });
  const checkOldVerified = await prisma.user.findUnique({ where: { id: oldVerified.id } });

  assert(checkOldUnverified === null, "8 kunlik tasdiqlanmagan hisob bazadan o'chirildi");
  assert(checkFreshUnverified !== null, "2 kunlik tasdiqlanmagan hisob saqlanib qoldi");
  assert(checkOldVerified !== null, "8 kunlik tasdiqlangan hisob HECH QACHON o'chirilmadi");

  // ──────────────────────────────────────────────────────────
  // 6. PLAYWRIGHT BRAUZER TESTI (UI Verification Flow)
  // ──────────────────────────────────────────────────────────
  console.log("\n--- 6. Playwright E2E: Ro'yxatdan o'tish va Brauzer orqali tasdiqlash ---");
  const browser: Browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  const pwTestIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;

  // /api/auth so'rovlariga test headerlarini ulash (CORS xatosi bo'lmasligi uchun faqat ichki endpointga)
  await page.route("**/api/auth**", (route) => {
    const headers = {
      ...route.request().headers(),
      "x-test-allow-public-reg": "true",
      "x-forwarded-for": pwTestIp,
    };
    route.continue({ headers });
  });

  try {
    const pwEmail = `pw_user_${ts}@cyberedu.uz`;

    // 6.1 Ro'yxatdan o'tish sahifasini ochish
    await page.goto(`${BASE_URL}/register`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("form");
    assert(page.url().includes("/register"), "Brauzer /register sahifasiga o'tdi");

    // Formani to'ldirish
    await page.fill("#reg-firstname", "Ali");
    await page.fill("#reg-lastname", "Valiyev");
    await page.fill("#reg-email", pwEmail);
    await page.fill("#reg-password", "Alisher#Security2026!");

    // Yuborish tugmasi
    await page.click("#btn-register");

    // Email tasdiqlash xabarnomasi paydo bo'lishini kutish
    await page.waitForSelector("text=Elektron Pochtani Tasdiqlang", { timeout: 10000 });
    assert(await page.isVisible("text=Elektron Pochtani Tasdiqlang"), "UIda elektron pochtani tasdiqlash oynasi chiqdi");

    // Bazadan ushbu foydalanuvchini va verification token xeshini topamiz
    const pwUser = await prisma.user.findUnique({
      where: { email: pwEmail },
    });
    assert(pwUser !== null && pwUser.emailVerified === false, "Foydalanuvchi bazada emailVerified: false holatda");

    // Test token generatsiya qilib bazaga biriktiramiz va shu havola orqali brauzerda ochamiz
    const pwTokenPair = generateVerificationToken();
    await prisma.user.update({
      where: { id: pwUser!.id },
      data: {
        verificationTokenHash: pwTokenPair.tokenHash,
        verificationExpires: pwTokenPair.expiresAt,
      },
    });

    // 6.2 Brauzerda /verify-email sahifasiga o'tish
    await page.goto(`${BASE_URL}/verify-email?token=${pwTokenPair.rawToken}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Muvaffaqiyatli Tasdiqlandi!", { timeout: 10000 });
    assert(await page.isVisible("text=Muvaffaqiyatli Tasdiqlandi!"), "UIda 'Muvaffaqiyatli Tasdiqlandi!' yozuvi ko'rindi");

    // Login tugmasini bosish
    await page.click('a:has-text("Tizimga Kirish (Login)")');
    await page.waitForURL("**/login", { timeout: 5000 });
    assert(page.url().includes("/login"), "Foydalanuvchi /login sahifasiga o'tdi");

    // Tizimga kirish
    await page.fill("#login-email", pwEmail);
    await page.fill("#login-password", "Alisher#Security2026!");
    await page.click("#btn-login");

    // Dashboardga o'tishni kutish
    await page.waitForURL("**/dashboard**", { timeout: 10000 });
    assert(page.url().includes("/dashboard"), "Pochtasi tasdiqlangan foydalanuvchi to'g'ridan-to'g'ri /dashboardga kirdi");

  } finally {
    await browser.close();
  }

  // Tozalash
  await prisma.invitationCode.delete({ where: { id: inviteCode.id } }).catch(() => {});

  console.log("\n========================================================");
  console.log(`   12-BOSQICH NATIJALARI: PASS: ${passCount} | FAIL: ${failCount}`);
  console.log("========================================================\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in test-phase12-public-registration:", err);
  process.exit(1);
});
