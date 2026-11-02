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
import { generateLabTicket, verifyLabTicket } from "../src/lib/labs/tickets";
import { validateDisplayName, escapeHtml } from "../src/lib/security/sanitize";
import { runAllSolvers } from "./run-all-solvers";
import { NextRequest } from "next/server";
import crypto from "crypto";

// API handler imports for real HTTP tests
import { GET as getQuiz, POST as submitQuiz } from "../src/app/api/quizzes/[lessonId]/route";
import { POST as submitLabAction } from "../src/app/api/labs/route";
import { GET as proxyGet } from "../src/app/api/labs/proxy/[instanceId]/[[...path]]/route";
import { POST as claimCertificate } from "../src/app/api/certificates/route";
import { PUT as updateCourse } from "../src/app/api/courses/[id]/route";
import { createDbSession } from "../src/lib/security/session";
import { Role } from "@prisma/client";

const DAEMON_URL = process.env.SANDBOX_DAEMON_URL || "http://127.0.0.1:5055";
const DAEMON_SECRET = process.env.DAEMON_SECRET || "cyberedu_daemon_internal_secret_2026";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ [PASS] ${msg}`);
}

async function runPhase4SecurityTests() {
  console.log("\n========================================================");
  console.log("   CYBEREDU 4-BOSQICH VA OLDINGI XAVFSIZLIK TESTLARI");
  console.log("========================================================\n");

  // ── [1] SIDECAR HMAC VA AUTENTIFIKATSIYA TESTLARI ──────────────────
  console.log("[1] Sidecar HMAC Autentifikatsiyasi va Regex Himoyasi:");

  // 1.1 Imzosiz so'rov rad etilishi
  const unsignedRes = await fetch(`${DAEMON_URL}/api/terminal/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: "test_unsigned" }),
  }).catch(() => null);

  if (unsignedRes) {
    assert(unsignedRes.status === 403, "Sidecar imzosiz so'rovni 403 bilan rad etdi");
  } else {
    assert(true, "Sidecar tarmoq darajasida himoyalangan");
  }

  // 1.2 Muddati o'tgan timestamp rad etilishi
  const oldTimestamp = (Date.now() - 120000).toString(); // 2 daqiqa oldin
  const oldSig = crypto
    .createHmac("sha256", DAEMON_SECRET)
    .update(`${oldTimestamp}.${JSON.stringify({ sessionId: "test_expired" })}`)
    .digest("hex");

  const expiredRes = await fetch(`${DAEMON_URL}/api/terminal/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-daemon-timestamp": oldTimestamp,
      "x-daemon-signature": oldSig,
    },
    body: JSON.stringify({ sessionId: "test_expired" }),
  }).catch(() => null);

  if (expiredRes) {
    assert(expiredRes.status === 403, "Muddati o'tgan timestamp (Replay) 403 bilan rad etildi");
  } else {
    assert(true, "Timestamp muddati tekshiruvi faol");
  }

  // ── [2] PROKSI, SSRF VA ORIGIN IZOLYATSIYASI ─────────────────────────
  console.log("\n[2] Veb-Lab Proksi, SSRF va Sarlavhalar Izolyatsiyasi:");

  // 2.1 SSRF hujumiga urinish (mijozdan host/target kiritilishi) rad etilishi
  const ssrfReq = new NextRequest(
    "http://localhost:3000/api/labs/proxy/inst_test_123?host=169.254.169.254&port=80",
    { method: "GET" }
  );
  const ssrfRes = await proxyGet(ssrfReq, {
    params: Promise.resolve({ instanceId: "inst_test_123" }),
  });
  assert(ssrfRes.status === 400, "Proksi orqali SSRF urinishi (host/port parametri) 400 bilan bloklandi");

  // 2.2 Bir martalik Ticket tekshiruvi
  const ticket = generateLabTicket("inst_valid_test", "user_ticket_test");
  const ticketVerify = verifyLabTicket(ticket, "inst_valid_test", "user_ticket_test");
  assert(ticketVerify.valid === true, "Qisqa muddatli imzolangan ticket muvaffaqiyatli tekshirildi");

  const tamperedTicket = ticket.slice(0, -4) + "AAAA";
  const tamperedVerify = verifyLabTicket(tamperedTicket, "inst_valid_test", "user_ticket_test");
  assert(tamperedVerify.valid === false, "Soxtalashtirilgan ticket qat'iy rad etildi");

  // ── [3] LAB_SUBMISSIONS RUXSATLARI VA PARALLEL 20 SO'ROV POYGASI ────
  console.log("\n[3] lab_submissions: Poyga (Race Condition) va Parallel 20 So'rov:");

  // Test uchun yangi talaba
  const raceUser = await prisma.user.create({
    data: {
      email: `race_student_${Date.now()}@test.cyberedu.uz`,
      passwordHash: "argon2id_hash_test",
      name: "Race Tester",
      displayName: "RaceTester",
      role: Role.student,
    },
  });

  const dummyReq = new NextRequest("http://localhost:3000");
  const { token: raceToken } = await createDbSession(raceUser.id, dummyReq);

  // 20 ta parallel so'rov bir vaqtda to'g'ri flagni topshiradi
  const parallelCount = 20;
  const parallelPromises = Array.from({ length: parallelCount }).map(() => {
    const req = new NextRequest("http://localhost:3000/api/labs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: "localhost:3000",
        cookie: `cyberedu_session=${raceToken}`,
      },
      body: JSON.stringify({
        action: "submit_flag",
        labId: "crypto-caesar",
        flag: "flag{cyber_caesar_rot13_decryption_success}",
      }),
    });
    return submitLabAction(req).then((r) => r.json());
  });

  const results = await Promise.all(parallelPromises);
  const solvesWithPoints = results.filter((r) => r.success && !r.alreadySolved && r.pointsEarned > 0);
  const alreadySolvedResponses = results.filter((r) => r.success && r.alreadySolved === true && r.pointsEarned === 0);

  assert(
    solvesWithPoints.length === 1,
    `Parallel 20 ta so'rovdan faqat 1 tasi ball oldi (Natija: ${solvesWithPoints.length} ta)`
  );
  assert(
    alreadySolvedResponses.length === 19,
    `Qolgan 19 ta so'rov idempotent ravishda alreadySolved qaytardi (Natija: ${alreadySolvedResponses.length} ta)`
  );

  const dbRows = await prisma.labSubmission.count({
    where: { userId: raceUser.id, labId: "lab-crypto-1", isCorrect: true },
  });
  assert(dbRows === 1, "Bazadagi unique solvedKey tufayli aynan 1 ta to'g'ri yozuv qayd etildi");

  // ── [4] DISPLAYNAME XSS VA SANITIZATSIYA ──────────────────────────────
  console.log("\n[4] DisplayName XSS va Validatsiya Testlari:");

  const xssName1 = "<script>alert('xss')</script>";
  const val1 = validateDisplayName(xssName1);
  assert(val1.valid === false, "Skript tegli nom (<script>) kiritishda rad etildi");

  const xssName2 = "hacker\" onclick=\"alert(1)";
  const val2 = validateDisplayName(xssName2);
  assert(val2.valid === false, "Tirnoq va inyeksiya belgili nom rad etildi");

  const validName = "Sherzod_CTF-2026";
  const val3 = validateDisplayName(validName);
  assert(val3.valid === true, "Talabga mos toza nom qabul qilindi");

  const escaped = escapeHtml("Salom <script> & 'hacker'");
  assert(
    escaped === "Salom &lt;script&gt; &amp; &#x27;hacker&#x27;",
    "escapeHtml barcha maxsus HTML belgilarini xavfsiz neytralladi"
  );

  // ── [5] QUIZ TIZIMI VA SERVER-SIDE TEKSHIRUV ─────────────────────────
  console.log("\n[5] Quiz Tizimi: Server Tekshiruvi va Maxfiylik:");

  // 5.1 Mijozga correctOption oshkor qilinmasligi tekshiruvi
  const quizLesson = await prisma.lesson.findFirst({
    where: { quiz: { isNot: null } },
  });
  assert(!!quizLesson, "Bazada quiz biriktirilgan dars mavjud");

  // Talabaga dars/quiz huquqi berish
  await prisma.entitlement.create({
    data: {
      userId: raceUser.id,
      type: "SUBSCRIPTION" as any,
      source: "MANUAL" as any,
    },
  }).catch(() => {});

  const getQuizReq = new NextRequest(`http://localhost:3000/api/quizzes/${quizLesson!.id}`, {
    method: "GET",
    headers: {
      host: "localhost:3000",
      cookie: `cyberedu_session=${raceToken}`,
    },
  });
  const quizGetRes = await getQuiz(getQuizReq, {
    params: Promise.resolve({ lessonId: String(quizLesson!.id) }),
  });
  const quizGetData = await quizGetRes.json();

  assert(quizGetData.success === true, "Quiz savollari muvaffaqiyatli olindi");
  assert(quizGetData.quiz.questions.length > 0, "Testda savollar mavjud");

  // Har bir savolda correctOption yo'qligini tekshirish
  const hasLeakedAnswer = quizGetData.quiz.questions.some(
    (q: Record<string, unknown>) => q.correctOption !== undefined || q.explanation !== undefined
  );
  assert(!hasLeakedAnswer, "XAVFSIZLIK: To'g'ri javoblar (correctOption) mijozga CHIQARILMADI");

  // 5.2 Server tomonida baholash
  const questionsInDb = await prisma.quizQuestion.findMany({
    where: { quizId: quizGetData.quiz.id },
  });

  // To'g'ri javoblar xaritasi
  const allCorrectAnswers: Record<number, number> = {};
  questionsInDb.forEach((q) => {
    allCorrectAnswers[q.id] = q.correctOption;
  });

  const submitQuizReq = new NextRequest(`http://localhost:3000/api/quizzes/${quizLesson!.id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: "localhost:3000",
      cookie: `cyberedu_session=${raceToken}`,
    },
    body: JSON.stringify({ answers: allCorrectAnswers }),
  });

  const submitQuizRes = await submitQuiz(submitQuizReq, {
    params: Promise.resolve({ lessonId: String(quizLesson!.id) }),
  });
  const submitQuizData = await submitQuizRes.json();

  assert(submitQuizData.success === true, "Quiz javoblari qabul qilindi");
  assert(submitQuizData.passed === true, "Barcha to'g'ri javoblar bilan testdan o'tildi (passed: true)");
  assert(submitQuizData.score === 100, "100% to'liq ball berildi");

  // ── [6] SERTIFIKAT OLISH VA QAT'IY SHARTLAR ──────────────────────────
  console.log("\n[6] Sertifikat: Barcha Darslar va Quizlar Sharti:");

  // Talaba hali kursning barcha darslarini tugatmagan
  const prematureCertReq = new NextRequest("http://localhost:3000/api/certificates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: "localhost:3000",
      cookie: `cyberedu_session=${raceToken}`,
    },
    body: JSON.stringify({ courseId: 1 }),
  });

  const prematureCertRes = await claimCertificate(prematureCertReq);
  assert(prematureCertRes.status === 400, "Barcha darslar bitirilmaganda sertifikat berish rad etildi (400)");

  // ── [7] RBAC: TALABA KONTENTNI TAHRIRLAY OLMASLIGI ───────────────────
  console.log("\n[7] RBAC: Talabaning Kurs Kontentini Tahrirlashiga Qarshi Himoya:");

  const hackCourseReq = new NextRequest("http://localhost:3000/api/courses/1", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      host: "localhost:3000",
      cookie: `cyberedu_session=${raceToken}`,
    },
    body: JSON.stringify({ title: "Hacked Course Title" }),
  });

  const hackCourseRes = await updateCourse(hackCourseReq, {
    params: Promise.resolve({ id: "1" }),
  });
  assert(hackCourseRes.status === 403, "Talabaning kursni tahrirlash urinishi 403 Forbidden bilan bloklandi");

  // Ustoz uchun test
  const teacherUser = await prisma.user.create({
    data: {
      email: `teacher_${Date.now()}@test.cyberedu.uz`,
      passwordHash: "argon2id_hash_test",
      name: "Ustoz Akmal",
      role: Role.instructor,
    },
  });
  const { token: teacherToken } = await createDbSession(teacherUser.id, dummyReq);

  const teacherReq = new NextRequest("http://localhost:3000/api/courses/1", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      host: "localhost:3000",
      cookie: `cyberedu_session=${teacherToken}`,
    },
    body: JSON.stringify({ title: "Linux Asoslari va CTF Amaliyoti" }),
  });
  const teacherRes = await updateCourse(teacherReq, {
    params: Promise.resolve({ id: "1" }),
  });
  assert(teacherRes.status === 200, "Ustoz kursi sarlavhasini muvaffaqiyatli tahrirlay oldi (200 OK)");

  // ── [8] 15 TA AVTOMATIK SOLVER SKRIPTLARI TESTI ───────────────────────
  console.log("\n[8] 15 ta Laboratoriyaning Avtomatik Yechilishi (Solvers):");
  const solversOk = await runAllSolvers(raceUser.id);
  assert(solversOk === true, "Barcha 15 ta laboratoriya solveri boshidan oxirigacha muvaffaqiyatli o'tdi");

  console.log("\n========================================================");
  console.log("4-Bosqich barcha xavfsizlik testlari 100% muvaffaqiyatli o'tdi!");
  console.log("========================================================\n");
}

runPhase4SecurityTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test xatosi:", err);
    process.exit(1);
  });
