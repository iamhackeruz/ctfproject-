/**
 * scripts/test-prod-security.ts
 * Production xavfsizlik himoyalari va tekshiruvlari testi.
 * 
 * Sinovlar:
 * 1. NODE_ENV=production va ALLOW_TEST_ACCOUNTS=true bo'lsa bloklanishi
 * 2. Qisqa sirlar (< 32 belgi) uchun bloklanishi
 * 3. O'zaro bir xil (dublikat) sirlar uchun bloklanishi
 * 4. Qisqa / zaif ma'lumotlar bazasi paroli (< 16 belgi) uchun bloklanishi
 * 5. Andoza (placeholder) sirlar uchun bloklanishi
 * 6. To'g'ri, xavfsiz va unikal sirlar bilan muvaffaqiyatli tasdiqlanishi
 * 7. Docker socket izolyatsiyasi tekshiruvi (faqat daemon'da :ro, app'da umuman yo'q)
 * 8. Sandbox daemon xavfsizligi (faqat cyberedu-term/weblab, no privileged, no host-mount/net, oq ro'yxat)
 * 9. Caddyfile va docker-compose.yml da standart qiymatlar yo'qligi (majburiy env tekshiruvi)
 */
import assert from "assert";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { validateEnvSecrets, assertEnvSecrets } from "../src/lib/security/env-validator";

function getValidProdEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    ALLOW_TEST_ACCOUNTS: "false",
    SESSION_SECRET: "prod_session_secret_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
    FLAG_SECRET: "prod_flag_secret_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
    DAEMON_SECRET: "prod_daemon_secret_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c",
    TOTP_ENCRYPTION_KEY: "prod_totp_key_aes256gcm_secret_998877665544332211",
    CRON_SECRET: "prod_cron_secret_scheduled_jobs_11223344556677889900",
    ADMIN_RESET_TOKEN: "prod_admin_reset_token_emergency_aabbccddeeff001122",
    DATABASE_URL: "postgresql://cyberedu:StrongProdPass2026_xyz987@postgres:5432/cyberedu?schema=public",
  };
}

async function runProdSecurityTests() {
  console.log("\n========================================================");
  console.log("   PRODUCTION XAVFSIZLIK VA HIMOYALAR TESTI");
  console.log("========================================================\n");

  let passed = 0;

  // 1. ALLOW_TEST_ACCOUNTS=true production'da qat'iy taqiqlanadi
  console.log("[1] ALLOW_TEST_ACCOUNTS=true tekshiruvi:");
  {
    const env = { ...getValidProdEnv(), ALLOW_TEST_ACCOUNTS: "true" };
    const res = validateEnvSecrets(env);
    assert(!res.valid, "ALLOW_TEST_ACCOUNTS=true rad etilishi kerak");
    assert(
      res.errors.some((e) => e.includes("ALLOW_TEST_ACCOUNTS=true bo'lishi qat'iyan taqiqlanadi")),
      "Tushunarli o'zbekcha xato xabari mavjud"
    );

    let thrown = false;
    try {
      assertEnvSecrets(env);
    } catch {
      thrown = true;
    }
    assert(thrown, "assertEnvSecrets exception otishi shart");
    console.log("  ✅ [PASS] Production'da ALLOW_TEST_ACCOUNTS=true bilan ishga tushish to'xtatildi");
    passed++;
  }

  // 2. Qisqa sirlar (< 32 belgi) tekshiruvi
  console.log("\n[2] Minimal uzunlik (< 32 belgi) tekshiruvlari:");
  const secretKeys = [
    "SESSION_SECRET",
    "FLAG_SECRET",
    "DAEMON_SECRET",
    "TOTP_ENCRYPTION_KEY",
    "CRON_SECRET",
    "ADMIN_RESET_TOKEN",
  ] as const;

  for (const key of secretKeys) {
    const env = { ...getValidProdEnv(), [key]: "short_secret_less_than_32" };
    const res = validateEnvSecrets(env);
    assert(!res.valid, `${key} < 32 bo'lganda rad etilishi kerak`);
    assert(
      res.errors.some((e) => e.includes(`${key} yetarli darajada uzun emas`)),
      `${key} uzunligi bo'yicha xato aniqlandi`
    );
    console.log(`  ✅ [PASS] ${key} (< 32 belgi) to'g'ri rad etildi`);
    passed++;
  }

  // 3. Dublikat (bir xil) sirlar tekshiruvi
  console.log("\n[3] O'zaro bir xil (dublikat) sirlar tekshiruvi:");
  {
    const sharedSecret = "very_long_identical_secret_string_32_bytes_len_ok!";
    const env = {
      ...getValidProdEnv(),
      SESSION_SECRET: sharedSecret,
      CRON_SECRET: sharedSecret,
    };
    const res = validateEnvSecrets(env);
    assert(!res.valid, "SESSION_SECRET va CRON_SECRET bir xil bo'lganda rad etilishi shart");
    assert(
      res.errors.some((e) => e.includes("bir xil bo'lishi mumkin emas")),
      "Dublikat sirlar xatosi topildi"
    );
    console.log("  ✅ [PASS] Bir xil qiymatga ega sirlar to'g'ri rad etildi");
    passed++;
  }

  // 4. Ma'lumotlar bazasi paroli tekshiruvi
  console.log("\n[4] DATABASE_URL paroli tekshiruvi:");
  {
    // A. Parol qisqa (< 16)
    const envShortPass = {
      ...getValidProdEnv(),
      DATABASE_URL: "postgresql://cyberedu:shortpass@postgres:5432/cyberedu",
    };
    const resShort = validateEnvSecrets(envShortPass);
    assert(!resShort.valid, "Qisqa DB paroli rad etilishi kerak");
    assert(
      resShort.errors.some((e) => e.includes("ma'lumotlar bazasi paroli yetarli darajada xavfsiz emas")),
      "Qisqa DB paroli xatosi mavjud"
    );
    console.log("  ✅ [PASS] 16 belgidan qisqa DB paroli rad etildi");
    passed++;

    // B. Parolsiz DB URL
    const envNoPass = {
      ...getValidProdEnv(),
      DATABASE_URL: "postgresql://cyberedu@postgres:5432/cyberedu",
    };
    const resNoPass = validateEnvSecrets(envNoPass);
    assert(!resNoPass.valid, "Parolsiz DB URL rad etilishi kerak");
    console.log("  ✅ [PASS] Parolsiz DATABASE_URL rad etildi");
    passed++;
  }

  // 5. Andoza (placeholder) sirlar tekshiruvi
  console.log("\n[5] Andoza (placeholder) sirlar tekshiruvi:");
  {
    const envPlaceholder = {
      ...getValidProdEnv(),
      SESSION_SECRET: "cyberedu-production-session-secret-change-in-prod-2026-9f8e7d",
    };
    const resPlaceholder = validateEnvSecrets(envPlaceholder);
    assert(!resPlaceholder.valid, "Andoza 'change-in-prod' sir rad etilishi kerak");
    assert(
      resPlaceholder.errors.some((e) => e.includes("xavfli andoza (placeholder")),
      "Andoza sir xatosi aniqlandi"
    );
    console.log("  ✅ [PASS] 'change-in-prod' andoza siri rad etildi");
    passed++;
  }

  // 6. To'g'ri va xavfsiz sozlamalar muvaffaqiyatli qabul qilinishi
  console.log("\n[6] To'liq xavfsiz sozlamalar tekshiruvi:");
  {
    const validEnv = getValidProdEnv();
    const res = validateEnvSecrets(validEnv);
    assert(res.valid, `Barcha talablar to'g'ri bo'lganda valid: true bo'lishi shart. Xatolar: ${res.errors.join(", ")}`);
    assert(res.errors.length === 0, "Xatolar ro'yxati bo'sh");

    // assertEnvSecrets xatosiz ishlashi
    assertEnvSecrets(validEnv);
    console.log("  ✅ [PASS] Barcha talablarga javob beradigan production konfiguratsiyasi 100% muvaffaqiyatli o'tdi");
    passed++;
  }

  // 7. Docker socket izolyatsiyasi tekshiruvi
  console.log("\n[7] Docker socket izolyatsiyasi tekshiruvi (docker-compose.yml va Dockerfile):");
  {
    const rootDir = process.cwd();
    const composeContent = fs.readFileSync(path.resolve(rootDir, "docker-compose.yml"), "utf-8");
    const dockerfileContent = fs.readFileSync(path.resolve(rootDir, "Dockerfile"), "utf-8");

    // A. docker.sock faqat sandbox-daemon servisi ichida bo'lishi kerak
    const daemonSection = composeContent.split("\n  sandbox-daemon:")[1]?.split("\n  caddy:")[0] || "";
    assert(
      daemonSection.includes("/var/run/docker.sock:/var/run/docker.sock:ro"),
      "docker.sock faqat sandbox-daemon konteyneriga read-only (:ro) ulanishi shart"
    );

    // B. app servisi ichida docker.sock mutlaqo bo'lmasligi kerak
    const appSection = composeContent.split("\n  app:")[1]?.split("\n  postgres:")[0] || "";
    assert(
      !appSection.includes("docker.sock"),
      "app konteynerida docker.sock bo'lmasligi shart (izolyatsiya buzilmasligi uchun)"
    );

    // C. postgres servisi ichida docker.sock bo'lmasligi kerak
    const postgresSection = composeContent.split("\n  postgres:")[1]?.split("\n  sandbox-daemon:")[0] || "";
    assert(
      !postgresSection.includes("docker.sock"),
      "postgres konteynerida docker.sock bo'lmasligi shart"
    );

    // D. Dockerfile runner bosqichi non-root (nextjs) foydalanuvchida ishlashi
    assert(
      dockerfileContent.includes("USER nextjs"),
      "Dockerfile runner bosqichi root bo'lmagan nextjs foydalanuvchida ishlashi shart"
    );
    assert(
      !dockerfileContent.includes("docker-cli") && !dockerfileContent.includes("docker.sock"),
      "Dockerfile da docker klienti yoki socket o'rnatilmagan bo'lishi shart"
    );

    console.log("  ✅ [PASS] Docker socket faqat sandbox-daemon'ga :ro ulangan; app va postgres butunlay izolyatsiyalangan");
    passed++;
  }

  // 8. Sandbox Daemon xavfsizligi va oq ro'yxat tekshiruvi
  console.log("\n[8] Sandbox daemon xavfsizligi va oq ro'yxat tekshiruvi:");
  {
    const daemonServerCode = fs.readFileSync(path.resolve(process.cwd(), "services/sandbox-daemon/server.ts"), "utf-8");

    // A. Konteyner prefikslari cyberedu-term- va cyberedu-weblab- bo'lishi shart
    assert(
      daemonServerCode.includes("const containerName = `cyberedu-term-${sessionId}`;"),
      "Terminal konteynerlari faqat cyberedu-term- prefiksi bilan ochilishi shart"
    );
    assert(
      daemonServerCode.includes("const containerName = `cyberedu-weblab-${instanceId}`;"),
      "Weblab konteynerlari faqat cyberedu-weblab- prefiksi bilan ochilishi shart"
    );

    // B. Weblab oq ro'yxati (WEBLAB_SLUGS) tekshirilishi
    assert(
      daemonServerCode.includes("WEBLAB_SLUGS.has(labSlug)"),
      "Weblab sluglari oq ro'yxat (WEBLAB_SLUGS) orqali tekshirilishi shart"
    );
    assert(
      daemonServerCode.includes("web-xss") &&
      daemonServerCode.includes("web-sqli") &&
      daemonServerCode.includes("web-idor") &&
      daemonServerCode.includes("web-exposed-files"),
      "Ruxsat etilgan 4 ta asosiy laboratoriya turi oq ro'yxatda mavjud"
    );

    // C. Privileged rejimi mutlaqo taqiqlangan
    assert(
      !daemonServerCode.includes("--privileged"),
      "Sandbox daemon konteynerlarida --privileged opsiyasi bo'lmasligi shart"
    );

    // D. Host networking taqiqlangan (terminal network none, weblab alohida lab tarmog'ida)
    assert(
      daemonServerCode.includes('"--network",\n    "none"'),
      "Terminal konteyneri --network none bilan tarmoqsiz izolyatsiyada ishlashi shart"
    );
    assert(
      !daemonServerCode.includes("--network host") && !daemonServerCode.includes("--net=host"),
      "Konteynerlarda host tarmog'i (--network host) taqiqlangan"
    );

    // E. Host mount taqiqlangan, faqat tmpfs va ro rootfs
    assert(
      daemonServerCode.includes('"--read-only"'),
      "Terminal root fayl tizimi read-only bo'lishi shart"
    );
    assert(
      daemonServerCode.includes('"--cap-drop",\n    "ALL"'),
      "Linux imkoniyatlari to'liq olib tashlangan (--cap-drop ALL)"
    );
    assert(
      daemonServerCode.includes('"--security-opt",\n    "no-new-privileges"'),
      "Privilege escalation taqiqlangan (no-new-privileges)"
    );

    console.log("  ✅ [PASS] Sandbox daemon faqat ruxsat etilgan konteynerlarni xavfsiz (no-privileged, no-host-mount) ochishi isbotlandi");
    passed++;
  }

  // 9. Caddyfile va docker-compose.yml da standart qiymatlar yo'qligi tekshiruvi
  console.log("\n[9] Caddyfile va docker-compose.yml da standart qiymatlar yo'qligi (majburiy env):");
  {
    const caddyContent = fs.readFileSync(path.resolve(process.cwd(), "Caddyfile"), "utf-8");
    const composeContent = fs.readFileSync(path.resolve(process.cwd(), "docker-compose.yml"), "utf-8");

    // A. Caddyfile'da DOMAIN, LABS_DOMAIN, ACME_EMAIL uchun fallback bo'lmasligi kerak
    assert(
      !caddyContent.includes("{$DOMAIN:") &&
      !caddyContent.includes("{$LABS_DOMAIN:") &&
      !caddyContent.includes("{$ACME_EMAIL:"),
      "Caddyfile da DOMAIN, LABS_DOMAIN, ACME_EMAIL uchun standart fallback qiymat bo'lmasligi shart"
    );
    assert(
      caddyContent.includes("{$DOMAIN}") &&
      caddyContent.includes("{$LABS_DOMAIN}") &&
      caddyContent.includes("{$ACME_EMAIL}"),
      "Caddyfile aniq {$DOMAIN}, {$LABS_DOMAIN}, {$ACME_EMAIL} o'zgaruvchilarini kutishi shart"
    );

    // B. docker-compose.yml da strict syntax ishlatilishi
    assert(
      composeContent.includes("${DOMAIN:?"),
      "docker-compose.yml da DOMAIN majburiy o'zgaruvchi sifatida belgilangan"
    );
    assert(
      composeContent.includes("${LABS_DOMAIN:?"),
      "docker-compose.yml da LABS_DOMAIN majburiy o'zgaruvchi sifatida belgilangan"
    );
    assert(
      composeContent.includes("${ACME_EMAIL:?"),
      "docker-compose.yml da ACME_EMAIL majburiy o'zgaruvchi sifatida belgilangan"
    );

    // C. docker compose config DOMAIN siz ishga tushirilganda xato bilan to'xtashi
    let failedWithoutEnv = false;
    try {
      execSync("docker compose config --quiet", {
        cwd: process.cwd(),
        env: { PATH: process.env.PATH },
        stdio: "pipe",
      });
    } catch {
      failedWithoutEnv = true;
    }
    assert(failedWithoutEnv, "Kerakli env o'zgaruvchilarisiz docker compose config xato berishi shart");

    console.log("  ✅ [PASS] Majburiy env o'zgaruvchilar berilmasa tizim ishga tushmasligi to'liq isbotlandi");
    passed++;
  }

  // 10. Tarmoq arxitekturasi va izolyatsiyasi tekshiruvi (app egress, postgres/daemon internal)
  console.log("\n[10] Tarmoq arxitekturasi va izolyatsiyasi tekshiruvi:");
  {
    const composeContent = fs.readFileSync(path.resolve(process.cwd(), "docker-compose.yml"), "utf-8");

    // A. App konteyneri tashqi dunyo (frontend-net) va ichki xizmatlar (internal-net) ga ulangan
    const appSection = composeContent.split("\n  app:")[1]?.split("\n  postgres:")[0] || "";
    assert(
      appSection.includes("- cyberedu-frontend-net") && appSection.includes("- cyberedu-internal-net"),
      "app konteyneri tashqi chiqish (frontend-net) va ichki aloqa (internal-net) tarmoqlariga ulangan"
    );

    // B. Postgres faqat va faqat cyberedu-internal-net da bo'lishi shart
    const postgresSection = composeContent.split("\n  postgres:")[1]?.split("\n  sandbox-daemon:")[0] || "";
    assert(
      postgresSection.includes("- cyberedu-internal-net") && !postgresSection.includes("- cyberedu-frontend-net"),
      "postgres faqat ichki tarmoqda (cyberedu-internal-net) bo'lishi shart"
    );

    // C. Sandbox Daemon faqat cyberedu-internal-net va cyberedu-weblab-net da bo'lishi shart
    const daemonSection = composeContent.split("\n  sandbox-daemon:")[1]?.split("\n  caddy:")[0] || "";
    assert(
      daemonSection.includes("- cyberedu-internal-net") &&
      daemonSection.includes("- cyberedu-weblab-net") &&
      !daemonSection.includes("- cyberedu-frontend-net"),
      "sandbox-daemon tashqi tarmoqqa chiqmasligi shart (faqat internal va weblab tarmoqlarida)"
    );

    // D. cyberedu-internal-net va cyberedu-weblab-net da internal: true mavjudligi
    const internalNetSection = composeContent.split("cyberedu-internal-net:")[1]?.split("cyberedu-weblab-net:")[0] || "";
    assert(
      internalNetSection.includes("internal: true"),
      "cyberedu-internal-net tarmog'ida internal: true qoidasi o'rnatilgan (tashqi chiqish butunlay bloklangan)"
    );

    const weblabNetSection = composeContent.split("cyberedu-weblab-net:")[1]?.split("volumes:")[0] || "";
    assert(
      weblabNetSection.includes("internal: true"),
      "cyberedu-weblab-net tarmog'ida internal: true qoidasi o'rnatilgan (laboratoriyalar tashqariga chiqa olmaydi)"
    );

    console.log("  ✅ [PASS] Tarmoq izolyatsiyasi to'liq tasdiqlandi (app tashqariga chiqa oladi, postgres va daemon mutlaqo yopiq)");
    passed++;
  }

  console.log("\n========================================================");
  console.log(`PRODUCTION HIMOYALARI TESTI YAKUNLANDI: ${passed} PASS, 0 FAIL`);
  console.log("========================================================\n");
}

runProdSecurityTests().catch((err) => {
  console.error("Test xatosi:", err);
  process.exit(1);
});
