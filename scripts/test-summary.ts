try {
  process.loadEnvFile();
} catch {}

/**
 * scripts/test-summary.ts
 * Barcha xavfsizlik test to'plamlarini avtomatik ishga tushirish,
 * xom chiqishlarni test-results/<sana>.log fayliga yozish va
 * har bir to'plamning PASS/FAIL sonini avtomatik hisoblab Markdown jadval chiqarish.
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";

interface SuiteConfig {
  file: string;
  name: string;
}

const TEST_SUITES: SuiteConfig[] = [
  { file: "test-terminal-security.ts", name: "1-Bosqich: Terminal Sandbox & Xavfsizlik" },
  { file: "test-phase2-auth-db.ts", name: "2-Bosqich: Autentifikatsiya & Baza" },
  { file: "test-phase3-labs-http.ts", name: "3-Bosqich: Veb-Laboratoriyalar & Proxy" },
  { file: "test-phase4-content-security.ts", name: "4-Bosqich: Kontent & 15 ta Lab Solverlari" },
  { file: "test-phase5-platform-security.ts", name: "5-Bosqich: Platforma Xavfsizlik Auditi" },
  { file: "test-phase6-playwright-browser.ts", name: "6-Bosqich: Playwright CSP & Opaque Origin" },
  { file: "test-browser-auth-flow.ts", name: "Auth Oqimi: Playwright Login & Register" },
  { file: "test-phase7-admin-foundations.ts", name: "7-Bosqich: Admin Asosi & RBAC" },
  { file: "test-phase7-playwright-browser.ts", name: "7-Bosqich: Playwright Admin Tablari" },
  { file: "test-phase8-fixes.ts", name: "8-Bosqich: canAccess & Guruh Muddatlari" },
  { file: "test-phase8-grant-revoke-browser.ts", name: "8-Bosqich: Playwright Grant & Revoke" },
  { file: "test-phase9-video-backend.ts", name: "9-Bosqich: Video Darslar Backend & Range" },
  { file: "test-phase9-video-browser.ts", name: "9-Bosqich: Playwright Video & Watermark" },
  { file: "test-phase10-backend.ts", name: "10-Bosqich: Vazifalar, Davomat & Telegram" },
  { file: "test-phase10-browser.ts", name: "10-Bosqich: Playwright Vazifa & Baholash" },
  { file: "test-phase11-2fa-reminders.ts", name: "11-Bosqich: 2FA TOTP & Idempotent Cron" },
  { file: "test-phase11-playwright-2fa-mobile.ts", name: "11-Bosqich: Playwright 2FA & Mobil Ekran" },
  { file: "test-prod-security.ts", name: "Production: Sirlar, Socket & Tarmoq Izolyatsiyasi" },
  { file: "test-phase12-public-registration.ts", name: "12-Bosqich: Ochiq Ro'yxatdan O'tish & Verifikatsiya" },
  { file: "test-quotas-and-ip.ts", name: "Kvotalar & Ishonchli Proksi (Caddy Right-to-Left)" },
  { file: "test-caddy-docker-ip.ts", name: "Caddy Docker: Haqiqiy Mijoz IP & Soxta XFF Himoyasi" },
  { file: "test-prod-browser.ts", name: "Production Playwright: Strict CSP Nonce & isDev Izolyatsiyasi" },
];

interface SuiteResult {
  index: number;
  file: string;
  name: string;
  passCount: number;
  failCount: number;
  exitCode: number;
  durationMs: number;
}

function runCommand(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { shell: true });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    proc.on("close", (code) => {
      resolve({ stdout, stderr, code: code || 0 });
    });
  });
}

async function runTestSuite(
  suite: SuiteConfig,
  index: number,
  logStream: fs.WriteStream
): Promise<SuiteResult> {
  const jsFile = `.test-dist/scripts/${suite.file.replace(/\.ts$/, ".js")}`;
  const startTime = Date.now();

  return new Promise((resolve) => {
    const banner = `\n>>> [SUITE ${index}/${TEST_SUITES.length}] ${suite.file} (${suite.name}) boshlandi...\n`;
    logStream.write(banner);
    process.stdout.write(banner);

    const proc = spawn("node", [jsFile], {
      env: { ...process.env },
    });

    let output = "";

    proc.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      logStream.write(text);
      process.stdout.write(text);
    });

    proc.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      logStream.write(text);
      process.stderr.write(text);
    });

    proc.on("close", (code) => {
      const durationMs = Date.now() - startTime;
      const exitCode = code || 0;

      // PASS va FAIL larni xom chiqishdan sanash
      const passMatches = (output.match(/✅\s*\[PASS\]/gi) || []).length;
      const solvedMatches = (output.match(/✅\s*\[SOLVED\]/gi) || []).length;
      let totalPass = passMatches + solvedMatches;

      const failMatches = (output.match(/❌\s*\[FAIL\]/gi) || []).length;
      let totalFail = failMatches;

      // Agar skript yakuniy hisobot xulosasini chiqargan bo'lsa (masalan, PASS: 49 | FAIL: 0)
      const explicitSummary = output.match(/PASS:\s*(\d+)\s*\|\s*FAIL:\s*(\d+)/i) ||
                              output.match(/(\d+)\s*o'tdi,\s*(\d+)\s*xato/i);
      if (explicitSummary) {
        const parsedPass = parseInt(explicitSummary[1], 10);
        const parsedFail = parseInt(explicitSummary[2], 10);
        if (!isNaN(parsedPass) && parsedPass > totalPass) {
          totalPass = parsedPass;
        }
        if (!isNaN(parsedFail) && parsedFail > totalFail) {
          totalFail = parsedFail;
        }
      }

      // Agar exitCode xato bo'lsa va totalFail 0 bo'lsa, kamida 1 xato qayd etish
      if (exitCode !== 0 && totalFail === 0) {
        totalFail = 1;
      }

      resolve({
        index,
        file: suite.file,
        name: suite.name,
        passCount: totalPass,
        failCount: totalFail,
        exitCode,
        durationMs,
      });
    });
  });
}

async function main() {
  console.log("========================================================");
  console.log("   CYBEREDU AVTOMATLASHGAN TEST HISOBOTI TIZIMI");
  console.log("========================================================\n");

  // 1. TypeScript kompilyatsiyasi
  console.log("[*] Test skriptlari CommonJS (.test-dist) ga kompilyatsiya qilinmoqda...");
  const tscRes = await runCommand("npx tsc", ["-p", "tsconfig.test.json"]);
  if (tscRes.code !== 0) {
    console.error("❌ TypeScript kompilyatsiyasida xatolik yuz berdi:\n", tscRes.stderr || tscRes.stdout);
    process.exit(1);
  }
  console.log("✅ Kompilyatsiya muvaffaqiyatli yakunlandi.\n");

  // 2. Log faylini yaratish
  const resultsDir = path.resolve(__dirname, "../test-results");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const now = new Date();
  const dateStr = now.toISOString().replace(/T/, "_").replace(/:/g, "-").slice(0, 19);
  const logFilePath = path.join(resultsDir, `${dateStr}.log`);
  const logStream = fs.createWriteStream(logFilePath, { flags: "a" });

  const startHeader = `CYBEREDU TEST REPORT — ${now.toISOString()}\nBarcha ${TEST_SUITES.length} ta to'plam ishga tushirilmoqda...\n${"=".repeat(80)}\n`;
  logStream.write(startHeader);

  const results: SuiteResult[] = [];

  // 3. Har bir to'plamni navbatma-navbat ishga tushirish
  for (let i = 0; i < TEST_SUITES.length; i++) {
    const suite = TEST_SUITES[i];
    const res = await runTestSuite(suite, i + 1, logStream);
    results.push(res);
  }

  // 4. .test-dist katalogini tozalash
  await runCommand("rm", ["-rf", ".test-dist"]);

  // 5. Yig'indilarni hisoblash
  const totalPass = results.reduce((acc, r) => acc + r.passCount, 0);
  const totalFail = results.reduce((acc, r) => acc + r.failCount, 0);
  const totalDuration = results.reduce((acc, r) => acc + r.durationMs, 0);

  // 6. Markdown jadvalini yaratish
  let markdownTable = `\n### 📊 AVTOMATLASHGAN TEST HISOBOTI JADVALI (${now.toLocaleDateString("uz-UZ")} ${now.toLocaleTimeString("uz-UZ")})\n\n`;
  markdownTable += `> **Xom log fayli:** \`${path.relative(process.cwd(), logFilePath)}\` (Hajmi: ${(fs.statSync(logFilePath).size / 1024).toFixed(1)} KB)\n\n`;
  markdownTable += "| № | Test To'plami (Fayl) | Vazifasi | PASS | FAIL | Holati | Vaqt |\n";
  markdownTable += "|---|---|---|:---:|:---:|:---:|:---:|\n";

  for (const r of results) {
    const statusIcon = r.failCount === 0 && r.exitCode === 0 ? "✅ PASS" : "❌ FAIL";
    const durSec = (r.durationMs / 1000).toFixed(1) + "s";
    markdownTable += `| ${r.index} | \`${r.file}\` | ${r.name} | **${r.passCount}** | ${r.failCount} | ${statusIcon} | ${durSec} |\n`;
  }

  const overallStatus = totalFail === 0 ? "✅ 100% O'TDI (0 FAIL)" : `❌ ${totalFail} TA XATO`;
  const totalDurSec = (totalDuration / 1000).toFixed(1) + "s";
  markdownTable += `| **JAMI** | **${results.length} ta to'plam** | **Barcha xavfsizlik va funksional testlar** | **${totalPass}** | **${totalFail}** | **${overallStatus}** | **${totalDurSec}** |\n\n`;

  logStream.write(`\n\n${markdownTable}\n`);
  logStream.end();

  // Konsolga chiqarish
  console.log("\n========================================================");
  console.log(markdownTable);
  console.log(`Xom chiqish logi saqlandi: ${logFilePath}`);
  console.log("========================================================\n");

  if (totalFail > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in test-summary:", err);
  process.exit(1);
});
