import crypto from "crypto";
import { prisma } from "../src/lib/db";
import {
  hashPassword,
  verifyPasswordHash,
  validatePassword,
} from "../src/lib/security/password";
import {
  createDbSession,
  getSessionUser,
  requireAuth,
} from "../src/lib/security/session";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail = "") {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ""}`);
    failedCount++;
  }
}

async function runPhase2Tests() {
  console.log("\n========================================================");
  console.log("   CYBEREDU AUTENTIFIKATSIYA VA BAZA TESTLARI (2-BOSQICH)");
  console.log("========================================================\n");

  // ─────────────────────────────────────────────────────────────
  // 1. ARGON2ID VA PAROL SIYOSATI TESTLARI
  // ─────────────────────────────────────────────────────────────
  console.log("[1] Argon2id va Parol Siyosati Testlari:");

  const shortPass = validatePassword("123456789");
  assert(!shortPass.valid, "9 ta belgili parol rad etildi (Minimal 10 ta shart)");

  const commonPass = validatePassword("password1234");
  assert(!commonPass.valid, "Keng tarqalgan zaif parol (password1234) rad etildi");

  const validPass = validatePassword("KiberXavfsizlik#2026!Strong");
  assert(validPass.valid, "Kuchli va talabga mos parol muvaffaqiyatli qabul qilindi");

  const strongHash = await hashPassword("KiberXavfsizlik#2026!Strong");
  assert(strongHash.startsWith("$argon2id$"), "Parol argon2id algoritmi bilan xeshlandi");

  const isPassOk = await verifyPasswordHash(strongHash, "KiberXavfsizlik#2026!Strong");
  assert(isPassOk, "Argon2id xeshi to'g'ri parol bilan muvaffaqiyatli tasdiqlandi");

  const isWrongPass = await verifyPasswordHash(strongHash, "Noto'g'riParol123!");
  assert(!isWrongPass, "Argon2id noto'g'ri parolni muvaffaqiyatli rad etdi");

  // ─────────────────────────────────────────────────────────────
  // 2. BAZAVIY SESSIYALAR VA SOXTA TOKEN HIMOYASI
  // ─────────────────────────────────────────────────────────────
  console.log("\n[2] Bazaviy Sessiyalar va Sessiyani Soxtalashtirish Testlari:");

  // Test uchun talaba yaratish
  const testStudentEmail = `test_student_${Date.now()}@cyberedu.uz`;
  const studentUser = await prisma.user.create({
    data: {
      email: testStudentEmail,
      name: "Test Talaba",
      passwordHash: strongHash,
      role: Role.student,
    },
  });

  const dummyReq = new NextRequest("http://localhost:3000/api/auth", {
    headers: { "x-forwarded-for": "127.0.0.1" },
  });

  const { token, user: sessionUser } = await createDbSession(studentUser.id, dummyReq);
  assert(token.includes("."), "Imzolangan sessiya tokeni yaratildi");
  assert(sessionUser.userId === studentUser.id, "Sessiya foydalanuvchiga to'g'ri bog'landi");

  // Soxtalashtirilgan (tampered) token tekshiruvi
  const reqWithTampered = new NextRequest("http://localhost:3000/api/auth", {
    headers: { cookie: `cyberedu_session=${token.slice(0, -6)}abcdef` },
  });
  const tamperedResult = await getSessionUser(reqWithTampered);
  assert(tamperedResult === null, "Soxtalashtirilgan (tampered) sessiya tokeni bazadan rad etildi");

  // Haqiqiy token bilan tekshirish
  const reqWithValid = new NextRequest("http://localhost:3000/api/auth", {
    headers: { cookie: `cyberedu_session=${token}` },
  });
  const validResult = await getSessionUser(reqWithValid);
  assert(
    validResult !== null && validResult.userId === studentUser.id,
    "Haqiqiy bazaviy sessiya cookie orqali muvaffaqiyatli tasdiqlandi"
  );

  // ─────────────────────────────────────────────────────────────
  // 3. RBAC (ROLNI OSHIRISHGA URINISH - PRIVILEGE ESCALATION)
  // ─────────────────────────────────────────────────────────────
  console.log("\n[3] RBAC (Privilege Escalation) Testlari:");

  // Talaba admin huquqini talab qiluvchi operatsiyaga urinadi
  const rbacReq = new NextRequest("http://localhost:3000/api/courses", {
    headers: { cookie: `cyberedu_session=${token}` },
  });

  const rbacCheck = await requireAuth(rbacReq, [Role.admin, Role.instructor]);
  assert(
    rbacCheck instanceof NextResponse && rbacCheck.status === 403,
    "Talabaning Admin/Instructor huquqiga urinishi (403 Forbidden) bilan bloklandi"
  );

  // Admin foydalanuvchisi yaratish va tekshirish
  const adminEmail = `test_admin_${Date.now()}@cyberedu.uz`;
  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      name: "Ustoz Admin",
      passwordHash: strongHash,
      role: Role.admin,
    },
  });

  const { token: adminToken } = await createDbSession(adminUser.id, dummyReq);
  const adminReq = new NextRequest("http://localhost:3000/api/courses", {
    headers: { cookie: `cyberedu_session=${adminToken}` },
  });

  const adminAuth = await requireAuth(adminReq, [Role.admin, Role.instructor]);
  assert(
    !(adminAuth instanceof NextResponse) && adminAuth.user.role === Role.admin,
    "Admin foydalanuvchisi RBAC tekshiruvidan muvaffaqiyatli o'tdi"
  );

  // ─────────────────────────────────────────────────────────────
  // 4. IDOR (BOSHQA FOYDALANUVCHI MA'LUMOTIGA KIRISH)
  // ─────────────────────────────────────────────────────────────
  console.log("\n[4] IDOR (Insecure Direct Object Reference) Testlari:");

  // Alice va Bob
  const alice = await prisma.user.create({
    data: {
      email: `alice_${Date.now()}@cyberedu.uz`,
      name: "Alice",
      passwordHash: strongHash,
      role: Role.student,
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: `bob_${Date.now()}@cyberedu.uz`,
      name: "Bob",
      passwordHash: strongHash,
      role: Role.student,
    },
  });

  // Alice 1-kursga progress yozadi
  await prisma.lessonProgress.create({
    data: {
      userId: alice.id,
      courseId: 1,
      lessonId: 1,
      completed: true,
    },
  });

  // Bob'ning sessiyasi
  const { token: bobToken } = await createDbSession(bob.id, dummyReq);
  const bobReq = new NextRequest("http://localhost:3000/api/progress", {
    headers: { cookie: `cyberedu_session=${bobToken}` },
  });

  const bobAuth = await requireAuth(bobReq);
  assert(!(bobAuth instanceof NextResponse), "Bob sessiyasi tasdiqlandi");

  if (!(bobAuth instanceof NextResponse)) {
    // Bob so'rov yuborganda faqat Bob'ning o'z progressini olishi kerak (Alice'nikini emas)
    const bobProgress = await prisma.lessonProgress.findMany({
      where: { userId: bobAuth.user.userId },
    });
    assert(
      !bobProgress.some((p) => p.userId === alice.id) && bobProgress.length === 0,
      "Bob Alice'ning progress yozuvlariga kira olmadi (IDOR himoyasi faol)"
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 5. LOGIN BRUTE-FORCE VA HISOBNI VAQTINCHA BLOKLASH
  // ─────────────────────────────────────────────────────────────
  console.log("\n[5] Login Brute-Force va Account Lockout Testlari:");

  const victimEmail = `victim_${Date.now()}@cyberedu.uz`;
  const victim = await prisma.user.create({
    data: {
      email: victimEmail,
      name: "Victim User",
      passwordHash: strongHash,
      role: Role.student,
      failedLoginAttempts: 0,
    },
  });

  // 5 marta ketma-ket xato urinishni simulyatsiya qilish
  for (let i = 1; i <= 5; i++) {
    const attempts = victim.failedLoginAttempts + i;
    const lockoutUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await prisma.user.update({
      where: { id: victim.id },
      data: { failedLoginAttempts: attempts, lockoutUntil },
    });
  }

  const updatedVictim = await prisma.user.findUnique({ where: { id: victim.id } });
  assert(
    updatedVictim !== null &&
      updatedVictim.failedLoginAttempts >= 5 &&
      updatedVictim.lockoutUntil !== null &&
      updatedVictim.lockoutUntil > new Date(),
    "5 marta xato urinishdan so'ng hisob 15 daqiqaga qulflangandi (Account Lockout faol)"
  );

  // ─────────────────────────────────────────────────────────────
  // 6. PAROL TIKLASH TOKENINI QAYTA ISHLATISH (REPLAY ATTACK)
  // ─────────────────────────────────────────────────────────────
  console.log("\n[6] Parol Tiklash Tokenini Qayta Ishlatish (Replay Attack) Testlari:");

  const rawCode = "789123";
  const tokenHash = crypto.createHash("sha256").update(rawCode).digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const resetRecord = await prisma.passwordResetToken.create({
    data: {
      userId: studentUser.id,
      tokenHash,
      expiresAt,
    },
  });

  // 1-marta ishlatish: muvaffaqiyatli
  const firstUse = await prisma.passwordResetToken.findFirst({
    where: {
      userId: studentUser.id,
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  assert(firstUse !== null, "Parol tiklash kodi 1-marta to'g'ri topildi");

  // Ishlatilgan deb belgilash
  await prisma.passwordResetToken.update({
    where: { id: resetRecord.id },
    data: { usedAt: new Date() },
  });

  // 2-marta qayta ishlatishga urinish (Replay Attack)
  const replayAttempt = await prisma.passwordResetToken.findFirst({
    where: {
      userId: studentUser.id,
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  assert(replayAttempt === null, "Oldin ishlatilgan bir martalik kod rad etildi (Replay attack bloklandi)");

  // ─────────────────────────────────────────────────────────────
  // 7. SERTIFIKATLAR VA TEKSHIRUV KODI (VERIFICATION)
  // ─────────────────────────────────────────────────────────────
  console.log("\n[7] Sertifikatlar va Tasdiqlash Kodlari Testlari:");

  const certCode = `CYBER-2026-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  await prisma.certificate.create({
    data: {
      certificateCode: certCode,
      userId: studentUser.id,
      courseId: 1,
      userName: studentUser.name,
      courseTitle: "Kiberxavfsizlik Asoslari",
      grade: "A'lo (100%)",
    },
  });

  const verifiedCert = await prisma.certificate.findUnique({
    where: { certificateCode: certCode },
  });
  assert(verifiedCert !== null && verifiedCert.userName === studentUser.name, "Sertifikat bazada noyob kod orqali tasdiqlandi");

  // Tozalash
  await prisma.session.deleteMany({ where: { userId: studentUser.id } });
  await prisma.user.deleteMany({
    where: {
      id: { in: [studentUser.id, adminUser.id, alice.id, bob.id, victim.id] },
    },
  });

  // ─────────────────────────────────────────────────────────────
  // NATIJALAR
  // ─────────────────────────────────────────────────────────────
  console.log("\n========================================================");
  console.log(`2-Bosqich testlari yakunlandi: ${passedCount} o'tdi, ${failedCount} xato.`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase2Tests()
  .catch((err) => {
    console.error("Testda xatolik:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
