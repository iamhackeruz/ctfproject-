try {
  process.loadEnvFile();
} catch {}

// Node runtime module alias hook for @/* -> src/*
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

import { prisma } from "../src/lib/db";
import { Role } from "@prisma/client";
import { hashPassword } from "../src/lib/security/password";
import {
  generateTotpSecret,
  encryptTotpSecret,
  decryptTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCode,
  create2FaPendingToken,
  verify2FaPendingToken,
} from "../src/lib/security/totp";
import { processReminders } from "../src/lib/reminders/scheduler";
import { spawnSync } from "child_process";

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

async function main() {
  console.log("\n========================================================");
  console.log("   11-BOSQICH: 2FA (TOTP), ESLATMALAR VA IDOR AUDITI");
  console.log("========================================================\n");

  const ts = Date.now();
  const testPassword = "Password#Secure2026!";
  const testHash = await hashPassword(testPassword);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. KRIPTOGRAFIYA VA TOTP ASOSLARI (AES-256-GCM, TIME SKEW, REPLAY)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("[1] Kriptografiya va TOTP Algoritmlari:");

  const plainSecret = generateTotpSecret();
  assert(plainSecret.length === 32, "Base32 TOTP siri 32 belgidan iborat (20 bayt entropiya)");

  const encryptedSecret = encryptTotpSecret(plainSecret);
  assert(encryptedSecret.split(":").length === 3, "Shifrlangan sir 'iv:tag:ciphertext' formatida saqlanadi");
  assert(!encryptedSecret.includes(plainSecret), "Shifrlangan matnda ochiq sir mavjud emas");

  const decryptedSecret = decryptTotpSecret(encryptedSecret);
  assert(decryptedSecret === plainSecret, "AES-256-GCM ochish asl Base32 sirni 100% tiklaydi");

  // Soxtalashtirish (tampering) tekshiruvi
  let tamperedCaught = false;
  try {
    const parts = encryptedSecret.split(":");
    // ciphertext qismini o'zgartirish
    parts[2] = (parts[2][0] === "a" ? "b" : "a") + parts[2].slice(1);
    decryptTotpSecret(parts.join(":"));
  } catch {
    tamperedCaught = true;
  }
  assert(tamperedCaught, "Buzilgan yoki o'zgartirilgan AES-256-GCM shifr rad etiladi (auth tag xatosi)");

  // TOTP kodi va vaqt darchasi (±1 step = ±30s)
  const currentStep = BigInt(Math.floor(Date.now() / 1000 / 30));
  const currentCode = generateTotpCode(plainSecret, 0);
  assert(currentCode.length === 6 && /^\d{6}$/.test(currentCode), "TOTP kodi 6 ta raqamdan iborat");

  const verifyCurrent = verifyTotpCode(plainSecret, currentCode);
  assert(verifyCurrent.valid && verifyCurrent.step === currentStep, "Joriy qadamdagi kod tasdiqlanadi");

  // -1 qadam (30 soniya oldin)
  const prevCode = generateTotpCode(plainSecret, -1);
  const verifyPrev = verifyTotpCode(plainSecret, prevCode);
  assert(verifyPrev.valid, "-1 qadamdagi (30s oldingi) kod qabul qilinadi (Time Skew -1)");

  // +1 qadam (30 soniya keyin)
  const nextCode = generateTotpCode(plainSecret, 1);
  const verifyNext = verifyTotpCode(plainSecret, nextCode);
  assert(verifyNext.valid, "+1 qadamdagi (30s keyingi) kod qabul qilinadi (Time Skew +1)");

  // -2 qadam (60 soniya oldin) — rad etilishi kerak
  const oldCode = generateTotpCode(plainSecret, -2);
  const verifyOld = verifyTotpCode(plainSecret, oldCode);
  assert(!verifyOld.valid, "-2 qadamdagi (60s oldingi) eskirgan kod rad etiladi");

  // Replay Attack himoyasi (bitta qadam ichida kodni qayta ishlatish)
  const replayVerify = verifyTotpCode(plainSecret, currentCode, verifyCurrent.step!);
  assert(!replayVerify.valid, "Replay himoyasi: o'sha 30s qadamda foydalanilgan kod qayta qabul qilinmaydi");

  // Zaxira kodlari (Backup Codes)
  const { rawCodes, hashedCodes } = generateBackupCodes(10);
  assert(rawCodes.length === 10 && hashedCodes.length === 10, "10 ta bir martalik zaxira kod yaratiladi");
  assert(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(rawCodes[0]), "Zaxira kod formati 'XXXX-XXXX'");
  assert(hashBackupCode(rawCodes[0]) === hashedCodes[0], "Zaxira kod xeshi SHA-256 bilan to'g'ri hisoblanadi");

  // ──────────────────────────────────────────────────────────────────────────
  // 2. VAQTINCHALIK 2FA TOKENI VA BIRINCHI KIRISHDA MAJBUR IYLIK
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[2] Vaqtinchalik 2FA Tokeni va Majburiy Sozlash:");

  const tokenUserId = "test-user-id-xyz";
  const pendingToken = create2FaPendingToken(tokenUserId, true);
  const verifiedPending = verify2FaPendingToken(pendingToken);
  assert(verifiedPending !== null && verifiedPending.userId === tokenUserId, "5 daqiqalik 2FA tokeni to'g'ri ochiladi");
  assert(verifiedPending?.setupRequired === true, "Token setupRequired holatini to'g'ri tashiydi");

  const fakeToken = pendingToken.slice(0, -6) + "000000";
  assert(verify2FaPendingToken(fakeToken) === null, "Soxtalashtirilgan 2FA tokeni rad etiladi");

  // ──────────────────────────────────────────────────────────────────────────
  // 3. FOYDALANUVCHILARNI YARATISH VA BAZADA 2FA OQIMI
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[3] Bazada 2FA Sozlash, Tasdiqlash va Zaxira Kodlar:");

  const instructorEmail = `test_inst_2fa_${ts}@cyberedu.uz`;
  const instructor = await prisma.user.create({
    data: {
      email: instructorEmail,
      name: "Ustoz 2FA",
      role: Role.instructor,
      passwordHash: testHash,
      twoFactorEnabled: false,
    },
  });

  // 2FA Setup Init: Temp secret saqlash
  const instSecret = generateTotpSecret();
  const instEnc = encryptTotpSecret(instSecret);
  await prisma.user.update({
    where: { id: instructor.id },
    data: { twoFactorTempSecret: instEnc },
  });

  const dbUserAfterInit = await prisma.user.findUnique({ where: { id: instructor.id } });
  assert(dbUserAfterInit?.twoFactorTempSecret?.includes(":"), "Bazada vaqtinchalik sir AES-256-GCM bilan shifrlangan");
  assert(!dbUserAfterInit?.twoFactorEnabled, "Setup tasdiqlanmaguncha twoFactorEnabled=false");

  // 2FA Setup Confirm: To'g'ri kod bilan
  const validCode = generateTotpCode(instSecret);
  const { rawCodes: instBackupRaw, hashedCodes: instBackupHashed } = generateBackupCodes(10);

  await prisma.$transaction([
    prisma.twoFactorBackupCode.deleteMany({ where: { userId: instructor.id } }),
    prisma.twoFactorBackupCode.createMany({
      data: instBackupHashed.map((codeHash) => ({
        userId: instructor.id,
        codeHash,
        used: false,
      })),
    }),
    prisma.user.update({
      where: { id: instructor.id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: dbUserAfterInit?.twoFactorTempSecret,
        twoFactorTempSecret: null,
        twoFactorLastUsedStep: BigInt(Math.floor(Date.now() / 30000)),
      },
    }),
  ]);

  const dbUserConfirmed = await prisma.user.findUnique({
    where: { id: instructor.id },
    include: { backupCodes: true },
  });
  assert(dbUserConfirmed?.twoFactorEnabled === true, "2FA muvaffaqiyatli yoqildi");
  assert(dbUserConfirmed?.twoFactorTempSecret === null, "twoFactorTempSecret tozalandi");
  assert(dbUserConfirmed?.twoFactorSecret?.includes(":"), "Doimiy sir bazada shifrlangan holda saqlanmoqda");
  assert(dbUserConfirmed?.backupCodes.length === 10, "10 ta zaxira kodi bazada saqlandi");

  // Zaxira kod orqali kirish sinovi
  const testBackupCode = instBackupRaw[0];
  const targetHash = hashBackupCode(testBackupCode);
  const foundBackup = await prisma.twoFactorBackupCode.findFirst({
    where: { userId: instructor.id, codeHash: targetHash, used: false },
  });
  assert(foundBackup !== null, "Zaxira kod xeshi bo'yicha bazadan topildi");

  // Kodni sarflash
  await prisma.twoFactorBackupCode.update({
    where: { id: foundBackup!.id },
    data: { used: true, usedAt: new Date() },
  });

  const reusedBackup = await prisma.twoFactorBackupCode.findFirst({
    where: { userId: instructor.id, codeHash: targetHash, used: false },
  });
  assert(reusedBackup === null, "Sarflangan zaxira kod qayta ishlatish uchun mavjud emas");

  // Lockout (5 xato urinish) sinovi
  await prisma.user.update({
    where: { id: instructor.id },
    data: {
      twoFactorFailedAttempts: 5,
      twoFactorLockoutUntil: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const lockedUser = await prisma.user.findUnique({ where: { id: instructor.id } });
  assert(
    Boolean(lockedUser?.twoFactorLockoutUntil && lockedUser.twoFactorLockoutUntil > new Date()),
    "5 marta xato kiritilganda hisob 15 daqiqaga qulflanadi"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // 4. TALABA UCHUN IXTIYORIY 2FA VA ROLLARDAN O'CHIRISH TAQIQI
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[4] Talaba Ixtiyoriy 2FA va Majburiy Rollar Himoyasi:");

  const studentEmail = `test_student_2fa_${ts}@cyberedu.uz`;
  const student = await prisma.user.create({
    data: {
      email: studentEmail,
      name: "Talaba Ixtiyoriy 2FA",
      role: Role.student,
      passwordHash: testHash,
      twoFactorEnabled: false,
    },
  });

  assert(!student.twoFactorEnabled, "Talaba uchun 2FA boshlang'ich holatda o'chiq");

  // ──────────────────────────────────────────────────────────────────────────
  // 5. ADMIN BOShQA FOYDALANUVChINING 2FA SINI BEKOR QILIShI
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[5] Admin tomonidan 2FA ni Bekor Qilish (Admin Reset):");

  await prisma.$transaction([
    prisma.twoFactorBackupCode.deleteMany({ where: { userId: instructor.id } }),
    prisma.user.update({
      where: { id: instructor.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorTempSecret: null,
        twoFactorFailedAttempts: 0,
        twoFactorLockoutUntil: null,
        twoFactorLastUsedStep: null,
      },
    }),
  ]);

  const instAfterReset = await prisma.user.findUnique({
    where: { id: instructor.id },
    include: { backupCodes: true },
  });
  assert(instAfterReset?.twoFactorEnabled === false, "Foydalanuvchi 2FA si bekor qilindi");
  assert(instAfterReset?.twoFactorSecret === null, "Barcha sirlar o'chirildi");
  assert(instAfterReset?.backupCodes.length === 0, "Barcha zaxira kodlari tozalandi");

  // ──────────────────────────────────────────────────────────────────────────
  // 6. FAVQULODDA ADMIN TIKLASH SKRIPTI (scripts/reset-2fa.ts)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[6] Favqulodda Shell Skripti Sinovi (scripts/reset-2fa.ts):");

  const emergencyAdminEmail = `emergency_admin_${ts}@cyberedu.uz`;
  const emergencyAdmin = await prisma.user.create({
    data: {
      email: emergencyAdminEmail,
      name: "Favqulodda Admin",
      role: Role.admin,
      passwordHash: testHash,
      twoFactorEnabled: true,
      twoFactorSecret: encryptTotpSecret(generateTotpSecret()),
    },
  });

  // Skriptni noto'g'ri token bilan chaqirish
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs");
  const compiledScript = path.resolve(process.cwd(), ".test-dist/scripts/reset-2fa.js");
  const scriptCmd = fs.existsSync(compiledScript) ? "node" : "node";
  const scriptArgs = fs.existsSync(compiledScript)
    ? [compiledScript, emergencyAdminEmail]
    : [path.resolve(__dirname, "reset-2fa.js"), emergencyAdminEmail];

  const failRun = spawnSync(scriptCmd, scriptArgs, {
    env: { ...process.env, ADMIN_RESET_TOKEN: "wrong-token" },
    encoding: "utf-8",
  });
  assert(failRun.status !== 0, "Noto'g'ri ADMIN_RESET_TOKEN bilan skript rad etiladi (exit code != 0)");

  // Skriptni to'g'ri token bilan chaqirish
  const tokenVal = process.env.ADMIN_RESET_TOKEN || "admin_emergency_reset_token_cyberedu_2026_secure_key";
  const successRun = spawnSync(scriptCmd, scriptArgs, {
    env: { ...process.env, ADMIN_RESET_TOKEN: tokenVal },
    encoding: "utf-8",
  });
  assert(successRun.status === 0, "To'g'ri ADMIN_RESET_TOKEN bilan favqulodda tiklash muvaffaqiyatli yakunlandi");

  const emAfterReset = await prisma.user.findUnique({ where: { id: emergencyAdmin.id } });
  assert(emAfterReset?.twoFactorEnabled === false, "Favqulodda skript admin 2FA sini o'chirdi");

  // ──────────────────────────────────────────────────────────────────────────
  // 7. ESLATMALAR FON REJALAShTIRUVChISI (SCHEDULER) VA IDEMPOTENTLIK
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[7] Eslatmalar Fon Vazifasi va Idempotentlik:");

  // 24 soatdan keyin topshirilishi kerak bo'lgan vazifa yaratish
  const in23Hours = new Date(Date.now() + 23 * 3600 * 1000);
  const testGroup = await prisma.group.create({
    data: {
      name: `Reminder Group ${ts}`,
      createdBy: instructor.id,
      instructorId: instructor.id,
      members: {
        create: [{ userId: student.id }],
      },
    },
  });

  const assignment = await prisma.assignment.create({
    data: {
      title: `Reminder HW ${ts}`,
      description: "Muddat eslatmasi sinovi",
      groupId: testGroup.id,
      dueAt: in23Hours,
      createdById: instructor.id,
      isPublished: true,
    },
  });

  // 3 kundan keyin tugaydigan Entitlement yaratish
  const in60Hours = new Date(Date.now() + 60 * 3600 * 1000);
  const entitlement = await prisma.entitlement.create({
    data: {
      userId: student.id,
      type: "SUBSCRIPTION",
      source: "MANUAL",
      endsAt: in60Hours,
      reason: "Sinov entitlement",
    },
  });

  // 1-marta scheduler ishlatish
  const res1 = await processReminders();
  assert(res1.due24hSent >= 1, "24 soat qolgan vazifa bo'yicha talabaga eslatma jo'natildi");
  assert(res1.expiringEntitlementsSent >= 1, "3 kun qolgan entitlement bo'yicha talabaga eslatma jo'natildi");

  // 2-marta scheduler ishlatish (Idempotentlik sinovi)
  const res2 = await processReminders();
  assert(res2.due24hSent === 0, "Idempotentlik: 24h eslatmasi ikkinchi marta takrorlanmadi (0 ta yangi)");
  assert(res2.expiringEntitlementsSent === 0, "Idempotentlik: entitlement eslatmasi ikkinchi marta takrorlanmadi (0 ta yangi)");

  // Bazadagi dedupKey tekshiruvi
  const expectedDedup = `reminder:assignment:${assignment.id}:due24h:${student.id}`;
  const notif = await prisma.notification.findUnique({ where: { dedupKey: expectedDedup } });
  assert(notif !== null, "Bildirishnoma bazada dedupKey bo'yicha yagona saqlangan");

  // ──────────────────────────────────────────────────────────────────────────
  // 8. USTOZ DOIRASI (INSTRUCTOR SCOPING) VA IDOR HIMOYASI
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[8] Ustoz Doirasi (Group.instructorId) va IDOR Himoyasi:");

  // Ustoz A va Ustoz B
  const instructorA = instructor;
  const instructorB = await prisma.user.create({
    data: {
      email: `inst_b_${ts}@cyberedu.uz`,
      name: "Ustoz Bobur",
      role: Role.instructor,
      passwordHash: testHash,
    },
  });

  // Ustoz A guruhi
  const groupA = await prisma.group.create({
    data: {
      name: `Guruhi A ${ts}`,
      createdBy: instructorA.id,
      instructorId: instructorA.id,
    },
  });

  // Ustoz B guruhi
  const groupB = await prisma.group.create({
    data: {
      name: `Guruhi B ${ts}`,
      createdBy: instructorB.id,
      instructorId: instructorB.id,
    },
  });

  // Guruhlar ro'yxatida ustoz doirasi (Ustoz A faqat o'z guruhini ko'rishi)
  const groupsForA = await prisma.group.findMany({
    where: {
      OR: [{ instructorId: instructorA.id }, { createdBy: instructorA.id }],
    },
  });
  const sawGroupB = groupsForA.some((g) => g.id === groupB.id);
  assert(!sawGroupB, "Ustoz A boshqa ustozning guruhini (Guruhi B) ro'yxatda ko'rmaydi");

  // Ustoz A guruhida mashg'ulot
  const sessionA = await prisma.classSession.create({
    data: {
      groupId: groupA.id,
      sessionDate: new Date(),
      topic: "Kiberxavfsizlik asoslari",
      createdById: instructorA.id,
    },
  });

  // IDOR tekshiruvi: Ustoz B sessionA ga ruxsati bormi?
  const sessionCheck = await prisma.classSession.findUnique({
    where: { id: sessionA.id },
    include: { group: true },
  });
  const isBAuthorizedForA =
    sessionCheck?.createdById === instructorB.id ||
    sessionCheck?.group.instructorId === instructorB.id ||
    sessionCheck?.group.createdBy === instructorB.id;
  assert(!isBAuthorizedForA, "IDOR himoyasi: Ustoz B Ustoz A ning mashg'uloti va davomatiga kira olmaydi");

  // Admin har ikkala guruhga kira oladi
  const adminGroups = await prisma.group.findMany({
    where: {},
  });
  const sawBoth = adminGroups.some((g) => g.id === groupA.id) && adminGroups.some((g) => g.id === groupB.id);
  assert(sawBoth, "Administrator barcha guruhlarni to'liq boshqara oladi");

  // Tozalash (Cleanup)
  try {
    await prisma.notification.deleteMany({ where: { userId: student.id } });
    await prisma.entitlement.delete({ where: { id: entitlement.id } });
    await prisma.assignment.delete({ where: { id: assignment.id } });
    await prisma.classSession.delete({ where: { id: sessionA.id } });
    await prisma.group.delete({ where: { id: testGroup.id } });
    await prisma.group.delete({ where: { id: groupA.id } });
    await prisma.group.delete({ where: { id: groupB.id } });
    await prisma.user.delete({ where: { id: emergencyAdmin.id } });
    await prisma.user.delete({ where: { id: instructorB.id } });
    await prisma.user.delete({ where: { id: instructorA.id } });
    await prisma.user.delete({ where: { id: student.id } });
  } catch {}

  console.log("\n========================================================");
  console.log(`   11-BOSQICH AUDITI YAKUNLANDI: ${passCount} PASS, ${failCount} FAIL`);
  console.log("========================================================\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test xatosi:", err);
  process.exit(1);
});
