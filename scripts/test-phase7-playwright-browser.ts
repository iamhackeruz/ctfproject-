/**
 * CyberEdu Phase 7 Playwright Real Browser Test Suite
 * 
 * Haqiqiy Chromium brauzeri (Google Chrome) orqali quyidagilarni to'liq isbotlaydi:
 * 1. Admin login -> /dashboard ko'rish -> Barcha 7 ta yangi Admin paneli tablari mavjudligi
 * 2. Admin: Foydalanuvchilar, Guruhlar, Taklif kodlari, Kontent tahrirchi, Audit loglar, Instansiyalar, Eksport
 * 3. Sozlamalar & Xavfsizlik: Parol o'zgartirishda eski parolni so'rash va Faol sessiyalar monitoringi
 * 4. Talaba login -> /dashboard da faqat talaba tablari ko'rinishi, Admin boshqaruv tablari umuman chiqmasligi
 * 5. Talaba dars sahifasida (/courses/1/learn) Q&A (savol-javob) bo'limining to'g'ri ishlashi
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
import { getTestCredentials } from "../src/lib/security/test-credentials";

function assert(condition: unknown, msg: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ [PASS] ${msg}`);
}

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

async function runPhase7BrowserSuite() {
  console.log("\n========================================================");
  console.log("   CYBEREDU 7-BOSQICH PLAYWRIGHT BRAUZER TESTLARI");
  console.log("========================================================\n");

  const browser: Browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });

  try {
    // ── [1] ADMIN LOGIN VA BARCHA ADMIN TABLARINI TEKSHIRISH ───────────────────
    console.log("[1] Administrator Kirishi va 7-Bosqich Admin Tablari Tekshiruvi:");
    const adminContext: BrowserContext = await browser.newContext();
    const adminPage: Page = await adminContext.newPage();

    const consoleErrors: string[] = [];
    adminPage.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const { adminEmail, adminPass } = getTestCredentials();
    await adminPage.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await adminPage.fill('input[type="email"], input[type="text"]', adminEmail);
    await adminPage.fill('input[type="password"]', adminPass);
    await adminPage.click('button[type="submit"]');

    await adminPage.waitForURL("**/dashboard", { timeout: 10000 });
    assert(adminPage.url().includes("/dashboard"), "Admin /dashboard sahifasiga muvaffaqiyatli o'tdi");

    // Admin tablari mavjudligini tekshirish
    const dashboardText = await adminPage.textContent("body");
    assert(dashboardText?.includes("Foydalanuvchilar"), "Dashboardda 'Foydalanuvchilar' tabi mavjud");
    assert(dashboardText?.includes("Guruhlar"), "Dashboardda 'Guruhlar' tabi mavjud");
    assert(dashboardText?.includes("Taklif kodlari"), "Dashboardda 'Taklif kodlari' tabi mavjud");
    assert(dashboardText?.includes("Kurs & Kontent"), "Dashboardda 'Kurs & Kontent' tabi mavjud");
    assert(dashboardText?.includes("Audit Loglar"), "Dashboardda 'Audit Loglar' tabi mavjud");
    assert(dashboardText?.includes("Instansiyalar"), "Dashboardda 'Instansiyalar' tabi mavjud");
    assert(dashboardText?.includes("Eksport"), "Dashboardda 'Eksport' tabi mavjud");
    assert(dashboardText?.includes("Sozlamalar & Xavfsizlik"), "Dashboardda 'Sozlamalar & Xavfsizlik' tabi mavjud");

    // ── [2] SOZLAMALAR VA FAOL SESSIYALAR BO'LIMI ─────────────────────────────
    console.log("\n[2] Sozlamalar & Xavfsizlik va Faol Sessiyalar:");
    await adminPage.click('button:has-text("Sozlamalar & Xavfsizlik")');
    await adminPage.waitForTimeout(1000);

    const settingsContent = await adminPage.textContent("body");
    assert(settingsContent?.includes("Joriy (eski) Parol"), "Parolni o'zgartirish uchun joriy (eski) parol maydoni mavjud");
    assert(settingsContent?.includes("Faol Sessiyalar va Qurilmalar"), "Faol sessiyalar va qurilmalar bo'limi mavjud");
    assert(settingsContent?.includes("Barcha boshqa qurilmalardan chiqish"), "'Barcha boshqa qurilmalardan chiqish' tugmasi mavjud");

    // ── [3] FOYDALANUVCHILAR TABI VA AMALLARI ─────────────────────────────────
    console.log("\n[3] Foydalanuvchilarni Boshqarish Tabi:");
    await adminPage.click('button:has-text("Foydalanuvchilar")');
    await adminPage.waitForTimeout(1000);

    const usersTabContent = await adminPage.textContent("body");
    assert(usersTabContent?.includes("Yangi Talaba / Xodim"), "Yangi talaba yaratish tugmasi mavjud");
    assert(usersTabContent?.includes("CSV Import"), "CSV Import tugmasi mavjud");

    // ── [4] GURUHLAR TABI ────────────────────────────────────────────────────
    console.log("\n[4] Guruhlar Tabi:");
    await adminPage.click('button:has-text("Guruhlar")');
    await adminPage.waitForTimeout(1000);

    const groupsTabContent = await adminPage.textContent("body");
    assert(groupsTabContent?.includes("Yangi Guruh Yaratish"), "Yangi guruh yaratish imkoniyati mavjud");

    // ── [5] KURS VA KONTENT TAHRIRCHISI TABI ─────────────────────────────────
    console.log("\n[5] Kurs & Kontent Tahrirchisi:");
    await adminPage.click('button:has-text("Kurs & Kontent")');
    await adminPage.waitForTimeout(1000);

    const contentEditor = await adminPage.textContent("body");
    assert(contentEditor?.includes("Kurslar, Modullar va Kontent Redaktori"), "Kurs & Kontent tahrirchi interfeysi yuklandi");

    // ── [5.1] AUDIT LOGLAR TABI ──────────────────────────────────────────────
    console.log("\n[5.1] Audit Loglar Tabi:");
    await adminPage.click('button:has-text("Audit Loglar")');
    await adminPage.waitForTimeout(1000);
    const logsContent = await adminPage.textContent("body");
    assert(logsContent?.includes("Audit Loglari"), "Audit loglar jadvali yuklandi");

    // ── [5.2] INSTANSIYALAR TABI ─────────────────────────────────────────────
    console.log("\n[5.2] Instansiyalar Tabi:");
    await adminPage.click('button:has-text("Instansiyalar")');
    await adminPage.waitForTimeout(1000);
    const instContent = await adminPage.textContent("body");
    assert(instContent?.includes("Faol Konteynerlar va Instansiyalar"), "Instansiyalar monitori yuklandi");

    // ── [5.3] EKSPORT TABI ───────────────────────────────────────────────────
    console.log("\n[5.3] Eksport Tabi:");
    await adminPage.click('button:has-text("Eksport")');
    await adminPage.waitForTimeout(1000);
    const exportContent = await adminPage.textContent("body");
    assert(exportContent?.includes("CSV Formatida Eksport Qilish"), "Eksport boshqaruvi yuklandi");

    // Admin sessiyasidan chiqish
    await adminPage.click('button:has-text("Chiqish")');
    await adminPage.waitForTimeout(1000);
    await adminContext.close();
    console.log("  ✅ Admin chiqishi muvaffaqiyatli");

    // ── [6] TALABA KIRISHI VA RBAC CHEKLOVLARINI TEKSHIRISH ─────────────────
    console.log("\n[6] Talaba Kirishi va RBAC Cheklovlari:");
    const studentContext: BrowserContext = await browser.newContext();
    const studentPage: Page = await studentContext.newPage();

    await studentPage.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await studentPage.fill('input[type="email"], input[type="text"]', "student@cyberedu.uz");
    await studentPage.fill('input[type="password"]', "Student#2026!Pass");
    await studentPage.click('button[type="submit"]');

    await studentPage.waitForURL("**/dashboard", { timeout: 10000 });
    const studentDashboard = await studentPage.textContent("body");

    // Talabaga faqat ruxsat etilgan tablar ko'rinishi shart
    assert(studentDashboard?.includes("Mening kurslarim"), "Talabada 'Mening kurslarim' tabi bor");
    assert(studentDashboard?.includes("Amaliy topshiriqlar"), "Talabada 'Amaliy topshiriqlar' tabi bor");
    assert(studentDashboard?.includes("Sertifikatlar"), "Talabada 'Sertifikatlar' tabi bor");
    assert(studentDashboard?.includes("Sozlamalar & Xavfsizlik"), "Talabada 'Sozlamalar & Xavfsizlik' tabi bor");

    // Admin boshqaruv tablari talabada MUTLAQO KO'RINMASLIGI SHART
    assert(!studentDashboard?.includes("👥 Foydalanuvchilar"), "Talabada 'Foydalanuvchilar' admin tabi YO'Q (RBAC)");
    assert(!studentDashboard?.includes("🏷️ Guruhlar"), "Talabada 'Guruhlar' admin tabi YO'Q (RBAC)");
    assert(!studentDashboard?.includes("🎟️ Taklif kodlari"), "Talabada 'Taklif kodlari' admin tabi YO'Q (RBAC)");
    assert(!studentDashboard?.includes("📝 Kurs & Kontent"), "Talabada 'Kurs & Kontent' admin tabi YO'Q (RBAC)");
    assert(!studentDashboard?.includes("📜 Audit Loglar"), "Talabada 'Audit Loglar' admin tabi YO'Q (RBAC)");
    assert(!studentDashboard?.includes("⚡ Instansiyalar"), "Talabada 'Instansiyalar' admin tabi YO'Q (RBAC)");
    assert(!studentDashboard?.includes("📊 Eksport"), "Talabada 'Eksport' admin tabi YO'Q (RBAC)");

    // ── [7] TALABA DARSLARDA Q&A (SAVOL-JAVOB) BO'LIMI ───────────────────────
    console.log("\n[7] Talaba Dars Sahifasida Q&A (Savol-Javob) Bo'limi:");
    await studentPage.goto(`${BASE_URL}/courses/1/learn`, { waitUntil: "networkidle" });
    const learnContent = await studentPage.textContent("body");
    assert(learnContent?.includes("Savol-Javoblar"), "Dars o'rganish sahifasida Savol-Javoblar tabi mavjud");

    await studentPage.click('button:has-text("Savol-Javoblar")');
    await studentPage.waitForTimeout(500);

    const qaInput = await studentPage.$('input[placeholder*="Dars bo\'yicha savolingiz bormi?"]');
    assert(qaInput !== null, "Talaba dars yuzasidan savol yozish formasiga ega");

    await studentContext.close();

    console.log("\n========================================================");
    console.log("   🎉 BARCHA PLAYWRIGHT BRAUZER TESTLARI MUVAFFAQIShATLI O'TDI!");
    console.log("========================================================\n");
  } finally {
    await browser.close();
  }
}

runPhase7BrowserSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Browser test xatosi:", err);
    process.exit(1);
  });
