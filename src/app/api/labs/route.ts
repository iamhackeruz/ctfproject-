import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import {
  getSessionUser,
  getOrCreateSession,
  attachSessionCookie,
  requireAuth,
} from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { verifyUserFlag, generateUserFlag } from "@/lib/terminal/flags";
import {
  checkLabSubmissionRateLimit,
  recordFailedLabSubmission,
} from "@/lib/security/lab-rate-limiter";
import { RestrictedDockerProxy } from "@/lib/terminal/docker-proxy";
import { generateLabTicket } from "@/lib/labs/tickets";
import { Role } from "@prisma/client";
import { canAccess } from "@/lib/security/entitlements";

const STATIC_SOLUTIONS: Record<string, string> = {
  "crypto-caesar": "flag{cyber_caesar_rot13_decryption_success}",
  "lab-crypto-1": "flag{cyber_caesar_rot13_decryption_success}",
  "crypto-base64-hex": "flag{cyber_hex_26490734547}",
  "lab-crypto-2": "flag{cyber_hex_26490734547}",
  "crypto-xor": "flag{cyber_xor_secret_byte_key_42}",
  "lab-crypto-3": "flag{cyber_xor_secret_byte_key_42}",
  "crypto-hash-crack": "flag{secret}",
  "lab-crypto-4": "flag{secret}",
  "lab-1": "flag{linux_permissions_mastered}",
  "lab-2": "flag{open_port_1337_secret}",
  "lab-3": "flag{sqli_admin_bypass_2026}",
  "lab-4": "flag{base64_decoded_success}",
  "1": "flag{cyber_edu_cia_triad_mastered_2026}",
  "2": "flag{tcp_3way_handshake_wireshark_pro}",
};

function safeStringCompare(a: string, b: string): boolean {
  const normA = a.trim().toLowerCase();
  const normB = b.trim().toLowerCase();
  if (normA.length !== normB.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(normA, "utf-8"),
    Buffer.from(normB, "utf-8")
  );
}

// ── GET: Barcha laboratoriyalarni olish ──────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getSessionUser(req);
    const isTeacher = user && (user.role === Role.admin || user.role === Role.instructor);

    const labs = await prisma.lab.findMany({
      orderBy: { id: "asc" },
      include: {
        _count: {
          select: {
            submissions: { where: { isCorrect: true } },
          },
        },
      },
    });

    const userSolves = new Set<string>();
    const userUnlocksMap = new Map<string, number[]>();

    if (user) {
      const solves = await prisma.labSubmission.findMany({
        where: { userId: user.userId, isCorrect: true },
        select: { labId: true },
      });
      solves.forEach((s) => userSolves.add(s.labId));

      const hintUnlocks = await prisma.labHintUnlock.findMany({
        where: { userId: user.userId },
        select: { labId: true, hintLevel: true },
      });
      for (const h of hintUnlocks) {
        const arr = userUnlocksMap.get(h.labId) || [];
        arr.push(h.hintLevel);
        userUnlocksMap.set(h.labId, arr);
      }
    }

    const sanitizedLabs = labs.map((lab) => {
      const unlockedLevels = userUnlocksMap.get(lab.id) || [];
      const isSolved = userSolves.has(lab.id);

      return {
        id: lab.id,
        slug: lab.slug,
        title: lab.title,
        category: lab.category,
        difficulty: lab.difficulty,
        points: lab.points,
        type: lab.type,
        description: lab.description,
        courseId: lab.courseId,
        solvedCount: lab._count.submissions,
        isSolved,
        unlockedHints: unlockedLevels,
        // Hintlar faqat ochilgan bo'lsa ko'rinadi
        hint1: isTeacher || unlockedLevels.includes(1) ? lab.hint1 : null,
        hint2: isTeacher || unlockedLevels.includes(2) ? lab.hint2 : null,
        hint3: isTeacher || unlockedLevels.includes(3) ? lab.hint3 : null,
        // Yechim yo'riqnomasi faqat ustozlarga
        guide: isTeacher ? lab.guide : null,
      };
    });

    return NextResponse.json({ success: true, labs: sanitizedLabs });
  } catch (err) {
    console.error("Labs GET xatosi:", err);
    return NextResponse.json(
      { success: false, error: "Laboratoriyalarni yuklab bo'lmadi." },
      { status: 500 }
    );
  }
}

// ── POST: Flag topshirish, hint ochish, instansiya boshqarish ────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const { session, token } = await getOrCreateSession(req);
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || (body.flag ? "submit_flag" : "unknown");

    // ── 1. FLAG TOPSHIRISH ──────────────────────────────────────────────
    if (action === "submit_flag") {
      const { labId, flag } = body;
      if (!labId || !flag || typeof flag !== "string") {
        const res = NextResponse.json(
          { success: false, error: "Lab ID va bayroq (flag) to'liq kiritilishi shart." },
          { status: 400 }
        );
        if (token) attachSessionCookie(res, token);
        return res;
      }

      const cleanLabId = String(labId).trim();
      const cleanFlag = flag.trim();

      // Labni bazadan topish (id yoki slug bo'yicha)
      const lab = await prisma.lab.findFirst({
        where: {
          OR: [{ id: cleanLabId }, { slug: cleanLabId }],
        },
      });

      if (!lab) {
        const res = NextResponse.json(
          { success: false, error: "Laboratoriya topilmadi." },
          { status: 404 }
        );
        if (token) attachSessionCookie(res, token);
        return res;
      }

      // Server markaziy darvozaboni (canAccess tekshiruvi)
      const userRecord = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, role: true, isBlocked: true },
      });
      const access = await canAccess(userRecord, { type: "lab", labId: lab.id });
      if (!access.allowed) {
        const res = NextResponse.json(
          { success: false, error: access.reason || "Ushbu laboratoriyaga kirish huquqi mavjud emas." },
          { status: access.statusCode || 403 }
        );
        if (token) attachSessionCookie(res, token);
        return res;
      }

      // Rate limit tekshiruvi: 5 ta xato urinish / 1 daqiqa (faqat tekshirish, xato bo'lsa keyin oshiriladi)
      const rate = checkLabSubmissionRateLimit(session.userId, lab.id, false);
      if (rate.limited) {
        const res = NextResponse.json(
          {
            success: false,
            error: `Juda ko'p xato urinishlar. Iltimos, ${rate.retryAfterSeconds || 60} soniyadan keyin qayta urinib ko'ring.`,
          },
          { status: 429 }
        );
        if (token) attachSessionCookie(res, token);
        return res;
      }

      // Foydalanuvchi oldinroq bu labni to'g'ri topshirganmi?
      const alreadySolved = await prisma.labSubmission.findFirst({
        where: {
          userId: session.userId,
          labId: lab.id,
          isCorrect: true,
        },
      });

      if (alreadySolved) {
        const res = NextResponse.json({
          success: true,
          alreadySolved: true,
          pointsEarned: 0,
          message: "Siz ushbu laboratoriyani allaqachon muvaffaqiyatli topshirgansiz!",
        });
        if (token) attachSessionCookie(res, token);
        return res;
      }

      // Flag to'g'riligini tekshirish:
      // 1-tekshiruv: Dinamik foydalanuvchi HMAC flag'i (har bir talabaga alohida)
      let isCorrect =
        verifyUserFlag(lab.id, session.userId, cleanFlag) ||
        verifyUserFlag(lab.slug, session.userId, cleanFlag);

      // 2-tekshiruv: Statik laboratoriyalar uchun maxsus yechim
      if (!isCorrect) {
        const expectedStatic =
          STATIC_SOLUTIONS[lab.slug] || STATIC_SOLUTIONS[lab.id] || STATIC_SOLUTIONS[cleanLabId];
        if (expectedStatic) {
          isCorrect = safeStringCompare(cleanFlag, expectedStatic);
        }
      }

      if (!isCorrect) {
        const remaining = recordFailedLabSubmission(session.userId, lab.id);

        // Noto'g'ri topshirishni bazaga qayd etish
        await prisma.labSubmission.create({
          data: {
            userId: session.userId,
            labId: lab.id,
            submittedFlag: cleanFlag.slice(0, 100),
            isCorrect: false,
            pointsEarned: 0,
          },
        });

        const res = NextResponse.json(
          {
            success: false,
            error: "Noto'g'ri flag! Qaytadan urinib ko'ring.",
            remainingAttempts: remaining,
          },
          { status: 400 }
        );
        if (token) attachSessionCookie(res, token);
        return res;
      }

      // To'g'ri topshirildi! Poyga holatlariga qarshi xavfsiz (race-safe & idempotent) tranzaksiya
      type SolveTxResult = {
        alreadySolved: boolean;
        pointsEarned: number;
        isFirstBlood: boolean;
        penaltyPercent: number;
      };

      let txResult: SolveTxResult;
      try {
        txResult = await prisma.$transaction(async (tx) => {
          // Tranzaksiya ichida avvalgi yechilganlikni tekshirish
          const priorSolve = await tx.labSubmission.findFirst({
            where: { userId: session.userId, labId: lab.id, isCorrect: true },
          });

          if (priorSolve) {
            return {
              alreadySolved: true,
              pointsEarned: 0,
              isFirstBlood: false,
              penaltyPercent: priorSolve.penaltyPercent,
            };
          }

          // Jarima (penalty) va ball hisoblash
          const hintUnlocks = await tx.labHintUnlock.findMany({
            where: { userId: session.userId, labId: lab.id },
          });

          const hintsUsed = hintUnlocks.length;
          let penaltyPercent = 0;
          if (hintsUsed === 1) penaltyPercent = 10;
          else if (hintsUsed === 2) penaltyPercent = 30; // 10 + 20
          else if (hintsUsed >= 3) penaltyPercent = 60; // 10 + 20 + 30

          const rawPoints = Math.round(lab.points * (1 - penaltyPercent / 100));
          const pointsEarned = Math.max(10, rawPoints);

          // First Blood tekshiruvi: Tizim bo'yicha bu labni 1-bo'lib kim yechdi?
          const priorGlobalSolve = await tx.labSubmission.findFirst({
            where: { labId: lab.id, isCorrect: true },
          });
          const isFirstBlood = !priorGlobalSolve;

          const solvedKey = `${session.userId}_${lab.id}`;

          await tx.labSubmission.create({
            data: {
              userId: session.userId,
              labId: lab.id,
              submittedFlag: cleanFlag.slice(0, 100),
              isCorrect: true,
              solvedKey,
              hintsUsed,
              penaltyPercent,
              pointsEarned,
              isFirstBlood,
            },
          });

          await tx.auditLog.create({
            data: {
              userId: session.userId,
              ip: clientIp,
              action: "LAB_SOLVED",
              status: "SUCCESS",
              details: JSON.stringify({
                labId: lab.id,
                slug: lab.slug,
                pointsEarned,
                isFirstBlood,
                hintsUsed,
              }),
            },
          });

          return {
            alreadySolved: false,
            pointsEarned,
            isFirstBlood,
            penaltyPercent,
          };
        });
      } catch (err: unknown) {
        // Agar parallel so'rovlarda unique constraint (P2002) yuz bersa, idempotent javob qaytarish
        const prismaErr = err as { code?: string };
        if (prismaErr?.code === "P2002") {
          txResult = {
            alreadySolved: true,
            pointsEarned: 0,
            isFirstBlood: false,
            penaltyPercent: 0,
          };
        } else {
          throw err;
        }
      }

      if (txResult.alreadySolved) {
        const res = NextResponse.json({
          success: true,
          alreadySolved: true,
          pointsEarned: 0,
          message: "Siz ushbu laboratoriyani allaqachon muvaffaqiyatli topshirgansiz!",
        });
        if (token) attachSessionCookie(res, token);
        return res;
      }

      const res = NextResponse.json({
        success: true,
        isCorrect: true,
        isFirstBlood: txResult.isFirstBlood,
        pointsEarned: txResult.pointsEarned,
        penaltyPercent: txResult.penaltyPercent,
        message: txResult.isFirstBlood
          ? "🩸 FIRST BLOOD! Siz ushbu laboratoriyani birinchi bo'lib yechdingiz!"
          : "Tabriklaymiz! Flag to'g'ri qabul qilindi!",
      });
      if (token) attachSessionCookie(res, token);
      return res;
    }

    // ── 2. HINT OCHISH ──────────────────────────────────────────────────
    if (action === "unlock_hint") {
      const { labId, hintLevel } = body;
      const level = parseInt(hintLevel, 10);

      if (!labId || ![1, 2, 3].includes(level)) {
        const res = NextResponse.json(
          { success: false, error: "Noto'g'ri hint parametri (daraja 1, 2 yoki 3 bo'lishi kerak)." },
          { status: 400 }
        );
        if (token) attachSessionCookie(res, token);
        return res;
      }

      const lab = await prisma.lab.findFirst({
        where: { OR: [{ id: String(labId) }, { slug: String(labId) }] },
      });

      if (!lab) {
        const res = NextResponse.json({ success: false, error: "Laboratoriya topilmadi." }, { status: 404 });
        if (token) attachSessionCookie(res, token);
        return res;
      }

      // Server markaziy darvozaboni (canAccess tekshiruvi)
      const userRecordHint = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, role: true, isBlocked: true },
      });
      const accessHint = await canAccess(userRecordHint, { type: "lab", labId: lab.id });
      if (!accessHint.allowed) {
        const res = NextResponse.json(
          { success: false, error: accessHint.reason || "Ushbu laboratoriyaga kirish huquqi mavjud emas." },
          { status: accessHint.statusCode || 403 }
        );
        if (token) attachSessionCookie(res, token);
        return res;
      }

      // Penalty foizi: 1-daraja: 10%, 2-daraja: 20%, 3-daraja: 30%
      const penalty = level === 1 ? 10 : level === 2 ? 20 : 30;

      await prisma.labHintUnlock.upsert({
        where: {
          userId_labId_hintLevel: {
            userId: session.userId,
            labId: lab.id,
            hintLevel: level,
          },
        },
        update: {},
        create: {
          userId: session.userId,
          labId: lab.id,
          hintLevel: level,
          penaltyPercent: penalty,
        },
      });

      const hintText =
        level === 1 ? lab.hint1 : level === 2 ? lab.hint2 : lab.hint3;

      const res = NextResponse.json({
        success: true,
        hintLevel: level,
        hintText,
        penaltyPercent: penalty,
        message: `${level}-daraja maslahat ochildi (-${penalty}% ball jarimasi).`,
      });
      if (token) attachSessionCookie(res, token);
      return res;
    }

    // ── 3. WEBLAB INSTANSIYASINI BOSHQARISH ──────────────────────────────
    if (action === "start_instance") {
      const { labId } = body;
      const lab = await prisma.lab.findFirst({
        where: { OR: [{ id: String(labId) }, { slug: String(labId) }] },
      });

      if (!lab || lab.type !== "web-instance") {
        const res = NextResponse.json(
          { success: false, error: "Ushbu laboratoriya uchun veb-instansiya talab qilinmaydi." },
          { status: 400 }
        );
        if (token) attachSessionCookie(res, token);
        return res;
      }

      // Server markaziy darvozaboni (canAccess tekshiruvi)
      const userRecordInstance = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, role: true, isBlocked: true },
      });
      const accessInstance = await canAccess(userRecordInstance, { type: "lab", labId: lab.id });
      if (!accessInstance.allowed) {
        const res = NextResponse.json(
          { success: false, error: accessInstance.reason || "Ushbu laboratoriyaga kirish huquqi mavjud emas." },
          { status: accessInstance.statusCode || 403 }
        );
        if (token) attachSessionCookie(res, token);
        return res;
      }

      // 1. Global limit: maksimal faol weblab instansiyalar (Contabo VPS: 4 ta)
      const maxWebLabs = parseInt(process.env.MAX_WEB_LABS || "4", 10);
      const runningCount = await prisma.webLabInstance.count({
        where: { status: "running", expiresAt: { gt: new Date() } },
      });

      if (runningCount >= maxWebLabs) {
        const res = NextResponse.json(
          {
            success: false,
            error: `Hozirda barcha laboratoriya serverlari band (maksimal limitga yetildi: ${maxWebLabs} ta). Iltimos, bir necha daqiqadan so'ng qayta urinib ko'ring yoki faol instansiyangizni yakunlang.`,
          },
          { status: 429 }
        );
        if (token) attachSessionCookie(res, token);
        return res;
      }

      // 2. Foydalanuvchiga 1 ta cheklovi: agar avvalgi faol instansiyasi bo'lsa, uni to'xtatish
      const priorUserInstance = await prisma.webLabInstance.findFirst({
        where: { userId: session.userId, status: "running" },
      });
      if (priorUserInstance) {
        await RestrictedDockerProxy.stopWebLab(priorUserInstance.containerId).catch(() => {});
        await prisma.webLabInstance.update({
          where: { id: priorUserInstance.id },
          data: { status: "stopped" },
        }).catch(() => {});
      }

      // Talabaning dinamik bayrog'ini hosil qilish
      const dynamicFlag = generateUserFlag(lab.id, session.userId);
      const instanceId = `inst_${session.userId.slice(-6)}_${lab.slug.replace(/[^a-z0-9]/g, "").slice(0, 8)}`;

      // Sidecar daemon orqali alohida Docker tarmog'ida ishga tushirish
      const startRes = await RestrictedDockerProxy.startWebLab(
        instanceId,
        lab.slug,
        dynamicFlag,
        session.userId
      );

      if (!startRes.success || !startRes.port) {
        const res = NextResponse.json(
          { success: false, error: `Instansiyani ishga tushirib bo'lmadi: ${startRes.error || "Noma'lum"}` },
          { status: 500 }
        );
        if (token) attachSessionCookie(res, token);
        return res;
      }

      const proxyToken = crypto.randomBytes(16).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await prisma.webLabInstance.upsert({
        where: { proxyToken },
        update: {
          containerId: instanceId,
          containerName: `cyberedu-weblab-${instanceId}`,
          hostPort: startRes.port,
          status: "running",
          expiresAt,
        },
        create: {
          userId: session.userId,
          labId: lab.id,
          containerId: instanceId,
          containerName: `cyberedu-weblab-${instanceId}`,
          hostPort: startRes.port,
          proxyToken,
          status: "running",
          expiresAt,
        },
      });

      // Qisqa muddatli imzolangan ticket hosil qilish
      const ticket = generateLabTicket(instanceId, session.userId);

      const res = NextResponse.json({
        success: true,
        instanceId,
        proxyToken,
        ticket,
        remainingSeconds: 1800,
        proxyUrl: `/api/labs/proxy/${instanceId}?ticket=${ticket}`,
        message: "Izolyatsiyalangan veb-laboratoriya muvaffaqiyatli ishga tushdi (30 daqiqa vaqt ajratildi).",
      });
      if (token) attachSessionCookie(res, token);
      return res;
    }

    if (action === "stop_instance") {
      const { instanceId } = body;
      if (instanceId) {
        await RestrictedDockerProxy.stopWebLab(instanceId);
        await prisma.webLabInstance.updateMany({
          where: { containerId: instanceId, userId: session.userId },
          data: { status: "stopped" },
        });
      }

      const res = NextResponse.json({ success: true, message: "Instansiya to'xtatildi." });
      if (token) attachSessionCookie(res, token);
      return res;
    }

    if (action === "instance_status") {
      const { instanceId } = body;
      const statusRes = await RestrictedDockerProxy.getWebLabStatus(instanceId);
      const res = NextResponse.json({ success: true, ...statusRes });
      if (token) attachSessionCookie(res, token);
      return res;
    }

    // ── 4. USTOZ / ADMIN AMALLARI (CRUD) ────────────────────────────────
    if (["create_lab", "update_lab", "delete_lab"].includes(action)) {
      const auth = await requireAuth(req, [Role.admin, Role.instructor]);
      if (auth instanceof NextResponse) return auth;

      if (action === "create_lab") {
        const { title, slug, category, difficulty, points, type, description, hint1, hint2, hint3, guide } = body;
        const newLab = await prisma.lab.create({
          data: {
            id: `lab-${slug || Date.now()}`,
            slug: slug || `lab-${Date.now()}`,
            title: title || "Yangi Lab",
            category: category || "Linux",
            difficulty: difficulty || "Oson",
            points: Number(points) || 50,
            type: type || "terminal",
            description: description || "",
            hint1: hint1 || null,
            hint2: hint2 || null,
            hint3: hint3 || null,
            guide: guide || null,
          },
        });
        return NextResponse.json({ success: true, lab: newLab });
      }

      if (action === "update_lab") {
        const { id, title, category, difficulty, points, type, description, hint1, hint2, hint3, guide } = body;
        const updated = await prisma.lab.update({
          where: { id },
          data: {
            title,
            category,
            difficulty,
            points: Number(points),
            type,
            description,
            hint1,
            hint2,
            hint3,
            guide,
          },
        });
        return NextResponse.json({ success: true, lab: updated });
      }

      if (action === "delete_lab") {
        const { id } = body;
        await prisma.lab.delete({ where: { id } });
        return NextResponse.json({ success: true, message: "Laboratoriya o'chirildi." });
      }
    }

    const badRes = NextResponse.json({ success: false, error: "Noma'lum amal." }, { status: 400 });
    if (token) attachSessionCookie(badRes, token);
    return badRes;
  } catch (err: unknown) {
    console.error("Labs API xatosi:", err);
    const msg = err instanceof Error ? err.message : "Serverda xatolik yuz berdi.";
    const errRes = NextResponse.json({ success: false, error: msg }, { status: 500 });
    if (token) attachSessionCookie(errRes, token);
    return errRes;
  }
}
