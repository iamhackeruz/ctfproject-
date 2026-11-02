/**
 * Playwright Real Browser E2E Test:
 * Admin grants premium entitlement -> Student accesses locked premium lesson & takes quiz ->
 * Admin revokes entitlement -> Student refreshes and lesson is locked again.
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
import { Role, AccessType } from "@prisma/client";
import { hashPassword } from "../src/lib/security/password";
import { getTestCredentials } from "../src/lib/security/test-credentials";

function assert(condition: unknown, msg: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ [PASS] ${msg}`);
}

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

async function main() {
  console.log("\n========================================================");
  console.log("   PLAYWRIGHT E2E: GRANT & REVOKE PREMIUM HUQUQLAR TESTI");
  console.log("========================================================\n");

  const ts = Date.now();
  const { adminEmail, adminPass, studentPass } = getTestCredentials();
  const adminHash = await hashPassword(adminPass);
  const studentHash = await hashPassword(studentPass);

  // 1. Admin hisobini ta'minlash
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { isBlocked: false, passwordHash: adminHash },
    create: {
      email: adminEmail,
      name: "Bosh Admin",
      displayName: "Admin",
      role: Role.admin,
      passwordHash: adminHash,
    },
  });

  // 2. Talaba hisobini yaratish
  const studentEmail = `student_gr_${ts}@cyberedu.uz`;
  const student = await prisma.user.create({
    data: {
      email: studentEmail,
      name: `Talaba GR ${ts}`,
      displayName: `Talaba GR`,
      role: Role.student,
      passwordHash: studentHash,
    },
  });

  // 3. Test Kursi (PREMIUM) va Quiz yaratish
  const course = await prisma.course.create({
    data: {
      slug: `prem-e2e-${ts}`,
      title: `E2E Premium Kurs ${ts}`,
      desc: "Haqiqiy brauzer testi uchun maxsus premium kurs",
      fullDesc: "Batafsil tavsif",
      instructorName: "Ustoz",
      instructorRole: "Katta Xavfsizlik Mutaxassisi",
      accessType: AccessType.PREMIUM,
      isPublished: true,
      modules: {
        create: {
          title: "1-Maxsus Modul",
          duration: "1 soat",
          order: 1,
          lessons: {
            create: {
              title: "1.1 Premium Kiber Himoya",
              duration: "20 daq",
              accessType: AccessType.PREMIUM,
              isPublished: true,
              isFree: false,
              content: "### Maxfiy Kiber Himoya Darsi\nUshbu matn faqat premium obunachilarga ko'rinadi.",
              order: 1,
            },
          },
        },
      },
    },
    include: {
      modules: {
        include: { lessons: true },
      },
    },
  });

  const lesson = course.modules[0].lessons[0];

  // Dars uchun Quiz yaratish
  await prisma.quiz.create({
    data: {
      lessonId: lesson.id,
      title: "Premium Dars Sinov Testi",
      passingScore: 70,
      maxAttempts: 3,
      questions: {
        create: [
          {
            question: "Kiberxavfsizlikda eng asosiy tamoyil nima?",
            options: [
              "Xavfsizlik eng birinchi o'rinda (To'g'ri javob)",
              "Parollarni stikerga yozib qo'yish",
              "Barcha portlarni ochiq qoldirish",
              "Hech qanday tekshiruv qilmaslik",
            ],
            correctOption: 0,
            order: 1,
          },
        ],
      },
    },
  });

  console.log(`[SETUP] Foydalanuvchilar: Admin (${admin.email}), Talaba (${student.email})`);
  console.log(`[SETUP] Kurs yaratildi: ID=${course.id}, LessonId=${lesson.id}`);

  // Brauzerni ochish (Google Chrome)
  const browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const studentContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const adminContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  const studentPage = await studentContext.newPage();
  const adminPage = await adminContext.newPage();

  try {
    // ── QADAM 1: Talaba tizimga kiradi va premium darsni ochadi (Qulflangan holat) ──
    console.log("\n--- QADAM 1: Talaba darsni ochadi (Huquqsiz, Dars Qulflangan) ---");
    await studentPage.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await studentPage.fill('input[type="email"], #login-email', student.email);
    await studentPage.fill('input[type="password"], #login-password', studentPass);
    await studentPage.click('button[type="submit"]:has-text("Kirish")');
    await studentPage.waitForURL("**/dashboard", { timeout: 10000 });
    assert(studentPage.url().includes("/dashboard"), "Talaba muvaffaqiyatli login qildi");

    // Talaba premium dars sahifasiga o'tadi
    await studentPage.goto(`${BASE_URL}/courses/${course.id}/learn`, { waitUntil: "networkidle" });

    // Dars qulflanganligini tekshirish
    const lockedHeader = studentPage.locator("h3:has-text('Dars Qulflangan')");
    await lockedHeader.waitFor({ state: "visible", timeout: 8000 });
    assert(await lockedHeader.isVisible(), "Talabaga dars '🔒 Dars Qulflangan' holatida ko'rsatildi");

    const lockedMsg = await studentPage.locator("p:has-text('Premium obuna talab etiladi')").isVisible();
    assert(lockedMsg, "Talabaga Premium obuna talab etilishi haqida tushunarli xabar berildi");

    // Test yoki konspekt tablari mavjud emasligini tasdiqlash
    const quizTabBefore = await studentPage.locator("button:has-text('Dars Testi')").isVisible();
    assert(!quizTabBefore, "Qulflangan darsda test va konspekt tablari ko'rsatilmadi");

    // ── QADAM 2: Admin UI orqali talabaga Premium huquqini beradi ──
    console.log("\n--- QADAM 2: Admin UI orqali talabaga Premium obuna beradi ---");
    await adminPage.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await adminPage.fill('input[type="email"], #login-email', admin.email);
    await adminPage.fill('input[type="password"], #login-password', adminPass);
    await adminPage.click('button[type="submit"]:has-text("Kirish")');
    await adminPage.waitForURL("**/dashboard", { timeout: 10000 });
    assert(adminPage.url().includes("/dashboard"), "Admin muvaffaqiyatli login qildi");

    // Admin "Kirish Huquqlari" tabiga o'tadi
    const entitlementsTabBtn = adminPage.locator('button:has-text("Kirish Huquqlari")');
    await entitlementsTabBtn.click();
    await adminPage.waitForTimeout(1000);

    // "+ Talabaga Huquq Berish" tugmasini bosadi
    const grantModalBtn = adminPage.locator('button:has-text("Talabaga Huquq Berish")');
    await grantModalBtn.click();
    await adminPage.waitForTimeout(500);

    // Modalda talaba emailini kiritish va formani topshirish
    const emailInput = adminPage.locator('input[placeholder*="talaba@cyberedu.uz"]');
    await emailInput.fill(student.email);

    // Huquq turi: SUBSCRIPTION tanlangan
    const submitGrantBtn = adminPage.locator('button[type="submit"]:has-text("Huquqni Berish")');
    await submitGrantBtn.click();

    // Muvaffaqiyat xabari chiqishini kutish
    await adminPage.waitForSelector('text=muvaffaqiyatli taqdim etildi', { timeout: 8000 });
    assert(true, "Admin UI da talabaga huquq berilgani haqida xabar chiqdi");

    // ── QADAM 3: Talaba darsni yangilaydi, dars ochiladi va quiz topshiradi ──
    console.log("\n--- QADAM 3: Talaba sahifani yangilaydi, dars ochiladi va test topshiradi ---");
    await studentPage.reload({ waitUntil: "networkidle" });

    // Dars endi qulflanmagan bo'lishi kerak
    await studentPage.waitForSelector('text=Maxfiy Kiber Himoya Darsi', { timeout: 8000 });
    assert(true, "Premium dars konspekti talaba sahifasida to'liq ochildi");

    // Test tabiga o'tish
    const quizTab = studentPage.locator('button:has-text("Dars Testi")');
    await quizTab.click();
    await studentPage.waitForTimeout(800);

    // Savol variantini tanlash (Birinchi to'g'ri variant)
    const firstOption = studentPage.locator('button:has-text("Xavfsizlik eng birinchi o\'rinda")');
    await firstOption.click();
    await studentPage.waitForTimeout(400);

    // Testni topshirish
    const submitQuizBtn = studentPage.locator('button:has-text("Testni Yakunlash")');
    await submitQuizBtn.click();

    // Natija chiqishini kutish
    await studentPage.waitForSelector('text=muvaffaqiyatli topshirilgan', { timeout: 8000 });
    assert(true, "Talaba premium dars testini (Quiz) muvaffaqiyatli topshirdi");

    // ── QADAM 4: Admin UI orqali talabaning huquqini bekor qiladi ──
    console.log("\n--- QADAM 4: Admin UI orqali talabaning kirish huquqini bekor qiladi ---");
    adminPage.on("dialog", async (dialog) => {
      console.log(`  [Dialog] Admin tasdiqlash oynasi: "${dialog.message()}" -> Qabul qilindi`);
      await dialog.accept();
    });

    // Jadvaldagi talabaning qatoridagi "Bekor qilish" tugmasini bosish
    const studentRow = adminPage.locator(`tr:has-text("${student.email}")`);
    const revokeBtn = studentRow.locator('button:has-text("Bekor qilish")');
    await revokeBtn.click();

    // Bekor qilinganligi haqida bildirishnoma chiqishini kutish
    await adminPage.waitForSelector('text=Kirish huquqi bekor qilindi', { timeout: 8000 });
    assert(true, "Admin UI da kirish huquqi muvaffaqiyatli bekor qilindi");

    // ── QADAM 5: Talaba sahifani yangilaganda dars yana qulflanishi ──
    console.log("\n--- QADAM 5: Talaba sahifani yangilaydi va dars yana qulflanadi ---");
    await studentPage.reload({ waitUntil: "networkidle" });

    const lockedAgainHeader = studentPage.locator("h3:has-text('Dars Qulflangan')");
    await lockedAgainHeader.waitFor({ state: "visible", timeout: 8000 });
    assert(await lockedAgainHeader.isVisible(), "Huquq bekor qilingach talaba darsi yana darhol '🔒 Dars Qulflangan' holatiga qaytdi");

    const contentHidden = await studentPage.locator('text=Maxfiy Kiber Himoya Darsi').isVisible();
    assert(!contentHidden, "Qulflangan dars matni talabaga ko'rinmadi");

    console.log("\n========================================================");
    console.log("   ✅ BARCHA GRANT & REVOKE E2E TESTLARI TO'LIQ O'TDI!");
    console.log("========================================================\n");
  } finally {
    await studentContext.close();
    await adminContext.close();
    await browser.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Testda xatolik:", err);
    process.exit(1);
  });
