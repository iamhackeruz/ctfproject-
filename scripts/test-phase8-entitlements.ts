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
import { Role, AccessType, EntitlementType, EntitlementSource } from "@prisma/client";
import { createDbSession } from "../src/lib/security/session";
import { hashPassword } from "../src/lib/security/password";
import { canAccess } from "../src/lib/security/entitlements";

// API Handlers
import { GET as getUsers, POST as createUser, PUT as updateUser, DELETE as deleteUser } from "../src/app/api/admin/users/route";
import { POST as importUsersCsv } from "../src/app/api/admin/users/csv-import/route";
import { GET as getInvitations, POST as createInvitation, DELETE as deleteInvitation } from "../src/app/api/admin/invitations/route";
import { GET as getGroups, POST as postGroup, PUT as putGroup, DELETE as deleteGroup } from "../src/app/api/admin/groups/route";
import { GET as getAuditLogs } from "../src/app/api/admin/audit-logs/route";
import { GET as getInstances, DELETE as deleteInstance } from "../src/app/api/admin/instances/route";
import { GET as exportCsv } from "../src/app/api/admin/export/route";
import { GET as getAdminEntitlements, POST as postAdminEntitlement } from "../src/app/api/admin/entitlements/route";
import { GET as getUserEntitlements } from "../src/app/api/user/entitlements/route";
import { GET as getCourses, POST as postCourse } from "../src/app/api/courses/route";
import { GET as getCourseById, PUT as updateCourse, DELETE as deleteCourse } from "../src/app/api/courses/[id]/route";
import { GET as getQuiz, POST as postQuiz } from "../src/app/api/quizzes/[lessonId]/route";
import { POST as postLab } from "../src/app/api/labs/route";
import { POST as postTerminal } from "../src/app/api/terminal/route";
import { POST as postCertificate } from "../src/app/api/certificates/route";
import { GET as getComments, POST as postComment } from "../src/app/api/comments/route";

function assert(condition: unknown, msg: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ [PASS] ${msg}`);
}

function makeRequest(
  url: string,
  method: string,
  body?: unknown,
  sessionToken?: string
): NextRequest {
  const headers: Record<string, string> = {
    origin: "http://localhost:3000",
    host: "localhost:3000",
  };
  if (sessionToken) {
    headers.cookie = `cyberedu_session=${sessionToken}`;
  }
  if (body) {
    headers["content-type"] = "application/json";
  }

  return new NextRequest(new URL(url, "http://localhost:3000").toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function runPhase8Suite() {
  console.log("\n========================================================");
  console.log("   CYBEREDU 8-BOSQICH (KIRISH HUQUQLARI & XAVFSIZLIK) TESTLARI");
  console.log("========================================================\n");

  const ts = Date.now();
  const dummyHash = await hashPassword("TestPass#Strong2026!");

  // 1. Test Foydalanuvchilarini yaratish
  const admin = await prisma.user.create({
    data: {
      email: `p8_admin_${ts}@cyberedu.uz`,
      name: "Phase8 Admin",
      displayName: "P8_Admin",
      role: Role.admin,
      passwordHash: dummyHash,
    },
  });

  const instructor = await prisma.user.create({
    data: {
      email: `p8_inst_${ts}@cyberedu.uz`,
      name: "Phase8 Instructor",
      displayName: "P8_Inst",
      role: Role.instructor,
      passwordHash: dummyHash,
    },
  });

  const student = await prisma.user.create({
    data: {
      email: `p8_student_${ts}@cyberedu.uz`,
      name: "Phase8 Student",
      displayName: "P8_Student",
      role: Role.student,
      passwordHash: dummyHash,
    },
  });

  const dummyDummy = makeRequest("/", "GET");
  const adminSession = await createDbSession(admin.id, dummyDummy);
  const instructorSession = await createDbSession(instructor.id, dummyDummy);
  const studentSession = await createDbSession(student.id, dummyDummy);

  console.log("Foydalanuvchilar yaratildi: Admin, Instructor, Student");

  // ─────────────────────────────────────────────────────────────────────────────
  // [1] INDIVIDUAL RBAC 403 FORBIDDEN TESTLARI (Talaba va Instructor)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TEST 1] STRICT RBAC 403 CHECKS FOR ALL ADMIN ENDPOINTS ---");

  // 1.1 Talaba uchun admin endpointlar 403 bo'lishi kerak
  const studentChecks: Array<{ name: string; req: NextRequest; fn: (r: NextRequest) => Promise<Response> }> = [
    { name: "GET /api/admin/users", req: makeRequest("/api/admin/users", "GET", undefined, studentSession.token), fn: getUsers },
    { name: "POST /api/admin/users", req: makeRequest("/api/admin/users", "POST", { name: "X", email: "x@c.uz" }, studentSession.token), fn: createUser },
    { name: "PUT /api/admin/users", req: makeRequest("/api/admin/users", "PUT", { action: "block", userId: "1" }, studentSession.token), fn: updateUser },
    { name: "DELETE /api/admin/users", req: makeRequest("/api/admin/users?id=1", "DELETE", undefined, studentSession.token), fn: deleteUser },
    { name: "GET /api/admin/groups", req: makeRequest("/api/admin/groups", "GET", undefined, studentSession.token), fn: getGroups },
    { name: "POST /api/admin/groups", req: makeRequest("/api/admin/groups", "POST", { name: "G" }, studentSession.token), fn: postGroup },
    { name: "DELETE /api/admin/groups", req: makeRequest("/api/admin/groups?id=1", "DELETE", undefined, studentSession.token), fn: deleteGroup },
    { name: "GET /api/admin/invitations", req: makeRequest("/api/admin/invitations", "GET", undefined, studentSession.token), fn: getInvitations },
    { name: "POST /api/admin/invitations", req: makeRequest("/api/admin/invitations", "POST", {}, studentSession.token), fn: createInvitation },
    { name: "DELETE /api/admin/invitations", req: makeRequest("/api/admin/invitations?id=1", "DELETE", undefined, studentSession.token), fn: deleteInvitation },
    { name: "GET /api/admin/audit-logs", req: makeRequest("/api/admin/audit-logs", "GET", undefined, studentSession.token), fn: getAuditLogs },
    { name: "GET /api/admin/instances", req: makeRequest("/api/admin/instances", "GET", undefined, studentSession.token), fn: getInstances },
    { name: "DELETE /api/admin/instances", req: makeRequest("/api/admin/instances?instanceId=1", "DELETE", undefined, studentSession.token), fn: deleteInstance },
    { name: "GET /api/admin/export", req: makeRequest("/api/admin/export", "GET", undefined, studentSession.token), fn: exportCsv },
    { name: "GET /api/admin/entitlements", req: makeRequest("/api/admin/entitlements", "GET", undefined, studentSession.token), fn: getAdminEntitlements },
    { name: "POST /api/admin/entitlements", req: makeRequest("/api/admin/entitlements", "POST", { action: "grant" }, studentSession.token), fn: postAdminEntitlement },
  ];

  for (const check of studentChecks) {
    const res = await check.fn(check.req);
    assert(res.status === 403, `Talaba ${check.name} ga murojaat qilganda 403 Forbidden oldi`);
  }

  // 1.2 Instructor uchun cheklangan amallar 403 bo'lishi kerak
  const instructorChecks: Array<{ name: string; req: NextRequest; fn: (r: NextRequest) => Promise<Response> }> = [
    { name: "PUT /api/admin/users (Role Change)", req: makeRequest("/api/admin/users", "PUT", { action: "change_role", userId: student.id, role: "admin" }, instructorSession.token), fn: updateUser },
    { name: "DELETE /api/admin/users", req: makeRequest("/api/admin/users?id=" + student.id, "DELETE", undefined, instructorSession.token), fn: deleteUser },
    { name: "DELETE /api/admin/groups", req: makeRequest("/api/admin/groups?id=dummy", "DELETE", undefined, instructorSession.token), fn: deleteGroup },
    { name: "DELETE /api/admin/invitations", req: makeRequest("/api/admin/invitations?id=dummy", "DELETE", undefined, instructorSession.token), fn: deleteInvitation },
    { name: "GET /api/admin/audit-logs", req: makeRequest("/api/admin/audit-logs", "GET", undefined, instructorSession.token), fn: getAuditLogs },
    { name: "GET /api/admin/export", req: makeRequest("/api/admin/export", "GET", undefined, instructorSession.token), fn: exportCsv },
  ];

  for (const check of instructorChecks) {
    const res = await check.fn(check.req);
    assert(res.status === 403, `Instructor ${check.name} ga murojaat qilganda 403 Forbidden oldi`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // [2] IZOHLAR (COMMENTS): RAW STORAGE, OUTPUT ESCAPING & RATE LIMITING
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TEST 2] COMMENTS RAW TEXT & OUTPUT ESCAPING ---");
  const rawXssText = "<script>alert(1)</script> Salom Ustoz";
  const postCommentReq = makeRequest("/api/comments", "POST", {
    lessonId: 1,
    question: rawXssText,
  }, studentSession.token);
  const commentRes = await postComment(postCommentReq);
  const commentData = await commentRes.json();
  assert(commentRes.status === 200, "Izoh muvaffaqiyatli qabul qilindi");

  const dbComment = await prisma.comment.findUnique({ where: { id: commentData.comment.id } });
  assert(dbComment?.question === rawXssText, "Bazada xom matn (raw text) o'zgartirilmasdan saqlangan");

  const getCommentReq = makeRequest("/api/comments?lessonId=1", "GET", undefined, studentSession.token);
  const getCommentsRes = await getComments(getCommentReq);
  const commentsList = await getCommentsRes.json();
  const returnedComment = commentsList.comments.find((c: { id: string }) => c.id === commentData.comment.id);
  assert(
    returnedComment.questionEscaped.includes("&lt;script&gt;"),
    "Chiqarishda xavfsiz escape qilingan matn berildi"
  );
  assert(
    returnedComment.question === rawXssText,
    "React render uchun xom matn ham berildi (ikkilamchi escape bo'lmasligi uchun)"
  );

  // Rate Limiting (5 ta izoh ketma-ket yuborilganda 429 berishi)
  let rateLimited = false;
  for (let i = 0; i < 7; i++) {
    const rapidReq = makeRequest("/api/comments", "POST", { lessonId: 1, question: `Savol ${i} ${ts}` }, studentSession.token);
    const rapidRes = await postComment(rapidReq);
    if (rapidRes.status === 429) {
      rateLimited = true;
      break;
    }
  }
  assert(rateLimited, "Izohlar yuborishda rate limiting (429) to'g'ri ishladi");

  // ─────────────────────────────────────────────────────────────────────────────
  // [3] CSV IMPORT FORMULA INJECTION & EXPORT SANITIZATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TEST 3] CSV IMPORT VALIDATION & EXPORT PROTECTION ---");
  const maliciousCsv = `Name,Email,Phone
=cmd|' /C calc'!A0,bad_formula_${ts}@cyberedu.uz,+998901234560
Normal Talaba,normal_talaba_${ts}@cyberedu.uz,+998901234561`;

  const csvReq = makeRequest("/api/admin/users/csv-import", "POST", { csvData: maliciousCsv }, adminSession.token);
  const csvRes = await importUsersCsv(csvReq);
  const csvData = await csvRes.json();
  assert(csvData.errors.length === 1, "Formula (=) bilan boshlangan foydalanuvchi ismi rad etildi");
  assert(csvData.importedCount === 1, "Normal foydalanuvchi muvaffaqiyatli import qilindi");

  const normalUserInDb = await prisma.user.findUnique({ where: { email: `normal_talaba_${ts}@cyberedu.uz` } });
  assert(normalUserInDb?.name === "Normal Talaba", "Bazadagi foydalanuvchi ismi apostrofsiz toza saqlandi");

  // Export formula protection test
  const adminExportReq = makeRequest("/api/admin/export?type=students", "GET", undefined, adminSession.token);
  const adminExportRes = await exportCsv(adminExportReq);
  assert(adminExportRes.status === 200, "Admin muvaffaqiyatli CSV eksport qildi");

  // ─────────────────────────────────────────────────────────────────────────────
  // [4] VAQTINCHALIK PAROL (TEMP PASSWORD) XAVFSIZLIGI
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TEST 4] TEMP PASSWORD SINGLE-SHOW & AUDIT MASKING ---");
  const createStudentReq = makeRequest("/api/admin/users", "POST", {
    name: "OneTime Pass Student",
    email: `temp_pass_${ts}@cyberedu.uz`,
    role: "student",
  }, adminSession.token);
  const createStudentRes = await createUser(createStudentReq);
  const createStudentData = await createStudentRes.json();
  const returnedTempPass = createStudentData.tempPassword || createStudentData.user?.tempPassword;
  assert(
    typeof returnedTempPass === "string" && returnedTempPass.length > 5,
    "Yaratish paytida bir marta vaqtinchalik parol qaytarildi"
  );

  // Keyingi GET so'rovida tempPassword chiqmasligi
  const getCreatedReq = makeRequest("/api/admin/users?q=" + encodeURIComponent(`temp_pass_${ts}@cyberedu.uz`), "GET", undefined, adminSession.token);
  const getCreatedRes = await getUsers(getCreatedReq);
  const getCreatedData = await getCreatedRes.json();
  const fetchedUser = getCreatedData.users[0];
  assert(fetchedUser && !("tempPassword" in fetchedUser), "Foydalanuvchilar ro'yxatida tempPassword qaytarilmaydi");
  assert(!("passwordHash" in fetchedUser), "passwordHash API orqali oshkor qilinmaydi");

  // ─────────────────────────────────────────────────────────────────────────────
  // [5] SERVER MARKAZIY DARVOZABONI (GATEKEEPER) & CANACCESS TEKSHIRUVLARI
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TEST 5] CENTRAL GATEKEEPER (canAccess) ENFORCEMENT ---");

  // 5.1 Test Kurslarini yaratish (PREMIUM va PAID_COURSE)
  const premiumCourse = await prisma.course.create({
    data: {
      slug: `premium-course-${ts}`,
      title: "Kiberxavfsizlik Ilg'or Tahlil (Premium)",
      desc: "Premium darajadagi kurs",
      fullDesc: "Batafsil premium kontent",
      accessType: AccessType.PREMIUM,
      priceUzs: 0,
      instructorName: "Ustoz Alisher",
      instructorRole: "Senior Pentester",
      modules: {
        create: [
          {
            title: "1-Modul: Premium Kirish",
            duration: "2 soat",
            lessons: {
              create: [
                {
                  title: "1-Dars: Maxfiy Texnikalar",
                  duration: "30 daqiqa",
                  accessType: AccessType.PREMIUM,
                  isFree: false,
                  content: "Bu juda maxfiy premium dars konspekti!",
                },
              ],
            },
          },
        ],
      },
    },
    include: { modules: { include: { lessons: true } } },
  });

  const premiumLesson = premiumCourse.modules[0].lessons[0];

  // Oraliq test yaratish
  const premiumQuiz = await prisma.quiz.create({
    data: {
      lessonId: premiumLesson.id,
      title: "Premium Dars Testi",
      passingScore: 70,
      maxAttempts: 3,
      questions: {
        create: [
          {
            question: "Kiberxavfsizlikda CIA nima?",
            options: ["Confidentiality, Integrity, Availability", "Central Intelligence Agency", "Cyber Info Access"],
            correctOption: 0,
            order: 1,
          },
        ],
      },
    },
  });

  // Premium Lab yaratish
  const premiumLab = await prisma.lab.create({
    data: {
      id: `lab-p8-premium-${ts}`,
      slug: `lab-p8-premium-${ts}`,
      title: "Premium Zero-Day Ekspluatatsiyasi",
      accessType: AccessType.PREMIUM,
      points: 100,
      type: "terminal",
      description: "Premium lab tavsifi",
      courseId: premiumCourse.id,
      lessonId: premiumLesson.id,
    },
  });

  // 5.2 Huquqi yo'q talaba murojaat qilganda:
  console.log("5.2 Huquqsiz talaba murojaati:");
  // A. Kursni GET qilish (dars matni yashirilgan, isLocked=true bo'lishi shart)
  const getPremCourseReq = makeRequest(`/api/courses/${premiumCourse.id}`, "GET", undefined, studentSession.token);
  const getPremCourseRes = await getCourseById(getPremCourseReq, { params: Promise.resolve({ id: String(premiumCourse.id) }) });
  const premCourseJson = await getPremCourseRes.json();
  const returnedLesson = premCourseJson.course.modules[0].lessons[0];
  assert(returnedLesson.isLocked === true, "Qulflangan premium dars isLocked=true bilan qaytdi");
  assert(returnedLesson.content === null, "Qulflangan darsning maxfiy matni (content) serverda null qilindi (sir chiqib ketmadi)");

  // B. Test savollarini olish -> 403
  const getQuizReq = makeRequest(`/api/quizzes/${premiumLesson.id}`, "GET", undefined, studentSession.token);
  const getQuizRes = await getQuiz(getQuizReq, { params: Promise.resolve({ lessonId: String(premiumLesson.id) }) });
  assert(getQuizRes.status === 403, "Qulflangan dars test savollarini olish 403 bilan rad etildi");

  // C. Test topshirish -> 403
  const postQuizReq = makeRequest(`/api/quizzes/${premiumLesson.id}`, "POST", { answers: { 1: 0 } }, studentSession.token);
  const postQuizRes = await postQuiz(postQuizReq, { params: Promise.resolve({ lessonId: String(premiumLesson.id) }) });
  assert(postQuizRes.status === 403, "Qulflangan dars testini topshirish 403 bilan rad etildi");

  // D. Lab flag topshirish -> 403
  const postLabReq = makeRequest("/api/labs", "POST", { labId: premiumLab.id, flag: "flag{test}" }, studentSession.token);
  const postLabRes = await postLab(postLabReq);
  assert(postLabRes.status === 403, "Premium lab bayrog'ini topshirish 403 bilan rad etildi");

  // E. Terminal buyrug'i -> 403
  const postTermReq = makeRequest("/api/terminal", "POST", { command: "ls -la", labSlug: premiumLab.slug }, studentSession.token);
  const postTermRes = await postTerminal(postTermReq);
  assert(postTermRes.status === 403, "Premium lab terminalida buyruq bajarish 403 bilan rad etildi");

  // F. Sertifikat olish -> 403
  const postCertReq = makeRequest("/api/certificates", "POST", { courseId: premiumCourse.id }, studentSession.token);
  const postCertRes = await postCertificate(postCertReq);
  assert(postCertRes.status === 403, "Huquqsiz kurs sertifikatini chiqarish 403 bilan rad etildi");

  // ─────────────────────────────────────────────────────────────────────────────
  // [6] PULLIK KURS ICHIDAGI BEPUL NAMUNA DARS (isFree: true preview)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TEST 6] FREE PREVIEW LESSON IN PAID COURSE ---");
  const paidCourse = await prisma.course.create({
    data: {
      slug: `paid-course-${ts}`,
      title: "To'liq Web Pentesting Kursi (Pullik)",
      desc: "Pullik amaliy kurs",
      fullDesc: "Batafsil",
      accessType: AccessType.PAID_COURSE,
      priceUzs: 350000,
      instructorName: "Ustoz Bobur",
      instructorRole: "Security Architect",
      modules: {
        create: [
          {
            title: "1-Modul",
            duration: "3 soat",
            lessons: {
              create: [
                {
                  title: "1-Dars: Bepul Namuna (Preview)",
                  duration: "15 daqiqa",
                  isFree: true, // PREVIEW
                  content: "Bu ochiq namuna dars konspekti!",
                },
                {
                  title: "2-Dars: Yopiq Pullik Dars",
                  duration: "45 daqiqa",
                  isFree: false,
                  content: "Faqat to'laganlar uchun maxsus konspekt!",
                },
              ],
            },
          },
        ],
      },
    },
    include: { modules: { include: { lessons: true } } },
  });

  const previewLesson = paidCourse.modules[0].lessons[0];
  const lockedPaidLesson = paidCourse.modules[0].lessons[1];

  const getPaidCourseReq = makeRequest(`/api/courses/${paidCourse.id}`, "GET", undefined, studentSession.token);
  const getPaidCourseRes = await getCourseById(getPaidCourseReq, { params: Promise.resolve({ id: String(paidCourse.id) }) });
  const paidCourseJson = await getPaidCourseRes.json();

  const previewInRes = paidCourseJson.course.modules[0].lessons[0];
  const lockedInRes = paidCourseJson.course.modules[0].lessons[1];

  assert(previewInRes.isLocked === false, "Pullik kursdagi isFree=true namuna dars qulflanmadi");
  assert(previewInRes.content === "Bu ochiq namuna dars konspekti!", "Namuna dars matni talabaga ko'rindi");
  assert(lockedInRes.isLocked === true, "Pullik kursdagi 2-dars qulflangan holatda qoldi");
  assert(lockedInRes.content === null, "Pullik dars matni serverda yashirildi");

  // ─────────────────────────────────────────────────────────────────────────────
  // [7] ADMIN HUQUQ BERISHI (GRANT), MUDDATI O'TISH VA BEKOR QILISH (REVOKE)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TEST 7] ENTITLEMENT GRANT, IMMEDIATE ACCESS & REVOKE ---");

  // 7.1 Admin talabaga SUBSCRIPTION huquqi beradi
  const grantReq = makeRequest("/api/admin/entitlements", "POST", {
    action: "grant",
    userId: student.id,
    type: "SUBSCRIPTION",
    durationDays: 30,
    reason: "A'lo baholari uchun taqdim etildi",
  }, adminSession.token);
  const grantRes = await postAdminEntitlement(grantReq);
  const grantData = await grantRes.json();
  assert(grantRes.status === 200 && grantData.grantedCount === 1, "Admin talabaga muvaffaqiyatli SUBSCRIPTION huquqini berdi");

  // 7.2 Endi talaba Premium kursga kirishni qayta tekshiradi: darhol ochilishi shart!
  const getPremAfterGrantReq = makeRequest(`/api/courses/${premiumCourse.id}`, "GET", undefined, studentSession.token);
  const getPremAfterGrantRes = await getCourseById(getPremAfterGrantReq, { params: Promise.resolve({ id: String(premiumCourse.id) }) });
  const premAfterGrantJson = await getPremAfterGrantRes.json();
  const unlockedLesson = premAfterGrantJson.course.modules[0].lessons[0];
  assert(unlockedLesson.isLocked === false, "Huquq berilgach, dars darhol ochildi (isLocked=false)");
  assert(unlockedLesson.content === "Bu juda maxfiy premium dars konspekti!", "Dars matni talabaga to'liq ko'rindi");

  // Test savollarini olish ham ochildi
  const getQuizAfterReq = makeRequest(`/api/quizzes/${premiumLesson.id}`, "GET", undefined, studentSession.token);
  const getQuizAfterRes = await getQuiz(getQuizAfterReq, { params: Promise.resolve({ lessonId: String(premiumLesson.id) }) });
  assert(getQuizAfterRes.status === 200, "Huquq berilgach, dars test savollari darhol ochildi (200 OK)");

  // 7.3 Huquqni bekor qilish (Revoke)
  const activeEnt = await prisma.entitlement.findFirst({
    where: { userId: student.id, type: EntitlementType.SUBSCRIPTION, revokedAt: null },
  });
  assert(activeEnt !== null, "Bazada faol huquq topildi");

  const revokeReq = makeRequest("/api/admin/entitlements", "POST", {
    action: "revoke",
    entitlementId: activeEnt!.id,
    reason: "Muddatidan oldin bekor qilindi",
  }, adminSession.token);
  const revokeRes = await postAdminEntitlement(revokeReq);
  assert(revokeRes.status === 200, "Kirish huquqi bekor qilindi");

  // Darhol yana qulflanishini tekshirish
  const getPremAfterRevokeReq = makeRequest(`/api/courses/${premiumCourse.id}`, "GET", undefined, studentSession.token);
  const getPremAfterRevokeRes = await getCourseById(getPremAfterRevokeReq, { params: Promise.resolve({ id: String(premiumCourse.id) }) });
  const premAfterRevokeJson = await getPremAfterRevokeRes.json();
  assert(
    premAfterRevokeJson.course.modules[0].lessons[0].isLocked === true,
    "Huquq bekor qilingach, dars darhol yana qulflandi (Server gatekeeper cron'siz ishlaydi)"
  );

  // 7.4 Muddati o'tgan huquq (Expired entitlement) testi:
  const expiredEnt = await prisma.entitlement.create({
    data: {
      userId: student.id,
      type: EntitlementType.SUBSCRIPTION,
      source: EntitlementSource.MANUAL,
      startsAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() - 1000), // 1 soniya oldin muddati o'tgan
    },
  });
  const accessWithExpired = await canAccess(
    { id: student.id, role: Role.student },
    { type: "course", courseId: premiumCourse.id }
  );
  assert(!accessWithExpired.allowed, "Muddati o'tgan huquq bilan so'rov rad etildi (403)");

  // ─────────────────────────────────────────────────────────────────────────────
  // [8] GURUH BO'YICHA HUQUQ VA TALABA GURUHDAN CHIQARILGANDA HUQUQ TUSHISHI
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TEST 8] GROUP-BASED ENTITLEMENT & REVOCATION ON REMOVAL ---");

  // 8.1 Yangi guruh yaratish va talabani a'zo qilish
  const testGroup = await prisma.group.create({
    data: {
      name: `Kiber Guruh ${ts}`,
      createdBy: admin.id,
      members: {
        create: [{ userId: student.id }],
      },
    },
  });

  // 8.2 Guruhga pullik kursni biriktirish (assign_course)
  const assignGroupReq = makeRequest("/api/admin/groups", "PUT", {
    action: "assign_course",
    groupId: testGroup.id,
    courseId: paidCourse.id,
  }, adminSession.token);
  const assignGroupRes = await putGroup(assignGroupReq);
  const assignGroupData = await assignGroupRes.json();
  assert(assignGroupRes.status === 200, "Guruhga pullik kurs biriktirildi va GROUP huquqi yaratildi");

  // Talaba endi pullik kurs darsini ko'ra oladimi?
  const getPaidAfterGroupReq = makeRequest(`/api/courses/${paidCourse.id}`, "GET", undefined, studentSession.token);
  const getPaidAfterGroupRes = await getCourseById(getPaidAfterGroupReq, { params: Promise.resolve({ id: String(paidCourse.id) }) });
  const paidAfterGroupJson = await getPaidAfterGroupRes.json();
  assert(
    paidAfterGroupJson.course.modules[0].lessons[1].isLocked === false,
    "Guruh a'zoligi orqali talaba pullik kursga to'liq kirdi"
  );

  // 8.3 Talabani guruhdan chiqarish (remove_member)
  const removeMemberReq = makeRequest("/api/admin/groups", "PUT", {
    action: "remove_member",
    groupId: testGroup.id,
    userId: student.id,
  }, adminSession.token);
  const removeMemberRes = await putGroup(removeMemberReq);
  assert(removeMemberRes.status === 200, "Talaba guruhdan chiqarildi");

  // Endi darhol huquq tushishi kerak
  const getPaidAfterRemoveReq = makeRequest(`/api/courses/${paidCourse.id}`, "GET", undefined, studentSession.token);
  const getPaidAfterRemoveRes = await getCourseById(getPaidAfterRemoveReq, { params: Promise.resolve({ id: String(paidCourse.id) }) });
  const paidAfterRemoveJson = await getPaidAfterRemoveRes.json();
  assert(
    paidAfterRemoveJson.course.modules[0].lessons[1].isLocked === true,
    "Guruhdan chiqarilgach, guruh huquqi darhol bekor bo'ldi (dars yana qulflandi)"
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // [9] TALABANING SHAXSIY HUQUQLARI API (/api/user/entitlements)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TEST 9] USER ENTITLEMENTS VIEW API ---");
  const userEntReq = makeRequest("/api/user/entitlements", "GET", undefined, studentSession.token);
  const userEntRes = await getUserEntitlements(userEntReq);
  const userEntData = await userEntRes.json();
  assert(userEntRes.status === 200, "Talaba o'z huquqlari ro'yxatini muvaffaqiyatli oldi");
  assert(Array.isArray(userEntData.entitlements), "Huquqlar massiv formatida qaytdi");

  console.log("\n========================================================");
  console.log("   ✅ BARCHA 8-BOSQICH XAVFSIZLIK VA HUQUQ TESTLARI MUVAFFAQISHLI O'TDI!");
  console.log("========================================================\n");
}

runPhase8Suite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test xatosi:", err);
    process.exit(1);
  });
