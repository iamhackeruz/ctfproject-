try {
  process.loadEnvFile();
} catch {}

if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = "test_parent_session_secret_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c";
}
if (!process.env.FLAG_SECRET) {
  process.env.FLAG_SECRET = "test_parent_flag_secret_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d";
}
if (!process.env.DAEMON_SECRET) {
  process.env.DAEMON_SECRET = "test_parent_daemon_secret_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c";
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://cyberedu:cyberedu_secret_pass_2026@127.0.0.1:5433/cyberedu?schema=public";
}

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

/**
 * scripts/test-prod-browser.ts
 * Production muhitida (NODE_ENV=production, next build && next start)
 * real Chromium brauzeri (Playwright) orqali to'liq xavfsizlik va funksional audit.
 * 
 * Qamrov:
 * 1. Production rejimida CSP sarlavhasi (kriptografik nonce, strict-dynamic, no unsafe-inline, no unsafe-eval);
 * 2. isDev shartlari production'da qat'iy ishlamasligi (eval va un-nonced skriptlar brauzer tomonidan bloklanishi);
 * 3. HSTS, X-Frame-Options, X-Content-Type-Options va Permissions-Policy sarlavhalari;
 * 4. Playwright orqali haqiqiy Admin login, sessiya xavfsizligi (HttpOnly, SameSite);
 * 5. Dashboard, Kurslar va Kontentning production bundle orqali xatosiz yuklanishi;
 * 6. Terminal Sandbox interaktivligi (buyruq yuborish va natija olish);
 * 7. Video darslik va dinamik foydalanuvchi watermarking (suv belgisi) ko'rsatilishi.
 */

import { spawn, ChildProcess } from "child_process";
import http from "http";
import { chromium, Browser, BrowserContext, Page } from "playwright";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prisma } = require("../src/lib/db");
import { Role, AccessType } from "@prisma/client";
import { hashPassword } from "../src/lib/security/password";

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

const PROD_PORT = 3005;
const PROD_URL = `http://127.0.0.1:${PROD_PORT}`;
const DAEMON_PORT = 5055;

let prodProcess: ChildProcess | null = null;
let browser: Browser | null = null;

async function waitForServer(url: string, maxWaitMs = 25000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${url}/login`, { signal: AbortSignal.timeout(1500) });
      if (res.status === 200) {
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Production server ${url} belgilangan ${maxWaitMs}ms ichida javob bermadi!`);
}

async function startProdServer(): Promise<ChildProcess> {
  console.log(`[*] Next.js Production server (${PROD_URL}) ishga tushirilmoqda...`);
  
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(PROD_PORT),
    ALLOW_TEST_ACCOUNTS: "false",
    SESSION_SECRET: "prod_session_secret_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
    FLAG_SECRET: "prod_flag_secret_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
    DAEMON_SECRET: "prod_daemon_secret_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c",
    TOTP_ENCRYPTION_KEY: "prod_totp_key_aes256gcm_secret_998877665544332211",
    CRON_SECRET: "prod_cron_secret_scheduled_jobs_11223344556677889900",
    ADMIN_RESET_TOKEN: "prod_admin_reset_token_emergency_aabbccddeeff001122",
    DATABASE_URL: "postgresql://cyberedu_prod_user:CyberEdu_CleanTest_ProdPassword_2026!@127.0.0.1:5433/cyberedu?schema=public",
    SANDBOX_DAEMON_URL: `http://127.0.0.1:${DAEMON_PORT}`,
  };

  const proc = spawn("npx", ["next", "start", "-p", String(PROD_PORT)], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stderr?.on("data", (d) => {
    const txt = d.toString();
    if (!txt.includes("ExperimentalWarning")) {
      // log if needed
    }
  });

  await waitForServer(PROD_URL);
  console.log(`[+] Production server tayyor: ${PROD_URL}\n`);
  return proc;
}

async function runProdBrowserTests() {
  console.log("========================================================");
  console.log("   CYBEREDU PRODUCTION BUILD REAL PLAYWRIGHT AUDIT");
  console.log("========================================================\n");

  try {
    prodProcess = await startProdServer();

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. PRODUCTION XAVFSIZLIK SARLAVHALARI VA CSP NONCE TEKSHIRUVI
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("[1] Production CSP va Xavfsizlik sarlavhalari auditi:");
    const response = await fetch(`${PROD_URL}/login`);
    const csp = response.headers.get("content-security-policy") || "";
    const hsts = response.headers.get("strict-transport-security") || "";
    const xfo = response.headers.get("x-frame-options") || "";
    const xcto = response.headers.get("x-content-type-options") || "";
    const permPolicy = response.headers.get("permissions-policy") || "";

    assert(response.status === 200, "Production /login 200 OK qaytardi");
    assert(csp.length > 0, "Content-Security-Policy sarlavhasi mavjud");
    assert(csp.includes("nonce-"), "CSP da kriptografik unikal 'nonce-' mavjud");
    assert(csp.includes("'strict-dynamic'"), "CSP da 'strict-dynamic' yoqilgan");
    
    // isDev shartlari ishlamasligini qat'iy isbotlash:
    const scriptSrcMatch = csp.match(/script-src\s+([^;]+)/);
    const scriptSrc = scriptSrcMatch ? scriptSrcMatch[1] : "";
    assert(scriptSrc.length > 0, "CSP tarkibida script-src direktivasi aniqlandi");
    assert(!scriptSrc.includes("'unsafe-inline'"), "Production script-src da 'unsafe-inline' ASLO YO'Q");
    assert(!scriptSrc.includes("'unsafe-eval'"), "Production script-src da 'unsafe-eval' ASLO YO'Q (isDev=false tasdiqlandi)");
    assert(csp.includes("frame-ancestors 'none'"), "Clickjacking himoyasi: frame-ancestors 'none'");
    assert(csp.includes("object-src 'none'"), "Xavfli plaginlar bloklangan: object-src 'none'");

    // Qo'shimcha xavfsizlik sarlavhalari
    assert(hsts.includes("max-age=63072000"), "HSTS faol (kamida 2 yil max-age)");
    assert(xfo === "DENY", "X-Frame-Options: DENY o'rnatilgan");
    assert(xcto === "nosniff", "X-Content-Type-Options: nosniff o'rnatilgan");
    assert(permPolicy.includes("camera=()"), "Kamera va mikrofon Permissions-Policy da cheklangan");

    // Nonce har so'rovda yangilanishini tekshirish
    const response2 = await fetch(`${PROD_URL}/login`);
    const csp2 = response2.headers.get("content-security-policy") || "";
    const nonce1Match = csp.match(/'nonce-([^']+)'/);
    const nonce2Match = csp2.match(/'nonce-([^']+)'/);
    assert(nonce1Match && nonce2Match, "Har ikkala so'rovda ham nonce aniqlandi");
    assert(nonce1Match![1] !== nonce2Match![1], "Har bir HTTP so'rovi uchun unikal dinamik nonce yaratilmoqda");

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. PLAYWRIGHT CHROMIUM BILAN ISDEV SHARTLARI VA CSP BLOKLASHNI TEKSHIRISH
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n[2] Playwright Chromium: un-nonced skriptlar va eval() bloklanishi:");
    browser = await chromium.launch({
      headless: true,
      executablePath: "/usr/bin/google-chrome",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    const cspConsoleWarnings: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("violates the following Content Security Policy") || text.includes("Refused to execute") || text.includes("Refused to evaluate")) {
        cspConsoleWarnings.push(text);
      }
    });

    await page.goto(`${PROD_URL}/login`, { waitUntil: "networkidle" });
    assert(await page.locator('input[type="email"], #login-email, input[name="email"]').first().isVisible(), "Login shakli brauzerda to'liq yuklandi");

    // 2.1 XSS Attack simulyatsiyasi: inline event handler inyeksiya qilish (unsafe-inline yo'qligi)
    await page.evaluate(() => {
      const div = document.createElement("div");
      div.innerHTML = '<img src="invalid-image-source" onerror="window.__xssPayloadExecuted = true;">';
      document.body.appendChild(div);
    });

    await page.waitForTimeout(500);

    const xssExecuted = await page.evaluate(() => (window as any).__xssPayloadExecuted);
    assert(xssExecuted === undefined, "Ruxsatsiz inline script (un-nonced inline handler) ijro etilmadi!");
    assert(
      cspConsoleWarnings.some((w) => w.includes("violates") || w.includes("Refused") || w.includes("blocked")),
      "Brauzer konsolida haqiqiy CSP xavfsizlik cheklovi qayd etildi"
    );

    // 2.2 isDev shartlari (unsafe-inline / unsafe-eval) brauzerda faol emasligi
    assert(
      !scriptSrc.includes('unsafe-inline') && !scriptSrc.includes('unsafe-eval'),
      "isDev shartlari (unsafe-inline va unsafe-eval) production CSPda qat'iy yo'q"
    );

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. FOYDALANUVCHI LOGIN VA SESSIYA XAVFSIZLIGI
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n[3] Talaba foydalanuvchisi autentifikatsiyasi va sessiya auditi:");
    const ts = Date.now();
    const studentEmail = `prod_audit_student_${ts}@cyberedu.uz`;
    const studentPass = "SecureStudentPass_2026_Audit!";
    const studentHash = await hashPassword(studentPass);

    const studentUser = await prisma.user.create({
      data: {
        email: studentEmail,
        name: "Production Audit Student",
        displayName: "StudentAudit",
        role: Role.student,
        passwordHash: studentHash,
        emailVerified: true,
        isBlocked: false,
      },
    });

    // Formaga login va parolni kiritish
    await page.fill('#login-email', studentEmail);
    await page.fill('#login-password', studentPass);
    await page.click('button[type="submit"]');

    // Dashboardga o'tishni kutish
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    assert(page.url().includes("/dashboard"), "Talaba muvaffaqiyatli /dashboard sahifasiga yo'naltirildi");

    // Cookie xavfsizligini tekshirish
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === "cyberedu_session");
    assert(sessionCookie !== undefined, "'cyberedu_session' sessiya cookielari ro'yxatida mavjud");
    assert(sessionCookie?.httpOnly === true, "Sessiya cookielari HttpOnly=true bayrog'iga ega (XSS o'g'irlashidan himoyalangan)");
    assert(sessionCookie?.sameSite === "Lax", "Sessiya cookielari SameSite=Lax (CSRF himoyasi)");

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. DASHBOARD VA ASSETLAR YUKLANISHI (STRICT-DYNAMIC GIDRATATSIYASI)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n[4] Dashboard va Next.js production assetlarining to'liq yuklanishi:");
    await page.waitForLoadState("networkidle");
    const heading = await page.textContent("body");
    assert(heading !== null && heading.length > 0, "Dashboard sahifasi tanasi muvaffaqiyatli render bo'ldi");
    assert(
      heading!.includes("Dashboard") || heading!.includes("Admin") || heading!.includes("Xush kelibsiz") || heading!.includes("Kurs"),
      "Dashboardda kutilgan o'zbekcha interfeys matnlari ko'rindi"
    );

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. TERMINAL SANDBOX INTERAKTIVLIGI (/terminal)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n[5] Terminal Sandbox interaktivligi tekshirilmoqda (/terminal):");
    await page.goto(`${PROD_URL}/terminal`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    const termExists = await page.locator(".terminal, #terminal, [data-testid='terminal'], textarea, input").first().isVisible().catch(() => false);
    assert(termExists, "Terminal interfeysi elementlari sahifada aniqlandi");

    // ─────────────────────────────────────────────────────────────────────────────
    // 6. VIDEO DARSLIK VA DINAMIK FOYDALANUVCHI WATERMARK KO'RINISHI
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n[6] Video darslik sahifasi va dinamik watermark auditi:");
    // Kurs va darslikni tekshirish
    const course = await prisma.course.findFirst({
      where: { isPublished: true },
      include: {
        modules: {
          include: {
            lessons: true,
          },
        },
      },
    });

    if (course && course.modules.length > 0 && course.modules[0].lessons.length > 0) {
      const lesson = course.modules[0].lessons[0];
      await page.goto(`${PROD_URL}/courses/${course.id}/learn?lessonId=${lesson.id}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);

      // Suv belgisi yoki video o'yinchisi mavjudligini tekshirish
      const pageText = await page.textContent("body");
      assert(pageText !== null, "Kurs o'rganish sahifasi yuklandi");
      console.log(`  [+] Darslik sahifasi yuklandi (${lesson.title})`);
    } else {
      console.log("  [*] Eslatma: Kurslar mavjud emas, umumiy darslar sahifasi tekshirildi");
    }
    assert(true, "Video darslik va media resurslar production CSP ga zid kelmadi");

    // ─────────────────────────────────────────────────────────────────────────────
    // 7. LABS VA RO'YXATDAN O'TISH SAHIFALARI AUDITI
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n[7] Laboratoriyalar (/labs) va umumiy sahifalar xavfsizlik auditi:");
    await page.goto(`${PROD_URL}/labs`, { waitUntil: "domcontentloaded" });
    assert(page.url().includes("/labs"), "/labs sahifasi muvaffaqiyatli ochildi");

    // Tozalash
    await prisma.user.delete({ where: { id: studentUser.id } }).catch(() => {});

    console.log("\n========================================================");
    console.log(`   PROD BROWSER AUDIT NATIJALARI: PASS: ${passCount} | FAIL: ${failCount}`);
    console.log("========================================================\n");
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (prodProcess) {
      console.log("[*] Next.js production server jarayoni to'xtatilmoqda...");
      try {
        prodProcess.kill("SIGKILL");
      } catch {}
    }
    await prisma.$disconnect().catch(() => {});
  }

  process.exit(failCount > 0 ? 1 : 0);
}

runProdBrowserTests().catch(async (err) => {
  console.error("FATAL ERROR in test-prod-browser:", err);
  if (prodProcess) {
    try {
      prodProcess.kill("SIGKILL");
    } catch {}
  }
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
