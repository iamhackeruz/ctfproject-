// Node runtime module alias hook for @/* -> src/*
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require("module");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request: string, parent: unknown, isMain: boolean, options: unknown) {
  if (request.startsWith("@/")) {
    const sub = request.slice(2);
    // When running from .test-dist/scripts/..., __dirname is .test-dist/scripts
    // compiled src files are in .test-dist/src
    const resolvedPath = path.resolve(__dirname, "../src", sub);
    return origResolve.call(this, resolvedPath, parent, isMain, options);
  }
  return origResolve.call(this, request, parent, isMain, options);
};

import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextRequest } from "next/server";

import { POST as coursesPost } from "../src/app/api/courses/route";
import { POST as authPost } from "../src/app/api/auth/route";
import { GET as labsGet, POST as labsPost } from "../src/app/api/labs/route";
import { GET as scoreboardGet } from "../src/app/api/scoreboard/route";
import { GET as proxyGet } from "../src/app/api/labs/proxy/[instanceId]/[[...path]]/route";
import { generateUserFlag } from "../src/lib/terminal/flags";
import { checkLabSubmissionRateLimit } from "../src/lib/security/lab-rate-limiter";
import { RestrictedDockerProxy } from "../src/lib/terminal/docker-proxy";
import { createDbSession } from "../src/lib/security/session";
import { hashPassword } from "../src/lib/security/password";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://cyberedu:cyberedu_secret_pass_2026@127.0.0.1:5433/cyberedu?schema=public";

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

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

async function runPhase3Tests() {
  console.log("\n========================================================");
  console.log("   CYBEREDU 3-BOSQICH: LABS VA XAVFSIZLIK TESTLARI");
  console.log("========================================================\n");

  // Test foydalanuvchilarini tayyorlash
  const testStudentEmail = `student_${Date.now()}@test.cyberedu.uz`;
  const testStudent2Email = `student2_${Date.now()}@test.cyberedu.uz`;
  const testTeacherEmail = `teacher_${Date.now()}@test.cyberedu.uz`;
  const passHash = await hashPassword("ComplexPass#2026!Sec");

  const student1 = await prisma.user.create({
    data: {
      email: testStudentEmail,
      name: "Ali Valiyev",
      displayName: "Ali_Hacker",
      role: Role.student,
      passwordHash: passHash,
    },
  });

  const student2 = await prisma.user.create({
    data: {
      email: testStudent2Email,
      name: "Bobur Rahimov",
      displayName: "Bobur_Sec",
      role: Role.student,
      passwordHash: passHash,
    },
  });

  const teacher = await prisma.user.create({
    data: {
      email: testTeacherEmail,
      name: "Akmal Ustoz",
      displayName: "Akmal_Teacher",
      role: Role.instructor,
      passwordHash: passHash,
    },
  });

  // Sessiyalar yaratish
  const dummyReq = new NextRequest("http://127.0.0.1:3000/");
  const s1Session = await createDbSession(student1.id, dummyReq);
  const s2Session = await createDbSession(student2.id, dummyReq);
  const teacherSession = await createDbSession(teacher.id, dummyReq);

  // ─────────────────────────────────────────────────────────────
  // 1. HTTP DARAJASIDAGI RBAC VA CSRF TESTLARI
  // ─────────────────────────────────────────────────────────────
  console.log("[1] HTTP Darajasidagi RBAC va CSRF Testlari:");

  // Test 1.1: Anonim so'rov kurs yarata olmaydi (401)
  const anonReq = new NextRequest("http://127.0.0.1:3000/api/courses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://127.0.0.1:3000",
    },
    body: JSON.stringify({ title: "Test Course", desc: "Test Desc" }),
  });
  const anonRes = await coursesPost(anonReq);
  assert(anonRes.status === 401, "Anonim so'rovga kurs yaratish rad etildi (401 Unauthorized)");

  // Test 1.2: Talaba kurs yarata olmaydi (Privilege Escalation bloklandi: 403)
  const studentReq = new NextRequest("http://127.0.0.1:3000/api/courses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://127.0.0.1:3000",
      cookie: `cyberedu_session=${s1Session.token}`,
    },
    body: JSON.stringify({ title: "Hacked Course", desc: "Hacked Desc" }),
  });
  const studentRes = await coursesPost(studentReq);
  assert(studentRes.status === 403, "Talabaning admin huquqiga urinishi HTTP darajasida bloklandi (403 Forbidden)");

  // Test 1.3: Ustoz/Admin kurs yarata oladi (200/201)
  const teacherReq = new NextRequest("http://127.0.0.1:3000/api/courses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://127.0.0.1:3000",
      cookie: `cyberedu_session=${teacherSession.token}`,
    },
    body: JSON.stringify({
      title: "Kriptografiya Chuqurlashtirilgan",
      desc: "Ustoz tomonidan yaratilgan kurs",
      level: "O'rta",
      duration: "12 soat",
      tags: ["Kripto"],
    }),
  });
  const teacherRes = await coursesPost(teacherReq);
  assert(teacherRes.status === 200, "Ustoz muvaffaqiyatli kurs yarata oldi (200 OK)");

  // Test 1.4: Cross-site CSRF so'rov rad etildi (403)
  const csrfReq = new NextRequest("http://127.0.0.1:3000/api/courses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://evil-attacker-site.com",
      cookie: `cyberedu_session=${teacherSession.token}`,
    },
    body: JSON.stringify({ title: "CSRF Course", desc: "Evil Desc" }),
  });
  const csrfRes = await coursesPost(csrfReq);
  assert(csrfRes.status === 403, "Yot saytdan (Evil Origin) yuborilgan CSRF so'rov rad etildi (403 Forbidden)");

  // ─────────────────────────────────────────────────────────────
  // 2. PAROL TIKLASH XAVFSIZLIGI (Fix B va F)
  // ─────────────────────────────────────────────────────────────
  console.log("\n[2] Parol Tiklash Xavfsizligi va Max 5 Urinish Testlari:");

  // Test 2.1: Parol tiklash kodi so'rash
  const resetReq = new NextRequest("http://127.0.0.1:3000/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://127.0.0.1:3000" },
    body: JSON.stringify({ action: "request-reset", email: student1.email }),
  });
  const resetRes = await authPost(resetReq);
  const resetData = await resetRes.json();
  const resetRawCode = resetData.code;
  assert(resetData.success && !!resetRawCode, "Parol tiklash kodi muvaffaqiyatli yaratildi");

  // Test 2.2: Noto'g'ri kodlar kiritilganda hisoblagich oshishi va 5-urinishda bekor bo'lishi
  for (let i = 1; i <= 4; i++) {
    const wrongReq = new NextRequest("http://127.0.0.1:3000/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "http://127.0.0.1:3000" },
      body: JSON.stringify({
        action: "verify-reset",
        email: student1.email,
        code: "000000",
        newPassword: "NewComplex#2026!Pass",
      }),
    });
    const wrongRes = await authPost(wrongReq);
    const wrongData = await wrongRes.json();
    assert(
      wrongRes.status === 400 && wrongData.error.includes("Qolgan urinishlar"),
      `Noto'g'ri kod rad etildi (${i}-urinish)`
    );
  }

  // 5-xato urinish: Kod darhol bekor qilinishi kerak
  const fifthReq = new NextRequest("http://127.0.0.1:3000/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://127.0.0.1:3000" },
    body: JSON.stringify({
      action: "verify-reset",
      email: student1.email,
      code: "000000",
      newPassword: "NewComplex#2026!Pass",
    }),
  });
  const fifthRes = await authPost(fifthReq);
  const fifthData = await fifthRes.json();
  assert(
    fifthRes.status === 400 && fifthData.error.includes("bekor qilindi"),
    "5 marta xato kiritilgach kod butunlay bekor qilindi (Token Revocation)"
  );

  // Endi to'g'ri kod kiritilsa ham rad etilishi kerak
  const revokedReq = new NextRequest("http://127.0.0.1:3000/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://127.0.0.1:3000" },
    body: JSON.stringify({
      action: "verify-reset",
      email: student1.email,
      code: resetRawCode,
      newPassword: "NewComplex#2026!Pass",
    }),
  });
  const revokedRes = await authPost(revokedReq);
  assert(revokedRes.status === 400, "Bekor qilingan kod bilan qayta tiklash bloklandi");

  // ─────────────────────────────────────────────────────────────
  // 3. LABORATORIYALAR VA DILNAMIK FLAG TESTLARI
  // ─────────────────────────────────────────────────────────────
  console.log("\n[3] Laboratoriyalar, Dinamik Flag va TimingSafeEqual Testlari:");

  // Test 3.1: 15 ta laboratoriya mavjudligi
  const labsGetReq = new NextRequest("http://127.0.0.1:3000/api/labs");
  const labsGetRes = await labsGet(labsGetReq);
  const labsGetData = await labsGetRes.json();
  assert(
    labsGetData.success && labsGetData.labs.length >= 15,
    `Kamida 15 ta lab mavjud (Bazadagi soni: ${labsGetData.labs?.length})`
  );

  // Test 3.2: Talaba uchun yechim yo'riqnomasi (guide) yashirilgan
  const studentLabsReq = new NextRequest("http://127.0.0.1:3000/api/labs", {
    headers: { cookie: `cyberedu_session=${s1Session.token}` },
  });
  const studentLabsRes = await labsGet(studentLabsReq);
  const studentLabsData = await studentLabsRes.json();
  const hasLeakedGuide = studentLabsData.labs.some((l: { guide: string | null }) => l.guide !== null);
  assert(!hasLeakedGuide, "Talabalardan ustoz yechim yo'riqnomasi (guide) muvaffaqiyatli yashirildi");

  // Test 3.3: Ustoz uchun yechim yo'riqnomasi (guide) ochiq
  const teacherLabsReq = new NextRequest("http://127.0.0.1:3000/api/labs", {
    headers: { cookie: `cyberedu_session=${teacherSession.token}` },
  });
  const teacherLabsRes = await labsGet(teacherLabsReq);
  const teacherLabsData = await teacherLabsRes.json();
  const hasTeacherGuide = teacherLabsData.labs.some((l: { guide: string | null }) => l.guide !== null);
  assert(hasTeacherGuide, "Ustoz uchun yechim yo'riqnomasi (guide) ko'rsatildi");

  // Test 3.4: Rate Limiting: 5 urinish / 1 daqiqa
  const labLinux1 = "lab-linux-1";
  for (let i = 0; i < 5; i++) {
    checkLabSubmissionRateLimit("test_ratelimit_user", labLinux1);
  }
  const rateLimitResult = checkLabSubmissionRateLimit("test_ratelimit_user", labLinux1);
  assert(rateLimitResult.limited, "5 marta xato flag topshirilgach Rate Limit (429) ishladi");

  // ─────────────────────────────────────────────────────────────
  // 4. HINT JARIMALARI VA FIRST BLOOD TESTLARI
  // ─────────────────────────────────────────────────────────────
  console.log("\n[4] Hint Jarimalari (-10%, -20%, -30%) va First Blood Testlari:");

  // Test 4.1: Talaba 1 uchun 1-hintni ochish
  const hint1Req = new NextRequest("http://127.0.0.1:3000/api/labs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://127.0.0.1:3000",
      cookie: `cyberedu_session=${s1Session.token}`,
    },
    body: JSON.stringify({ action: "unlock_hint", labId: "lab-linux-2", hintLevel: 1 }),
  });
  const hint1Res = await labsPost(hint1Req);
  const hint1Data = await hint1Res.json();
  assert(hint1Data.success && hint1Data.penaltyPercent === 10, "1-daraja hint ochildi (-10% jarima)");

  // Test 4.2: Talaba 1 to'g'ri dinamik flag topshiradi va First Blood oladi
  const s1Flag = generateUserFlag("lab-linux-2", student1.id);
  const s1SubmitReq = new NextRequest("http://127.0.0.1:3000/api/labs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://127.0.0.1:3000",
      cookie: `cyberedu_session=${s1Session.token}`,
    },
    body: JSON.stringify({ action: "submit_flag", labId: "lab-linux-2", flag: s1Flag }),
  });
  const s1SubmitRes = await labsPost(s1SubmitReq);
  const s1SubmitData = await s1SubmitRes.json();
  assert(
    s1SubmitData.success && s1SubmitData.isFirstBlood === true,
    "Birinchi yechuvchi muvaffaqiyatli First Blood (🩸) oldi"
  );
  assert(
    s1SubmitData.penaltyPercent === 10 && s1SubmitData.pointsEarned === 45,
    "1-hint ochilgani uchun 50 balldan 10% jarima ayirilib 45 ball berildi"
  );

  // Test 4.3: Talaba 2 xuddi shu labni 2-bo'lib yechganda First Blood ololmaydi
  const s2Flag = generateUserFlag("lab-linux-2", student2.id);
  const s2SubmitReq = new NextRequest("http://127.0.0.1:3000/api/labs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://127.0.0.1:3000",
      cookie: `cyberedu_session=${s2Session.token}`,
    },
    body: JSON.stringify({ action: "submit_flag", labId: "lab-linux-2", flag: s2Flag }),
  });
  const s2SubmitRes = await labsPost(s2SubmitReq);
  const s2SubmitData = await s2SubmitRes.json();
  assert(
    s2SubmitData.success && s2SubmitData.isFirstBlood === false,
    "Keyingi yechuvchi First Blood ololmadi (isFirstBlood: false)"
  );
  assert(
    s2SubmitData.pointsEarned === 50,
    "Hint ishlatmagan talaba to'liq 50 ball oldi"
  );

  // ─────────────────────────────────────────────────────────────
  // 5. VEB LABORATORIYA IZOLYATSIYASI VA REVERSE PROXY IDOR
  // ─────────────────────────────────────────────────────────────
  console.log("\n[5] Izolyatsiyalangan Veb Lab va Reverse Proxy IDOR Testlari:");

  // Test 5.1: Talaba 1 uchun weblab instansiyasini ishga tushirish
  const startInstReq = new NextRequest("http://127.0.0.1:3000/api/labs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://127.0.0.1:3000",
      cookie: `cyberedu_session=${s1Session.token}`,
    },
    body: JSON.stringify({ action: "start_instance", labId: "web-sqli" }),
  });
  const startInstRes = await labsPost(startInstReq);
  const startInstData = await startInstRes.json();
  assert(startInstData.success && !!startInstData.instanceId, "Izolyatsiyalangan veb lab instansiyasi ishga tushdi");

  const instanceId = startInstData.instanceId;

  if (instanceId) {
    // Test 5.2: Talaba 1 o'z instansiyasiga proxy orqali kira oladi (200 OK)
    const proxyReq = new NextRequest(`http://127.0.0.1:3000/api/labs/proxy/${instanceId}`, {
      headers: { cookie: `cyberedu_session=${s1Session.token}` },
    });
    const proxyRes = await proxyGet(proxyReq, { params: Promise.resolve({ instanceId }) });
    assert(proxyRes.status === 200, "Talaba 1 o'z laboratoriyasiga Reverse Proxy orqali muvaffaqiyatli kirdi");

    // Test 5.3: Talaba 2 Talaba 1 ning instansiyasiga kira olmaydi (IDOR bloklandi: 404)
    const idorProxyReq = new NextRequest(`http://127.0.0.1:3000/api/labs/proxy/${instanceId}`, {
      headers: { cookie: `cyberedu_session=${s2Session.token}` },
    });
    const idorProxyRes = await proxyGet(idorProxyReq, { params: Promise.resolve({ instanceId }) });
    assert(
      idorProxyRes.status === 404,
      "Talaba 2 begona instansiyaga kira olmadi (Reverse Proxy IDOR himoyasi faol)"
    );

    // Instansiyani to'xtatish
    await RestrictedDockerProxy.stopWebLab(instanceId);
  }

  // ─────────────────────────────────────────────────────────────
  // 6. SCOREBOARD VA ANONYMITY (DisplayName) TESTLARI
  // ─────────────────────────────────────────────────────────────
  console.log("\n[6] Scoreboard va Maxfiylik (DisplayName) Testlari:");

  const scoreReq = new NextRequest("http://127.0.0.1:3000/api/scoreboard");
  const scoreRes = await scoreboardGet(scoreReq);
  const scoreData = await scoreRes.json();

  assert(scoreData.success && Array.isArray(scoreData.leaderboard), "Scoreboard ma'lumotlari muvaffaqiyatli olindi");

  const scoreRawString = JSON.stringify(scoreData);
  const emailExposed =
    scoreRawString.includes(testStudentEmail) || scoreRawString.includes("@test.cyberedu.uz");
  assert(!emailExposed, "Foydalanuvchi elektron pochtalari (email) Scoreboard'da oshkor qilinmadi (Anonymity)");

  const hasDisplayName = scoreData.leaderboard.some(
    (u: { displayName: string }) => u.displayName === "Bobur_Sec" || u.displayName === "Ali_Hacker"
  );
  assert(hasDisplayName, "Scoreboard'da talabalarning DisplayName nomlari to'g'ri ko'rsatildi");

  // Tozalash
  await prisma.user.deleteMany({
    where: {
      id: { in: [student1.id, student2.id, teacher.id] },
    },
  });

  console.log("\n========================================================");
  console.log(`Phase 3 Testlar yakunlandi: ${passedCount} o'tdi, ${failedCount} xato.`);
  console.log("========================================================\n");

  if (failedCount > 0) process.exit(1);
}

runPhase3Tests()
  .catch((e) => {
    console.error("Test xatosi:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
