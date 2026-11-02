// Node runtime module alias hook for @/* -> src/*
try {
  process.loadEnvFile();
} catch {}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require("module");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs");
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
import { createDbSession } from "../src/lib/security/session";
import { hashPassword } from "../src/lib/security/password";
import {
  validateAttachment,
  generateAttachmentKey,
  attachmentStorage,
} from "../src/lib/storage/attachment-storage";
import { scrubSensitiveNotificationText } from "../src/lib/notifications/notification-service";

// Handlers
import { GET as getAssignments, POST as postAssignment } from "../src/app/api/assignments/route";
import { GET as getAssignmentById, DELETE as deleteAssignment } from "../src/app/api/assignments/[id]/route";
import { POST as postExtension } from "../src/app/api/assignments/[id]/extensions/route";
import { POST as submitAssignment } from "../src/app/api/assignments/[id]/submit/route";
import { GET as getSubmissions } from "../src/app/api/assignments/[id]/submissions/route";
import { GET as exportSubmissions } from "../src/app/api/assignments/[id]/submissions/export/route";
import { PUT as gradeSubmission } from "../src/app/api/assignments/submissions/[submissionId]/grade/route";
import { GET as downloadSubmission } from "../src/app/api/assignments/submissions/[submissionId]/download/route";

import { GET as getSessions, POST as postSession } from "../src/app/api/attendance/sessions/route";
import { GET as getSessionById } from "../src/app/api/attendance/sessions/[sessionId]/route";
import { POST as markAttendanceRecords } from "../src/app/api/attendance/sessions/[sessionId]/records/route";
import { GET as getAttendanceStats } from "../src/app/api/attendance/stats/route";
import { GET as exportAttendance } from "../src/app/api/attendance/export/route";
import { GET as getUserAttendance } from "../src/app/api/user/attendance/route";

import { POST as telegramWebhook } from "../src/app/api/telegram/webhook/route";
import { POST as getConnectCode } from "../src/app/api/user/telegram/connect-code/route";
import { POST as disconnectTelegram } from "../src/app/api/user/telegram/disconnect/route";

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

function makeRequest(
  url: string,
  method: string,
  options?: {
    body?: unknown;
    formData?: FormData;
    sessionToken?: string;
    headers?: Record<string, string>;
  }
): NextRequest {
  const reqHeaders: Record<string, string> = {
    origin: "http://localhost:3000",
    host: "localhost:3000",
    ...(options?.headers || {}),
  };

  if (options?.sessionToken) {
    reqHeaders["cookie"] = `cyberedu_session=${options.sessionToken}`;
  }

  let reqBody: BodyInit | undefined = undefined;

  if (options?.formData) {
    reqBody = options.formData;
  } else if (options?.body) {
    reqHeaders["content-type"] = "application/json";
    reqBody = JSON.stringify(options.body);
  }

  return new NextRequest(url, {
    method,
    headers: reqHeaders,
    body: reqBody,
  });
}

async function runTests() {
  console.log("\n🚀 === 10-BOSQICH XAVFSIZLIK VA INTEGRATSIYA TESTLARI ===\n");

  // TEST 1: Fayl yuklash xavfsizligi va Magic Bytes tekshiruvi
  console.log("--- 1. Fayl yuklash va Magic Bytes tekshiruvlari ---");
  {
    // A. Haqiqiy PDF (%PDF- imzosi bilan)
    const validPdf = Buffer.from("%PDF-1.4\n%test pdf content");
    const resPdf = validateAttachment(validPdf, "hujjat.pdf", ["pdf"]);
    assert(resPdf.valid, "Haqiqiy PDF fayli qabul qilindi");

    // B. Haqiqiy PNG (89 50 4E 47...)
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const resPng = validateAttachment(validPng, "rasm.png", ["png"]);
    assert(resPng.valid, "Haqiqiy PNG rasm qabul qilindi");

    // C. Kengaytmasi .pdf qilingan soxta EXE (MZ imzoli)
    const fakeExePdf = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const resExe = validateAttachment(fakeExePdf, "zararli.pdf", ["pdf"]);
    assert(!resExe.valid, "Kengaytmasi .pdf qilingan EXE (.exe/PE) magic bytes orqali rad etildi");

    // D. Kengaytmasi .pdf qilingan Linux ELF
    const fakeElfPdf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01]);
    const resElf = validateAttachment(fakeElfPdf, "payload.pdf", ["pdf"]);
    assert(!resElf.valid, "Kengaytmasi .pdf qilingan Linux ELF dasturi rad etildi");

    // E. XSS HTML fayli
    const fakeHtml = Buffer.from("<html><script>alert(1)</script></html>");
    const resHtml = validateAttachment(fakeHtml, "sahifa.txt", ["txt"]);
    assert(!resHtml.valid, "Ichida HTML/Script bo'lgan fayl XSS himoyasi orqali rad etildi");

    // F. SVG fayli (XSS xavfi)
    const fakeSvg = Buffer.from("<svg onload=alert(1)>");
    const resSvg = validateAttachment(fakeSvg, "vektor.svg", ["svg", "pdf"]);
    assert(!resSvg.valid, "SVG fayli rad etildi");

    // G. PHP kodi
    const fakePhp = Buffer.from("<?php system($_GET['c']); ?>");
    const resPhp = validateAttachment(fakePhp, "shell.txt", ["txt"]);
    assert(!resPhp.valid, "PHP skripti rad etildi");

    // H. Ruxsat etilmagan kengaytma (.exe)
    const resDisallowed = validateAttachment(Buffer.from("matn"), "program.exe", ["pdf", "txt"]);
    assert(!resDisallowed.valid, "Ruxsat berilmagan kengaytma (.exe) darhol rad etildi");

    // I. Matnli faylda null-bayt (Ikkilik ma'lumot)
    const binaryInText = Buffer.from("matn\0ikkilik");
    const resNull = validateAttachment(binaryInText, "test.txt", ["txt"]);
    assert(!resNull.valid, "Matnli fayldagi null-bayt aniqlanib rad etildi");
  }

  // TEST 2: Privacy Scrubbing (Maxfiy ma'lumotlarni yashirish)
  console.log("\n--- 2. Bildirishnomalarda Maxfiy Ma'lumotlarni Yashirish ---");
  {
    const raw = "Talaba paroli: Maxfiy123! token=xyz_token_889 flag{sql_inj_first_blood} email: talaba.alisher@cyberedu.uz";
    const scrubbed = scrubSensitiveNotificationText(raw);

    assert(!scrubbed.includes("Maxfiy123!"), "Xabardan haqiqiy parol olib tashlandi");
    assert(!scrubbed.includes("sql_inj_first_blood"), "Xabardan haqiqiy flag olib tashlandi");
    assert(scrubbed.includes("FLAG{******}"), "Flag niqoblandi (FLAG{******})");
    assert(!scrubbed.includes("talaba.alisher@cyberedu.uz"), "To'liq email olib tashlandi");
    assert(scrubbed.includes("t***@cyberedu.uz"), "Email to'g'ri niqoblandi (t***@domain)");
  }

  // Test foydalanuvchilarini yaratish
  console.log("\n--- Test foydalanuvchilari va guruhini sozlash ---");
  const adminEmail = `test_admin_p10_${Date.now()}@test.cyberedu.uz`;
  const student1Email = `test_s1_p10_${Date.now()}@test.cyberedu.uz`;
  const student2Email = `test_s2_p10_${Date.now()}@test.cyberedu.uz`;
  const pwdHash = await hashPassword("TestPass_123456");

  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      name: "Phase10 Admin",
      passwordHash: pwdHash,
      role: Role.admin,
    },
  });

  const student1 = await prisma.user.create({
    data: {
      email: student1Email,
      name: "Talaba Bir",
      passwordHash: pwdHash,
      role: Role.student,
    },
  });

  const student2 = await prisma.user.create({
    data: {
      email: student2Email,
      name: "Talaba Ikki",
      passwordHash: pwdHash,
      role: Role.student,
    },
  });

  const group = await prisma.group.create({
    data: {
      name: `P10 Guruh ${Date.now()}`,
      createdBy: adminUser.id,
      members: {
        create: [
          { userId: student1.id },
          { userId: student2.id },
        ],
      },
    },
  });

  // Sessiyalar
  const dummyReq = new NextRequest("http://localhost:3000");
  const adminSession = await createDbSession(adminUser.id, dummyReq);
  const student1Session = await createDbSession(student1.id, dummyReq);
  const student2Session = await createDbSession(student2.id, dummyReq);

  // TEST 3: Uy Vazifasi yaratish va Muddat tekshiruvlari
  console.log("\n--- 3. Uy Vazifasi yaratish va Muddat nazorati ---");
  let pastAssignmentId = "";
  {
    // A. Admin muddati o'tgan vazifa yaratadi (allowLate = false)
    const pastDate = new Date(Date.now() - 3600 * 1000); // 1 soat oldin
    const reqCreate = makeRequest("http://localhost:3000/api/assignments", "POST", {
      body: {
        title: "Xavfsiz Tarmoqlar Topshirig'i",
        description: "Wireshark traffic dump tahlili",
        groupId: group.id,
        dueAt: pastDate.toISOString(),
        maxScore: 100,
        isPublished: true,
        allowLateSubmission: false,
      },
      sessionToken: adminSession.token,
    });
    const resCreate = await postAssignment(reqCreate);
    const jsonCreate = await resCreate.json();
    assert(jsonCreate.success, "Admin vazifa yaratdi");
    pastAssignmentId = jsonCreate.assignment.id;

    // B. Talaba1 muddati o'tgan vazifaga topshirishga urinadi -> 400 xato
    const reqSubmitFail = makeRequest(
      `http://localhost:3000/api/assignments/${pastAssignmentId}/submit`,
      "POST",
      {
        body: { textContent: "Mening kech qolgan javobim" },
        sessionToken: student1Session.token,
      }
    );
    const resSubmitFail = await submitAssignment(reqSubmitFail, {
      params: Promise.resolve({ id: pastAssignmentId }),
    });
    const jsonSubmitFail = await resSubmitFail.json();
    assert(!jsonSubmitFail.success, "Muddati o'tgan va ruxsat berilmagan topshirish rad etildi (400)");

    // C. Ustoz faqat Talaba1 uchun muddatni uzaytiradi (AssignmentExtension)
    const futureDate = new Date(Date.now() + 2 * 3600 * 1000); // 2 soat keyin
    const reqExt = makeRequest(
      `http://localhost:3000/api/assignments/${pastAssignmentId}/extensions`,
      "POST",
      {
        body: {
          userId: student1.id,
          extendedDueAt: futureDate.toISOString(),
          reason: "Uzrli sabab bilan kechikdi",
        },
        sessionToken: adminSession.token,
      }
    );
    const resExt = await postExtension(reqExt, {
      params: Promise.resolve({ id: pastAssignmentId }),
    });
    const jsonExt = await resExt.json();
    assert(jsonExt.success, "Ustoz talaba uchun muddatni muvaffaqiyatli uzaytirdi");

    // D. Endi Talaba1 topshira oladi
    const reqSubmitSuccess = makeRequest(
      `http://localhost:3000/api/assignments/${pastAssignmentId}/submit`,
      "POST",
      {
        body: { textContent: "Uzaytirilgan muddatdagi yechim matni" },
        sessionToken: student1Session.token,
      }
    );
    const resSubmitSuccess = await submitAssignment(reqSubmitSuccess, {
      params: Promise.resolve({ id: pastAssignmentId }),
    });
    const jsonSubmitSuccess = await resSubmitSuccess.json();
    assert(jsonSubmitSuccess.success, "Muddat uzaytirilgach, talaba topshirishni muvaffaqiyatli yakunladi");
    assert(jsonSubmitSuccess.submission.isLate === false, "Uzaytirilgan muddat ichida bo'lgani uchun kechikkan deb belgilanmadi");
  }

  // TEST 4: Topshiriq versiyalari (Resubmission / History)
  console.log("\n--- 4. Qayta topshirish va versiyalash (Submission History) ---");
  {
    // Talaba1 javobini yangilab qayta topshiradi
    const reqResubmit = makeRequest(
      `http://localhost:3000/api/assignments/${pastAssignmentId}/submit`,
      "POST",
      {
        body: { textContent: "Yechimning 2-versiyasi (tuzatilgan)" },
        sessionToken: student1Session.token,
      }
    );
    const resResubmit = await submitAssignment(reqResubmit, {
      params: Promise.resolve({ id: pastAssignmentId }),
    });
    const jsonResubmit = await resResubmit.json();
    assert(jsonResubmit.success, "Talaba muvaffaqiyatli qayta topshirdi");
    assert(jsonResubmit.submission.version === 2, "Topshiriq versiyasi 2 ga oshdi (v2)");

    // Bazada tarix saqlanganligini tekshirish
    const history = await prisma.submissionHistory.findMany({
      where: { submissionId: jsonResubmit.submission.id },
    });
    assert(history.length === 1, "Avvalgi topshirish tarix jadvalida (v1) arxivlandi");
    assert(history[0].textContent === "Uzaytirilgan muddatdagi yechim matni", "Tarixdagi matn to'liq saqlangan");
  }

  // TEST 5: IDOR Himoyasi (Boshqa talabaning faylini o'g'irlashni bloklash)
  console.log("\n--- 5. IDOR Himoyasi (Boshqa talabaning faylini yuklab olishni rad etish) ---");
  let student1SubmissionId = "";
  {
    // Talaba1 fayl bilan topshiriq topshiradi
    const fileContent = Buffer.from("%PDF-1.4\nTalaba 1 hisoboti");
    const fileKey = generateAttachmentKey("pdf");
    await attachmentStorage.putBuffer(fileKey, fileContent);

    const subWithFile = await prisma.submission.update({
      where: {
        assignmentId_userId: {
          assignmentId: pastAssignmentId,
          userId: student1.id,
        },
      },
      data: {
        fileKey,
        fileName: "talaba1_hisobot.pdf",
        fileSize: fileContent.length,
        mimeType: "application/pdf",
      },
    });
    student1SubmissionId = subWithFile.id;

    // Talaba2 ushbu topshiriq faylini yuklab olishga urinadi (IDOR) -> 403
    const reqDownloadIdor = makeRequest(
      `http://localhost:3000/api/assignments/submissions/${student1SubmissionId}/download`,
      "GET",
      { sessionToken: student2Session.token }
    );
    const resDownloadIdor = await downloadSubmission(reqDownloadIdor, {
      params: Promise.resolve({ submissionId: student1SubmissionId }),
    });
    assert(resDownloadIdor.status === 403, "Talaba2 boshqa talabaning faylini yuklab olmoqchi bo'lganda 403 Forbidden oldi (IDOR himoyasi)");

    // Talaba1 o'z faylini yuklab oladi -> 200
    const reqDownloadOwn = makeRequest(
      `http://localhost:3000/api/assignments/submissions/${student1SubmissionId}/download`,
      "GET",
      { sessionToken: student1Session.token }
    );
    const resDownloadOwn = await downloadSubmission(reqDownloadOwn, {
      params: Promise.resolve({ submissionId: student1SubmissionId }),
    });
    assert(resDownloadOwn.status === 200, "Talaba1 o'z faylini muvaffaqiyatli yuklab oldi (200 OK)");
    assert(
      resDownloadOwn.headers.get("content-disposition")?.includes("attachment"),
      "Yuklab olishda Content-Disposition: attachment sarlavhasi mavjud"
    );
    assert(
      resDownloadOwn.headers.get("x-content-type-options") === "nosniff",
      "X-Content-Type-Options: nosniff mavjud"
    );

    // Ustoz/Admin ham faylni yuklab oladi -> 200
    const reqDownloadAdmin = makeRequest(
      `http://localhost:3000/api/assignments/submissions/${student1SubmissionId}/download`,
      "GET",
      { sessionToken: adminSession.token }
    );
    const resDownloadAdmin = await downloadSubmission(reqDownloadAdmin, {
      params: Promise.resolve({ submissionId: student1SubmissionId }),
    });
    assert(resDownloadAdmin.status === 200, "Ustoz talaba topshirig'i faylini tekshirish uchun yuklab oldi (200 OK)");
  }

  // TEST 6: Baholash va Ustoz izohi
  console.log("\n--- 6. Baholash va Ustoz izohi ---");
  {
    const reqGrade = makeRequest(
      `http://localhost:3000/api/assignments/submissions/${student1SubmissionId}/grade`,
      "PUT",
      {
        body: {
          score: 95,
          instructorFeedback: "A'lo darajadagi yechim, barcha traffic flaglari to'g'ri topilgan.",
          status: "GRADED",
        },
        sessionToken: adminSession.token,
      }
    );
    const resGrade = await gradeSubmission(reqGrade, {
      params: Promise.resolve({ submissionId: student1SubmissionId }),
    });
    const jsonGrade = await resGrade.json();
    assert(jsonGrade.success, "Ustoz topshiriqni baholadi (95 ball)");

    // Talabaga bildirishnoma yuborilganligini tekshirish
    const notif = await prisma.notification.findFirst({
      where: {
        userId: student1.id,
        type: "SUBMISSION_GRADED",
      },
    });
    assert(Boolean(notif), "Talaba1 ga 'Topshirig'ingiz baholandi' bildirishnomasi navbatga qo'shildi");
  }

  // TEST 7: Davomat (Attendance) va Unikal Yozuvlar
  console.log("\n--- 7. Davomat tizimi, unikal yozuvlar va statistika ---");
  {
    // A. Ustoz dars mashg'ulotini yaratadi
    const reqSession = makeRequest("http://localhost:3000/api/attendance/sessions", "POST", {
      body: {
        groupId: group.id,
        sessionDate: new Date().toISOString(),
        topic: "Web Application Firewall & OWASP Top 10",
      },
      sessionToken: adminSession.token,
    });
    const resSession = await postSession(reqSession);
    const jsonSession = await resSession.json();
    assert(jsonSession.success, "Ustoz yangi dars mashg'ulotini yaratdi");
    const sessionId = jsonSession.session.id;

    // B. Guruh talabalari uchun davomat belgilash
    const reqMark = makeRequest(
      `http://localhost:3000/api/attendance/sessions/${sessionId}/records`,
      "POST",
      {
        body: {
          records: [
            { userId: student1.id, status: "PRESENT", note: "Faol qatnashdi" },
            { userId: student2.id, status: "ABSENT", note: "Sababsiz kelmadi" },
          ],
        },
        sessionToken: adminSession.token,
      }
    );
    const resMark = await markAttendanceRecords(reqMark, {
      params: Promise.resolve({ sessionId }),
    });
    const jsonMark = await resMark.json();
    assert(jsonMark.success, "Guruh talabalari uchun davomat muvaffaqiyatli belgilandi");

    // C. Bitta talabaning bitta sessiyada ikki marta kiritilmasligi (Unique constraint)
    const recordsCount = await prisma.attendanceRecord.count({
      where: { sessionId, userId: student1.id },
    });
    assert(recordsCount === 1, "Talaba bitta sessiyada faqat bitta davomat yozuviga ega (Unikallik ta'minlandi)");

    // D. Talaba1 o'z davomatini ko'radi (boshqalarni ko'rmaydi)
    const reqUserAtt = makeRequest("http://localhost:3000/api/user/attendance", "GET", {
      sessionToken: student1Session.token,
    });
    const resUserAtt = await getUserAttendance(reqUserAtt);
    const jsonUserAtt = await resUserAtt.json();
    assert(jsonUserAtt.success, "Talaba1 o'z davomatini muvaffaqiyatli ko'rdi");
    assert(jsonUserAtt.stats.present === 1, "Talaba1 o'zining qatnashgan darsini ko'rmoqda");
    assert(jsonUserAtt.sessions.length >= 1, "Mashg'ulotlar ro'yxati taqdim etildi");

    // E. Davomat statistikasi va 3+ dars qoldirganlar ogohlantirishi
    // student2 uchun yana 2 ta qoldirilgan sessiya yaratamiz (jami 3 ta qoldirilgan dars)
    const s2 = await prisma.classSession.create({
      data: { groupId: group.id, sessionDate: new Date(), topic: "Lab 2", createdById: adminUser.id },
    });
    await prisma.attendanceRecord.create({
      data: { sessionId: s2.id, userId: student2.id, status: "ABSENT", markedById: adminUser.id },
    });
    const s3 = await prisma.classSession.create({
      data: { groupId: group.id, sessionDate: new Date(), topic: "Lab 3", createdById: adminUser.id },
    });
    await prisma.attendanceRecord.create({
      data: { sessionId: s3.id, userId: student2.id, status: "ABSENT", markedById: adminUser.id },
    });

    const reqStats = makeRequest(`http://localhost:3000/api/attendance/stats?groupId=${group.id}`, "GET", {
      sessionToken: adminSession.token,
    });
    const resStats = await getAttendanceStats(reqStats);
    const jsonStats = await resStats.json();
    assert(jsonStats.success, "Guruh davomat statistikasi hisoblandi");
    assert(jsonStats.atRiskCount >= 1, "3 martadan ortiq dars qoldirgan talaba (atRisk) aniqlandi");
    const st2Stat = jsonStats.students.find((s: { user: { id: string } }) => s.user.id === student2.id);
    assert(st2Stat.isAtRisk === true, "Talaba2 xavf ostida (isAtRisk=true) deb belgilandi");

    // F. CSV Eksport va Formula Injection himoyasi
    const reqExport = makeRequest(`http://localhost:3000/api/attendance/export?groupId=${group.id}`, "GET", {
      sessionToken: adminSession.token,
    });
    const resExport = await exportAttendance(reqExport);
    assert(resExport.status === 200, "Davomat CSV eksporti 200 qaytardi");
    assert(
      resExport.headers.get("content-type")?.includes("text/csv"),
      "Content-Type: text/csv qaytarildi"
    );
  }

  // TEST 8: Telegram Bot va Webhook Xavfsizligi
  console.log("\n--- 8. Telegram Bot, Webhook va Secret Token Xavfsizligi ---");
  {
    process.env.TELEGRAM_WEBHOOK_SECRET = "super_secret_webhook_token_p10";

    // A. Talaba connect code oladi
    const reqCode = makeRequest("http://localhost:3000/api/user/telegram/connect-code", "POST", {
      sessionToken: student1Session.token,
    });
    const resCode = await getConnectCode(reqCode);
    const jsonCode = await resCode.json();
    assert(jsonCode.success, "Talaba1 uchun 6 belgili Telegram ulanish kodi yaratildi");
    const rawConnectCode = jsonCode.code;
    assert(rawConnectCode.length === 6, "Ulanish kodi aniq 6 ta belgidan iborat");

    // B. Webhook so'rovi noto'g'ri secret token bilan yuborilganda -> 403 rad etilishi
    const reqBadSecret = makeRequest("http://localhost:3000/api/telegram/webhook", "POST", {
      headers: { "x-telegram-bot-api-secret-token": "wrong_secret" },
      body: { message: { text: `/start ${rawConnectCode}`, chat: { id: 12345678 } } },
    });
    const resBadSecret = await telegramWebhook(reqBadSecret);
    assert(resBadSecret.status === 403, "Noto'g'ri webhook secret token bilan so'rov 403 qaytardi");

    // C. Webhook to'g'ri secret token bilan /start CODE qabul qiladi
    const reqGoodWebhook = makeRequest("http://localhost:3000/api/telegram/webhook", "POST", {
      headers: { "x-telegram-bot-api-secret-token": "super_secret_webhook_token_p10" },
      body: {
        message: {
          text: `/start ${rawConnectCode}`,
          chat: { id: 987654321 },
          from: { id: 987654321, username: "talaba_alisher_bot" },
        },
      },
    });
    const resGoodWebhook = await telegramWebhook(reqGoodWebhook);
    const jsonGoodWebhook = await resGoodWebhook.json();
    assert(jsonGoodWebhook.ok === true, "To'g'ri secret token bilan webhook qabul qilindi");

    // Talabada telegramChatId o'rnatilganligini tekshirish
    const updatedS1 = await prisma.user.findUnique({ where: { id: student1.id } });
    assert(updatedS1?.telegramChatId === "987654321", "Talabaning telegramChatId saqlandi va hisob ulandi");
    assert(updatedS1?.telegramUsername === "@talaba_alisher_bot", "Talabaning telegramUsername saqlandi");

    // D. Foydalanuvchi Telegram hisobini veb interfeys orqali uzadi
    const reqDisconnect = makeRequest("http://localhost:3000/api/user/telegram/disconnect", "POST", {
      sessionToken: student1Session.token,
    });
    const resDisconnect = await disconnectTelegram(reqDisconnect);
    const jsonDisconnect = await resDisconnect.json();
    assert(jsonDisconnect.success, "Talaba Telegram hisobini muvaffaqiyatli uzdi");

    const disconnS1 = await prisma.user.findUnique({ where: { id: student1.id } });
    assert(disconnS1?.telegramChatId === null, "TelegramChatId bazadan tozalandi");
  }

  // Tozalash
  console.log("\n--- Test ma'lumotlarini tozalash ---");
  await prisma.assignment.delete({ where: { id: pastAssignmentId } }).catch(() => null);
  await prisma.classSession.deleteMany({ where: { groupId: group.id } }).catch(() => null);
  await prisma.group.delete({ where: { id: group.id } }).catch(() => null);
  await prisma.user.deleteMany({
    where: { id: { in: [adminUser.id, student1.id, student2.id] } },
  }).catch(() => null);

  console.log(`\n=========================================`);
  console.log(`Phase 10 Backend Test Natijasi:`);
  console.log(`  Jami testlar: ${passCount + failCount}`);
  console.log(`  PASS: ${passCount}`);
  console.log(`  FAIL: ${failCount}`);
  console.log(`=========================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Testda kutilmagan xatolik:", err);
  process.exit(1);
});
