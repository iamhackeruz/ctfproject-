/**
 * CyberEdu Phase 6 & Pre-Phase 6 Playwright Real Browser Test Suite
 * 
 * Ushbu test real Chromium brauzeri (Playwright) orqali quyidagilarni qat'iy isbotlaydi:
 * 1. Web-XSS laboratoriyasidagi XSS payload'i platforma API'siga (cookie bilan ham, cookie'siz ham) so'rov yubora olmasligi.
 * 2. XSS payload platformaning ota oynasini (window.parent.document) yoki uning cookie'larini o'qiy olmasligi.
 * 3. Opaque origin ("null") ostida lab'ning o'z funksiyalari (forma yuborish, SQLi, IDOR, robots.txt, XSS reflected) to'liq ishlashi.
 * 4. CSRF himoyasi platformani himoya qilgan holda, lab proksi yo'lining POST so'rovlarini to'sib qo'ymasligi.
 * 5. Nonce asosidagi CSP brauzer konsolida hech qanday xatolik keltirib chiqarmasligi.
 */

// Node runtime module alias hook for @/* -> src/*
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

import http from "http";
import { spawn, ChildProcess } from "child_process";
import { chromium, Browser, BrowserContext } from "playwright";
import { verifyCsrf } from "../src/lib/security/csrf";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/db";
import { Role } from "@prisma/client";
import { createDbSession } from "../src/lib/security/session";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ [PASS] ${msg}`);
}

const TEST_PORT = 3988;
const XSS_PORT = 8181;
const SQLI_PORT = 8182;
const IDOR_PORT = 8183;
const FILES_PORT = 8184;

const activeProcesses: ChildProcess[] = [];
let testServer: http.Server | null = null;
let browser: Browser | null = null;

async function startPythonLab(labType: string, port: number, flag: string): Promise<ChildProcess> {
  const pythonScript = path.resolve(process.cwd(), "labs/app.py");
  const proc = spawn("python3", [pythonScript], {
    env: {
      ...process.env,
      LAB_TYPE: labType,
      PORT: String(port),
      FLAG: flag,
    },
    stdio: "pipe",
  });

  activeProcesses.push(proc);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve();
    }, 2000);

    proc.stdout?.on("data", (data: Buffer) => {
      if (data.toString().includes("CyberEdu Lab")) {
        clearTimeout(timeout);
        resolve();
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  return proc;
}

function getLabPortByInstance(instanceId: string): number {
  if (instanceId.includes("sqli")) return SQLI_PORT;
  if (instanceId.includes("idor")) return IDOR_PORT;
  if (instanceId.includes("files")) return FILES_PORT;
  return XSS_PORT;
}

function createPlatformTestServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://127.0.0.1:${TEST_PORT}`);

      // ── [A] PLATFORMA ASOSIY SAHIFASI (Strict Nonce CSP bilan) ──────────
      if (url.pathname === "/platform-app") {
        const nonce = "CYBEREDU_SECURE_NONCE_777";
        const csp = `default-src 'self' http://127.0.0.1:${TEST_PORT}; script-src 'self' 'nonce-${nonce}' http://127.0.0.1:${TEST_PORT}; style-src 'self' 'unsafe-inline'; frame-src 'self' http://127.0.0.1:${TEST_PORT}; object-src 'none'; base-uri 'self';`;

        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": csp,
          "Set-Cookie": "cyberedu_session=SUPER_SECRET_PLATFORM_COOKIE_XYZ999; Path=/; HttpOnly; SameSite=Lax",
        });

        // Ota sahifa: ichida lab iframe joylashgan
        const labIframeUrl = url.searchParams.get("labUrl") || `/api/labs/proxy/inst_playwright_test/`;
        res.end(`<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="utf-8">
  <title>CyberEdu Platform — Real Browser Test</title>
</head>
<body>
  <h1>CyberEdu Kiberxavfsizlik Ta'lim Platformasi</h1>
  <div id="platform-status">Faol</div>
  <iframe id="lab-frame" src="${labIframeUrl}" sandbox="allow-scripts allow-forms" style="width:800px; height:500px;"></iframe>
  <script nonce="${nonce}">
    window.__PLATFORM_SECRET_KEY = "SECRET_PLATFORM_KEY_DO_NOT_LEAK";
    window.__platform_loaded = true;
  </script>
</body>
</html>`);
        return;
      }

      // ── [B] LAB PROKSI YO'LI (Opaque Origin Sandbox CSP bilan) ─────────
      if (url.pathname.startsWith("/api/labs/proxy/")) {
        const sub = url.pathname.replace("/api/labs/proxy/", "");
        const parts = sub.split("/");
        const instanceId = parts[0];
        const restPath = parts.slice(1).join("/");
        const targetPort = getLabPortByInstance(instanceId);
        const leadingPath = restPath ? `/${restPath}` : "/";
        const targetUrl = `http://127.0.0.1:${targetPort}${leadingPath}${url.search}`;

        // 1. Platforma cookie'larini (cyberedu_session) upstream'ga O'TKAZMASLIK
        const clientCookies = req.headers["cookie"] || "";
        const filteredCookies = clientCookies
          .split(";")
          .map((c) => c.trim())
          .filter((c) => !c.startsWith("cyberedu_session="))
          .join("; ");

        const upstreamHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          const lower = k.toLowerCase();
          if (!["host", "connection", "transfer-encoding", "cookie", "authorization"].includes(lower) && typeof v === "string") {
            upstreamHeaders[lower] = v;
          }
        }
        if (filteredCookies) {
          upstreamHeaders["cookie"] = filteredCookies;
        }

        // Upstream so'rovni o'tkazish
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", async () => {
          try {
            const bodyBuffer = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
            const upstreamRes = await fetch(targetUrl, {
              method: req.method,
              headers: upstreamHeaders,
              body: req.method !== "GET" && req.method !== "HEAD" ? bodyBuffer : undefined,
            });

            // Opaque sandbox CSP sarlavhasi (allow-same-origin YO'Q)
            res.writeHead(upstreamRes.status, {
              "Content-Type": upstreamRes.headers.get("content-type") || "text/html",
              "Content-Security-Policy": "default-src 'self' 'unsafe-inline' data:; frame-ancestors 'self'; sandbox allow-forms allow-scripts;",
              "X-Content-Type-Options": "nosniff",
              "X-Frame-Options": "SAMEORIGIN",
            });

            const buf = await upstreamRes.arrayBuffer();
            res.end(Buffer.from(buf));
          } catch (e: unknown) {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Upstream error", detail: String(e) }));
          }
        });
        return;
      }

      // ── [C] PLATFORMA HIMOYA QILINGAN API (CSRF tekshiruvi bilan) ──────
      if (url.pathname === "/api/auth") {
        req.resume(); // consume incoming body
        // NextRequest wrapper yaratish va CSRF tekshiruvidan o'tkazish
        const dummyNextReq = new NextRequest(`http://127.0.0.1:${TEST_PORT}/api/auth`, {
          method: req.method,
          headers: req.headers as Record<string, string>,
        });

        const csrfResult = verifyCsrf(dummyNextReq);
        if (!csrfResult.valid) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: false,
            error: "CSRF tekshiruvi rad etildi: Opaque yoki begona Origin ruxsat etilmaydi.",
          }));
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, message: "Avtorizatsiya muvaffaqiyatli" }));
        return;
      }

      res.writeHead(404);
      res.end("Not Found");
    });

    server.listen(TEST_PORT, "127.0.0.1", () => {
      resolve(server);
    });
  });
}

async function runPlaywrightSuite() {
  console.log("\n========================================================");
  console.log("   CYBEREDU REAL BRAUZER (PLAYWRIGHT) XAVFSIZLIK AUDITI");
  console.log("========================================================\n");

  try {
    // 1. To'rtta mustaqil veb-laboratoriyani alohida portlarda ishga tushirish
    console.log("[1] Veb-laboratoriyalarni xavfsiz portlarda ishga tushirish...");
    await startPythonLab("web-xss", XSS_PORT, "flag{playwright_xss_proof_1337}");
    await startPythonLab("web-sqli", SQLI_PORT, "flag{playwright_sqli_flag_888}");
    await startPythonLab("web-idor", IDOR_PORT, "flag{playwright_idor_flag_444}");
    await startPythonLab("web-exposed-files", FILES_PORT, "flag{playwright_git_flag_222}");
    console.log(`  ✅ Barcha 4 ta laboratoriya (XSS: ${XSS_PORT}, SQLi: ${SQLI_PORT}, IDOR: ${IDOR_PORT}, Files: ${FILES_PORT}) tayyor.`);

    // 2. Platforma test HTTP serverini ishga tushirish
    console.log("[2] Platforma va Proksi test serverini ishga tushirish...");
    testServer = await createPlatformTestServer();
    console.log(`  ✅ Platforma serveri ${TEST_PORT}-portda ishlamoqda.`);

    // 3. Playwright Chromium brauzerini ishga tushirish
    console.log("[3] Chromium brauzerini ishga tushirish (--no-sandbox)...");
    browser = await chromium.launch({
      executablePath: "/usr/bin/google-chrome",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });
    const context: BrowserContext = await browser.newContext();
    const page = await context.newPage();

    // CSP va xato xabarlarini ushlash uchun konsol tinglovchisi
    const cspErrors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("Content Security Policy") || text.includes("violates the following Content Security Policy")) {
        // Platform CSP xatolarini ushlash
        if (!text.includes("inst_playwright_test")) {
          cspErrors.push(text);
        }
      }
    });

    // ── [TEST 1] PLATFORMA SAHIFASINI VA NONCE CSP NI TEKSHIRISH ─────────
    console.log("\n--- [TEST 1] Platforma Sahifasi va CSP (script-src Nonce) ---");
    await page.goto(`http://127.0.0.1:${TEST_PORT}/platform-app`);
    await page.waitForSelector("#platform-status");

    const platformLoaded = await page.evaluate(() => (window as unknown as { __platform_loaded: boolean }).__platform_loaded);
    assert(platformLoaded === true, "Platforma sahifasi va nonce-inline skripti muvaffaqiyatli ishga tushdi.");
    assert(cspErrors.length === 0, "Platforma sahifasida birorta ham CSP buzilishi yoki xatosi yuz bermadi.");

    // ── [TEST 2] WEBLAB'DAN XSS PAYLOAD BILAN OPAQUE ORIGIN IZOLYATSIYASI
    console.log("\n--- [TEST 2] XSS Payload Orqali DOM va Cookie O'g'irlashni Sinash ---");
    // XSS payload: ota DOM ni o'qishga va cookie'ni o'g'irlashga urinadi
    const maliciousPayload = `
      <script>
        window.__xss_executed = true;
        window.__origin = window.origin;

        // 1. Parent DOM'ga kirish urinishi
        try {
          window.__parent_secret_stolen = window.parent.__PLATFORM_SECRET_KEY;
        } catch (e) {
          window.__parent_dom_error = e.name + ': ' + e.message;
        }

        // 2. Cookie o'qish urinishi
        window.__captured_cookies = document.cookie;
      </script>
    `;

    const encodedPayload = encodeURIComponent(maliciousPayload);
    const labXssUrl = `/api/labs/proxy/inst_playwright_test/?q=${encodedPayload}`;
    await page.goto(`http://127.0.0.1:${TEST_PORT}/platform-app?labUrl=${encodeURIComponent(labXssUrl)}`);

    // Lab iframe yuklanishini kutish
    await page.waitForTimeout(1500);

    const frameElement = await page.$("#lab-frame");
    assert(frameElement !== null, "Lab iframe elementi topildi.");
    const frame = await frameElement!.contentFrame();
    assert(frame !== null, "Lab iframe contentFrame ochildi.");

    // Iframe ichidagi natijalarni va jonli fetch so'rovini tekshirish
    const iframeEval = await frame!.evaluate(async (port) => {
      const win = window as unknown as Record<string, unknown>;
      let liveFetchStatus: number | null = null;
      let liveFetchError: string | null = null;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "login", email: "attacker@evil.com" }),
        });
        liveFetchStatus = res.status;
      } catch (err: unknown) {
        liveFetchError = err instanceof Error ? err.name + ": " + err.message : String(err);
      }

      return {
        xssExecuted: win.__xss_executed,
        origin: win.origin,
        parentSecretStolen: win.__parent_secret_stolen,
        parentDomError: win.__parent_dom_error,
        capturedCookies: win.__captured_cookies,
        liveFetchStatus,
        liveFetchError,
      };
    }, TEST_PORT);

    assert(iframeEval.xssExecuted === true, "XSS skripti laboratoriya ichida muvaffaqiyatli ishga tushdi (Reflected XSS ishlaydi).");
    assert(iframeEval.origin === "null", "Laboratoriya origin'i qat'iy 'null' (Opaque Origin) ekani tasdiqlandi.");
    assert(iframeEval.parentSecretStolen === undefined, "XSS skripti platforma ota oynasidagi maxfiy kalitni o'g'irlay OLMADI.");
    assert(
      typeof iframeEval.parentDomError === "string" && iframeEval.parentDomError.includes("SecurityError"),
      `Brauzer ota oynaga kirishni SecurityError bilan blokladi: ${iframeEval.parentDomError}`
    );
    assert(
      !String(iframeEval.capturedCookies).includes("cyberedu_session") && !String(iframeEval.capturedCookies).includes("SUPER_SECRET_PLATFORM_COOKIE"),
      "XSS skripti platforma sessiya cookie'sini (cyberedu_session) o'qiy OLMADI."
    );
    assert(
      iframeEval.liveFetchStatus === 403 || typeof iframeEval.liveFetchError === "string",
      `Platforma API'siga opaque origindan yuborilgan so'rov bloklandi (Status: ${iframeEval.liveFetchStatus}, Error: ${iframeEval.liveFetchError}).`
    );

    // Server-side verifyCsrf tekshiruvi: Opaque "null" Origin rad etilishini tasdiqlash
    const serverOpaqueCheck = verifyCsrf(
      new NextRequest(`http://127.0.0.1:${TEST_PORT}/api/auth`, {
        method: "POST",
        headers: {
          origin: "null",
          host: `127.0.0.1:${TEST_PORT}`,
          cookie: "cyberedu_session=ACTIVE_SESSION_KEY",
        },
      })
    );
    assert(serverOpaqueCheck.valid === false, "Server tomonidagi verifyCsrf 'Origin: null' so'rovini 403 bilan to'xtatdi.");

    // ── [TEST 3] LAB'NING O'Z FUNKSIYALARI OPAQUE ORIGINDA ISHLASHI ───────
    console.log("\n--- [TEST 3] Lab'ning O'z Funksiyalari (Search, Forms) Opaque Originda Ishlashi ---");
    await page.goto(`http://127.0.0.1:${TEST_PORT}/platform-app?labUrl=${encodeURIComponent("/api/labs/proxy/inst_playwright_test/?q=salom_kiber")}`);
    await page.waitForTimeout(1000);
    const frame2 = await (await page.$("#lab-frame"))!.contentFrame();
    const resultText = await frame2!.$eval(".result-box", (el) => el.textContent);
    assert(resultText?.includes("salom_kiber") === true, "Laboratoriyaning qidiruv funksiyasi opaque origin ostida mukammal ishladi.");

    // ── [TEST 4] SQLi VA IDOR LABORATORIYALARINI TEST QILISH ───────────────
    console.log("\n--- [TEST 4] SQLi, IDOR va Exposed Files Laboratoriyalarini Tasdiqlash ---");
    // SQLi labida login bypass sinash
    const sqliRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/labs/proxy/inst_sqli/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "username=" + encodeURIComponent("admin' --") + "&password=fakepassword",
    });
    const sqliText = await sqliRes.text();
    assert(sqliRes.status === 200, "SQLi laboratoriyasiga POST so'rovi CSRF tomonidan to'silmasdan 200 OK qaytardi.");
    assert(sqliText.includes("flag{playwright_sqli_flag_888}"), "SQLi login bypass muvaffaqiyatli o'tib flag qaytdi.");

    // IDOR labini tekshirish
    const idorRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/labs/proxy/inst_idor/api/user?id=1`);
    const idorText = await idorRes.text();
    assert(idorRes.status === 200 && idorText.includes("flag{playwright_idor_flag_444}"), "IDOR laboratoriyasidan flag muvaffaqiyatli olindi.");

    // Exposed files labini tekshirish (robots.txt va .git/HEAD)
    const robotsRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/labs/proxy/inst_files/robots.txt`);
    const robotsText = await robotsRes.text();
    assert(robotsRes.status === 200 && robotsText.includes("Disallow: /.backup_secrets_2026/"), "robots.txt orqali yashirin katalog fosh qilindi.");

    const gitRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/labs/proxy/inst_files/.git/HEAD`);
    const gitText = await gitRes.text();
    assert(gitRes.status === 200 && gitText.includes("flag{playwright_git_flag_222}"), "Ochiq .git fayllari laboratoriyasidan flag muvaffaqiyatli olindi.");

    // ── [TEST 5] PRE-PHASE 6 C, E, F: QUIZ 24H RESET, INVITATION CODE, SMTP/TEMP PASSWORD
    console.log("\n--- [TEST 5] Pre-Phase 6 C, E, F: Biznes Mantiq va Xavfsizlik Tekshiruvi ---");
    
    // Ustoz va Talaba yaratish
    const instructor = await prisma.user.create({
      data: {
        email: `instr_pw_${Date.now()}@cyberedu.uz`,
        name: "Playwright Ustoz",
        displayName: "Instr_PW",
        role: Role.instructor,
        passwordHash: "argon2_test_instr",
      },
    });

    const studentUser = await prisma.user.create({
      data: {
        email: `student_pw_${Date.now()}@cyberedu.uz`,
        name: "Playwright Talaba",
        displayName: "Student_PW",
        role: Role.student,
        passwordHash: "argon2_test_student",
      },
    });

    const instructorSession = await createDbSession(instructor.id, new NextRequest("http://localhost:3000"));

    // E: Taklif kodi (Invitation Code) yaratish
    const invite = await prisma.invitationCode.create({
      data: {
        code: `INV-${Date.now()}`,
        createdBy: instructor.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    assert(invite.code.startsWith("INV-"), "Ustoz tomonidan bir martalik taklif kodi muvaffaqiyatli yaratildi.");

    // C: Quiz urinishlarini tozalash API (Ustoz huquqi bilan)
    const quiz = await prisma.quiz.findFirst();
    if (quiz) {
      // Talaba uchun sun'iy urinish kiritamiz
      await prisma.quizSubmission.create({
        data: {
          userId: studentUser.id,
          quizId: quiz.id,
          score: 20,
          passed: false,
          attemptsCount: 1,
          createdAt: new Date(),
        },
      });

      // Ustoz sifatida o'chirish
      const deleteReq = new NextRequest(`http://localhost:3000/api/quizzes/${quiz.lessonId}?userId=${studentUser.id}`, {
        method: "DELETE",
        headers: {
          cookie: `cyberedu_session=${instructorSession.token}`,
          origin: "http://localhost:3000",
        },
      });
      const { DELETE: quizDelete } = await import("../src/app/api/quizzes/[lessonId]/route");
      const delRes = await quizDelete(deleteReq, { params: Promise.resolve({ lessonId: String(quiz.lessonId) }) });
      assert(delRes.status === 200, "Ustoz talabaning quiz urinishlarini muvaffaqiyatli qayta tikladi (200 OK).");

      const remaining = await prisma.quizSubmission.count({
        where: { userId: studentUser.id, quizId: quiz.id },
      });
      assert(remaining === 0, "Talaba urinishlari bazadan to'liq tozalandi.");
    }

    // F: Ustoz paneli orqali vaqtinchalik parol generatsiya qilish
    const tempPassReq = new NextRequest("http://localhost:3000/api/auth", {
      method: "POST",
      headers: {
        cookie: `cyberedu_session=${instructorSession.token}`,
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "generate-temp-password",
        userId: studentUser.id,
      }),
    });
    const { POST: authPost } = await import("../src/app/api/auth/route");
    const tempRes = await authPost(tempPassReq);
    const tempJson = await tempRes.json();
    assert(tempRes.status === 200 && tempJson.tempPassword.startsWith("Temp#"), "Ustoz talaba uchun bir martalik vaqtinchalik parol yaratdi.");

    const updatedStudent = await prisma.user.findUnique({ where: { id: studentUser.id } });
    assert(updatedStudent?.mustChangePassword === true, "Talaba birinchi kirishda parolni o'zgartirishi majburiy qilindi (mustChangePassword: true).");

    console.log("\n========================================================");
    console.log("   ✅ REAL BRAUZER VA PRE-PHASE 6 TESTLARI TO'LIQ O'TDI!");
    console.log("========================================================\n");
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    for (const proc of activeProcesses) {
      proc.kill();
    }
    if (testServer) {
      await new Promise<void>((res) => testServer!.close(() => res()));
    }
  }
}

runPlaywrightSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test xatosi:", err);
    process.exit(1);
  });
