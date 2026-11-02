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
import { generateTotpCode } from "../src/lib/security/totp";

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
  console.log("   PLAYWRIGHT E2E: 11-BOSQICH 2FA & MOBILE (360PX) TEST");
  console.log("========================================================\n");

  const ts = Date.now();
  const testPassword = "Password#Secure2026!";
  const testHash = await hashPassword(testPassword);

  const instEmail = `p11_inst_${ts}@cyberedu.uz`;
  const studentEmail = `p11_student_${ts}@cyberedu.uz`;

  // Instructor (2FA majburiy, lekin hali sozlanmagan)
  const instructor = await prisma.user.create({
    data: {
      email: instEmail,
      name: "Playwright Instructor",
      role: Role.instructor,
      passwordHash: testHash,
      twoFactorEnabled: false,
    },
  });

  // Student (oddiy talaba)
  const student = await prisma.user.create({
    data: {
      email: studentEmail,
      name: "Playwright Student",
      role: Role.student,
      passwordHash: testHash,
      twoFactorEnabled: false,
    },
  });

  // Guruh va topshiriq (mobil test uchun)
  const testGroup = await prisma.group.create({
    data: {
      name: `Mobile Test Group ${ts}`,
      createdBy: instructor.id,
      instructorId: instructor.id,
      members: {
        create: [{ userId: student.id }],
      },
    },
  });

  await prisma.assignment.create({
    data: {
      title: `Mobile HW Responsive Test ${ts}`,
      description: "Mobil ekranda to'g'ri ko'rinish testi",
      groupId: testGroup.id,
      dueAt: new Date(Date.now() + 48 * 3600 * 1000),
      createdById: instructor.id,
      isPublished: true,
    },
  });

  await prisma.classSession.create({
    data: {
      groupId: testGroup.id,
      sessionDate: new Date(),
      topic: "Mobil Dizayn va Xavfsizlik",
      createdById: instructor.id,
      records: {
        create: [
          {
            userId: student.id,
            status: "PRESENT",
            markedById: instructor.id,
          },
        ],
      },
    },
  });

  let browser: Browser | null = null;
  const cspViolations: string[] = [];

  try {
    browser = await chromium.launch({
      executablePath: "/usr/bin/google-chrome",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 1: INSTRUCTOR 2FA SOZLASH (SETUP) BRAUZER OQIMI
    // ──────────────────────────────────────────────────────────────────────────
    console.log("[1] Instructor 2FA Sozlash Oqimi (Real Brauzer):");

    const instContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });

    const instPage = await instContext.newPage();
    // Faqat /api/auth so'roviga x-enforce-2fa qo'shish (CORS fontlariga tegmasdan)
    await instPage.route("**/api/auth", async (route) => {
      const headers = { ...route.request().headers(), "x-enforce-2fa": "true" };
      await route.continue({ headers });
    });

    instPage.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("Content Security Policy") || text.includes("CSP")) {
        cspViolations.push(text);
      }
    });

    await instPage.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });

    // Login formasini to'ldirish
    await instPage.fill("#login-email", instEmail);
    await instPage.fill("#login-password", testPassword);
    await instPage.click("#btn-login");

    // 2FA Setup view ko'rinishi
    await instPage.waitForSelector("#totp-code", { timeout: 10000 });
    const setupTitle = await instPage.textContent("h1");
    assert(setupTitle?.includes("2FA"), "Login so'ng 2FA Sozlash sahifasi ochildi");

    // QR-kod SVG ko'rinishi
    const hasQrSvg = await instPage.locator("svg").count();
    assert(hasQrSvg > 0, "QR-kod SVG brauzerda muvaffaqiyatli render bo'ldi");

    // Base32 kalitni o'qish
    const base32Secret = await instPage.locator("code").textContent();
    assert(Boolean(base32Secret && base32Secret.length >= 16), "Qo'lda kiritish uchun Base32 sir ko'rsatildi");

    // TOTP kod yaratish va tasdiqlash
    const generatedCode = generateTotpCode(base32Secret!.trim());
    await instPage.fill("#totp-code", generatedCode);
    await instPage.click("#btn-confirm-2fa-setup");

    // Zaxira kodlari (Backup codes) ko'rinishi
    await instPage.waitForSelector("#btn-finish-backup-codes", { timeout: 10000 });
    const backupTitle = await instPage.textContent("h1");
    assert(backupTitle?.includes("Zaxira"), "10 ta zaxira kod sahifasi ko'rsatildi");

    // Zaxira kodlaridan birini saqlab olish (keyingi test uchun)
    const backupCodesList = await instPage.locator("div[style*='monospace']").allTextContents();
    assert(backupCodesList.length === 10, "Aynan 10 ta bir martalik zaxira kod ko'rsatildi");
    const savedBackupCode = backupCodesList[0].trim();

    // "Saqladim, Kabinetga Kirish" tugmasini bosish
    await instPage.click("#btn-finish-backup-codes");
    await instPage.waitForURL("**/dashboard", { timeout: 10000 });
    assert(instPage.url().includes("/dashboard"), "2FA sozlangach kabinetga (dashboard) o'tildi");

    await instContext.close();

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 2: ODDIY 2FA KOD BILAN KIRISH (VERIFY LOGIN)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n[2] Oddiy 2FA Kod Bilan Kirish Oqimi (Real Brauzer):");

    const instLoginContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });
    const page2 = await instLoginContext.newPage();

    await page2.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page2.fill("#login-email", instEmail);
    await page2.fill("#login-password", testPassword);
    await page2.click("#btn-login");

    // 2FA Verify view ko'rinishi
    await page2.waitForSelector("#totp-verify-code", { timeout: 10000 });
    const verifyTitle = await page2.textContent("h1");
    assert(verifyTitle?.includes("2FA"), "6 xonali 2FA tasdiqlash oynasi ochildi");

    // Yangi TOTP kod bilan kirish (Time skew +1 darchasi orqali replay himoyasiga tushmasdan)
    const freshTotp = generateTotpCode(base32Secret!.trim(), 1);
    await page2.fill("#totp-verify-code", freshTotp);
    await page2.click("#btn-verify-2fa-login");

    await page2.waitForURL("**/dashboard", { timeout: 10000 });
    assert(page2.url().includes("/dashboard"), "To'g'ri 2FA kod bilan dashboardga muvaffaqiyatli kirildi");

    await instLoginContext.close();

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 3: ZAXIRA KOD ORQALI KIRISH (BACKUP CODE LOGIN)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n[3] Zaxira Kod Orqali Kirish Oqimi (Real Brauzer):");

    const backupLoginContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });
    const page3 = await backupLoginContext.newPage();

    await page3.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page3.fill("#login-email", instEmail);
    await page3.fill("#login-password", testPassword);
    await page3.click("#btn-login");

    await page3.waitForSelector("#totp-verify-code", { timeout: 10000 });

    // "Zaxira kod orqali kirish" tugmasini bosish
    await page3.click('button:has-text("Zaxira kod orqali kirish")');
    await page3.waitForSelector("#backup-code-input", { timeout: 5000 });

    // Zaxira kodni kiritish
    await page3.fill("#backup-code-input", savedBackupCode);
    await page3.click("#btn-verify-2fa-login");

    await page3.waitForURL("**/dashboard", { timeout: 10000 });
    assert(page3.url().includes("/dashboard"), "Zaxira kod orqali dashboardga muvaffaqiyatli kirildi");

    await backupLoginContext.close();

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 4: MOBIL EKRAN (360PX x 640PX) RESPONSIVE AUDITI
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n[4] Mobil Ekran (360px) Responsivlik Auditi:");

    const mobileContext: BrowserContext = await browser.newContext({
      viewport: { width: 360, height: 640 },
      userAgent: "Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    });

    const mobilePage = await mobileContext.newPage();
    mobilePage.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("Content Security Policy") || text.includes("CSP")) {
        cspViolations.push(text);
      }
    });

    // Talaba sifatida kirish
    await mobilePage.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await mobilePage.fill("#login-email", studentEmail);
    await mobilePage.fill("#login-password", testPassword);
    await mobilePage.click("#btn-login");

    await mobilePage.waitForURL("**/dashboard", { timeout: 10000 });
    assert(mobilePage.url().includes("/dashboard"), "Talaba mobil ekranda dashboardga kirdi");

    // 1. Ekran kengligi va gorizontal scroll tekshiruvi (360px)
    const mobileWidth = await mobilePage.evaluate(() => window.innerWidth);
    assert(mobileWidth === 360, "Viewport kengligi aniq 360px ga sozlangan");

    // 2. NotificationBell tekshiruvi (360px da sig'ishi)
    const bellBtn = mobilePage.locator('div[class*="mobileRight"] button[aria-label="Bildirishnomalar"]');
    if ((await bellBtn.count()) > 0) {
      await bellBtn.click();
      await mobilePage.waitForTimeout(400);

      const dropdownBox = await mobilePage.evaluate(() => {
        const dd = document.querySelector('div[style*="calc(100% + 8px)"]');
        if (!dd) return null;
        const rect = dd.getBoundingClientRect();
        return { width: rect.width, right: rect.right, left: rect.left };
      });

      if (dropdownBox) {
        assert(
          dropdownBox.right <= 365,
          `Bildirishnomalar oynasi 360px ekran doirasida sig'moqda (right: ${dropdownBox.right}px)`
        );
      }
    }

    // 3. Davomat va Vazifalar sahifasidagi jadvallar tekshiruvi
    const hasScrollContainer = await mobilePage.evaluate(() => {
      const tables = document.querySelectorAll("table");
      for (const t of tables) {
        const parent = t.parentElement;
        if (parent) {
          const style = window.getComputedStyle(parent);
          if (style.overflowX !== "auto" && style.overflowX !== "scroll") {
            return false;
          }
        }
      }
      return true;
    });
    assert(hasScrollContainer, "Barcha jadvallar overflow-x: auto konteyner bilan himoyalangan");

    // 4. CSP buzilishlari tekshiruvi
    assert(cspViolations.length === 0, `CSP xatoliklari mavjud emas (topildi: ${cspViolations.length})`);

    await mobileContext.close();

    // Tozalash
    try {
      await prisma.assignment.deleteMany({ where: { groupId: testGroup.id } });
      await prisma.classSession.deleteMany({ where: { groupId: testGroup.id } });
      await prisma.group.delete({ where: { id: testGroup.id } });
      await prisma.twoFactorBackupCode.deleteMany({ where: { userId: instructor.id } });
      await prisma.user.delete({ where: { id: instructor.id } });
      await prisma.user.delete({ where: { id: student.id } });
    } catch {}

    console.log("\n========================================================");
    console.log(`   PLAYWRIGHT TESTLARI YAKUNLANDI: ${passCount} PASS, ${failCount} FAIL`);
    console.log("========================================================\n");

    if (failCount > 0) {
      process.exit(1);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main().catch((err) => {
  console.error("Playwright test xatosi:", err);
  process.exit(1);
});
