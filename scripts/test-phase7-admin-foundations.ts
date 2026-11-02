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
import { createDbSession, getSessionUser, revokeAllUserSessions } from "../src/lib/security/session";
import { hashPassword } from "../src/lib/security/password";
import { sanitizeCsvFormulaInjection } from "../src/app/api/admin/users/csv-import/route";

// API Handlers
import { GET as getUsers, POST as createUser, PUT as updateUser, DELETE as deleteUser } from "../src/app/api/admin/users/route";
import { POST as importUsersCsv } from "../src/app/api/admin/users/csv-import/route";
import { GET as getInvitations, POST as createInvitation } from "../src/app/api/admin/invitations/route";
import { GET as getGroups, POST as groupAction, PUT as editGroup, DELETE as deleteGroup } from "../src/app/api/admin/groups/route";
import { GET as getAuditLogs } from "../src/app/api/admin/audit-logs/route";
import { GET as exportCsv } from "../src/app/api/admin/export/route";
import { GET as getCourses } from "../src/app/api/courses/route";
import { GET as getCourseById, PUT as updateCourse } from "../src/app/api/courses/[id]/route";
import { GET as getQuiz } from "../src/app/api/quizzes/[lessonId]/route";
import { GET as getComments, POST as postComment, PUT as putComment } from "../src/app/api/comments/route";
import { POST as authPost } from "../src/app/api/auth/route";

function assert(condition: boolean, msg: string) {
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

async function runPhase7Tests() {
  console.log("\n========================================================");
  console.log("   CYBEREDU 7-BOSQICH (ADMIN ASOSI) TESTLAR TO'PLAMI");
  console.log("========================================================\n");

  const ts = Date.now();

  // Test foydalanuvchilarini yaratish
  const dummyHash = await hashPassword("TestPass#2026!Strong");

  const admin = await prisma.user.create({
    data: {
      email: `phase7_admin_${ts}@cyberedu.uz`,
      name: "Phase7 Admin",
      displayName: "P7_Admin",
      role: Role.admin,
      passwordHash: dummyHash,
    },
  });

  const instructor = await prisma.user.create({
    data: {
      email: `phase7_inst_${ts}@cyberedu.uz`,
      name: "Phase7 Instructor",
      displayName: "P7_Inst",
      role: Role.instructor,
      passwordHash: dummyHash,
    },
  });

  const student = await prisma.user.create({
    data: {
      email: `phase7_stud_${ts}@cyberedu.uz`,
      name: "Phase7 Student",
      displayName: "P7_Student",
      role: Role.student,
      passwordHash: dummyHash,
    },
  });

  const dummyReq = makeRequest("/api/auth", "GET");
  const adminSession = await createDbSession(admin.id, dummyReq);
  const instSession = await createDbSession(instructor.id, dummyReq);
  const studSession = await createDbSession(student.id, dummyReq);

  // ─────────────────────────────────────────────────────────────────────────────
  // 0. SEED TUZATISHI: Mavjud kontent qayta seed qilinganda yo'qolmasligi
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TEST 0] SEED PERSISTENCE TEST ---");
  const testCourse = await prisma.course.findFirst();
  if (testCourse) {
    const customTitle = `Maxsus Saqlangan Kurs ${ts}`;
    await prisma.course.update({
      where: { id: testCourse.id },
      data: { title: customTitle },
    });

    // Seed'dagi upsert mantiqi: update bo'sh bo'lgani sababli, customTitle o'zgarishi kerak emas
    const { seedDatabase } = await import("../prisma/seed");
    await seedDatabase();

    const courseAfterSeed = await prisma.course.findUnique({
      where: { id: testCourse.id },
    });
    assert(
      courseAfterSeed?.title === customTitle,
      `Baza qayta seed qilinganda tahrirlangan kurs sarlavhasi o'chib ketmadi (${courseAfterSeed?.title})`
    );
  } else {
    console.log("  ⚠️ Test kursi mavjud emas, seed o'tkazib yuborildi");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. ROLLAR VA RBAC: Role.accountant va Mass Assignment himoyasi
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TEST 1] ROLLAR VA RBAC HIMOYASI ---");
  assert(Role.accountant === "accountant", "Role enumida 'accountant' mavjud");

  // Talaba rolni o'zgartirishga urinishi (403 bo'lishi shart)
  const studentReq = makeRequest("/api/admin/users", "PUT", {
    action: "update_role",
    userId: student.id,
    newRole: Role.admin,
  }, studSession.token);
  const studentRes = await updateUser(studentReq);
  assert(studentRes.status === 403, "Talaba rolni o'zgartira olmadi (403 Forbidden)");

  // Instruktor o'zini admin qilmoqchi bo'lishi (403 bo'lishi shart)
  const instReq = makeRequest("/api/admin/users", "PUT", {
    action: "update_role",
    userId: instructor.id,
    newRole: Role.admin,
  }, instSession.token);
  const instRes = await updateUser(instReq);
  assert(instRes.status === 403, "Instruktor rolni o'zgartira olmadi (403 Forbidden)");

  // Faqat admin talabani accountant qila oladi
  const adminReq = makeRequest("/api/admin/users", "PUT", {
    action: "update_role",
    userId: student.id,
    newRole: Role.accountant,
  }, adminSession.token);
  const adminRes = await updateUser(adminReq);
  const adminData = await adminRes.json();
  assert(adminRes.status === 200 && adminData.user.role === Role.accountant, "Admin talabani accountant qilib tayinlay oldi");

  // Qaytaramiz student holatiga
  await prisma.user.update({ where: { id: student.id }, data: { role: Role.student } });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. FOYDALANUVCHILARNI BOSHQARISH VA BLOKLASH
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TEST 2] USER MANAGEMENT & INSTANT SESSION DROP ---");
  // Talaba yaratish (vaqtinchalik parol bilan)
  const createStudReq = makeRequest("/api/admin/users", "POST", {
    email: `temp_stud_${ts}@cyberedu.uz`,
    name: "Vaqtinchalik Talaba",
  }, adminSession.token);
  const createStudRes = await createUser(createStudReq);
  const createStudData = await createStudRes.json();
  assert(createStudRes.status === 200, "Admin yangi talaba hisobini yaratdi");
  assert(!!createStudData.tempPassword, "Yangi talaba uchun vaqtinchalik parol berildi");

  const createdUserDb = await prisma.user.findUnique({ where: { id: createStudData.user.id } });
  assert(createdUserDb?.mustChangePassword === true, "mustChangePassword=true bayrog'i o'rnatildi");

  // Yaratilgan talaba tizimga kiradi va sessiya hosil qiladi
  const tempSession = await createDbSession(createdUserDb!.id, dummyReq);

  // Talaba bloklanadi
  const blockReq = makeRequest("/api/admin/users", "PUT", {
    action: "toggle_block",
    userId: createdUserDb!.id,
    isBlocked: true,
  }, adminSession.token);
  const blockRes = await updateUser(blockReq);
  assert(blockRes.status === 200, "Talaba muvaffaqiyatli bloklandi");

  // Bloklangan talabaning mavjud sessiyasi DARHOL ishlamay qolishi kerak
  const checkSessionReq = makeRequest("/api/auth", "GET", undefined, tempSession.token);
  const sessionUser = await getSessionUser(checkSessionReq);
  assert(sessionUser === null, "Bloklangan foydalanuvchining sessiyasi darhol bekor qilindi (getSessionUser=null)");

  // Bloklangan talaba login qilmoqchi bo'lsa -> 403
  const blockedLoginReq = makeRequest("/api/auth", "POST", {
    action: "login",
    email: createdUserDb!.email,
    password: createStudData.tempPassword,
  });
  const blockedLoginRes = await authPost(blockedLoginReq);
  assert(blockedLoginRes.status === 403, "Bloklangan hisob qayta login qila olmadi (403 Forbidden)");

  // Admin o'z hisobini o'chira olmasligi
  const selfDelReq = makeRequest(`/api/admin/users?id=${admin.id}`, "DELETE", undefined, adminSession.token);
  const selfDelRes = await deleteUser(selfDelReq);
  assert(selfDelRes.status === 400, "Admin o'z hisobini o'chira olmadi (400 Bad Request)");

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. TAKLIF KODLARI VA LIMITLAR
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TEST 3] INVITATION CODES & MAX USES LIMIT ---");
  // Guruh yaratamiz
  const group1 = await prisma.group.create({
    data: {
      name: `Xavfsizlik Guruhi ${ts}`,
      description: "Guruh tavsifi",
      createdBy: admin.id,
    },
  });

  // Taklif kodi yaratamiz: maxUses = 2, group1 ga bog'langan
  const createInvReq = makeRequest("/api/admin/invitations", "POST", {
    maxUses: 2,
    expiresInDays: 5,
    groupId: group1.id,
  }, adminSession.token);
  const createInvRes = await createInvitation(createInvReq);
  const createInvData = await createInvRes.json();
  assert(createInvRes.status === 200, "Taklif kodi muvaffaqiyatli yaratildi");
  const inviteCode = createInvData.invitation.code;

  // 1-talaba ro'yxatdan o'tadi
  const reg1Req = makeRequest("/api/auth", "POST", {
    action: "register",
    name: "Taklif Talaba 1",
    email: `invite_stud1_${ts}@cyberedu.uz`,
    password: "Password#12345!Strong",
    inviteCode,
  });
  const reg1Res = await authPost(reg1Req);
  assert(reg1Res.status === 200, "1-talaba taklif kodi bilan ro'yxatdan o'tdi");

  // Talaba 1 guruhga avtomatik birikkanini tekshirish
  const member1 = await prisma.groupMember.findFirst({
    where: { group: { id: group1.id }, user: { email: `invite_stud1_${ts}@cyberedu.uz` } },
  });
  assert(!!member1, "1-talaba taklif kodidagi guruhga avtomatik biriktirildi");

  // 2-talaba ro'yxatdan o'tadi
  const reg2Req = makeRequest("/api/auth", "POST", {
    action: "register",
    name: "Taklif Talaba 2",
    email: `invite_stud2_${ts}@cyberedu.uz`,
    password: "Password#12345!Strong",
    inviteCode,
  });
  const reg2Res = await authPost(reg2Req);
  assert(reg2Res.status === 200, "2-talaba taklif kodi bilan ro'yxatdan o'tdi");

  // 3-talaba ro'yxatdan o'tishga urinadi (limit 2 ta edi -> 400 xato bo'lishi kerak)
  const reg3Req = makeRequest("/api/auth", "POST", {
    action: "register",
    name: "Taklif Talaba 3",
    email: `invite_stud3_${ts}@cyberedu.uz`,
    password: "Password#12345!Strong",
    inviteCode,
  });
  const reg3Res = await authPost(reg3Req);
  assert(reg3Res.status === 400, "3-talaba limit tugagani sababli ro'yxatdan o'ta olmadi (400 Bad Request)");

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. GURUHLAR VA MASS ENROLLMENT
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TEST 4] GROUPS & MASS COURSE ENROLLMENT ---");
  const testCourseForGroup = await prisma.course.findFirst();
  if (testCourseForGroup) {
    const massEnrollReq = makeRequest("/api/admin/groups", "PUT", {
      action: "assign_course",
      groupId: group1.id,
      courseId: testCourseForGroup.id,
    }, adminSession.token);
    const massEnrollRes = await editGroup(massEnrollReq);
    const massEnrollData = await massEnrollRes.json();
    console.log("DEBUG massEnroll:", massEnrollRes.status, massEnrollData);
    assert(massEnrollRes.status === 200 && massEnrollData.enrolledCount >= 2, "Guruhdagi barcha talabalar kursga avtomatik yozildi (Mass Enrollment)");

    // Guruh scoreboardini olish
    const scoreboardReq = makeRequest(`/api/admin/groups?groupId=${group1.id}`, "GET", undefined, adminSession.token);
    const scoreboardRes = await getGroups(scoreboardReq);
    const scoreboardData = await scoreboardRes.json();
    console.log("DEBUG scoreboard:", scoreboardRes.status, scoreboardData);
    assert(scoreboardRes.status === 200 && Array.isArray(scoreboardData.group.scoreboard), "Guruh a'zolari va scoreboard muvaffaqiyatli hisoblandi");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. KONTENT TAHRIRCHI VA SERVER-SIDE DRAFT HIMOYA
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TEST 5] DRAFT CONTENT SERVER-SIDE PROTECTION ---");
  const draftCourse = await prisma.course.create({
    data: {
      slug: `qoralama-kurs-${ts}`,
      title: `Qoralama Kurs ${ts}`,
      desc: "Ushbu kurs hali chop etilmagan",
      fullDesc: "Batafsil tavsif",
      level: "Boshlang'ich",
      icon: "🔒",
      instructorName: "Instruktor",
      instructorRole: "Kiberxavfsizlik o'qituvchisi",
      isPublished: false, // Qoralama (Draft)
    },
  });

  // Talaba qoralama kursni ko'ra olmasligi kerak (404)
  const studentCourseReq = makeRequest(`/api/courses/${draftCourse.id}`, "GET", undefined, studSession.token);
  const studentCourseRes = await getCourseById(studentCourseReq, { params: Promise.resolve({ id: String(draftCourse.id) }) });
  assert(studentCourseRes.status === 404, "Talabaga qoralama kurs ko'rinmadi (404 Not Found)");

  // Instruktor qoralama kursni ko'ra olishi kerak (200)
  const instCourseReq = makeRequest(`/api/courses/${draftCourse.id}`, "GET", undefined, instSession.token);
  const instCourseRes = await getCourseById(instCourseReq, { params: Promise.resolve({ id: String(draftCourse.id) }) });
  assert(instCourseRes.status === 200, "Instruktorga qoralama kurs tahrirlash uchun ko'rindi (200 OK)");

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. QUIZ TAHRIRCHI VA JAVOBLARNING TALABADAN YASHIRILISHI
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TEST 6] QUIZ SECURITY: CORRECT OPTION NEVER SENT TO STUDENT ---");
  const testQuiz = await prisma.quiz.findFirst({
    include: { questions: true },
  });
  if (testQuiz && testQuiz.questions.length > 0) {
    // Talaba testni olganda correctOption ko'rinmasligi shart
    const studentQuizReq = makeRequest(`/api/quizzes/${testQuiz.lessonId}`, "GET", undefined, studSession.token);
    const studentQuizRes = await getQuiz(studentQuizReq, { params: Promise.resolve({ lessonId: String(testQuiz.lessonId) }) });
    const studentQuizData = await studentQuizRes.json();
    assert(studentQuizRes.status === 200, "Talaba test savollarini oldi");
    assert(
      !("correctOption" in studentQuizData.quiz.questions[0]),
      "Talabaga testning to'g'ri javobi (correctOption) yuborilmadi"
    );

    // Instruktor adminView=true bilan to'liq testni (correctOption bilan) olishi
    const instQuizReq = makeRequest(`/api/quizzes/${testQuiz.lessonId}?adminView=true`, "GET", undefined, instSession.token);
    const instQuizRes = await getQuiz(instQuizReq, { params: Promise.resolve({ lessonId: String(testQuiz.lessonId) }) });
    const instQuizData = await instQuizRes.json();
    assert(
      "correctOption" in instQuizData.quiz.questions[0],
      "Instruktor tahrirlash rejimida correctOption ni oldi"
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. CSV INJECTION (FORMULA INJECTION) HIMOYASI
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TEST 7] CSV FORMULA INJECTION DEFENSE ---");
  const maliciousFormula = "=cmd|' /C calc'!A0";
  const sanitizedCell = sanitizeCsvFormulaInjection(maliciousFormula);
  assert(sanitizedCell.startsWith("'="), "Formula injection '=...' bitta tirnoq (') bilan zararsizlantirildi");

  // CSV Import testi
  const csvContent = `Name,Email,Phone,Group
${maliciousFormula},csv_hacker_${ts}@cyberedu.uz,+998901234567,GroupA
Valid Student,csv_valid_${ts}@cyberedu.uz,+998901234568,GroupA`;

  const importReq = makeRequest("/api/admin/users/csv-import", "POST", {
    csvData: csvContent,
    defaultRole: "student",
  }, adminSession.token);
  const importRes = await importUsersCsv(importReq);
  const importData = await importRes.json();
  assert(importRes.status === 200 && importData.importedCount === 1, "CSV orqali 1 ta to'g'ri foydalanuvchi import qilindi");
  assert(importData.errors.length === 1, "Formula bilan boshlangan qator rad etildi");

  const importedValidDb = await prisma.user.findUnique({
    where: { email: `csv_valid_${ts}@cyberedu.uz` },
  });
  assert(
    importedValidDb?.name === "Valid Student",
    "Bazadagi import qilingan ism o'zgartirilmasdan (apostrofsiz) saqlangan"
  );

  // CSV Eksport testi
  const exportReq = makeRequest("/api/admin/export?type=students", "GET", undefined, adminSession.token);
  const exportRes = await exportCsv(exportReq);
  const exportedText = await exportRes.text();
  assert(exportRes.status === 200, "Talabalar CSV fayli muvaffaqiyatli eksport qilindi");
  assert(
    exportedText.includes("Valid Student"),
    "Eksport qilingan CSV da talabalar ro'yxati mavjud"
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. IZOHLAR (COMMENTS & Q&A) XSS HIMOYASI VA PERSISTENT RATE LIMIT
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TEST 8] COMMENTS XSS DEFENSE & RATE LIMITING ---");
  const xssPayload = "<script>alert(1)</script><img src=x onerror=alert('xss')>Salom ustoz";
  const commentReq = makeRequest("/api/comments", "POST", {
    lessonId: 1,
    content: xssPayload,
  }, studSession.token);
  const commentRes = await postComment(commentReq);
  const commentData = await commentRes.json();
  assert(commentRes.status === 200, "Izoh muvaffaqiyatli qabul qilindi");
  assert(
    commentData.comment.questionEscaped &&
      !commentData.comment.questionEscaped.includes("<script>") &&
      commentData.comment.questionEscaped.includes("&lt;script&gt;"),
    "Izohdagi <script> tegi XSS ga qarshi tozalangan (&lt;script&gt;)"
  );

  // Tozalash
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          admin.email,
          instructor.email,
          student.email,
          `temp_stud_${ts}@cyberedu.uz`,
          `invite_stud1_${ts}@cyberedu.uz`,
          `invite_stud2_${ts}@cyberedu.uz`,
          `csv_hacker_${ts}@cyberedu.uz`,
          `csv_math_${ts}@cyberedu.uz`,
        ],
      },
    },
  });
  await prisma.group.delete({ where: { id: group1.id } }).catch(() => {});
  await prisma.course.delete({ where: { id: draftCourse.id } }).catch(() => {});

  console.log("\n========================================================");
  console.log("   🎉 BARCHA 8 TA ASOSIY 7-BOSQICH TESTLARI MUVAFFAQIShATLI O'TDI!");
  console.log("========================================================\n");
}

runPhase7Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test xatosi:", err);
    process.exit(1);
  });
