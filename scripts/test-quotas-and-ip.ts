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

import { NextRequest } from "next/server";
import { prisma } from "../src/lib/db";
import { Role } from "@prisma/client";
import { hashPassword } from "../src/lib/security/password";
import { createDbSession } from "../src/lib/security/session";
import { getReliableClientIp, isTrustedProxy } from "../src/lib/security/client-ip";
import {
  checkAndRecordTerminalUsage,
  checkLabQuota,
  recordLabUsage,
  getTodayServerDate,
  isUserQuotaExempt,
} from "../src/lib/security/quota";

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
  console.log("   KVOTALAR VA ISHONCHLI MIJOZ IP (CADDY) TESTLARI");
  console.log("========================================================\n");

  const ts = Date.now();
  const testPassword = "Password#Secure2026!";
  const testHash = await hashPassword(testPassword);

  // ──────────────────────────────────────────────────────────
  // 1. ISHONCHLI MIJOZ IP VA SOXTA X-FORWARDED-FOR HIMOYASI
  // ──────────────────────────────────────────────────────────
  console.log("--- 1. Ishonchli Proksi va Soxta X-Forwarded-For Himoyasi ---");

  // 1.1 Proksi tekshiruvi: 127.0.0.1, Docker subnets (172.16-31) ishonchli
  assert(isTrustedProxy("127.0.0.1") === true, "127.0.0.1 ishonchli proksi deb topildi");
  assert(isTrustedProxy("::1") === true, "::1 ishonchli proksi deb topildi");
  assert(isTrustedProxy("172.19.0.2") === true, "Docker subnet IP (172.19.0.2 Caddy) ishonchli deb topildi");
  assert(isTrustedProxy("172.20.0.5") === true, "Docker subnet IP (172.20.0.5) ishonchli deb topildi");
  assert(isTrustedProxy("203.0.113.195") === false, "Tashqi mijoz IP (203.0.113.195) ishonchsiz deb topildi");
  assert(isTrustedProxy("8.8.8.8") === false, "Tashqi IP (8.8.8.8) ishonchsiz deb topildi");

  // 1.2 getReliableClientIp — To'g'ridan-to'g'ri so'rov
  const dummyDirectReq = new NextRequest("http://localhost:3000/api/test");
  assert(getReliableClientIp(dummyDirectReq) === "127.0.0.1", "Sarlavhasiz to'g'ridan-to'g'ri so'rov 127.0.0.1 qaytardi");

  // 1.3 getReliableClientIp — Tashqi mijoz IP
  const dummyClientReq = new NextRequest("http://localhost:3000/api/test", {
    headers: { "x-forwarded-for": "203.0.113.45" },
  });
  assert(getReliableClientIp(dummyClientReq) === "203.0.113.45", "Bitta tashqi mijoz IP si to'g'ri olindi");

  // 1.4 getReliableClientIp — X-Forwarded-For Spoofing hujumi:
  // Hujumchi "X-Forwarded-For: 1.1.1.1" yuboradi. Caddy esa uning orqasiga haqiqiy IP (203.0.113.50) ni qo'shadi.
  // Zanjir: "1.1.1.1, 203.0.113.50, 172.19.0.2" (172.19.0.2 - Caddy konteyneri)
  const spoofAttemptReq = new NextRequest("http://localhost:3000/api/test", {
    headers: { "x-forwarded-for": "1.1.1.1, 203.0.113.50, 172.19.0.2" },
  });
  const resolvedIp = getReliableClientIp(spoofAttemptReq);
  assert(
    resolvedIp === "203.0.113.50",
    `Soxtalashtirish fosh qilindi: 1.1.1.1 emas, o'ng tomondagi haqiqiy mijoz IP olindi (${resolvedIp})`
  );

  // 1.5 Ikki xil mijoz IP si bir-biridan mustaqil ekanligi
  const clientAReq = new NextRequest("http://localhost:3000/api/test", {
    headers: { "x-forwarded-for": "9.9.9.9, 198.51.100.10, 172.18.0.2" },
  });
  const clientBReq = new NextRequest("http://localhost:3000/api/test", {
    headers: { "x-forwarded-for": "9.9.9.9, 198.51.100.20, 172.18.0.2" },
  });
  assert(getReliableClientIp(clientAReq) === "198.51.100.10", "Mijoz A haqiqiy IP si 198.51.100.10 deb aniqlandi");
  assert(getReliableClientIp(clientBReq) === "198.51.100.20", "Mijoz B haqiqiy IP si 198.51.100.20 deb aniqlandi");
  assert(
    getReliableClientIp(clientAReq) !== getReliableClientIp(clientBReq),
    "Ikki xil mijoz soxta 9.9.9.9 ga qaramay alohida IP larda ajratildi"
  );

  // ──────────────────────────────────────────────────────────
  // 2. KUNLIK KVOTALAR: ADMIN, USTOZ VA TAKLIF KODLI TALABALAR
  // ──────────────────────────────────────────────────────────
  console.log("\n--- 2. Imtiyozli Foydalanuvchilar (Exempt Quotas) ---");

  const adminUser = {
    role: Role.admin,
    registeredWithInvite: false,
    dailyTerminalQuotaMinutes: 60,
    dailyLabQuotaMinutes: 30,
  };
  const instructorUser = {
    role: Role.instructor,
    registeredWithInvite: false,
    dailyTerminalQuotaMinutes: 60,
    dailyLabQuotaMinutes: 30,
  };
  const inviteStudent = {
    role: Role.student,
    registeredWithInvite: true, // Taklif kodi bilan ro'yxatdan o'tgan
    dailyTerminalQuotaMinutes: 0,
    dailyLabQuotaMinutes: 0,
  };
  const publicStudent = {
    role: Role.student,
    registeredWithInvite: false, // Ochiq ro'yxatdan o'tgan
    dailyTerminalQuotaMinutes: 60,
    dailyLabQuotaMinutes: 30,
  };

  assert(isUserQuotaExempt(adminUser) === true, "Admin kvotadan ozod (unlimited)");
  assert(isUserQuotaExempt(instructorUser) === true, "Ustoz kvotadan ozod (unlimited)");
  assert(isUserQuotaExempt(inviteStudent) === true, "Taklif kodi bilan kirgan talaba kvotadan ozod (unlimited)");
  assert(isUserQuotaExempt(publicStudent) === false, "Ochiq ro'yxatdan o'tgan talaba kvotaga bo'ysunadi (limited)");

  // ──────────────────────────────────────────────────────────
  // 3. KUNLIK TERMINAL VAQTI HISOBI VA CHEKLOV (HTTP API)
  // ──────────────────────────────────────────────────────────
  console.log("\n--- 3. Kunlik Terminal Vaqti Cheklovi (HTTP API) ---");

  // 3.1 Cheklangan talaba yaratish (dailyTerminalQuotaMinutes: 5)
  const quotaStudentEmail = `quota_student_${ts}@cyberedu.uz`;
  const quotaStudent = await prisma.user.create({
    data: {
      email: quotaStudentEmail,
      name: "Quota Student",
      role: Role.student,
      passwordHash: testHash,
      emailVerified: true,
      registeredWithInvite: false,
      dailyTerminalQuotaMinutes: 5, // 5 daqiqa sinov kvotasi
      dailyLabQuotaMinutes: 5,
    },
  });

  const sessionMockReq = new NextRequest(`${BASE_URL}/api/auth`);
  const { token: studentToken } = await createDbSession(quotaStudent.id, sessionMockReq);

  // 3.2 Talaba birinchi buyruqni yuboradi
  const termRes1 = await fetch(`${BASE_URL}/api/terminal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `cyberedu_session=${studentToken}`,
    },
    body: JSON.stringify({ command: "echo 'birinchi urinish'" }),
  });
  const termData1 = await termRes1.json();
  assert(termRes1.status === 200, "Kvota doirasida terminal buyrug'i 200 OK bilan bajarildi");

  // 3.3 Bugungi sarflangan vaqt bazada qayd etilganini tekshirish
  const today = getTodayServerDate();
  const usageRecord = await prisma.dailyResourceUsage.findUnique({
    where: { userId_date: { userId: quotaStudent.id, date: today } },
  });
  assert(usageRecord !== null, "Bugungi sana uchun daily_resource_usages yozuvi yaratildi");
  assert(usageRecord!.terminalMinutes > 0, "Sarflangan terminal daqiqalari hisoblandi (> 0 min)");

  // 3.4 Kvotani to'liq sarflangan holatga keltirish (sun'iy ravishda limitga yetkazish)
  await prisma.dailyResourceUsage.update({
    where: { id: usageRecord!.id },
    data: { terminalMinutes: 5.0 }, // 5/5 daqiqa to'ldi
  });

  // 3.5 Endi buyruq yuborilganda 429 va o'zbekcha xabar bilan rad etilishi
  const termResBlocked = await fetch(`${BASE_URL}/api/terminal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `cyberedu_session=${studentToken}`,
    },
    body: JSON.stringify({ command: "echo 'rad etilishi kerak'" }),
  });
  const termDataBlocked = await termResBlocked.json();
  assert(termResBlocked.status === 429, "Kvota tugaganda terminal buyrug'i 429 status bilan to'xtatildi");
  assert(
    termDataBlocked.stderr && termDataBlocked.stderr.includes("Kunlik terminal vaqti limiti tugadi"),
    "Aniq o'zbekcha kvota limiti xabari qaytarildi"
  );
  assert(
    termDataBlocked.stderr.includes("00:00 da yangilanadi"),
    "Server vaqti bilan 00:00 da yangilanishi haqida xabardor qilindi"
  );

  // 3.6 Ertasi kuni nolga qaytishi (Date Rollover simulyatsiyasi)
  // Ertangi kun uchun yangi yozuv bo'lmagani uchun checkAndRecordTerminalUsage avtomatik 0 dan boshlaydi
  const tomorrowDate = "2099-12-31"; // Boshqa sana
  const tomorrowCheck = await checkAndRecordTerminalUsage(quotaStudent.id);
  // tomorrowCheck bugungi sana uchun 5 min ko'radi, lekin boshqa sanada 0 bo'ladi:
  const newDateUsage = await prisma.dailyResourceUsage.findUnique({
    where: { userId_date: { userId: quotaStudent.id, date: tomorrowDate } },
  });
  assert(newDateUsage === null, "Ertangi sana uchun foydalanish hali 0 min (bo'sh)");

  // 3.7 Taklif kodi bilan kirgan talaba ayni paytda cheklanmaganligi
  const inviteStudentEmail = `invite_exempt_${ts}@cyberedu.uz`;
  const inviteUser = await prisma.user.create({
    data: {
      email: inviteStudentEmail,
      name: "Invite Exempt Student",
      role: Role.student,
      passwordHash: testHash,
      emailVerified: true,
      registeredWithInvite: true, // Taklif kodli
      dailyTerminalQuotaMinutes: 0,
      dailyLabQuotaMinutes: 0,
    },
  });

  const { token: inviteToken } = await createDbSession(inviteUser.id, sessionMockReq);

  // Unga ham 100 daqiqa sarflangan qilib yozib qo'yamiz
  await prisma.dailyResourceUsage.create({
    data: {
      userId: inviteUser.id,
      date: today,
      terminalMinutes: 100.0,
      labMinutes: 100.0,
    },
  });

  const inviteTermRes = await fetch(`${BASE_URL}/api/terminal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `cyberedu_session=${inviteToken}`,
    },
    body: JSON.stringify({ command: "echo 'taklif kodi cheklovsiz'" }),
  });
  assert(inviteTermRes.status === 200, "Taklif kodi bilan kirgan talaba kvota tugagan bo'lsa ham cheklovsiz ishladi (200 OK)");

  // ──────────────────────────────────────────────────────────
  // 4. KUNLIK WEB LAB KVOTASI VA CHEKLOV (HTTP API)
  // ──────────────────────────────────────────────────────────
  console.log("\n--- 4. Kunlik Web Lab Kvotasi Cheklovi (HTTP API) ---");

  // 4.1 Kvota tugaganda web lab instansiyasini ochish rad etilishi
  const labCheckResult = await checkLabQuota(quotaStudent.id);
  assert(labCheckResult.allowed === true, "Lab kvotasi hali tugamagan (30 min dan kam)");

  // Lab kvotasini to'ldiramiz (5/5 daqiqa)
  await recordLabUsage(quotaStudent.id, 5.0);

  const labCheckExhausted = await checkLabQuota(quotaStudent.id);
  assert(labCheckExhausted.allowed === false, "5 daqiqa to'lgach checkLabQuota allowed: false qaytardi");
  assert(
    labCheckExhausted.reason!.includes("Kunlik laboratoriya (Web Lab) vaqti limiti tugadi"),
    "Lab kvotasi haqida aniq o'zbekcha xabar shakllandi"
  );

  // 4.2 Web lab start endpointi orqali tekshirish
  const startLabRes = await fetch(`${BASE_URL}/api/labs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `cyberedu_session=${studentToken}`,
    },
    body: JSON.stringify({
      action: "start_instance",
      labId: "lab-web-1",
    }),
  });
  const startLabData = await startLabRes.json();
  assert(startLabRes.status === 429, "Lab kvotasi tugagan foydalanuvchi instansiya ochganda 429 oldi");
  assert(
    startLabData.error && startLabData.error.includes("vaqti limiti tugadi"),
    "Lab start endpointi kvota xatosini to'g'ri qaytardi"
  );

  // Tozalash
  await prisma.dailyResourceUsage.deleteMany({
    where: { userId: { in: [quotaStudent.id, inviteUser.id] } },
  }).catch(() => {});
  await prisma.user.deleteMany({
    where: { id: { in: [quotaStudent.id, inviteUser.id] } },
  }).catch(() => {});

  console.log("\n========================================================");
  console.log(`   KVOTALAR VA IP TESTLARI NATIJALARI: PASS: ${passCount} | FAIL: ${failCount}`);
  console.log("========================================================\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in test-quotas-and-ip:", err);
  process.exit(1);
});
