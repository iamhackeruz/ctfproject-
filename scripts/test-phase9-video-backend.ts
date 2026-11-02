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
import { Role, AccessType, EntitlementType, EntitlementSource } from "@prisma/client";
import { createDbSession } from "../src/lib/security/session";
import { hashPassword } from "../src/lib/security/password";
import { videoStorage, validateMp4MagicBytes, LocalDiskStorage } from "../src/lib/video/storage";
import { acquireStreamSlot, releaseStreamSlot, resetAllStreamSlotsForTest } from "../src/lib/video/concurrency";
import { generateSignedVideoToken, verifySignedVideoToken } from "../src/lib/video/tokens";

// Handlers
import { POST as uploadVideo } from "../src/app/api/admin/videos/upload/route";
import { GET as getVideoAdmin, DELETE as deleteVideoAdmin } from "../src/app/api/admin/videos/[lessonId]/route";
import { GET as getStorageStats } from "../src/app/api/admin/videos/storage-stats/route";
import { GET as streamVideo } from "../src/app/api/videos/[lessonId]/stream/route";
import { GET as getProgress, POST as postProgress } from "../src/app/api/videos/[lessonId]/progress/route";
import { GET as getVideoMeta } from "../src/app/api/videos/[lessonId]/meta/route";

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
  options?: {
    body?: unknown;
    binaryBody?: Buffer;
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
    reqHeaders.cookie = `cyberedu_session=${options.sessionToken}`;
  }

  let bodyData: BodyInit | undefined = undefined;
  if (options?.binaryBody) {
    bodyData = options.binaryBody as any;
    if (!reqHeaders["content-type"]) {
      reqHeaders["content-type"] = "video/mp4";
    }
  } else if (options?.body) {
    bodyData = JSON.stringify(options.body);
    reqHeaders["content-type"] = "application/json";
  }

  return new NextRequest(url, {
    method,
    headers: reqHeaders,
    body: bodyData,
  });
}

async function run() {
  console.log("\n=======================================================");
  console.log("   9-BOSQICH: VIDEO DARSLAR BACKEND TESTI");
  console.log("=======================================================\n");

  const sampleVideoPath = path.resolve(process.cwd(), "test-fixtures/sample-lesson.mp4");
  assert(fs.existsSync(sampleVideoPath), "sample-lesson.mp4 test fayli mavjud");
  const sampleVideoBytes = fs.readFileSync(sampleVideoPath);

  // ── TEST 1: MAGIC BYTES VA PATH TRAVERSAL HIMOYASI ────────────────────────
  console.log("\n--- [TEST 1] Magic Bytes va Path Traversal tekshiruvi ---");
  const validHeaderCheck = validateMp4MagicBytes(sampleVideoBytes.subarray(0, 16));
  assert(validHeaderCheck.valid === true, "Haqiqiy MP4 ning ftyp magic baytlari qabul qilindi");

  const fakeExeBytes = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04]);
  const exeCheck = validateMp4MagicBytes(fakeExeBytes);
  assert(exeCheck.valid === false && exeCheck.reason?.includes(".exe"), "Soxta .exe fayli magic bytes orqali rad etildi");

  const fakeHtmlBytes = Buffer.from("<!DOCTYPE html><html><body>malicious</body></html>");
  const htmlCheck = validateMp4MagicBytes(fakeHtmlBytes);
  assert(htmlCheck.valid === false && htmlCheck.reason?.includes("HTML"), "Soxta HTML fayli magic bytes orqali rad etildi");

  // Path Traversal tekshiruvi
  let traversalBlocked = false;
  try {
    const testStorage = new LocalDiskStorage();
    await (testStorage as any).openStream("../../etc/passwd");
  } catch (err: any) {
    traversalBlocked = err.message.includes("Path traversal") || err.message.includes("Xavfsizlik xatosi");
  }
  assert(traversalBlocked, "Path traversal ('../../etc/passwd') storage darajasida qat'iy bloklandi");

  // ── TEST 2: FOYDALANUVCHILAR VA DARSLARNI TAYYORLASH ─────────────────────
  console.log("\n--- [TEST 2] Test foydalanuvchilari va kurs/darslarini tayyorlash ---");
  const ts = Date.now();
  const dummyHash = await hashPassword("ComplexPass123!@#");

  const adminUser = await prisma.user.create({
    data: {
      email: `video_admin_${ts}@cyberedu.local`,
      name: "Video Admin",
      passwordHash: dummyHash,
      role: Role.admin,
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      email: `video_student_${ts}@cyberedu.local`,
      name: "Video Talaba",
      passwordHash: dummyHash,
      role: Role.student,
    },
  });

  const dummyReq = makeRequest("http://localhost:3000", "GET");
  const { token: adminToken } = await createDbSession(adminUser.id, dummyReq);
  const { token: studentToken } = await createDbSession(studentUser.id, dummyReq);

  // Kurs va premium dars yaratish
  const testCourse = await prisma.course.create({
    data: {
      title: `Video Test Kurs ${ts}`,
      slug: `video-course-${ts}`,
      desc: "Video darslar sinovi uchun kurs",
      fullDesc: "Batafsil video kursi ma'lumoti",
      instructorName: "Ustoz",
      instructorRole: "Katta Xavfsizlik Mutaxassisi",
      accessType: AccessType.PREMIUM,
      priceUzs: 150000,
      isPublished: true,
      modules: {
        create: {
          title: "1-Modul: Video darslar",
          duration: "1 soat",
          order: 1,
          lessons: {
            create: {
              title: "1-Dars: Xavfsiz streaming",
              duration: "10 daqiqa",
              accessType: AccessType.PREMIUM,
              isFree: false,
              isPublished: true,
              order: 1,
            },
          },
        },
      },
    },
  });

  const lesson = await prisma.lesson.findFirst({
    where: { module: { courseId: testCourse.id } },
  });
  if (!lesson) throw new Error("Lesson not found");
  const lessonId = lesson.id;
  assert(Boolean(lessonId), `Test darsi yaratildi (ID: ${lessonId})`);

  // ── TEST 3: RBAC VA VIDEO YUKLASH (TALABA vs ADMIN) ────────────────────────
  console.log("\n--- [TEST 3] RBAC: Talaba yuklay olmasligi (403) va Admin yuklashi (200) ---");
  const studentUploadReq = makeRequest(
    `http://localhost:3000/api/admin/videos/upload?lessonId=${lessonId}`,
    "POST",
    {
      binaryBody: sampleVideoBytes,
      sessionToken: studentToken,
      headers: { "x-file-name": "hacked.mp4" },
    }
  );
  const studentUploadRes = await uploadVideo(studentUploadReq);
  assert(studentUploadRes.status === 403, "Talaba video yuklamoqchi bo'lganda 403 Forbidden oldi");

  // Soxta faylni yuklashga urinish (Admin bo'lsa ham magic-bytes tekshiruvidan yiqiladi)
  const fakeUploadReq = makeRequest(
    `http://localhost:3000/api/admin/videos/upload?lessonId=${lessonId}`,
    "POST",
    {
      binaryBody: Buffer.from("MZThisIsAFakeExeFileRenamedToMp4"),
      sessionToken: adminToken,
      headers: { "x-file-name": "malicious.mp4" },
    }
  );
  const fakeUploadRes = await uploadVideo(fakeUploadReq);
  assert(fakeUploadRes.status === 400, "Soxta .exe video sifatida yuklanayotganda 400 Bad Request bilan rad etildi");

  // Admin haqiqiy MP4 yuklaydi
  const adminUploadReq = makeRequest(
    `http://localhost:3000/api/admin/videos/upload?lessonId=${lessonId}`,
    "POST",
    {
      binaryBody: sampleVideoBytes,
      sessionToken: adminToken,
      headers: { "x-file-name": "sample-lesson.mp4" },
    }
  );
  const adminUploadRes = await uploadVideo(adminUploadReq);
  assert(adminUploadRes.status === 200, "Admin haqiqiy MP4 faylni muvaffaqiyatli yukladi (200 OK)");
  const uploadJson = await adminUploadRes.json();
  assert(uploadJson.success === true && uploadJson.video.fileKey.endsWith(".mp4"), "Video bazada saqlandi va fileKey yaratildi");

  // ── TEST 4: STREAMING GATEKEEPER (401, 403, HUQUQ BEKOR QILINISHI) ───────
  console.log("\n--- [TEST 4] Stream Gatekeeper: 401 unauth, 403 unentitled, huquq bekor bo'lishi ---");
  // 1. Kirmagan foydalanuvchi (Mehmon)
  const unauthReq = makeRequest(`http://localhost:3000/api/videos/${lessonId}/stream`, "GET");
  const unauthRes = await streamVideo(unauthReq, { params: Promise.resolve({ lessonId: String(lessonId) }) });
  assert(unauthRes.status === 401, "Kirmagan mehmon stream ochmoqchi bo'lganda 401 Unauthorized oldi");

  // 2. Kirgan, lekin huquqi yo'q talaba (dars PREMIUM, talabada huquq yo'q)
  const unentitledReq = makeRequest(
    `http://localhost:3000/api/videos/${lessonId}/stream`,
    "GET",
    { sessionToken: studentToken }
  );
  const unentitledRes = await streamVideo(unentitledReq, { params: Promise.resolve({ lessonId: String(lessonId) }) });
  assert(unentitledRes.status === 403, "Huquqsiz talaba premium video streamini ochmoqchi bo'lganda 403 Forbidden oldi");

  // 3. Talabaga premium obuna huquqi beramiz
  const entitlement = await prisma.entitlement.create({
    data: {
      userId: studentUser.id,
      type: EntitlementType.SUBSCRIPTION,
      source: EntitlementSource.MANUAL,
    },
  });
  console.log("  [+] Talabaga Premium obuna (Entitlement) berildi.");

  // Endi talaba stream qila oladi
  const entitledReq = makeRequest(
    `http://localhost:3000/api/videos/${lessonId}/stream`,
    "GET",
    { sessionToken: studentToken }
  );
  const entitledRes = await streamVideo(entitledReq, { params: Promise.resolve({ lessonId: String(lessonId) }) });
  if (entitledRes.status !== 200 && entitledRes.status !== 206) {
    console.log("Stream debug:", entitledRes.status, await entitledRes.text());
  }
  assert(entitledRes.status === 200 || entitledRes.status === 206, "Huquq berilgach talaba streamni muvaffaqiyatli ochdi (200/206)");

  // 4. Huquq bekor qilinishi (Revocation) — keyingi stream so'rovi darhol to'xtashi shart!
  await prisma.entitlement.update({
    where: { id: entitlement.id },
    data: { revokedAt: new Date() },
  });
  console.log("  [-] Talabaning huquqi bekor qilindi (revokedAt = now).");

  const revokedReq = makeRequest(
    `http://localhost:3000/api/videos/${lessonId}/stream`,
    "GET",
    { sessionToken: studentToken }
  );
  const revokedRes = await streamVideo(revokedReq, { params: Promise.resolve({ lessonId: String(lessonId) }) });
  assert(revokedRes.status === 403, "Huquq bekor qilingach darhol keyingi stream so'rovi 403 bilan to'xtatildi");

  // Huquqni qayta tiklaymiz (keyingi testlar uchun)
  await prisma.entitlement.update({
    where: { id: entitlement.id },
    data: { revokedAt: null },
  });

  // ── TEST 5: HTTP 206 PARTIAL CONTENT RANGE TEKSHIRUVI ─────────────────────
  console.log("\n--- [TEST 5] HTTP 206 Range (Seeking va qismlarga bo'lib yuklash) ---");
  const rangeReq = makeRequest(
    `http://localhost:3000/api/videos/${lessonId}/stream`,
    "GET",
    {
      sessionToken: studentToken,
      headers: { range: "bytes=0-1023" },
    }
  );
  const rangeRes = await streamVideo(rangeReq, { params: Promise.resolve({ lessonId: String(lessonId) }) });
  assert(rangeRes.status === 206, "Range so'rovi 206 Partial Content statusini qaytardi");
  assert(rangeRes.headers.get("Accept-Ranges") === "bytes", "Accept-Ranges: bytes sarlavhasi mavjud");
  assert(rangeRes.headers.get("Content-Range")?.startsWith("bytes 0-1023/"), `To'g'ri Content-Range qaytdi: ${rangeRes.headers.get("Content-Range")}`);
  assert(rangeRes.headers.get("Content-Length") === "1024", "Content-Length: 1024 ga teng");
  assert(rangeRes.headers.get("Cache-Control")?.includes("no-store"), "Cache-Control: private, no-store xavfsizlik sarlavhasi mavjud");
  assert(rangeRes.headers.get("X-Content-Type-Options") === "nosniff", "X-Content-Type-Options: nosniff mavjud");

  // Baytlar aniqligini tekshirish
  const rangeBuffer = Buffer.from(await rangeRes.arrayBuffer());
  assert(rangeBuffer.length === 1024, "Qaytarilgan bufer uzunligi 1024 bayt");
  const originalSlice = sampleVideoBytes.subarray(0, 1024);
  assert(rangeBuffer.equals(originalSlice), "Qaytarilgan Range baytlari asl fayl baytlariga 100% mos keldi");

  // ── TEST 6: CONCURRENCY CHEKLOVI (BIR VAQTDA MAKSIMAL 2 TA OQIM) ───────────
  console.log("\n--- [TEST 6] Concurrency Cheklovi: Max 2 ta oqim, 3-chisi 429 berishi ---");
  resetAllStreamSlotsForTest();

  // 1-oqim (Tab 1)
  const slot1 = acquireStreamSlot(studentUser.id, "tab-session-1", String(lessonId));
  assert(slot1.allowed === true && slot1.activeCount === 1, "1-video oqimi ruxsat etildi");

  // 2-oqim (Tab 2)
  const slot2 = acquireStreamSlot(studentUser.id, "tab-session-2", String(lessonId));
  assert(slot2.allowed === true && slot2.activeCount === 2, "2-video oqimi ruxsat etildi");

  // 3-oqim (Tab 3 yoki boshqa qurilma) -> BLOKLANISHI SHART (429)
  const slot3 = acquireStreamSlot(studentUser.id, "tab-session-3", String(lessonId));
  assert(slot3.allowed === false, "3-video oqimi bloklandi (allowed=false)");
  assert(slot3.message?.includes("maksimal 2 ta video oqimi"), "O'zbekcha aniq ogohlantirish berildi");

  // API orqali 429 tekshiruvi
  const thirdStreamReq = makeRequest(
    `http://localhost:3000/api/videos/${lessonId}/stream?streamSessionId=tab-session-3`,
    "GET",
    { sessionToken: studentToken }
  );
  const thirdStreamRes = await streamVideo(thirdStreamReq, { params: Promise.resolve({ lessonId: String(lessonId) }) });
  assert(thirdStreamRes.status === 429, "API 429 Too Many Requests statusini qaytardi");

  // 1-oqim to'xtatilganda (release) -> 3-oqim ruxsat berilishi kerak
  releaseStreamSlot(studentUser.id, "tab-session-1");
  const slot3Retry = acquireStreamSlot(studentUser.id, "tab-session-3", String(lessonId));
  assert(slot3Retry.allowed === true, "1-oqim to'xtatilgach 3-oqim muvaffaqiyatli slot oldi");
  resetAllStreamSlotsForTest();

  // 60 soniya faolsizlikdan keyin avtomatik bo'shash (Inactivity Expiration)
  console.log("  [*] 60 soniya faolsizlikdan keyingi avtomatik bo'shash sinovi...");
  const t0 = Date.now();
  acquireStreamSlot(studentUser.id, "stale-session-1", String(lessonId), t0);
  acquireStreamSlot(studentUser.id, "stale-session-2", String(lessonId), t0);
  const blockedImmediate = acquireStreamSlot(studentUser.id, "new-session", String(lessonId), t0);
  assert(blockedImmediate.allowed === false, "2 ta faol slot bor paytda yangi slot rad etildi");

  // 59 soniyada hali faol (60 soniya to'lmagan)
  const blockedAt59s = acquireStreamSlot(studentUser.id, "new-session", String(lessonId), t0 + 59 * 1000);
  assert(blockedAt59s.allowed === false, "59 soniyada sessiyalar hali faol (bloklandi)");

  // 60+ soniyadan so'ng avtomatik tozalanadi
  const allowedAt61s = acquireStreamSlot(studentUser.id, "new-session", String(lessonId), t0 + 61 * 1000);
  assert(allowedAt61s.allowed === true, "60 soniya faolsizlikdan so'ng eski slotlar avtomatik bo'shatildi");
  resetAllStreamSlotsForTest();

  // ── TEST 7: 10 DAQIQLIK IMZOLANGAN TOKEN ──────────────────────────────────
  console.log("\n--- [TEST 7] 10 daqiqalik imzolangan video tokeni ---");
  const token = generateSignedVideoToken(studentUser.id, String(lessonId), 10 * 60 * 1000);
  const verifyValid = verifySignedVideoToken(token);
  assert(verifyValid.valid === true && verifyValid.userId === studentUser.id, "Imzolangan token to'g'ri tekshirildi");

  // Muddati o'tgan token
  const expiredToken = generateSignedVideoToken(studentUser.id, String(lessonId), -1000);
  const verifyExpired = verifySignedVideoToken(expiredToken);
  assert(verifyExpired.valid === false && verifyExpired.error?.includes("muddati tugagan"), "Muddati o'tgan token rad etildi");

  // Soxtalashtirilgan token
  const tamperedToken = `${token}tampered`;
  const verifyTampered = verifySignedVideoToken(tamperedToken);
  assert(verifyTampered.valid === false && verifyTampered.error?.includes("noto'g'ri"), "Soxta imzoli token rad etildi");

  // ── TEST 8: VIDEO PROGRESS SAQLASH VA TIKLASH ─────────────────────────────
  console.log("\n--- [TEST 8] VideoProgress saqlash va tiklash ---");
  const saveProgressReq = makeRequest(
    `http://localhost:3000/api/videos/${lessonId}/progress`,
    "POST",
    {
      sessionToken: studentToken,
      body: { positionSec: 42.5, completed: false },
    }
  );
  const saveRes = await postProgress(saveProgressReq, { params: Promise.resolve({ lessonId: String(lessonId) }) });
  assert(saveRes.status === 200, "Progress saqlandi (200 OK)");

  const getProgressReq = makeRequest(
    `http://localhost:3000/api/videos/${lessonId}/progress`,
    "GET",
    { sessionToken: studentToken }
  );
  const getRes = await getProgress(getProgressReq, { params: Promise.resolve({ lessonId: String(lessonId) }) });
  const getJson = await getRes.json();
  assert(Math.floor(getJson.progress.positionSec) === 42, "Saqlangan sekund to'g'ri qaytarildi (42.5 soniya)");

  // ── TEST 9: VIDEO XOTIRASI STATISTIKASI (STORAGE STATS) ───────────────────
  console.log("\n--- [TEST 9] Video xotirasi vidjeti (Storage stats) ---");
  const statsReq = makeRequest("http://localhost:3000/api/admin/videos/storage-stats", "GET", {
    sessionToken: adminToken,
  });
  const statsRes = await getStorageStats(statsReq);
  assert(statsRes.status === 200, "Admin xotira statistikasini oldi (200 OK)");
  const statsJson = await statsRes.json();
  assert(statsJson.success === true && statsJson.stats.videoCount >= 1, "Kamida 1 ta video mavjudligi statistikada ko'rindi");
  console.log(`  [i] Xotira holati: ${statsJson.stats.usedFormatted} band, ${statsJson.stats.freeFormatted} bo'sh`);

  // Tozalash
  await prisma.videoProgress.deleteMany({ where: { lessonId } }).catch(() => {});
  await prisma.video.deleteMany({ where: { lessonId } }).catch(() => {});
  await prisma.entitlement.deleteMany({ where: { userId: studentUser.id } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, studentUser.id] } } }).catch(() => {});
  await prisma.course.deleteMany({ where: { id: testCourse.id } }).catch(() => {});

  console.log("\n=======================================================");
  console.log("   ✅ BARCHA 9 TA BACKEND VIDEO TESTLARI MUVAFFAQIShATLI O'TDI!");
  console.log("=======================================================\n");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Testda kutilmagan xatolik:", err);
    process.exit(1);
  });
