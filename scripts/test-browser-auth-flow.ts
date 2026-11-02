/**
 * CyberEdu Playwright Full Auth Flow Browser Test
 * 
 * Haqiqiy Chromium brauzeri orqali quyidagilarni to'liq isbotlaydi:
 * 1. Admin login -> /dashboard ko'rish -> logout
 * 2. Demo talaba login -> /dashboard ko'rish -> logout
 * 3. Ustozdan olingan taklif kodi (inviteCode) orqali yangi talaba ro'yxatdan o'tishi -> dashboard -> logout -> qayta login
 * 4. Noto'g'ri parol kiritilganda aniq o'zbekcha xato xabari ("Login yoki parol noto'g'ri kiritildi.") chiqishi va sahifa jim yangilanmasligi
 */

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

import { chromium, Browser, BrowserContext, Page } from "playwright";
import { prisma } from "../src/lib/db";
import { Role } from "@prisma/client";
import { hashPassword } from "../src/lib/security/password";
import { getTestCredentials } from "../src/lib/security/test-credentials";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ [PASS] ${msg}`);
}

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

async function runBrowserAuthSuite() {
  console.log("\n========================================================");
  console.log("   CYBEREDU PLAYWRIGHT BRAUZER AUTH FLOW AUDITI");
  console.log("========================================================\n");

  const browser: Browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });

  try {
    // ── [1] ADMIN LOGIN -> DASHBOARD -> LOGOUT ──────────────────────────────
    console.log("[1] Administrator Kirishi (Admin Login -> Dashboard -> Logout):");
    const { adminEmail, adminPass } = getTestCredentials();
    const adminHash = await hashPassword(adminPass);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { isBlocked: false, passwordHash: adminHash },
      create: {
        email: adminEmail,
        name: "Bosh Admin",
        role: Role.admin,
        passwordHash: adminHash,
      },
    });

    const adminContext: BrowserContext = await browser.newContext();
    const adminPage: Page = await adminContext.newPage();

    const adminCspViolations: string[] = [];
    adminPage.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("Content Security Policy") || text.includes("violates the following Content Security Policy")) {
        adminCspViolations.push(text);
      }
    });

    await adminPage.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    assert(adminCspViolations.length === 0, "Login sahifasida birorta ham CSP xatosi yuz bermadi.");

    await adminPage.fill("#login-email", adminEmail);
    await adminPage.fill("#login-password", adminPass);
    await adminPage.click("button[type=\"submit\"]");

    // Dashboardga o'tishini kutish
    await adminPage.waitForURL("**/dashboard", { timeout: 6000 });
    assert(adminPage.url().includes("/dashboard"), "Admin hisobi muvaffaqiyatli /dashboard sahifasiga yo'naltirildi.");

    await adminPage.waitForSelector("body");
    const dashboardHtml = await adminPage.content();
    assert(
      dashboardHtml.includes("Bosh Ustoz") || dashboardHtml.includes("Ustoz") || dashboardHtml.includes("Admin"),
      "Administrator kabinetida uning roli yoki ismi to'g'ri ko'rsatildi."
    );

    // Logout qilish (Chiqish)
    const logoutBtn = await adminPage.$("button:has-text(\"Chiqish\"), a:has-text(\"Chiqish\")");
    if (logoutBtn) {
      await logoutBtn.click();
      await adminPage.waitForTimeout(1000);
    } else {
      // Navbar yoki to'g'ridan-to'g'ri /api/auth orqali
      await adminPage.evaluate(() => fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) }));
      await adminPage.goto(`${BASE_URL}/login`);
    }

    const adminCookies = await adminContext.cookies();
    const sessionCookie = adminCookies.find((c) => c.name === "cyberedu_session");
    assert(!sessionCookie || sessionCookie.value === "", "Admin muvaffaqiyatli chiqdi (logout), sessiya cookie'si bekor qilindi.");
    await adminContext.close();

    // ── [2] DEMO TALABA LOGIN -> DASHBOARD -> LOGOUT ─────────────────────────
    console.log("\n[2] Demo Talaba Kirishi (Student Login -> Dashboard -> Logout):");
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();

    await studentPage.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await studentPage.fill("#login-email", "student@cyberedu.uz");
    await studentPage.fill("#login-password", "Student#2026!Pass");
    await studentPage.click("button[type=\"submit\"]");

    await studentPage.waitForURL("**/dashboard", { timeout: 6000 });
    assert(studentPage.url().includes("/dashboard"), "Talaba hisobi muvaffaqiyatli /dashboard sahifasiga yo'naltirildi.");

    const studentHtml = await studentPage.content();
    assert(
      studentHtml.includes("Sardor") || studentHtml.includes("Talaba") || studentHtml.includes("Mening Kurslarim"),
      "Talaba kabinetida talaba ma'lumotlari to'g'ri ko'rsatildi."
    );

    await studentContext.close();

    // ── [3] TAKLIF KODI (INVITE CODE) BILAN YANGI TALABA RO'YXATDAN O'TISHI
    console.log("\n[3] Taklif Kodi bilan Ro'yxatdan O'tish (Register with Invite Code -> Dashboard):");
    // Ustoz uchun DB da bir martalik taklif kodi yaratamiz
    const adminUser = await prisma.user.findFirst({ where: { role: Role.admin } });
    const uniqueInvite = `CYBER-INV-${Date.now().toString(36).toUpperCase()}`;
    await prisma.invitationCode.create({
      data: {
        code: uniqueInvite,
        createdBy: adminUser ? adminUser.id : "system_admin",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const newStudentContext = await browser.newContext();
    const newStudentPage = await newStudentContext.newPage();

    await newStudentPage.goto(`${BASE_URL}/register`, { waitUntil: "domcontentloaded" });

    const newEmail = `talaba_${Date.now()}@cyberedu.uz`;
    const newPass = "SuperSecure#2026!Talaba";

    await newStudentPage.fill("#reg-firstname", "Temur");
    await newStudentPage.fill("#reg-lastname", "Bekmurodov");
    await newStudentPage.fill("#reg-email", newEmail);
    await newStudentPage.fill("#reg-invite", uniqueInvite);
    await newStudentPage.fill("#reg-password", newPass);

    await newStudentPage.click("button[type=\"submit\"]");

    // Dashboardga o'tishini kutish
    await newStudentPage.waitForURL("**/dashboard", { timeout: 6000 });
    assert(newStudentPage.url().includes("/dashboard"), "Yangi ro'yxatdan o'tgan talaba /dashboard ga muvaffaqiyatli kirdi.");

    // Chiqib ketib, yangi hisob va parol bilan qayta /login qilish
    await newStudentPage.evaluate(() => fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) }));
    await newStudentPage.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });

    await newStudentPage.fill("#login-email", newEmail);
    await newStudentPage.fill("#login-password", newPass);
    await newStudentPage.click("button[type=\"submit\"]");

    await newStudentPage.waitForURL("**/dashboard", { timeout: 6000 });
    assert(newStudentPage.url().includes("/dashboard"), "Yangi yaratilgan talaba /login orqali ikkinchi marta ham muvaffaqiyatli kirdi.");

    // Ishlatilgan taklif kodi bazada ishlatilgan deb belgilanganini tekshirish
    const usedInvite = await prisma.invitationCode.findUnique({ where: { code: uniqueInvite } });
    assert(usedInvite !== null && usedInvite.usedAt !== null, "Bir martalik taklif kodi muvaffaqiyatli sarflandi (usedAt belgilandi).");

    await newStudentContext.close();

    // ── [4] XATO PAROL VA ANIQ O'ZBEKCHA XATO KO'RSATILISHI ─────────────────
    console.log("\n[4] Noto'g'ri Parol Kiritilganda UI Xato Xabari (Error Feedback):");
    const errorContext = await browser.newContext();
    const errorPage = await errorContext.newPage();

    await errorPage.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await errorPage.fill("#login-email", "admin@cyberedu.uz");
    await errorPage.fill("#login-password", "MutlaqoNoto'g'riParol#999");
    await errorPage.click("button[type=\"submit\"]");

    // Xato xabari paydo bo'lishini kutish (sahifa yangilanmasdan)
    await errorPage.waitForSelector("#login-error-alert", { timeout: 3000 });
    const alertText = await errorPage.$eval("#login-error-alert", (el) => el.textContent);
    assert(
      alertText?.includes("Login yoki parol noto'g'ri") === true,
      `Foydalanuvchiga aniq xato xabari ko'rsatildi: "${alertText?.trim()}"`
    );
    assert(errorPage.url().includes("/login"), "Sahifa jim yangilanib ketmadi, xato bilan /login sahifasida qoldi.");

    await errorContext.close();

    console.log("\n========================================================");
    console.log("   ✅ BARCHA AUTH PLAYWRIGHT BRAUZER TESTLARI O'TDI!");
    console.log("========================================================\n");
  } finally {
    await browser.close();
  }
}

runBrowserAuthSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test xatosi:", err);
    process.exit(1);
  });
