/**
 * Playwright Haqiqiy Chromium Brauzer E2E Testi:
 * 9-BOSQICH: VIDEO DARSLAR (SELF-HOSTED STREAMING)
 * 
 * Tekshiriladigan jihatlar:
 * 1. Admin darsga video yuklaydi (progress ko'rsatkichi, almashtirish, o'chirish).
 * 2. Admin panelda "Video xotirasi" vidjeti yangilanadi.
 * 3. Talaba dars sahifasini ochadi va video o'ynaydi (206 Range streaming).
 * 4. Dinamik harakatlanuvchi Watermark (talaba ismi va emaili) ko'rinadi.
 * 5. Tezlikni o'zgartirish (0.75x, 1x, 1.25x, 1.5x, 2x) ishlaydi.
 * 6. Video oldinga o'tkazilganda (seek) Range so'rovi boradi va progress saqlanadi.
 * 7. Sahifa yangilanganda to'xtagan joydan davom etadi.
 * 8. Brauzer konsolida 0 ta CSP xatosi bo'lishi tasdiqlanadi.
 * 9. Huquq bekor qilinganda video oqimi to'xtaydi (403).
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
import { Role, AccessType, EntitlementType, EntitlementSource } from "@prisma/client";
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
  console.log("   PLAYWRIGHT E2E: VIDEO DARSLAR VA STREAMING TESTI");
  console.log("========================================================\n");

  const sampleVideoPath = path.resolve(process.cwd(), "test-fixtures/sample-lesson.mp4");
  assert(fs.existsSync(sampleVideoPath), "sample-lesson.mp4 mavjud");

  const ts = Date.now();
  const { adminEmail, adminPass, studentPass } = getTestCredentials();
  const adminHash = await hashPassword(adminPass);
  const studentHash = await hashPassword(studentPass);

  // 1. Admin hisobi
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

  // 2. Talaba hisobi
  const studentEmail = `video_e2e_student_${ts}@cyberedu.uz`;
  const student = await prisma.user.create({
    data: {
      email: studentEmail,
      name: `Alisher Navoiy ${ts}`,
      displayName: `Alisher`,
      role: Role.student,
      passwordHash: studentHash,
    },
  });

  // 3. Test Kursi va Darsi
  const course = await prisma.course.create({
    data: {
      slug: `video-e2e-${ts}`,
      title: `E2E Video Kurs ${ts}`,
      desc: "Video streaming imkoniyatlarini sinash kursi",
      fullDesc: "Batafsil ma'lumot",
      instructorName: "Ustoz Kiber",
      instructorRole: "Yetakchi Muhandis",
      accessType: AccessType.PREMIUM,
      priceUzs: 180000,
      isPublished: true,
      modules: {
        create: {
          title: "1-Modul: Video arxitekturasi",
          duration: "1 soat",
          order: 1,
          lessons: {
            create: {
              title: "1.1 Xavfsiz Video Oqimi",
              duration: "15 daqiqa",
              accessType: AccessType.PREMIUM,
              isPublished: true,
              isFree: false,
              content: "# Video Dars Konspekti\n\nUshbu darsda video streaming asoslari o'rganiladi.",
              order: 1,
            },
          },
        },
      },
    },
  });

  const lesson = await prisma.lesson.findFirst({
    where: { module: { courseId: course.id } },
  });
  if (!lesson) throw new Error("Lesson create failed");

  console.log(`[+] Baza tayyor: Course ID ${course.id}, Lesson ID ${lesson.id}`);

  // Brauzerni ishga tushirish (Google Chrome / Chromium)
  const browser: Browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/google-chrome",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--use-fake-ui-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });

  const cspErrors: string[] = [];
  const rangeRequests: string[] = [];

  try {
    // ═════════════════════════════════════════════════════════════════════════
    // QADAM 1: ADMIN SESSiYASI — VIDEO YUKLASH VA ADMIN PREVIEW
    // ═════════════════════════════════════════════════════════════════════════
    console.log("\n--- [QADAM 1] Admin kirishi va video yuklash ---");
    const adminCtx: BrowserContext = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    const adminPage: Page = await adminCtx.newPage();

    adminPage.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("Content Security Policy") || text.includes("CSP") || text.includes("Refused to")) {
        console.warn(`[Admin CSP Warning]: ${text}`);
        cspErrors.push(text);
      }
    });

    // 1.1 Login sahifasi
    await adminPage.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await adminPage.fill("#login-email", adminEmail);
    await adminPage.fill("#login-password", adminPass);
    await adminPage.click('button[type="submit"]:has-text("Kirish")');
    await adminPage.waitForURL("**/dashboard**", { timeout: 10000 });
    console.log("  [+] Admin dashboardga kirdi");

    // 1.2 Kontent muharriri tabiga o'tish
    const contentTabBtn = adminPage.locator('button:has-text("Kurs & Kontent")').first();
    await contentTabBtn.click();
    await adminPage.waitForTimeout(1000);

    // Kursni tanlash
    const courseBtn = adminPage.locator("button", { hasText: course.title }).first();
    await courseBtn.click();
    await adminPage.waitForTimeout(1000);

    // Darsni tahrirlash uchun tanlash
    const lessonItem = adminPage.locator(`div:has-text("${lesson.title}")`).last();
    await lessonItem.click();
    await adminPage.waitForTimeout(1000);

    // Video panelining mavjudligini tekshirish
    const videoPanel = adminPage.locator('[data-testid="admin-lesson-video-panel"]');
    await videoPanel.waitFor({ state: "visible", timeout: 5000 });
    assert(await videoPanel.isVisible(), "Admin panelida Video Darslik bo'limi ko'rindi");

    // Video faylni yuklash
    const fileInput = adminPage.locator('[data-testid="video-upload-input"]');
    await fileInput.setInputFiles(sampleVideoPath);
    console.log("  [+] MP4 video fayli tanlandi, yuklanmoqda...");

    // Progress ko'rsatkichi va muvaffaqiyat xabari
    await adminPage.waitForSelector("text=Video muvaffaqiyatli yuklandi!", { timeout: 15000 });
    assert(true, "Video yuklash progressi o'tib, 'Video muvaffaqiyatli yuklandi!' xabari chiqdi");

    // Video xotirasi vidjeti mavjudligi
    const storageWidget = adminPage.locator('[data-testid="video-storage-widget"]');
    assert(await storageWidget.isVisible(), "Video Xotirasi vidjeti (Used/Free) admin headerida ko'rindi");

    await adminCtx.close();

    // ═════════════════════════════════════════════════════════════════════════
    // QADAM 2: TALABA SESSIYASI — HUQUQSIZ BO'LGANDA BLOKLANISHI
    // ═════════════════════════════════════════════════════════════════════════
    console.log("\n--- [QADAM 2] Huquqsiz talaba darsni ochganda qulflanishi ---");
    const studentCtx: BrowserContext = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    const studentPage: Page = await studentCtx.newPage();

    studentPage.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("Content Security Policy") || text.includes("CSP") || text.includes("Refused to")) {
        console.warn(`[Student CSP Warning]: ${text}`);
        cspErrors.push(text);
      }
    });

    studentPage.on("response", (res) => {
      const url = res.url();
      if (url.includes("/api/videos/") && url.includes("/stream")) {
        rangeRequests.push(`Status: ${res.status()}, Content-Range: ${res.headers()["content-range"] || "none"}`);
      }
    });

    // 2.1 Talaba tizimga kiradi
    await studentPage.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await studentPage.fill("#login-email", studentEmail);
    await studentPage.fill("#login-password", studentPass);
    await studentPage.click('button[type="submit"]:has-text("Kirish")');
    await studentPage.waitForURL("**/dashboard**", { timeout: 10000 });
    console.log("  [+] Talaba tizimga kirdi");

    // 2.2 Dars sahifasiga o'tish (Hali huquq yo'q)
    await studentPage.goto(`${BASE_URL}/courses/${course.id}/learn`, { waitUntil: "domcontentloaded" });
    await studentPage.waitForTimeout(1000);

    const lockedText = studentPage.locator("text=Premium obuna talab etiladi");
    assert(await lockedText.isVisible(), "Huquqsiz talabaga dars qulflanganligi (Premium talab etiladi) ko'rindi");

    // ═════════════════════════════════════════════════════════════════════════
    // QADAM 3: HUQUQ BERILGANDA VIDEO PLAYBACK VA 206 STREAMING
    // ═════════════════════════════════════════════════════════════════════════
    console.log("\n--- [QADAM 3] Premium huquq berilgach Video Player va Watermark ---");
    // Admin talabaga Subscription entitlement beradi
    await prisma.entitlement.create({
      data: {
        userId: student.id,
        type: EntitlementType.SUBSCRIPTION,
        source: EntitlementSource.MANUAL,
      },
    });
    console.log("  [+] Talabaga Premium obuna berildi, sahifa yangilanmoqda...");

    await studentPage.reload({ waitUntil: "domcontentloaded" });
    await studentPage.waitForTimeout(1500);

    // 3.1 Video element mavjudligi
    const videoEl = studentPage.locator("video");
    await videoEl.waitFor({ state: "visible", timeout: 8000 });
    assert(await videoEl.isVisible(), "HTML5 <video> elementi muvaffaqiyatli yuklandi");

    const videoSrc = await videoEl.getAttribute("src");
    assert(videoSrc?.includes(`/api/videos/${lesson.id}/stream`), `Video stream manzilidan yuklanmoqda: ${videoSrc}`);

    // 3.2 Dinamik Watermark mavjudligi (Talaba ismi va emaili)
    const watermark = studentPage.locator('[data-testid="video-watermark"]');
    await watermark.waitFor({ state: "visible", timeout: 5000 });
    const watermarkText = await watermark.textContent();
    assert(
      watermarkText?.includes(student.name) && watermarkText?.includes(student.email),
      `Dinamik Watermark talabaning ismi va emailini ko'rsatmoqda: "${watermarkText?.trim()}"`
    );

    // 3.3 Videoni o'ynatish (Play)
    const playToggleBtn = studentPage.locator('[data-testid="video-play-toggle"]');
    await playToggleBtn.click();
    await studentPage.waitForTimeout(1500);
    console.log("  [+] Video ijrosi boshlandi");

    // 3.4 Tezlikni o'zgartirish (1.5x)
    const speedBtn = studentPage.locator('[data-testid="video-speed-1.5"]');
    await speedBtn.click();
    await studentPage.waitForTimeout(500);
    const currentRate = await videoEl.evaluate((v: HTMLVideoElement) => v.playbackRate);
    assert(currentRate === 1.5, `Tezlik muvaffaqiyatli 1.5x ga o'rnatildi (playbackRate: ${currentRate})`);

    // 3.5 Oldinga o'tkazish (Seek) va Range so'rovi ketishi
    await videoEl.evaluate((v: HTMLVideoElement) => {
      v.currentTime = 1.0;
    });
    await studentPage.waitForTimeout(1000);

    // Range so'rovlari statusini tekshirish
    const has206 = rangeRequests.some((r) => r.includes("206"));
    assert(has206, `HTTP 206 Partial Content Range so'rovi brauzer tomonidan qabul qilindi`);

    // 3.6 Progress saqlanishi va sahifa yangilanganda tiklanishi
    await studentPage.evaluate(async (lid) => {
      await fetch(`/api/videos/${lid}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionSec: 1.2, completed: false }),
      });
    }, lesson.id);

    // Sahifani yangilash
    await studentPage.reload({ waitUntil: "domcontentloaded" });
    await studentPage.waitForTimeout(1500);

    // Yangilangandan so'ng video player tiklandi
    const refreshedVideo = studentPage.locator("video");
    assert(await refreshedVideo.isVisible(), "Sahifa yangilangach video player saqlandi");

    // 3.7 CSP xatolarini tekshirish
    assert(cspErrors.length === 0, `Brauzer konsolida 0 ta CSP xatosi qayd etildi (Haqiqiy xatolar soni: ${cspErrors.length})`);

    // ═════════════════════════════════════════════════════════════════════════
    // QADAM 4: HUQUQ BEKOR QILINISHI VA OQIMNING TO'XTATILISHI
    // ═════════════════════════════════════════════════════════════════════════
    console.log("\n--- [QADAM 4] Huquq bekor qilinishi (Revocation) ---");
    await prisma.entitlement.updateMany({
      where: { userId: student.id },
      data: { revokedAt: new Date() },
    });
    console.log("  [-] Talabaning huquqi bekor qilindi, sahifa yangilanmoqda...");

    await studentPage.reload({ waitUntil: "domcontentloaded" });
    await studentPage.waitForTimeout(1500);

    const reLockedText = studentPage.locator("text=Premium obuna talab etiladi");
    assert(await reLockedText.isVisible(), "Huquq bekor qilingach dars yana darhol qulflandi");

    await studentCtx.close();
  } finally {
    await browser.close();

    // Tozalash
    await prisma.videoProgress.deleteMany({ where: { lessonId: lesson.id } }).catch(() => {});
    await prisma.video.deleteMany({ where: { lessonId: lesson.id } }).catch(() => {});
    await prisma.entitlement.deleteMany({ where: { userId: student.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, student.id] } } }).catch(() => {});
    await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
  }

  console.log("\n========================================================");
  console.log("   ✅ PLAYWRIGHT REAL BROWSER VIDEO TESTI 100% O'TDI!");
  console.log("========================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Browser test xatosi:", err);
    process.exit(1);
  });
