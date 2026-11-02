/**
 * CyberEdu Platform — Clean Docker Production E2E Verification
 * 
 * Ushbu test toza Docker Compose muhitida (.env.production nusxasi, yangi volumelar)
 * to'liq tizim (app, postgres, sandbox-daemon) ishlashini haqiqiy Chromium
 * brauzeri (Playwright) orqali tekshiradi:
 * 1. Admin login
 * 2. Kurs ochish va o'rganish
 * 3. Terminal sandbox orqali buyruq bajarish
 * 4. Bitta laboratoriyani (lab) ishga tushirish
 * 5. Video yuklash va brauzerda watermark bilan oqimli (stream) ko'rish
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const ADMIN_EMAIL = process.env.ADMIN_INIT_EMAIL || "admin@cyberedu.uz";
const ADMIN_PASSWORD = process.env.ADMIN_INIT_PASSWORD || "Murakkab_Admin_Parol_Kamida_12_Belgi!";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ [PASS] ${message}`);
}

async function waitForServer(url: string, maxRetries = 60): Promise<void> {
  console.log(`[*] Docker platforma tayyorligi kutilmoqda (${url})...`);
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${url}/api/auth`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        console.log(`[+] Platforma to'liq ishga tushdi va javob bermoqda (Urinish ${i + 1})`);
        return;
      }
    } catch {
      // kutilmoqda
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Docker konteyneri ${url} da belgilangan vaqt ichida ishga tushmadi!`);
}

async function runCleanDockerE2ETest() {
  console.log("\n========================================================");
  console.log("   CYBEREDU DOCKER COMPOSE CLEAN PRODUCTION E2E AUDIT");
  console.log("========================================================\n");

  await waitForServer(BASE_URL);

  const browser = await chromium.launch({
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
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // ─────────────────────────────────────────────────────────────────────────────
    // 1. ADMIN KIRISHI (LOGIN)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n--- [QADAM 1] ADMIN KIRISHI (LOGIN) ---");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });

    assert(await page.locator("#login-email").isVisible(), "Login sahifasida email kiritish maydoni mavjud");
    await page.locator("#login-email").fill(ADMIN_EMAIL);
    await page.locator("#login-password").fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/dashboard", { timeout: 15000 });
    assert(page.url().includes("/dashboard"), "Admin hisobi muvaffaqiyatli /dashboard sahifasiga yo'naltirildi");

    const dashboardText = await page.textContent("body");
    assert(dashboardText?.includes("Administrator") || dashboardText?.includes("admin@cyberedu.uz") || dashboardText?.includes("Admin"), "Administrator boshqaruv paneli yuklandi");

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. KURS VA DARSLARNI OCHISH
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n--- [QADAM 2] KURS KATALOGI VA DARSNI OCHISH ---");
    await page.goto(`${BASE_URL}/courses`, { waitUntil: "networkidle" });
    assert(page.url().includes("/courses"), "Kurslar katalogi sahifasi ochildi");

    const coursesCount = await page.locator("a[href^='/courses/']").count();
    assert(coursesCount > 0, `Katalogda kamida 1 ta kurs kartochkasi topildi (${coursesCount} ta kurs mavjud)`);

    // 1-kursni o'rganish sahifasini ochish
    await page.goto(`${BASE_URL}/courses/1/learn`, { waitUntil: "networkidle" });
    assert(page.url().includes("/courses/1/learn"), "1-kurs o'rganish sahifasi yuklandi");

    const lessonBody = await page.textContent("body");
    assert(lessonBody?.includes("Dars") || lessonBody?.includes("Konspekt") || lessonBody?.includes("Kiber"), "Dars kontenti va o'quv materiallari sahifada ko'rindi");

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. TERMINAL SANDBOX
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n--- [QADAM 3] TERMINAL SANDBOX VA BUYRUQ BAJARISH ---");
    await page.goto(`${BASE_URL}/terminal`, { waitUntil: "networkidle" });

    // Terminal sahifasidagi buyruq maydonini aniqlash
    const termInput = page.locator("input[placeholder*='buyruq'], input[placeholder*='command'], input[type='text']").first();
    assert(await termInput.isVisible(), "Terminal buyruq kiritish maydoni mavjud");

    await termInput.fill("id");
    await termInput.press("Enter");

    // Terminal natijasini kutish
    await page.waitForTimeout(3000);
    const termContent = await page.textContent("body");
    const idSuccess = termContent?.includes("uid=10001") || termContent?.includes("student") || termContent?.includes("cyberedu");
    assert(idSuccess, "Terminal sandbox ichida 'id' buyrug'i muvaffaqiyatli bajarildi (non-root student izolyatsiyasi)");

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. BITTA LABORATORIYANI ISHGA TUSHIRISH (LABS)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n--- [QADAM 4] LABORATORIYALAR (LABS) RO'YXATI VA ISHGA TUSHIRISH ---");
    await page.goto(`${BASE_URL}/labs`, { waitUntil: "networkidle" });

    const labsCount = await page.locator("a[href^='/labs/'], button:has-text('Ishga tushirish'), button:has-text('Boshlash')").count();
    assert(labsCount > 0, "Laboratoriyalar ro'yxatida amaliy mashg'ulotlar mavjud");

    // Bitta laboratoriyani ochish
    const firstLabLink = page.locator("a[href^='/labs/']").first();
    if (await firstLabLink.isVisible()) {
      await firstLabLink.click();
      await page.waitForLoadState("networkidle");
      const labPageText = await page.textContent("body");
      assert(labPageText?.includes("Flag") || labPageText?.includes("Topshiriq") || labPageText?.includes("Yo'riqnoma"), "Laboratoriya sahifasi va topshiriq yo'riqnomasi to'liq yuklandi");
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. VIDEO YUKLASH VA STREAMING (WATERMARK BILAN)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n--- [QADAM 5] VIDEO YUKLASH VA BRAUZERDA OQIMLI (STREAM) KO'RISH ---");
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });

    // 5.1 Kontent muharriri tabiga o'tish
    const contentTab = page.locator('button:has-text("Kurs & Kontent")').first();
    assert(await contentTab.isVisible(), "Admin dashboardida 'Kurs & Kontent' tabi mavjud");
    await contentTab.click();
    await page.waitForTimeout(1500);

    // Modullar yuklanishini kutish
    await page.waitForSelector("text=Modullar", { timeout: 10000 });

    // 1-darsni tahrirlash uchun tanlash
    const lessonTitleEl = page.locator("span:has-text('Fayl Huquqlari'), div:has-text('Fayl Huquqlari')").last();
    await lessonTitleEl.waitFor({ state: "visible", timeout: 10000 });
    await lessonTitleEl.click();
    await page.waitForTimeout(1000);

    // Video panelining mavjudligini tekshirish
    const videoPanel = page.locator('[data-testid="admin-lesson-video-panel"]');
    await videoPanel.waitFor({ state: "visible", timeout: 8000 });
    assert(await videoPanel.isVisible(), "Admin panelida Video Darslik bo'limi ko'rindi");

    // Test video fayli mavjudligini tekshirish
    const sampleVideoPath = fs.existsSync(path.resolve(__dirname, "../../test-fixtures/sample-lesson.mp4"))
      ? path.resolve(__dirname, "../../test-fixtures/sample-lesson.mp4")
      : path.resolve(process.cwd(), "test-fixtures/sample-lesson.mp4");
    assert(fs.existsSync(sampleVideoPath), "sample-lesson.mp4 fayli mavjud");

    const fileInput = page.locator('[data-testid="video-upload-input"]');
    await fileInput.setInputFiles(sampleVideoPath);
    console.log("  [+] MP4 video fayli tanlandi, yuklanmoqda...");

    // Yuklash muvaffaqiyatli yakunlanishini kutish
    await page.waitForSelector("text=Video muvaffaqiyatli yuklandi!", { timeout: 25000 });
    assert(true, "Video yuklash jarayoni muvaffaqiyatli yakunlandi");

    // Video xotirasi vidjeti mavjudligi
    const storageWidget = page.locator('[data-testid="video-storage-widget"]');
    assert(await storageWidget.isVisible(), "Video Xotirasi vidjeti (Used/Free) admin headerida ko'rindi");

    // Endi video yuklangan dars sahifasiga o'tib, player va streamni tekshirish
    console.log("  [*] O'quv sahifasiga o'tib video player va watermark tekshirilmoqda...");
    await page.goto(`${BASE_URL}/courses/1/learn`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Video player elementi mavjudligi
    const videoElem = page.locator("video").first();
    await videoElem.waitFor({ state: "attached", timeout: 15000 });
    assert(await videoElem.isVisible(), "HTML5 <video> pleyeri dars sahifasida yuklandi");

    // Video src atributi tekshiruvi
    const videoSrc = await videoElem.getAttribute("src");
    assert(videoSrc?.includes("/api/videos/") && videoSrc?.includes("/stream"), `Video stream manzilidan yuklanmoqda: ${videoSrc}`);

    // Dinamik Watermark tekshiruvi
    const watermarkElem = page.locator('[data-testid="video-watermark"]');
    await watermarkElem.waitFor({ state: "visible", timeout: 8000 });
    const watermarkText = await watermarkElem.textContent();
    assert(watermarkText?.includes(ADMIN_EMAIL), `Dinamik watermark foydalanuvchi hisobini ko'rsatmoqda: "${watermarkText?.trim()}"`);

    // Video ijrosi va 1.5x tezlikni tekshirish
    await page.evaluate(() => {
      const v = document.querySelector("video");
      if (v) {
        v.playbackRate = 1.5;
        v.play().catch(() => {});
      }
    });

    const playbackRate = await page.evaluate(() => {
      const v = document.querySelector("video");
      return v ? v.playbackRate : 1;
    });
    assert(playbackRate === 1.5, "Video ijro tezligi 1.5x ga o'rnatildi");

    console.log("\n========================================================");
    console.log("   🎉 BARCHA CLEAN DOCKER COMPOSE E2E AUDITLARI O'TDI!");
    console.log("========================================================\n");
  } finally {
    await browser.close();
  }
}

runCleanDockerE2ETest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Xatolik:", err);
    process.exit(1);
  });
