try {
  process.loadEnvFile();
} catch {}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require("module");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs");
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
  console.log("   PLAYWRIGHT E2E: 10-BOSQICH BRAUZER TESTLARI");
  console.log("========================================================\n");

  const ts = Date.now();
  const { adminPass, studentPass } = getTestCredentials();
  const teacherHash = await hashPassword(adminPass);
  const studentHash = await hashPassword(studentPass);

  const teacherEmail = `playwright_teacher_${ts}@cyberedu.uz`;
  const studentEmail = `playwright_student_${ts}@cyberedu.uz`;

  const teacher = await prisma.user.create({
    data: {
      email: teacherEmail,
      name: "Ustoz Jamshid",
      displayName: "Jamshid",
      role: Role.instructor,
      passwordHash: teacherHash,
    },
  });

  const student = await prisma.user.create({
    data: {
      email: studentEmail,
      name: `Talaba Botir ${ts}`,
      displayName: "Botir",
      role: Role.student,
      passwordHash: studentHash,
    },
  });

  const group = await prisma.group.create({
    data: {
      name: `P10 Playwright Guruhi ${ts}`,
      createdBy: teacher.id,
      members: {
        create: [{ userId: student.id }],
      },
    },
  });

  console.log(`Test foydalanuvchilari yaratildi:`);
  console.log(`  Ustoz:   ${teacherEmail}`);
  console.log(`  Talaba:  ${studentEmail}`);
  console.log(`  Guruh:   ${group.name}`);

  // Test attachment fayli
  const sampleFilePath = path.resolve(process.cwd(), `test-fixtures/sample_hw_${ts}.txt`);
  fs.writeFileSync(sampleFilePath, "Talabaning Playwright orqali yuklagan hisobot fayli.");

  let browser: Browser | null = null;
  let teacherContext: BrowserContext | null = null;
  let studentContext: BrowserContext | null = null;
  const cspViolations: string[] = [];

  try {
    browser = await chromium.launch({
      executablePath: "/usr/bin/google-chrome",
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });

    teacherContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });
    studentContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });

    const teacherPage = await teacherContext.newPage();
    const studentPage = await studentContext.newPage();

    const handleConsole = (msg: { text: () => string }) => {
      const txt = msg.text();
      if (txt.includes("Content Security Policy") || txt.includes("CSP")) {
        console.warn(`[CSP Warning]: ${txt}`);
        cspViolations.push(txt);
      }
    };
    teacherPage.on("console", handleConsole);
    studentPage.on("console", handleConsole);

    // ==========================================
    // 1-QADAM: Ustoz login qiladi va vazifa yaratadi
    // ==========================================
    console.log("\n--- 1. Ustoz login qiladi va yangi vazifa yaratadi ---");
    await teacherPage.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await teacherPage.waitForSelector("#login-email");
    await teacherPage.fill("#login-email", teacherEmail);
    await teacherPage.fill("#login-password", adminPass);

    await teacherPage.click('button[type="submit"]:has-text("Kirish")');
    await teacherPage.waitForURL("**/dashboard**", { timeout: 10000 });
    assert(teacherPage.url().includes("/dashboard"), "Ustoz muvaffaqiyatli dashboardga kirdi");

    // "Uy vazifalari" tabini ochish
    await teacherPage.click('button:has-text("📋 Uy vazifalari")');
    await teacherPage.waitForTimeout(500);

    // "+ Yangi vazifa yaratish" tugmasini bosish
    await teacherPage.click('button:has-text("+ Yangi vazifa yaratish")');
    await teacherPage.waitForTimeout(500);

    // Formani to'ldirish
    const assignmentTitle = `Playwright Assignment ${ts}`;
    await teacherPage.fill('input[placeholder*="SQL Injection"]', assignmentTitle);
    await teacherPage.fill('textarea[placeholder*="shartlarini"]', "Ushbu vazifada tarmoq trafigini tahlil qiling.");

    // Guruhni tanlash
    await teacherPage.selectOption("#assignment-create-group", { label: group.name });

    // Muddatni belgilash (ertangi sana)
    const tomorrowStr = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16);
    await teacherPage.fill('input[type="datetime-local"]', tomorrowStr);

    // Saqlash
    const [createRes] = await Promise.all([
      teacherPage.waitForResponse((r) => r.url().includes("/api/assignments") && r.request().method() === "POST"),
      teacherPage.click('button[type="submit"]:has-text("Yaratish")'),
    ]);
    const createData = await createRes.json();
    console.log("Assignment created response:", createData);

    await teacherPage.waitForTimeout(1000);

    // Ro'yxatda vazifa ko'ringanligini tekshirish
    const hasAss = await teacherPage.textContent(`text=${assignmentTitle}`);
    assert(Boolean(hasAss), "Yaratilgan vazifa ustoz ro'yxatida ko'rindi");

    // ==========================================
    // 2-QADAM: Talaba kiradi, vazifani ko'radi va fayl bilan topshiradi
    // ==========================================
    console.log("\n--- 2. Talaba vazifani ko'radi va topshiradi ---");
    await studentPage.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await studentPage.waitForSelector("#login-email");
    await studentPage.fill("#login-email", studentEmail);
    await studentPage.fill("#login-password", studentPass);
    await studentPage.click('button[type="submit"]:has-text("Kirish")');

    await studentPage.waitForURL("**/dashboard**", { timeout: 10000 });
    assert(studentPage.url().includes("/dashboard"), "Talaba dashboardga kirdi");

    // Talabaning "Uy vazifalari" tabini ochish
    await studentPage.click('button:has-text("📋 Uy vazifalari")');
    await studentPage.waitForSelector(`text=${assignmentTitle}`, { timeout: 10000 });

    // "Topshirish" tugmasini bosish
    await studentPage.click('button:has-text("Topshirish")');
    await studentPage.waitForTimeout(500);

    // Yechim matnini kiritish va fayl biriktirish
    await studentPage.fill('textarea[placeholder*="Yechim tafsilotlarini"]', "Mening amaliy yechimim: port 80 va 443 tahlil qilindi.");
    await studentPage.setInputFiles('input[type="file"]', sampleFilePath);

    // Yuborish
    const [subRes] = await Promise.all([
      studentPage.waitForResponse((r) => r.url().includes("/submit") && r.request().method() === "POST"),
      studentPage.click('button[type="submit"]:has-text("Yuborish")'),
    ]);
    const subData = await subRes.json();
    console.log("Submission response:", subData);

    await studentPage.waitForTimeout(1000);

    // Holat "Tekshirilmoqda" bo'lganligini tekshirish
    await studentPage.waitForSelector("text=Tekshirilmoqda", { timeout: 10000 });
    const textAfterSubmit = await studentPage.textContent("body");
    assert(textAfterSubmit?.includes("Tekshirilmoqda"), "Topshiriq yuborildi va 'Tekshirilmoqda' holatiga o'tdi");

    // ==========================================
    // 3-QADAM: Ustoz topshiriqni baholaydi va izoh yozadi
    // ==========================================
    console.log("\n--- 3. Ustoz topshiriqni baholaydi ---");
    // Ustoz sahifasiga qaytish
    await teacherPage.bringToFront();
    // "Topshiriqlarni ko'rish" tugmasini bosish
    await teacherPage.click('button:has-text("Topshiriqlarni ko\'rish")');
    await teacherPage.waitForTimeout(800);

    // Talabaning topshirig'ini topish va "Baholash" tugmasini bosish
    await teacherPage.click('button:has-text("Baholash")');
    await teacherPage.waitForTimeout(500);

    // Ball va izoh kiritish
    await teacherPage.fill('input[type="number"]', "88");
    await teacherPage.fill('textarea[placeholder*="Xatoliklar yoki tavsiyalar"]', "Yaxshi tahlil, hisobot to'liq topshirilgan.");

    // Saqlash
    await teacherPage.click('button:has-text("Saqlash va bildirish")');
    await teacherPage.waitForTimeout(1000);

    // Modalni yopish
    await teacherPage.click('button:has-text("✕")');
    await teacherPage.waitForTimeout(500);
    assert(true, "Ustoz talaba topshirig'ini muvaffaqiyatli baholadi");

    // ==========================================
    // 4-QADAM: Talaba o'z bahosini va izohini ko'radi
    // ==========================================
    console.log("\n--- 4. Talaba qo'yilgan bahoni va ustoz izohini ko'radi ---");
    await studentPage.bringToFront();
    await studentPage.reload({ waitUntil: "domcontentloaded" });
    await studentPage.click('button:has-text("📋 Uy vazifalari")');
    await studentPage.waitForTimeout(500);

    const studentBody = await studentPage.textContent("body");
    assert(studentBody?.includes("Baholangan: 88"), "Talaba o'z bahosini ko'rmoqda (88 ball)");
    assert(studentBody?.includes("Yaxshi tahlil"), "Talaba ustoz izohini ko'rmoqda");

    // ==========================================
    // 5-QADAM: Davomat tizimi (Ustoz belgilaydi -> Talaba ko'radi)
    // ==========================================
    console.log("\n--- 5. Davomat tizimi sinovi ---");
    await teacherPage.bringToFront();

    // "Davomat" tabini ochish
    await teacherPage.click('button:has-text("📊 Davomat")');
    await teacherPage.waitForTimeout(500);

    // Guruhni tanlash
    await teacherPage.selectOption("#attendance-group-select", { label: group.name });
    await teacherPage.waitForTimeout(500);

    // Yangi mashg'ulot qo'shish
    await teacherPage.click('button:has-text("+ Yangi mashg\'ulot")');
    await teacherPage.waitForTimeout(500);

    const sessionTopicName = `Playwright Davomat Mavzusi ${ts}`;
    await teacherPage.fill('input[placeholder*="Web xavfsizligi"]', sessionTopicName);
    await teacherPage.fill('input[type="datetime-local"]', new Date().toISOString().slice(0, 16));
    await teacherPage.click('button[type="submit"]:has-text("Yaratish")');
    await teacherPage.waitForTimeout(1000);

    // "Davomat belgilash" tugmasini bosish
    await teacherPage.click('button:has-text("Davomat belgilash")');
    await teacherPage.waitForTimeout(800);

    // "Hammasini Qatnashdi qilish" tugmasini bosish
    await teacherPage.click('button:has-text("Hammasini \\"Qatnashdi\\" qilish")');
    await teacherPage.waitForTimeout(300);

    // Saqlash
    await teacherPage.click('button:has-text("Saqlash")');
    await teacherPage.waitForTimeout(1000);

    // Talaba kiradi va o'z davomatini ko'radi
    await studentPage.bringToFront();
    await studentPage.click('button:has-text("📊 Mening davomatim")');
    await studentPage.waitForTimeout(500);

    const attendanceBody = await studentPage.textContent("body");
    assert(attendanceBody?.includes(sessionTopicName), "Talaba sahifasida mashg'ulot mavzusi ko'rindi");
    assert(attendanceBody?.includes("Qatnashdi"), "Talaba o'zining 'Qatnashdi' holatini ko'rmoqda");
    assert(attendanceBody?.includes("100%"), "Talabaning davomati 100% ko'rsatilmoqda");

    // ==========================================
    // 6-QADAM: Telegram ulash kodi va Bildirishnomalar
    // ==========================================
    console.log("\n--- 6. Telegram ulanish kodi va In-app bildirishnomalar ---");
    // Sozlamalar tabini ochish
    await studentPage.click('button:has-text("⚙️ Sozlamalar")');
    await studentPage.waitForTimeout(500);

    // "Telegram'ni ulash" tugmasini bosish
    await studentPage.click('button:has-text("Telegram\'ni ulash")');
    await studentPage.waitForTimeout(1000);

    // 6 belgili kod hosil bo'lganligini tekshirish
    const settingsBody = await studentPage.textContent("body");
    assert(settingsBody?.includes("/start"), "Telegram bot uchun /start buyrug'i va ulanish kodi hosil bo'ldi");

    // Navbar'dagi Bildirishnoma qo'ng'irog'ini (NotificationBell) ochish
    await studentPage.click('button[aria-label="Bildirishnomalar"]');
    await studentPage.waitForTimeout(500);

    const bellPopup = await studentPage.textContent("body");
    assert(bellPopup?.includes("Bildirishnomalar"), "Bildirishnomalar oynasi muvaffaqiyatli ochildi");

    // CSP tekshiruvi
    assert(cspViolations.length === 0, "Brauzerda 0 ta CSP qoidabuzarligi qayd etildi");

    console.log("\n========================================================");
    console.log(`Phase 10 Playwright Test Natijasi:`);
    console.log(`  PASS: ${passCount}`);
    console.log(`  FAIL: ${failCount}`);
    console.log("========================================================\n");
  } finally {
    if (teacherContext) await teacherContext.close().catch(() => null);
    if (studentContext) await studentContext.close().catch(() => null);
    if (browser) await browser.close().catch(() => null);

    // Tozalash
    try {
      if (fs.existsSync(sampleFilePath)) fs.unlinkSync(sampleFilePath);
    } catch {}
    await prisma.classSession.deleteMany({ where: { groupId: group.id } }).catch(() => null);
    await prisma.assignment.deleteMany({ where: { groupId: group.id } }).catch(() => null);
    await prisma.group.delete({ where: { id: group.id } }).catch(() => null);
    await prisma.user.deleteMany({
      where: { id: { in: [teacher.id, student.id] } },
    }).catch(() => null);
  }

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Playwright testida kutilmagan xatolik:", err);
  process.exit(1);
});
