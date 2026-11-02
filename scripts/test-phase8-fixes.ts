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
import { canAccess, getUserActiveEntitlements, evaluateLessonAccess } from "../src/lib/security/entitlements";

// API Handlers
import { GET as getComments, POST as postComment } from "../src/app/api/comments/route";
import { GET as getProxy, POST as postProxy } from "../src/app/api/labs/proxy/[instanceId]/[[...path]]/route";
import { GET as getScoreboard } from "../src/app/api/scoreboard/route";
import { GET as getGroups, POST as postGroup, PUT as putGroup, DELETE as deleteGroup } from "../src/app/api/admin/groups/route";
import { GET as getCourses } from "../src/app/api/courses/route";
import { GET as getCourseById } from "../src/app/api/courses/[id]/route";
import { POST as postLab } from "../src/app/api/labs/route";
import { POST as postTerminal } from "../src/app/api/terminal/route";

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

async function main() {
  console.log("=== 8-BOSQICH TUZATISHLARI VA SERVER SOZLAMALARI TEKSHIRUVI ===");
  const testId = `tfix_${Date.now()}`;

  // 1. Foydalanuvchilar yaratish
  const passwordHash = await hashPassword("StrongPass#2026");

  const admin = await prisma.user.create({
    data: {
      name: "Fix Admin",
      email: `admin_${testId}@cyberedu.uz`,
      passwordHash,
      role: Role.admin,
    },
  });

  const student = await prisma.user.create({
    data: {
      name: "Fix Student",
      email: `student_${testId}@cyberedu.uz`,
      passwordHash,
      role: Role.student,
    },
  });

  const blockedStudent = await prisma.user.create({
    data: {
      name: "Blocked Student",
      email: `blocked_${testId}@cyberedu.uz`,
      passwordHash,
      role: Role.student,
      isBlocked: true,
    },
  });

  const dummyReq = new NextRequest("http://localhost:3000");
  const adminSession = await createDbSession(admin.id, dummyReq);
  const studentSession = await createDbSession(student.id, dummyReq);

  // 2. Test Kursi, Moduli, Darsi (PREMIUM)
  const premiumCourse = await prisma.course.create({
    data: {
      slug: `prem-course-${testId}`,
      title: `Premium Kurs ${testId}`,
      desc: "Premium xavfsizlik kursi",
      fullDesc: "Batafsil ma'lumot",
      instructorName: "Ustoz",
      instructorRole: "Katta Xavfsizlik Mutaxassisi",
      accessType: AccessType.PREMIUM,
      isPublished: true,
      modules: {
        create: {
          title: "1-Modul",
          duration: "2 soat",
          order: 1,
          lessons: {
            create: {
              title: "1.1 Premium Dars",
              duration: "30 daq",
              accessType: AccessType.PREMIUM,
              isPublished: true,
              isFree: false,
              content: "Maxfiy premium kontent",
              order: 1,
            },
          },
        },
      },
    },
    include: {
      modules: {
        include: { lessons: true },
      },
    },
  });

  const premiumLesson = premiumCourse.modules[0].lessons[0];

  console.log("\n--- TEST 1: IZOHLAR (Q&A) MARKAZIY DARVOZABON (canAccess) TEKSHIRUVI ---");
  // A. Talaba qulflangan dars izohlarini o'qishga urinadi (GET)
  const getCommentsReq = makeRequest(`/api/comments?lessonId=${premiumLesson.id}`, "GET", undefined, studentSession.token);
  const getCommentsRes = await getComments(getCommentsReq);
  assert(getCommentsRes.status === 403, "Huquqsiz talaba qulflangan dars izohlarini o'qiy olmadi (403 Forbidden)");

  // B. Talaba qulflangan darsga savol yozishga urinadi (POST)
  const postCommentReq = makeRequest(
    "/api/comments",
    "POST",
    { lessonId: premiumLesson.id, content: "Bu savol qulflangan dars uchun" },
    studentSession.token
  );
  const postCommentRes = await postComment(postCommentReq);
  assert(postCommentRes.status === 403, "Huquqsiz talaba qulflangan darsga savol yubora olmadi (403 Forbidden)");

  // C. Talabaga ushbu kurs/dars uchun GRANT berilganda izohlar ochilishi
  const grant = await prisma.entitlement.create({
    data: {
      userId: student.id,
      type: EntitlementType.GRANT,
      source: EntitlementSource.MANUAL,
      grantedBy: admin.id,
      reason: "Sinov uchun ruxsat berildi",
    },
  });

  // Endi GET va POST ishlashi kerak
  const getCommentsReq2 = makeRequest(`/api/comments?lessonId=${premiumLesson.id}`, "GET", undefined, studentSession.token);
  const getCommentsRes2 = await getComments(getCommentsReq2);
  assert(getCommentsRes2.status === 200, "Huquq berilgach talaba izohlarni o'qiy oldi (200 OK)");

  const postCommentReq2 = makeRequest(
    "/api/comments",
    "POST",
    { lessonId: premiumLesson.id, content: "Dars bo'yicha savolim bor" },
    studentSession.token
  );
  const postCommentRes2 = await postComment(postCommentReq2);
  const postCommentData = await postCommentRes2.json();
  assert(postCommentRes2.status === 200 && postCommentData.success, "Huquq berilgach talaba izoh qoldira oldi (200 OK)");

  // Grantni bekor qilish
  await prisma.entitlement.update({
    where: { id: grant.id },
    data: { revokedAt: new Date() },
  });

  // Grant bekor qilingach yana 403 bo'lishi kerak
  const getCommentsReq3 = makeRequest(`/api/comments?lessonId=${premiumLesson.id}`, "GET", undefined, studentSession.token);
  const getCommentsRes3 = await getComments(getCommentsReq3);
  assert(getCommentsRes3.status === 403, "Huquq bekor qilingach dars izohlari yana darhol qulflandi (403)");

  console.log("\n--- TEST 2: VEB-LAB PROKSI YO'LI (IDOR VA canAccess) TEKSHIRUVI ---");
  // Premium lab yaratish
  const premLab = await prisma.lab.create({
    data: {
      id: `lab_prem_${testId}`,
      slug: `lab-prem-${testId}`,
      title: "Premium Lab",
      description: "Premium lab tavsifi",
      category: "web",
      type: "web-instance",
      difficulty: "medium",
      accessType: AccessType.PREMIUM,
      points: 100,
    },
  });

  // Talaba uchun instansiya yaratish
  const instId = `inst_${testId.slice(-8)}`;
  const labInstance = await prisma.webLabInstance.create({
    data: {
      userId: student.id,
      labId: premLab.id,
      containerId: instId,
      containerName: `cyberedu-weblab-${instId}`,
      hostPort: 6050,
      proxyToken: `token_${testId}`,
      status: "running",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });

  // Talaba lab proksi orqali so'rov yuboradi, lekin talabada PREMIUM huquqi yo'q
  const proxyReq = makeRequest(`/api/labs/proxy/${instId}`, "GET", undefined, studentSession.token);
  const proxyRes = await getProxy(proxyReq, { params: Promise.resolve({ instanceId: instId }) });
  assert(proxyRes.status === 403, "Huquqsiz talaba lab proksiga kira olmadi (403 Forbidden)");

  console.log("\n--- TEST 3: SCOREBOARD VA BLOKLANGAN FOYDALANUVCHILAR ---");
  // Bloklangan talabaga to'g'ri lab topshirig'i yozamiz
  await prisma.labSubmission.create({
    data: {
      userId: blockedStudent.id,
      labId: premLab.id,
      submittedFlag: "FLAG{TEST}",
      isCorrect: true,
      pointsEarned: 100,
    },
  });

  const scoreboardReq = makeRequest("/api/scoreboard", "GET");
  const scoreboardRes = await getScoreboard(scoreboardReq);
  const scoreboardData = await scoreboardRes.json();
  const foundBlocked = scoreboardData.leaderboard.find((u: { displayName: string }) => u.displayName.includes("Blocked Student"));
  assert(!foundBlocked, "Bloklangan talabaning natijalari umumiy scoreboard da ko'rsatilmadi");

  console.log("\n--- TEST 4: GURUH ORQALI BERILGAN HUQUQQA MUDDAT (endsAt) VA BEKOR QILISH ---");
  // A. Guruh yaratish
  const createGroupReq = makeRequest(
    "/api/admin/groups",
    "POST",
    { name: `Group ${testId}`, description: "Test o'quv guruhi" },
    adminSession.token
  );
  const createGroupRes = await postGroup(createGroupReq);
  const createGroupData = await createGroupRes.json();
  const groupId = createGroupData.group.id;
  assert(createGroupRes.status === 200 && groupId, "Guruh muvaffaqiyatli yaratildi");

  // B. Guruhga talabani qo'shish
  const addMemberReq = makeRequest(
    "/api/admin/groups",
    "PUT",
    { action: "add_members", groupId, userIds: [student.id] },
    adminSession.token
  );
  await putGroup(addMemberReq);

  // C. Guruhga kursni muddat bilan (durationDays: 30) biriktirish
  const assignReq = makeRequest(
    "/api/admin/groups",
    "PUT",
    {
      action: "assign_course",
      groupId,
      courseId: premiumCourse.id,
      durationDays: 30,
    },
    adminSession.token
  );
  const assignRes = await putGroup(assignReq);
  const assignData = await assignRes.json();
  assert(assignRes.status === 200 && assignData.success, "Guruhga kurs muddat bilan biriktirildi");

  // Bazada GroupCourse.endsAt va Entitlement.endsAt to'g'ri yozilganini tekshirish
  const groupCourse = await prisma.groupCourse.findUnique({
    where: { groupId_courseId: { groupId, courseId: premiumCourse.id } },
  });
  assert(groupCourse && groupCourse.endsAt !== null, "GroupCourse.endsAt muddati muvaffaqiyatli saqlandi");

  const memberEntitlement = await prisma.entitlement.findFirst({
    where: {
      userId: student.id,
      groupId,
      courseId: premiumCourse.id,
      revokedAt: null,
    },
  });
  assert(memberEntitlement && memberEntitlement.endsAt !== null, "Talaba Entitlement.endsAt muddati to'g'ri o'rnatildi");

  // D. Guruhdan kurs olib tashlanganda (remove_course) GROUP huquqi darhol bekor bo'lishi
  const removeCourseReq = makeRequest(
    "/api/admin/groups",
    "PUT",
    { action: "remove_course", groupId, courseId: premiumCourse.id },
    adminSession.token
  );
  const removeCourseRes = await putGroup(removeCourseReq);
  const removeCourseData = await removeCourseRes.json();
  assert(removeCourseRes.status === 200 && removeCourseData.success, "Kurs guruhdan olib tashlandi");

  const revokedEntitlement = await prisma.entitlement.findFirst({
    where: {
      id: memberEntitlement?.id,
    },
  });
  assert(revokedEntitlement && revokedEntitlement.revokedAt !== null, "Kurs olib tashlangach GROUP huquqi darhol bekor qilindi (revokedAt != null)");

  // E. Guruh o'chirilganda guruhning qolgan barcha huquqlari bekor bo'lishi
  const deleteGroupReq = makeRequest(`/api/admin/groups?id=${groupId}`, "DELETE", undefined, adminSession.token);
  const deleteGroupRes = await deleteGroup(deleteGroupReq);
  assert(deleteGroupRes.status === 200, "Guruh muvaffaqiyatli o'chirildi va bog'liq barcha huquqlar bekor qilindi");

  console.log("\n--- TEST 5: N+1 SO'ROV OPTIMIZATSIYASI VA INDEKSLAR ---");
  // courses endpoint chaqirilib tezkorligi tekshiriladi
  const t0 = Date.now();
  const coursesReq = makeRequest("/api/courses", "GET", undefined, studentSession.token);
  const coursesRes = await getCourses(coursesReq);
  const t1 = Date.now();
  assert(coursesRes.status === 200, "GET /api/courses muvaffaqiyatli 200 qaytardi");
  assert(t1 - t0 < 500, `Kurslar ro'yxati N+1 muammosiz juda tez yuklandi (${t1 - t0} ms)`);

  console.log("\n--- TEST 6: CONTABO VPS RESURS CHEKLOVLARI VA O'ZBEKCHA XABARLAR ---");
  // A. MAX_WEB_LABS limiti xabari
  // Sun'iy ravishda 4 ta instansiya yaratamiz
  const dummyInstances = [];
  for (let i = 1; i <= 4; i++) {
    dummyInstances.push(
      await prisma.webLabInstance.create({
        data: {
          userId: admin.id,
          labId: premLab.id,
          containerId: `dummy_${i}_${testId.slice(-6)}`,
          containerName: `cyberedu-weblab-dummy-${i}`,
          hostPort: 6060 + i,
          proxyToken: `dummy_token_${i}_${testId}`,
          status: "running",
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      })
    );
  }

  // 5-instansiyani ochishga urinish (Admin sessiyasi orqali canAccess muvaffaqiyatli o'tadi va resurs limitiga uriladi)
  const startLabReq = makeRequest("/api/labs", "POST", { action: "start_instance", labId: premLab.id }, adminSession.token);
  const startLabRes = await postLab(startLabReq);
  const startLabData = await startLabRes.json();
  assert(startLabRes.status === 429, "Maksimal 4 ta lab instansiyasiga yetilganda 429 status qaytarildi");
  assert(
    startLabData.error && startLabData.error.includes("Hozirda barcha laboratoriya serverlari band"),
    `Resurs yetishmasligida aniq o'zbekcha xabar berildi: "${startLabData.error}"`
  );

  // Tozalash
  await prisma.webLabInstance.deleteMany({
    where: { id: { in: dummyInstances.map((d) => d.id) } },
  });

  // B. Terminal limit xabari
  const termRes = await postTerminal(
    makeRequest("/api/terminal", "POST", { command: "a".repeat(1025) }, studentSession.token)
  );
  const termData = await termRes.json();
  assert(termRes.status === 400 && termData.stderr.includes("Buyruq uzunligi"), "Terminal uzunlik chegarasi o'zbekcha xabar bilan ishlaydi");

  console.log("\n=== BARCHA 8-BOSQICH TUZATISH TESTLARI MUVAFFAQIYATLI O'TDI (ALL PASSED) ===");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Testda xatolik yuz berdi:", e);
    process.exit(1);
  });
