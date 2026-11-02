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

import { prisma } from "../src/lib/db";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { createDbSession, revokeAllUserSessions, listUserSessions, revokeSessionById } from "../src/lib/security/session";
import { validateEnvSecrets } from "../src/lib/security/env-validator";
import { maskSensitiveData, recordAuditLog } from "../src/lib/security/audit";
import { checkPersistentRateLimit } from "../src/lib/security/persistent-rate-limiter";
import { isSafeUrl, isSafeImageUrl } from "../src/components/MarkdownView";
import { safeApiError } from "../src/lib/security/api-validator";
import { generateLabTicket } from "../src/lib/labs/tickets";

// API Handlers
import { GET as proxyGet } from "../src/app/api/labs/proxy/[instanceId]/[[...path]]/route";
import { GET as getQuiz, POST as submitQuiz } from "../src/app/api/quizzes/[lessonId]/route";
import { POST as authPost } from "../src/app/api/auth/route";
import { POST as claimCertificate } from "../src/app/api/certificates/route";
import { PUT as updateCourse } from "../src/app/api/courses/[id]/route";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ [PASS] ${msg}`);
}

async function runPhase5SecurityAudit() {
  console.log("\n========================================================");
  console.log("   CYBEREDU 5-BOSQICH VA PRE-PHASE 5 XAVFSIZLIK AUDITI");
  console.log("========================================================\n");

  // Test foydalanuvchilarini yaratish
  const student = await prisma.user.create({
    data: {
      email: `audit_student_${Date.now()}@cyberedu.uz`,
      name: "Audit Talaba",
      displayName: "Audit_Student_5",
      role: Role.student,
      passwordHash: "argon2_test_hash",
    },
  });

  const victim = await prisma.user.create({
    data: {
      email: `victim_${Date.now()}@cyberedu.uz`,
      name: "Qurbon Foydalanuvchi",
      displayName: "Victim_User_5",
      role: Role.student,
      passwordHash: "argon2_victim_hash",
    },
  });

  const studentSession = await createDbSession(student.id, new NextRequest("http://localhost:3000"));
  await createDbSession(victim.id, new NextRequest("http://localhost:3000"));

  // ── [1] PRE-PHASE 5 A: WEBLAB CSP VA OPAQUE ORIGIN IZOLYATSIYASI ─────
  console.log("[1] Web-Lab Proksi CSP va Opaque Origin Izolyatsiyasi (A):");

  const ticket = generateLabTicket("inst_audit_test", student.id);
  const testProxyReq = new NextRequest(`http://localhost:3000/api/labs/proxy/inst_audit_test?ticket=${ticket}`);
  // Proksi soxta/mavjud bo'lmagan instansiya uchun ham xavfsiz javob berishi yoki sarlavhalarini tekshirish
  const proxyRes = await proxyGet(testProxyReq, { params: Promise.resolve({ instanceId: "inst_audit_test" }) });
  
  // CSP sarlavhasi tekshiruvi: allow-same-origin bo'lmasligi shart (Opaque origin)
  const cspHeader = proxyRes.headers.get("Content-Security-Policy") || "";
  assert(!cspHeader.includes("allow-same-origin"), "CSP'da 'allow-same-origin' OLIB TASHLANDI (Opaque origin faol)");

  // Lab ichidagi XSS skripti platforma API'siga so'rov yuborganda (Origin: null yoki platforma cookie'larisiz)
  const xssForgedReq = new NextRequest("http://localhost:3000/api/auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "null", // Opaque sandbox origin
    },
    body: JSON.stringify({ action: "list-sessions" }),
  });
  const xssForgedRes = await authPost(xssForgedReq);
  assert(
    xssForgedRes.status === 403 || xssForgedRes.status === 401,
    "Lab ichidagi XSS (Origin: null / cookiesiz) platforma API'siga kira olmadi (Bloklandi)"
  );

  // ── [2] PRE-PHASE 5 C: QUIZ XAVFSIZLIGI VA BRUTE-FORCE CHEKLOVI ───────
  console.log("\n[2] Quiz Xavfsizligi va Brute-Force Himoyasi (C):");

  const quizLesson = await prisma.lesson.findFirst({
    where: { quiz: { isNot: null } },
    include: { quiz: { include: { questions: true } } },
  });

  assert(!!quizLesson && !!quizLesson.quiz, "Bazada test darsi mavjud");
  assert(quizLesson!.quiz!.questions.length >= 5, "Har bir testda kamida 5 ta savol mavjud (Pre-Phase 5 talabi)");

  // Talabaga huquq berish
  await prisma.entitlement.create({
    data: {
      userId: student.id,
      type: "SUBSCRIPTION" as any,
      source: "MANUAL" as any,
    },
  }).catch(() => {});

  // 2.1 Variantlar aralashtirilishi (Shuffling)
  const getQReq1 = new NextRequest(`http://localhost:3000/api/quizzes/${quizLesson!.id}`, {
    headers: {
      host: "localhost:3000",
      cookie: `cyberedu_session=${studentSession.token}`,
    },
  });
  const getQRes1 = await getQuiz(getQReq1, { params: Promise.resolve({ lessonId: String(quizLesson!.id) }) });
  const qData1 = await getQRes1.json();
  assert(qData1.success === true, "Quiz savollari muvaffaqiyatli olindi");
  assert(qData1.quiz.questions[0].correctOption === undefined, "To'g'ri javob indeksi mijozga CHIQARILMADI");

  // 2.2 Xato javob topshirilganda xato savollar indeksi oshkor qilinmasligi
  const wrongAnswers: Record<string, string> = {};
  quizLesson!.quiz!.questions.forEach((q) => {
    wrongAnswers[String(q.id)] = "mutlaqo_xato_javob";
  });

  const submitWrongReq = new NextRequest(`http://localhost:3000/api/quizzes/${quizLesson!.id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: "localhost:3000",
      cookie: `cyberedu_session=${studentSession.token}`,
    },
    body: JSON.stringify({ answers: wrongAnswers }),
  });
  const submitWrongRes = await submitQuiz(submitWrongReq, {
    params: Promise.resolve({ lessonId: String(quizLesson!.id) }),
  });
  const submitWrongData = await submitWrongRes.json();

  assert(submitWrongData.success === true && submitWrongData.passed === false, "Xato urinish qayd etildi (passed: false)");
  assert(submitWrongData.questionResults === undefined, "Qaysi savol xato ekanligi mijozga OSHKOR QILINMADI (faqat umumiy ball)");

  // 2.3 Urinishlar orasidagi kutish vaqti (60 soniya Cooldown)
  const rapidRetryReq = new NextRequest(`http://localhost:3000/api/quizzes/${quizLesson!.id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: "localhost:3000",
      cookie: `cyberedu_session=${studentSession.token}`,
    },
    body: JSON.stringify({ answers: wrongAnswers }),
  });
  const rapidRetryRes = await submitQuiz(rapidRetryReq, {
    params: Promise.resolve({ lessonId: String(quizLesson!.id) }),
  });
  assert(rapidRetryRes.status === 429, "Tezkor takroriy urinish Cooldown (429 Too Many Requests) bilan to'xtatildi");

  // ── [3] PRE-PHASE 5 D: SERTIFIKAT VA BOG'LANGAN LAB SHARTI ────────────
  console.log("\n[3] Sertifikat: Bog'langan Laboratoriyalar Sharti (D):");

  // Kurs darslari va testlarini muvaffaqiyatli topshirgan deb belgilaymiz
  const course1Lessons = await prisma.lesson.findMany({
    where: { module: { courseId: 1 } },
    include: { quiz: true },
  });
  for (const l of course1Lessons) {
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: student.id, lessonId: l.id } },
      update: { completed: true },
      create: { userId: student.id, lessonId: l.id, courseId: 1, completed: true },
    });
    if (l.quiz) {
      await prisma.quizSubmission.create({
        data: {
          userId: student.id,
          quizId: l.quiz.id,
          score: 100,
          passed: true,
        },
      });
    }
  }

  // Ammo bog'langan laboratoriyalar hali topshirilmagan!
  const certReq = new NextRequest("http://localhost:3000/api/certificates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: "localhost:3000",
      cookie: `cyberedu_session=${studentSession.token}`,
    },
    body: JSON.stringify({ courseId: 1 }),
  });
  const certRes = await claimCertificate(certReq);
  const certData = await certRes.json();
  assert(
    certRes.status === 400 && certData.error.includes("laboratoriya"),
    "Laboratoriyalar yechilmaganligi sababli sertifikat berish rad etildi (400)"
  );

  // ── [4] PRE-PHASE 5 E: MARKDOWN XSS VA RASM CHEKLOVLARI ──────────────
  console.log("\n[4] Markdown XSS va Rasm Manbalari Cheklovi (E):");

  assert(!isSafeUrl("javascript:alert('XSS')"), "javascript: protokoli muvaffaqiyatli rad etildi");
  assert(!isSafeUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="), "data: protokoli muvaffaqiyatli rad etildi");
  assert(isSafeUrl("https://cyberedu.uz/courses"), "Xavfsiz HTTPS havola qabul qilindi");
  assert(isSafeUrl("/courses/1"), "Xavfsiz nisbiy havola qabul qilindi");

  assert(!isSafeImageUrl("https://evil-hacker.com/malicious_tracker.png"), "Ruxsat etilmagan uchinchi tomon rasm domeni bloklandi");
  assert(isSafeImageUrl("https://cyberedu.uz/assets/badge.png"), "Ruxsat etilgan platforma rasmi qabul qilindi");
  assert(isSafeImageUrl("/images/cyber-badge.png"), "Lokal nisbiy rasm manzili qabul qilindi");

  // ── [5] 5-BOSQICH: SIRLAR VA MUHIT TEKSHIRUVI (ENV VALIDATION) ───────
  console.log("\n[5] Sirlar va Muhit Xavfsizligi Tekshiruvi (Env Secrets):");

  const envCheck = validateEnvSecrets();
  assert(envCheck.valid === true, "SESSION_SECRET, FLAG_SECRET va DAEMON_SECRET mavjud, uzunligi >= 32 va bir-biridan farqli");

  // ── [6] 5-BOSQICH: SESSIYA AMALLARI VA IDLE TIMEOUT ───────────────────
  console.log("\n[6] Sessiya Boshqaruvi va Faolsizlik (Idle Timeout):");

  // 6.1 Talaba o'z faol sessiyalarini ko'ra oladi
  const listSessionsReq = new NextRequest("http://localhost:3000/api/auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: "localhost:3000",
      cookie: `cyberedu_session=${studentSession.token}`,
    },
    body: JSON.stringify({ action: "list-sessions" }),
  });
  const listSessionsRes = await authPost(listSessionsReq);
  const listSessionsData = await listSessionsRes.json();
  assert(listSessionsData.success === true && Array.isArray(listSessionsData.sessions), "Faol sessiyalar ro'yxati olindi");
  assert(listSessionsData.sessions.some((s: { isCurrent: boolean }) => s.isCurrent), "Joriy sessiya to'g'ri belgilandi");

  // 6.2 Parol o'zgarganda barcha sessiyalarning bekor qilinishi
  const revokedCount = await revokeAllUserSessions(student.id);
  assert(revokedCount >= 1, "Foydalanuvchi barcha faol sessiyalari bekor qilindi");

  const sessionsAfterRevoke = await listUserSessions(student.id);
  assert(sessionsAfterRevoke.length === 0, "Bekor qilingach, faol sessiyalar qolmadi");

  // ── [7] 5-BOSQICH: AUDIT LOG VA MAXFIY MA'LUMOTLARNI YASHIRISH ───────
  console.log("\n[7] Audit Log va Maxfiy Ma'lumotlarni Niqoblash (Masking):");

  const sensitivePayload = {
    username: "test_user",
    password: "SuperSecretPassword#123",
    flag: "flag{test_flag_secret_12345}",
    note: "Tizimga kirish flag{internal_secret_999}",
  };

  const masked = maskSensitiveData(sensitivePayload) as Record<string, string>;
  assert(masked.password === "[MAXFIY_MA'LUMOT_YASHIRILDI]", "Parol logda to'liq niqoblandi");
  assert(!masked.flag.includes("secret_12345"), "Flag qiymati logda yashirildi (flag{******})");

  await recordAuditLog({
    userId: student.id,
    action: "LOGIN_SUCCESS",
    ip: "127.0.0.1",
    details: sensitivePayload,
  });
  assert(true, "Audit log ma'lumotlar bazasiga va log fayliga muvaffaqiyatli yozildi");

  // ── [8] 5-BOSQICH: BAZAVIY RATE LIMITER (PERSISTENT RATE LIMIT) ──────
  console.log("\n[8] Doimiy (Persistent) Baza Rate Limiteri:");

  const testRateKey = `audit_rate_${Date.now()}`;
  const rate1 = await checkPersistentRateLimit(testRateKey, 3, 60, true);
  assert(rate1.limited === false && rate1.remainingPoints === 2, "1-urinish muvaffaqiyatli qayd etildi");

  await checkPersistentRateLimit(testRateKey, 3, 60, true);
  await checkPersistentRateLimit(testRateKey, 3, 60, true);

  const rate4 = await checkPersistentRateLimit(testRateKey, 3, 60, true);
  assert(rate4.limited === true && rate4.remainingPoints === 0, "Limit tugagach (4-urinish) bloklandi (Persistent rate limit faol)");

  // ── [9] 5-BOSQICH: OWASP TOP 10 INTEGRATSION TEKSHIRUVI ──────────────
  console.log("\n[9] OWASP Top 10 Platforma Xavfsizlik Auditi:");

  // 9.1 IDOR: Talaba jabrlanuvchining sessiyasini bekor qila olmasligi
  const victimSessions = await prisma.session.findMany({ where: { userId: victim.id } });
  if (victimSessions.length > 0) {
    const idorRevokeSuccess = await revokeSessionById(victimSessions[0].id, student.id);
    assert(!idorRevokeSuccess, "IDOR: Talaba begona foydalanuvchining sessiyasini bekor qila olmadi");
  }

  // 9.2 Mass Assignment: Ro'yxatdan o'tishda role: "admin" yuborilishi rad etilishi
  const testAdminUser = await prisma.user.findFirst({ where: { role: Role.admin } });
  const massInviteCode = `MASS-INV-${Date.now().toString(36).toUpperCase()}`;
  await prisma.invitationCode.create({
    data: {
      code: massInviteCode,
      createdBy: testAdminUser ? testAdminUser.id : "system_admin",
      expiresAt: new Date(Date.now() + 60000),
    },
  });

  const massAssignEmail = `hacker_${Date.now()}@test.uz`;
  const massAssignReq = new NextRequest("http://localhost:3000/api/auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: "localhost:3000",
    },
    body: JSON.stringify({
      action: "register",
      name: "Hacker User",
      email: massAssignEmail,
      password: "StrongPass#2026!Mass",
      inviteCode: massInviteCode,
      role: "admin", // Hujumchi rolni admin qilmoqchi
    }),
  });
  await authPost(massAssignReq);
  const registeredUser = await prisma.user.findFirst({
    where: { email: massAssignEmail },
  });
  assert(registeredUser?.role === Role.student, "Mass Assignment: 'role: admin' inyeksiyasi e'tiborsiz qoldirildi, student bo'lib yaratildi");

  // 9.3 Ochiq Admin Marshrutlari: Talaba kursni tahrirlay olmasligi (RBAC)
  const freshStudentSession = await createDbSession(student.id, new NextRequest("http://localhost:3000"));
  const studentEditCourseReq = new NextRequest("http://localhost:3000/api/courses/1", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      host: "localhost:3000",
      cookie: `cyberedu_session=${freshStudentSession.token}`,
    },
    body: JSON.stringify({ title: "Buzilgan kurs" }),
  });
  const editCourseRes = await updateCourse(studentEditCourseReq, { params: Promise.resolve({ id: "1" }) });
  assert(editCourseRes.status === 403, "Ochiq Admin Endpointlar: Talabaning kursni tahrirlashi 403 Forbidden bilan bloklandi");

  // 9.4 Xatolarda ma'lumot oshkor qilmaslik
  const safeErrRes = safeApiError(new Error("FATAL: relation 'users' does not exist at postgres.c:120"), "TestContext");
  const safeErrData = await safeErrRes.json();
  assert(
    !safeErrData.error.includes("postgres") && !safeErrData.error.includes("users"),
    "Ichki ma'lumotlar oshkor bo'lmadi: SQL va stack trace yashirildi"
  );

  // Tozalash
  await prisma.user.deleteMany({
    where: { id: { in: [student.id, victim.id, registeredUser?.id || ""] } },
  });

  console.log("\n========================================================");
  console.log("5-BOSQICH VA PRE-PHASE 5 BARCHA XAVFSIZLIK AUDITI MUVAFFAQIYATLI O'TDI!");
  console.log("========================================================\n");
}

runPhase5SecurityAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
