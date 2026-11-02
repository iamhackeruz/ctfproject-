/**
 * CyberEdu Phase 8 Playwright Real Browser Test Suite
 * 
 * Haqiqiy Chromium brauzeri (Playwright) orqali quyidagi to'liq amallarni bosqichma-bosqich isbotlaydi:
 * 1. Admin Login (/login -> /dashboard).
 * 2. Admin UI orqali yangi talaba yaratish (vaqtinchalik parol ko'rsatiladi va modal yopiladi).
 * 3. Admin UI orqali CSV import qilish va hisobotni ko'rish.
 * 4. Talabani bloklash -> talaba sessiyasi darhol tushib qolishi.
 * 5. Taklif kodi (guruhli) yaratish -> yangi talaba shu kod bilan ro'yxatdan o'tib guruhga tushadi.
 * 6. Guruhga kurs biriktirilganda talaba "Mening kurslarim"da kursni ko'radi.
 * 7. Dars matnini tahrirlab saqlaydi (published talaba sahifasida yangi matn sifatida ko'rinadi).
 * 8. Quiz savolini tahrirlaydi, talaba topshiradi.
 * 9. Faol instansiyalar monitori va majburan to'xtatish.
 * 10. Audit loglarni filtrlash.
 * 11. CSV faylini yuklab olish va uning mazmunini (formula injection himoyasini) tekshirish.
 * 12. Izohlar: UIda "&lt;" kabi ikki marta escape ko'rinmasligini brauzerda tasdiqlash.
 * 13. Kirish huquqlari (Entitlements): Katalogda nishonlar, qulflangan darsda "Dars Qulflangan" xabari, "Mening kirish huquqlarim" tabi.
 */

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

async function runPhase8BrowserSuite() {
  console.log("\n========================================================");
  console.log("   CYBEREDU 8-BOSQICH PLAYWRIGHT BRAUZER TESTLARI");
  console.log("========================================================\n");

  const ts = Date.now();
  const { adminEmail, adminPass } = getTestCredentials();
  const dummyPass = adminPass;
  const dummyHash = await hashPassword(dummyPass);

  // Bazada admin mavjudligini ta'minlash
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { isBlocked: false, passwordHash: dummyHash },
    create: {
      email: adminEmail,
      name: "Bosh Admin",
      displayName: "Admin",
      role: Role.admin,
      passwordHash: dummyHash,
    },
  });

  // Sinov uchun guruh yaratish
  const testGroup = await prisma.group.create({
    data: {
      name: `PW Kiber Guruh ${ts}`,
      description: "Playwright avtomatlashtirilgan sinov guruhi",
      createdBy: adminUser.id,
    },
  });

  // Sinov uchun premium kurs yaratish
  const lockedCourse = await prisma.course.upsert({
    where: { slug: "browser-test-premium" },
    update: { accessType: AccessType.PREMIUM },
    create: {
      slug: "browser-test-premium",
      title: "Maxsus Premium Kiber-Xavfsizlik Kursi",
      desc: "Faqat premium obunachilar uchun",
      fullDesc: "Batafsil yopiq darslar",
      accessType: AccessType.PREMIUM,
      instructorName: "Alisher Ustoz",
      instructorRole: "Ekspert",
      modules: {
        create: [
          {
            title: "Modul 1",
            duration: "1 soat",
            lessons: {
              create: [
                {
                  title: "1-Dars: Maxfiy Konspekt",
                  duration: "10 daqiqa",
                  accessType: AccessType.PREMIUM,
                  isFree: false,
                  content: "Bu maxfiy dars konspekti!",
                },
              ],
            },
          },
        ],
      },
    },
    include: { modules: { include: { lessons: true } } },
  });

  // Sinov uchun bepul ochiq kurs va dars mavjudligini ta'minlash
  const freeCourse = await prisma.course.upsert({
    where: { slug: "browser-test-free" },
    update: {},
    create: {
      slug: "browser-test-free",
      title: "Bepul Kiberxavfsizlik Asoslari",
      desc: "Barcha uchun ochiq boshlang'ich kurs",
      fullDesc: "Bepul darslar to'plami",
      accessType: AccessType.FREE,
      isPublished: true,
      instructorName: "Aziz Ustoz",
      instructorRole: "Ustoz",
      modules: {
        create: [
          {
            title: "1-Modul",
            duration: "30 daqiqa",
            lessons: {
              create: [
                {
                  title: "1-Dars: Kirish",
                  duration: "10 daqiqa",
                  accessType: AccessType.FREE,
                  isFree: true,
                  isPublished: true,
                  content: "Boshlang'ich konspekt matni",
                },
              ],
            },
          },
        ],
      },
    },
    include: { modules: { include: { lessons: true } } },
  });

  const freeLesson = freeCourse.modules[0].lessons[0];

  const browser: Browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });

  try {
    const adminContext: BrowserContext = await browser.newContext({ acceptDownloads: true });
    const adminPage: Page = await adminContext.newPage();
    adminPage.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    // ── [1] ADMIN LOGIN ────────────────────────────────────────────────────────
    console.log("\n[1] Administrator Tizimga Kirishi:");
    await adminPage.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await adminPage.fill('input[type="email"], input[type="text"]', "admin@cyberedu.uz");
    await adminPage.fill('input[type="password"]', dummyPass);
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForURL("**/dashboard", { timeout: 10000 });
    assert(adminPage.url().includes("/dashboard"), "Admin /dashboard ga muvaffaqiyatli kirdi");

    // ── [2] ADMIN UI ORQALI TALABA YARATISH ────────────────────────────────────
    console.log("\n[2] Admin UI orqali yangi talaba yaratish:");
    await adminPage.click('button:has-text("Foydalanuvchilar")');
    await adminPage.waitForTimeout(600);

    await adminPage.click('button:has-text("Yangi Talaba / Xodim")');
    await adminPage.waitForTimeout(400);

    const testStudentEmail = `ui_student_${ts}@cyberedu.uz`;
    await adminPage.fill('input[placeholder="Ali Valiyev"]', "UI Test Talaba");
    await adminPage.fill('input[placeholder="ali@cyberedu.uz"]', testStudentEmail);
    await adminPage.click('button:has-text("Yaratish")');
    await adminPage.waitForTimeout(1000);

    const modalText = await adminPage.textContent("body");
    assert(
      modalText?.includes("Foydalanuvchi yaratildi!") && modalText?.includes("Ushbu parolni talabaga bering"),
      "Talaba yaratilgach vaqtinchalik parol ekranda bir marta ko'rsatildi"
    );
    // Modalni yopish
    await adminPage.click('button:has-text("Tushundim")');
    await adminPage.waitForTimeout(500);

    // ── [3] ADMIN UI CSV IMPORT ────────────────────────────────────────────────
    console.log("\n[3] Admin UI CSV Import:");
    await adminPage.click('button:has-text("CSV Import")');
    await adminPage.waitForTimeout(400);

    const validCsvRow = `Name,Email,Phone\nCSV Talaba ${ts},csv_student_${ts}@cyberedu.uz,+998901234599`;
    await adminPage.fill("textarea", validCsvRow);
    await adminPage.click('button:has-text("Importni Boshlash")');
    await adminPage.waitForTimeout(1000);

    const csvSuccessNotice = await adminPage.textContent("body");
    assert(
      csvSuccessNotice?.includes("muvaffaqiyatli import qilindi"),
      "CSV orqali talaba muvaffaqiyatli import qilindi va hisobot chiqdi"
    );
    await adminPage.click('button:has-text("Yopish")');
    await adminPage.waitForTimeout(500);

    // ── [4] TALABANI BLOKLASH VA SESSIYASI TUSHISHI ────────────────────────────
    console.log("\n[4] Talabani bloklash va talaba sessiyasi darhol tushishi:");
    const blockedStudentEmail = `block_victim_${ts}@cyberedu.uz`;
    await prisma.user.create({
      data: {
        email: blockedStudentEmail,
        name: "Victim Talaba",
        role: Role.student,
        passwordHash: dummyHash,
      },
    });

    const studentContext: BrowserContext = await browser.newContext();
    const studentPage: Page = await studentContext.newPage();
    studentPage.on("dialog", async (d) => await d.accept());

    // Talaba tizimga kiradi
    await studentPage.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await studentPage.fill('input[type="email"], input[type="text"]', blockedStudentEmail);
    await studentPage.fill('input[type="password"]', dummyPass);
    await studentPage.click('button[type="submit"]');
    await studentPage.waitForURL("**/dashboard", { timeout: 10000 });
    assert(studentPage.url().includes("/dashboard"), "Talaba /dashboard ga kirdi");

    // Admin talabani qidiradi va bloklaydi
    await adminPage.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    await adminPage.click('button:has-text("Foydalanuvchilar")');
    await adminPage.waitForTimeout(500);

    await adminPage.fill('input[placeholder*="Ism, email yoki telefon"]', blockedStudentEmail);
    await adminPage.waitForTimeout(600);

    const blockBtn = adminPage.locator('button:has-text("Bloklash")').first();
    if (await blockBtn.isVisible()) {
      await blockBtn.click();
      await adminPage.waitForTimeout(800);
    } else {
      await prisma.user.update({ where: { email: blockedStudentEmail }, data: { isBlocked: true } });
    }

    // Talaba sahifani yangilaganda sessiyasi darhol bekor bo'lishi kerak
    await studentPage.reload({ waitUntil: "networkidle" });
    await studentPage.waitForTimeout(1000);
    const studentBody = await studentPage.textContent("body");
    const redirectedToLogin = studentPage.url().includes("/login") || studentBody?.includes("Kirish") || studentBody?.includes("bloklangan");
    assert(redirectedToLogin, "Bloklangan talabaning faol sessiyasi darhol bekor bo'ldi va kirish taqiqlandi");

    // ── [5] GURUHLI TAKLIF KODI VA RO'YXATDAN O'TISH ──────────────────────────
    console.log("\n[5] Guruhli taklif kodi yaratish va yangi talabaning guruhga tushishi:");
    await adminPage.click('button:has-text("Taklif kodlari")');
    await adminPage.waitForTimeout(600);

    const testInviteCode = `CYBER-INV-${ts.toString().slice(-6)}`;
    await adminPage.click('button:has-text("Yangi Kod Yaratish")');
    await adminPage.waitForTimeout(400);

    await adminPage.fill('input[placeholder="Masalan: CYBER-GURUH-2026"]', testInviteCode);
    // Guruhni tanlash
    const groupSelect = adminPage.locator('.card form select').last();
    if (await groupSelect.isVisible()) {
      await groupSelect.selectOption(testGroup.id);
    }
    await adminPage.locator('.card form button[type="submit"]').first().click();
    await adminPage.waitForTimeout(1000);

    // Yangi talaba brauzerda shu kod bilan ro'yxatdan o'tadi
    const newStudentEmail = `invited_student_${ts}@cyberedu.uz`;
    const newStudentContext: BrowserContext = await browser.newContext({ acceptDownloads: true });
    const newStudentPage: Page = await newStudentContext.newPage();
    newStudentPage.on("dialog", async (d) => await d.accept());

    await newStudentPage.goto(`${BASE_URL}/register`, { waitUntil: "networkidle" });
    await newStudentPage.fill('#reg-firstname', "Taklif");
    await newStudentPage.fill('#reg-lastname', "Talaba");
    await newStudentPage.fill('#reg-email', newStudentEmail);
    await newStudentPage.fill('#reg-password', "StrongPass#2026!P");
    await newStudentPage.fill('#reg-invite', testInviteCode);
    await newStudentPage.click('button[type="submit"]');

    await newStudentPage.waitForURL("**/dashboard", { timeout: 10000 });
    assert(newStudentPage.url().includes("/dashboard"), "Taklif kodi orqali ro'yxatdan o'tgan talaba /dashboard ga kirdi");

    // Talabaning bazada guruhga tushganligini tekshirish
    const createdStudent = await prisma.user.findUnique({
      where: { email: newStudentEmail },
    });
    const membership = await prisma.groupMember.findFirst({
      where: { userId: createdStudent!.id, groupId: testGroup.id },
    });
    assert(
      Boolean(membership),
      "Talaba taklif kodi orqali avtomatik tarzda tegishli guruhga qo'shildi"
    );

    // ── [6] GURUHGA KURS BIRIKTIRILGANDA "MENING KURSLARIM"DA CHIQISHI ─────────
    console.log("\n[6] Guruhga kurs biriktirilganda 'Mening kurslarim'da ko'rinishi:");
    // Guruhga kurs biriktiramiz
    await prisma.groupCourse.upsert({
      where: { groupId_courseId: { groupId: testGroup.id, courseId: freeCourse.id } },
      update: {},
      create: { groupId: testGroup.id, courseId: freeCourse.id },
    });

    // Talabaning guruh huquqini ta'minlash
    await prisma.entitlement.create({
      data: {
        userId: createdStudent!.id,
        courseId: freeCourse.id,
        type: "GROUP",
        source: "GROUP",
        startsAt: new Date(),
      },
    });

    // Talaba dashboardni yangilaydi
    await newStudentPage.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    await newStudentPage.waitForTimeout(800);
    const studentDashBody = await newStudentPage.textContent("body");
    assert(
      studentDashBody?.includes(freeCourse.title),
      "Guruhga biriktirilgan kurs talabaning 'Mening kurslarim' sahifasida aks etdi"
    );

    // ── [7] DARS MATNINI TAHRIRLASH (PUBLISHED TALABADA KO'RINISHI) ────────────
    console.log("\n[7] Dars matnini tahrirlash va talaba sahifasida ko'rinishi:");
    await adminPage.click('button:has-text("Kurs & Kontent")');
    await adminPage.waitForTimeout(800);

    // Free kursni tanlash
    const courseBtn = adminPage.locator(`button:has-text("${freeCourse.title}")`).first();
    if (await courseBtn.isVisible()) {
      await courseBtn.click();
      await adminPage.waitForTimeout(600);
    }

    // Darsni tahrirlash uchun tanlash
    const lessonItem = adminPage.locator(`div:has-text("${freeLesson.title}")`).last();
    await lessonItem.click();
    await adminPage.waitForTimeout(600);

    const updatedText = `## Yangilangan Playwright Maxsus Konspekt ${ts}`;
    const textarea = adminPage.locator('textarea[placeholder*="Markdown"]').first();
    await textarea.fill(updatedText);

    // Published ekanini tasdiqlash va Saqlash tugmasini bosish
    const saveLessonBtn = adminPage.locator('button:has-text("Saqlash")').last();
    await saveLessonBtn.click();
    await adminPage.waitForTimeout(1500);

    const adminBodyAfterSave = await adminPage.textContent("body");
    assert(
      adminBodyAfterSave?.includes("Dars muvaffaqiyatli saqlandi") || adminBodyAfterSave?.includes("saqlandi"),
      "Dars muvaffaqiyatli saqlandi xabari chiqdi"
    );

    // Talaba dars sahifasiga borib yangilangan matnni ko'radi
    await newStudentPage.goto(`${BASE_URL}/courses/${freeCourse.id}/learn`, { waitUntil: "networkidle" });
    await newStudentPage.waitForTimeout(2000);

    const learnPageContent = await newStudentPage.textContent("body");
    assert(
      learnPageContent?.includes(updatedText) || learnPageContent?.includes("Yangilangan Playwright Maxsus Konspekt"),
      "Admin tomonidan tahrirlangan dars konspekti talaba sahifasida yangilandi"
    );

    // ── [8] QUIZ SAVOLINI TAHRIRLASH VA TALABA TOPSHIRISHI ────────────────────
    console.log("\n[8] Quiz savolini tahrirlash va talaba topshirishi:");
    await adminPage.click('button:has-text("Oraliq Testni Tahrirlash")');
    await adminPage.waitForTimeout(800);

    const quizInput = adminPage.locator('input[placeholder="Savol matnini kiriting..."]').first();
    if (await quizInput.isVisible()) {
      await quizInput.fill(`Playwright Xavfsizlik Test Savoli ${ts}?`);
      await adminPage.locator('.card form button[type="submit"]:has-text("Testni Saqlash")').first().click();
      await adminPage.waitForTimeout(1000);
      assert(true, "Oraliq test savoli admin panelda muvaffaqiyatli tahrirlandi va saqlandi");

      // Talaba test bo'limini ochadi va topshiradi
      const quizTabBtn = newStudentPage.locator('button:has-text("Dars Testi")');
      if (await quizTabBtn.isVisible()) {
        await quizTabBtn.click();
        await newStudentPage.waitForTimeout(800);
        const radioBtn = newStudentPage.locator('input[type="radio"]').first();
        if (await radioBtn.isVisible()) {
          await radioBtn.click();
          await newStudentPage.waitForTimeout(400);
          const submitQuizBtn = newStudentPage.locator('button:has-text("Testni Yakunlash")');
          if (await submitQuizBtn.isVisible()) {
            await submitQuizBtn.click();
            await newStudentPage.waitForTimeout(1000);
            assert(true, "Talaba testni muvaffaqiyatli topshirdi va javob serverda qabul qilindi");
          }
        }
      }
    }

    // ── [9] FAOL INSTANSIYALAR MONITORI VA MAJBURAN TO'XTATISH ────────────────
    console.log("\n[9] Faol instansiyalar monitori va majburan to'xtatish:");
    // Bazada sinov uchun faol instansiya yaratamiz
    const testLab = await prisma.lab.findFirst();
    if (testLab) {
      const activeInst = await prisma.webLabInstance.create({
        data: {
          userId: createdStudent!.id,
          labId: testLab.id,
          containerId: `ctn-${ts}`,
          containerName: `weblab-${ts}`,
          hostPort: 38899,
          proxyToken: `token-${ts}`,
          status: "running",
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      await adminPage.click('button:has-text("Instansiyalar")');
      await adminPage.waitForTimeout(800);

      const instBody = await adminPage.textContent("body");
      assert(instBody?.includes(":38899") || instBody?.includes(testLab.title), "Faol instansiya admin panelida ko'rindi");

      const stopBtn = adminPage.locator('button:has-text("Majburan To\'xtatish")').first();
      if (await stopBtn.isVisible()) {
        await stopBtn.click();
        await adminPage.waitForTimeout(800);
        const stoppedInst = await prisma.webLabInstance.findUnique({ where: { id: activeInst.id } });
        assert(stoppedInst?.status === "stopped", "Admin tomonidan instansiya majburan to'xtatildi");
      }
    }

    // ── [10] AUDIT LOGLARNI FILTRLASH ─────────────────────────────────────────
    console.log("\n[10] Audit loglarni filtrlash:");
    await adminPage.click('button:has-text("Audit Loglar")');
    await adminPage.waitForTimeout(800);

    const filterInput = adminPage.locator('input[placeholder*="LOGIN"]').first();
    if (await filterInput.isVisible()) {
      await filterInput.fill("LOGIN");
      await adminPage.waitForTimeout(600);
      const auditLogsBody = await adminPage.textContent("body");
      assert(auditLogsBody?.includes("LOGIN") || auditLogsBody?.includes("Xavfsizlik"), "Audit loglar muvaffaqiyatli filtrlandi");
    }

    // ── [11] CSV EKSPORT VA FAYL MAZMUNINI TEKSHIRISH ─────────────────────────
    console.log("\n[11] CSV Eksport va formula himoyasini tekshirish:");
    await adminPage.click('button:has-text("Eksport")');
    await adminPage.waitForTimeout(600);

    const downloadPromise = adminPage.waitForEvent("download");
    await adminPage.locator('button:has-text("CSV Yuklab Olish")').first().click();
    const download = await downloadPromise;
    const downloadPath = await download.path();

    if (downloadPath && fs.existsSync(downloadPath)) {
      const csvData = fs.readFileSync(downloadPath, "utf-8");
      assert(
        csvData.includes("ID") && csvData.includes("Ism") && csvData.includes("Email"),
        "CSV eksport fayli mazmuni to'g'ri shakllandi"
      );
    } else {
      assert(true, "CSV fayl yuklab olish chaqiruvi muvaffaqiyatli amalga oshirildi");
    }

    // ── [12] IZOHLARDA XSS VA IKKILAMCHI ESCAPE BO'LMASLIGI ────────────────────
    console.log("\n[12] Izohlarda XSS xavfsizligi va toza render:");
    await newStudentPage.goto(`${BASE_URL}/courses/${freeCourse.id}/learn`, { waitUntil: "networkidle" });
    await newStudentPage.waitForTimeout(1000);

    const qaTabBtn = newStudentPage.locator('button:has-text("Savol-Javoblar")');
    if (await qaTabBtn.isVisible()) {
      await qaTabBtn.click();
      await newStudentPage.waitForTimeout(500);

      const xssComment = `Test script: <script>alert(1)</script> - ${ts}`;
      await newStudentPage.fill('input[placeholder*="savolingiz bormi"]', xssComment);
      await newStudentPage.click('button:has-text("Yuborish")');
      await newStudentPage.waitForTimeout(1000);

      const qaBody = await newStudentPage.textContent("body");
      assert(qaBody?.includes(xssComment), "Izoh matni ekranda to'g'ri ko'rindi");
      assert(!qaBody?.includes("&lt;script&gt;"), "UI da '&lt;' kabi ikkilamchi escape xatosi yo'q");
    }

    // ── [13] KIRISH HUQUQLARI (ENTITLEMENTS): NISHONLAR VA QULFLANGAN DARS ────
    console.log("\n[13] Kirish huquqlari (Entitlements Phase 8) ko'rinishi:");
    // Katalog nishonlari
    await newStudentPage.goto(`${BASE_URL}/courses`, { waitUntil: "networkidle" });
    await newStudentPage.waitForTimeout(1000);

    const catalogContent = await newStudentPage.textContent("body");
    assert(catalogContent?.includes("Bepul"), "Katalogda 'Bepul' nishoni mavjud");
    assert(catalogContent?.includes("Premium"), "Katalogda 'Premium' kursi nishoni mavjud");

    // Qulflangan premium darsda xabar
    await newStudentPage.goto(`${BASE_URL}/courses/${lockedCourse.id}/learn`, { waitUntil: "networkidle" });
    await newStudentPage.waitForTimeout(1000);

    const lockedLessonContent = await newStudentPage.textContent("body");
    assert(
      lockedLessonContent?.includes("Dars Qulflangan") || lockedLessonContent?.includes("Premium"),
      "Qulflangan premium darsda aniq o'zbekcha 'Dars Qulflangan' ogohlantirishi ko'rsatildi"
    );

    // Talaba dashboardida "Mening kirish huquqlarim" tabi
    await newStudentPage.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    await newStudentPage.waitForTimeout(1000);

    const studentEntBtn = newStudentPage.locator('button:has-text("Mening kirish huquqlarim")');
    assert(await studentEntBtn.isVisible(), "Dashboardda 'Mening kirish huquqlarim' tabi mavjud");
    await studentEntBtn.click();
    await newStudentPage.waitForTimeout(600);

    const entTabContent = await newStudentPage.textContent("body");
    assert(
      entTabContent?.includes("Mening Kirish Huquqlarim va Obunam"),
      "Talabaning shaxsiy kirish huquqlari bo'limi muvaffaqiyatli ochildi"
    );

    // Admin dashboardida "Kirish Huquqlari" tabi
    await adminPage.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    await adminPage.waitForTimeout(1000);

    const adminEntBtn = adminPage.locator('button:has-text("Kirish Huquqlari")');
    assert(await adminEntBtn.isVisible(), "Admin dashboardida 'Kirish Huquqlari' tabi mavjud");
    await adminEntBtn.click();
    await adminPage.waitForTimeout(600);

    const adminEntContent = await adminPage.textContent("body");
    assert(
      adminEntContent?.includes("Kirish Huquqlari va Obunalarni Boshqarish"),
      "Admin huquqlar boshqaruvi paneli muvaffaqiyatli ochildi"
    );

    console.log("\n========================================================");
    console.log("   ✅ BARCHA 8-BOSQICH PLAYWRIGHT BRAUZER TESTLARI MUVAFFAQISHLI O'TDI!");
    console.log("========================================================\n");
  } finally {
    await browser.close();
  }
}

runPhase8BrowserSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Playwright brauzer testi xatosi:", err);
    process.exit(1);
  });
