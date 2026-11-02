import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { Role } from "@prisma/client";
import { recordAuditLog } from "@/lib/security/audit";
import { canAccess } from "@/lib/security/entitlements";

interface RouteContext {
  params: Promise<{ lessonId: string }>;
}

// GET /api/quizzes/[lessonId] — Test savollarini olish (To'g'ri javoblar QAT'IY YASHIRILGAN)
export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { lessonId } = await context.params;
  const parsedLessonId = parseInt(lessonId, 10);

  if (isNaN(parsedLessonId)) {
    return NextResponse.json({ success: false, error: "Noto'g'ri dars ID" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const adminView = searchParams.get("adminView") === "true";
  const user = await getSessionUser(req);
  const isStaff = user && (user.role === Role.admin || user.role === Role.instructor);

  // Agar ustoz/admin tahrirlash uchun so'rasa, to'liq savollar va to'g'ri javoblarni berish
  if (adminView && isStaff) {
    const adminQuiz = await prisma.quiz.findUnique({
      where: { lessonId: parsedLessonId },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!adminQuiz) {
      return NextResponse.json({ success: false, error: "Test topilmadi." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      quiz: {
        id: adminQuiz.id,
        lessonId: adminQuiz.lessonId,
        title: adminQuiz.title,
        passingScore: adminQuiz.passingScore,
        maxAttempts: adminQuiz.maxAttempts,
        questions: adminQuiz.questions,
      },
    });
  }

  const quiz = await prisma.quiz.findUnique({
    where: { lessonId: parsedLessonId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          quizId: true,
          question: true,
          options: true,
          order: true,
          // XAVFSIZLIK: correctOption va explanation talabaga CHIQARILMAYDI!
        },
      },
    },
  });

  if (!quiz) {
    return NextResponse.json({ success: false, error: "Ushbu dars uchun test mavjud emas." }, { status: 404 });
  }

  // Server markaziy darvozaboni (canAccess tekshiruvi)
  if (!isStaff) {
    const userObj = user ? { id: user.userId, role: user.role, isBlocked: user.isBlocked } : null;
    const access = await canAccess(userObj, { type: "quiz", lessonId: parsedLessonId });
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: access.reason || "Ushbu testdan foydalanish uchun kirish huquqi talab etiladi." },
        { status: access.statusCode || 403 }
      );
    }
  }
  let attemptsCount = 0;
  let isPassed = false;
  let bestScore = 0;

  if (user) {
    const submissions = await prisma.quizSubmission.findMany({
      where: { userId: user.userId, quizId: quiz.id },
      orderBy: { createdAt: "desc" },
    });

    // 24 soatlik avtomatik tiklanish oynasi (Pre-Stage 6: Requirement C)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeSubmissions = submissions.filter((s) => s.createdAt > twentyFourHoursAgo);

    attemptsCount = activeSubmissions.length;
    isPassed = submissions.some((s) => s.passed);
    bestScore = submissions.reduce((max, s) => Math.max(max, s.score), 0);
  }

  // Har urinishda variantlar tartibini aralashtirish (Pre-Stage 5: Requirement C)
  const shuffledQuestions = quiz.questions.map((q) => {
    const opts = [...q.options];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return {
      id: q.id,
      quizId: q.quizId,
      question: q.question,
      options: opts,
      order: q.order,
    };
  });

  return NextResponse.json({
    success: true,
    quiz: {
      id: quiz.id,
      lessonId: quiz.lessonId,
      title: quiz.title,
      passingScore: quiz.passingScore,
      maxAttempts: quiz.maxAttempts,
      questions: shuffledQuestions,
    },
    attemptsCount,
    attemptsLeft: Math.max(0, quiz.maxAttempts - attemptsCount),
    isPassed,
    bestScore,
  });
}

// POST /api/quizzes/[lessonId] — Test javoblarini topshirish va server tomonida tekshirish
export async function POST(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { user } = authResult;
  const { lessonId } = await context.params;
  const parsedLessonId = parseInt(lessonId, 10);

  if (isNaN(parsedLessonId)) {
    return NextResponse.json({ success: false, error: "Noto'g'ri dars ID" }, { status: 400 });
  }

  const quiz = await prisma.quiz.findUnique({
    where: { lessonId: parsedLessonId },
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
      lesson: {
        select: { moduleId: true, module: { select: { courseId: true } } },
      },
    },
  });

  if (!quiz) {
    return NextResponse.json({ success: false, error: "Ushbu dars uchun test topilmadi." }, { status: 404 });
  }

  // Server markaziy darvozaboni (canAccess tekshiruvi)
  const isStaff = user.role === Role.admin || user.role === Role.instructor;
  if (!isStaff) {
    const access = await canAccess(
      { id: user.userId, role: user.role, isBlocked: user.isBlocked },
      { type: "quiz", lessonId: parsedLessonId }
    );
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: access.reason || "Ushbu testdan foydalanish uchun kirish huquqi talab etiladi." },
        { status: access.statusCode || 403 }
      );
    }
  }

  const priorSubmissions = await prisma.quizSubmission.findMany({
    where: { userId: user.userId, quizId: quiz.id },
    orderBy: { createdAt: "desc" },
  });

  // 1. Urinishlar soni limitini tekshirish (oxirgi 24 soatlik oynada, Pre-Stage 6: Requirement C)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const activeSubmissions = priorSubmissions.filter((s) => s.createdAt > twentyFourHoursAgo);
  const attemptsUsed = activeSubmissions.length;
  const alreadyPassed = priorSubmissions.some((s) => s.passed);

  if (!alreadyPassed && attemptsUsed >= quiz.maxAttempts) {
    const oldestOfThree = activeSubmissions[activeSubmissions.length - 1];
    const resetTime = new Date(new Date(oldestOfThree.createdAt).getTime() + 24 * 60 * 60 * 1000);
    const hoursLeft = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / (60 * 60 * 1000)));

    return NextResponse.json(
      {
        success: false,
        error: `Kechirasiz, ushbu test uchun ajratilgan barcha ${quiz.maxAttempts} ta urinishdan foydalanib bo'ldingiz. Urinishlar ${hoursLeft} soatdan keyin avtomatik tiklanadi yoki ustozingizga murojaat qiling.`,
      },
      { status: 400 }
    );
  }

  // Urinishlar orasidagi kutish vaqti (Pre-Stage 5: Requirement C: 60 soniya cooldown)
  if (priorSubmissions.length > 0) {
    const elapsed = Date.now() - new Date(priorSubmissions[0].createdAt).getTime();
    const cooldownMs = 60 * 1000;
    if (elapsed < cooldownMs) {
      const retryAfter = Math.ceil((cooldownMs - elapsed) / 1000);
      return NextResponse.json(
        {
          success: false,
          error: `Juda tez urinish! Yangi urinishdan oldin yana ${retryAfter} soniya kuting.`,
          retryAfterSeconds: retryAfter,
        },
        { status: 429 }
      );
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const answers: Record<string | number, number | string> = body.answers || {};

    if (quiz.questions.length === 0) {
      return NextResponse.json({ success: false, error: "Testda savollar mavjud emas." }, { status: 400 });
    }

    // 2. Server tomonida javoblarni tekshirish (Mijozga to'g'ri kalit yoki xato savollar indeksi oshkor qilinmaydi)
    let correctCount = 0;
    for (const q of quiz.questions) {
      const studentAnswer = answers[q.id];
      const correctText = q.options[q.correctOption];
      let isCorrect = false;

      if (typeof studentAnswer === "string") {
        isCorrect = studentAnswer.trim() === correctText.trim();
      } else if (typeof studentAnswer === "number") {
        isCorrect = studentAnswer === q.correctOption;
      }

      if (isCorrect) {
        correctCount += 1;
      }
    }

    const score = Math.round((correctCount / quiz.questions.length) * 100);
    const passed = score >= quiz.passingScore;

    // 3. Natijani bazaga saqlash
    await prisma.quizSubmission.create({
      data: {
        userId: user.userId,
        quizId: quiz.id,
        score,
        passed,
        attemptsCount: attemptsUsed + 1,
      },
    });

    // Agar muvaffaqiyatli topshirilgan bo'lsa, darsni yakunlangan deb belgilash
    if (passed && quiz.lesson?.module?.courseId) {
      await prisma.lessonProgress
        .upsert({
          where: {
            userId_lessonId: {
              userId: user.userId,
              lessonId: parsedLessonId,
            },
          },
          update: { completed: true },
          create: {
            userId: user.userId,
            courseId: quiz.lesson.module.courseId,
            lessonId: parsedLessonId,
            completed: true,
          },
        })
        .catch(() => {});
    }

    return NextResponse.json({
      success: true,
      score,
      correctCount,
      totalQuestions: quiz.questions.length,
      passed,
      passingScore: quiz.passingScore,
      attemptsUsed: attemptsUsed + 1,
      maxAttempts: quiz.maxAttempts,
      message: passed
        ? `Tabriklaymiz! Siz testni ${score}% natija bilan muvaffaqiyatli topshirdingiz!`
        : `Afsuski, o'tish bali (${quiz.passingScore}%) to'planmadi (${score}%). Qayta urinib ko'rishingiz mumkin.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PUT /api/quizzes/[lessonId] — Testni tahrirlash (RBAC: Faqat Admin yoki Instructor)
export async function PUT(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;

  const { lessonId } = await context.params;
  const parsedLessonId = parseInt(lessonId, 10);

  if (isNaN(parsedLessonId)) {
    return NextResponse.json({ success: false, error: "Noto'g'ri dars ID" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { title, passingScore, maxAttempts, questions } = body;

    const quiz = await prisma.quiz.upsert({
      where: { lessonId: parsedLessonId },
      update: {
        title: title || "Dars bo'yicha test",
        passingScore: typeof passingScore === "number" ? passingScore : 70,
        maxAttempts: typeof maxAttempts === "number" ? maxAttempts : 3,
      },
      create: {
        lessonId: parsedLessonId,
        title: title || "Dars bo'yicha test",
        passingScore: typeof passingScore === "number" ? passingScore : 70,
        maxAttempts: typeof maxAttempts === "number" ? maxAttempts : 3,
      },
    });

    if (Array.isArray(questions)) {
      // Mavjud savollarni yangilash
      await prisma.quizQuestion.deleteMany({ where: { quizId: quiz.id } });
      let qIdx = 0;
      for (const q of questions) {
        qIdx++;
        await prisma.quizQuestion.create({
          data: {
            quizId: quiz.id,
            question: q.question,
            options: q.options || [],
            correctOption: typeof q.correctOption === "number" ? q.correctOption : 0,
            explanation: q.explanation || null,
            order: qIdx,
          },
        });
      }
    }

    return NextResponse.json({ success: true, message: "Test muvaffaqiyatli yangilandi." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/quizzes/[lessonId] — Talaba urinishlarini qayta tiklash (Pre-Stage 6: Requirement C)
export async function DELETE(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;

  const { lessonId } = await context.params;
  const parsedLessonId = parseInt(lessonId, 10);
  if (isNaN(parsedLessonId)) {
    return NextResponse.json({ success: false, error: "Noto'g'ri dars ID" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId")?.trim();
  if (!targetUserId) {
    return NextResponse.json({ success: false, error: "Talaba ID (userId) ko'rsatilmadi." }, { status: 400 });
  }

  const quiz = await prisma.quiz.findUnique({ where: { lessonId: parsedLessonId } });
  if (!quiz) {
    return NextResponse.json({ success: false, error: "Test topilmadi." }, { status: 404 });
  }

  // Talabaning ushbu quiz bo'yicha urinishlarini o'chirish / tiklash
  const deleted = await prisma.quizSubmission.deleteMany({
    where: {
      userId: targetUserId,
      quizId: quiz.id,
    },
  });

  // Audit logga yozish
  await recordAuditLog({
    userId: authResult.user.userId,
    action: "ROLE_CHANGE",
    ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1",
    details: {
      action: "RESET_QUIZ_ATTEMPTS",
      targetUserId,
      quizId: quiz.id,
      clearedAttempts: deleted.count,
    },
  });

  return NextResponse.json({
    success: true,
    message: `Talabaning barcha ${deleted.count} ta urinishi muvaffaqiyatli tiklandi.`,
  });
}
