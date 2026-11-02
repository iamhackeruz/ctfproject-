import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, getSessionUser } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { checkPersistentRateLimit } from "@/lib/security/persistent-rate-limiter";
import { recordAuditLog } from "@/lib/security/audit";
import { canAccess } from "@/lib/security/entitlements";
import { Role } from "@prisma/client";

/**
 * Matnni xavfsiz HTML escape qilish (chiqarishda)
 */
export function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

function validateRawCommentText(raw: unknown): { valid: boolean; cleanText: string; error?: string } {
  if (typeof raw !== "string") {
    return { valid: false, cleanText: "", error: "Izoh matni satr (string) bo'lishi shart." };
  }
  const clean = raw.trim();
  if (clean.includes("\0")) {
    return { valid: false, cleanText: "", error: "Izoh matnida nojo'iz belgilar (null byte) aniqlandi." };
  }
  if (clean.length < 3) {
    return { valid: false, cleanText: "", error: "Savol matni kamida 3 ta belgidan iborat bo'lishi shart." };
  }
  if (clean.length > 1000) {
    return { valid: false, cleanText: "", error: "Savol matni 1000 ta belgidan oshmasligi shart." };
  }
  return { valid: true, cleanText: clean };
}

// GET /api/comments?lessonId=... — Dars izohlari va savol-javoblar
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const lessonIdStr = searchParams.get("lessonId");
    if (!lessonIdStr) {
      return NextResponse.json({ success: false, error: "lessonId ko'rsatilmadi." }, { status: 400 });
    }

    const lessonId = parseInt(lessonIdStr, 10);
    if (isNaN(lessonId)) {
      return NextResponse.json({ success: false, error: "Noto'g'ri lessonId" }, { status: 400 });
    }

    const user = await getSessionUser(req);
    const isStaff = user && (user.role === Role.admin || user.role === Role.instructor);

    // Huquqsiz foydalanuvchilar qulflangan dars izohlarini ko'ra olmaydi
    if (!isStaff) {
      const userObj = user ? { id: user.userId, role: user.role as Role, isBlocked: user.isBlocked } : null;
      const access = await canAccess(userObj, { type: "lesson", lessonId });
      if (!access.allowed) {
        return NextResponse.json(
          { success: false, error: access.reason || "Ushbu dars izohlarini ko'rish uchun kirish huquqi talab etiladi." },
          { status: access.statusCode || 403 }
        );
      }
    }

    const where: Record<string, unknown> = { lessonId };
    if (!isStaff) {
      where.isPublished = true;
    }

    const comments = await prisma.comment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, avatar: true, role: true },
        },
      },
    });

    const formatted = comments.map((c) => ({
      id: c.id,
      lessonId: c.lessonId,
      question: c.question,
      questionEscaped: escapeHtml(c.question),
      content: c.question,
      answer: c.answer,
      instructorReply: c.answer,
      answeredBy: c.answeredBy,
      answeredAt: c.answeredAt,
      isPublished: c.isPublished,
      createdAt: c.createdAt,
      authorName: c.user.name,
      author: {
        id: c.user.id,
        name: c.user.name,
        avatar: c.user.avatar || "👤",
        role: c.user.role,
      },
    }));

    return NextResponse.json({ success: true, comments: formatted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/comments — Yangi savol / izoh yozish (Talaba yoki Ustoz)
export async function POST(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.student, Role.instructor, Role.admin]);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { lessonId, question, content } = body;

    const parsedLessonId = parseInt(String(lessonId), 10);
    if (isNaN(parsedLessonId)) {
      return NextResponse.json({ success: false, error: "Noto'g'ri dars ID." }, { status: 400 });
    }

    const rawInput = content !== undefined ? content : question;
    const validated = validateRawCommentText(rawInput);
    if (!validated.valid) {
      return NextResponse.json({ success: false, error: validated.error }, { status: 400 });
    }
    const cleanQuestion = validated.cleanText;

    const isStaff = user.role === Role.admin || user.role === Role.instructor;
    if (!isStaff) {
      const userObj = { id: user.userId, role: user.role as Role, isBlocked: user.isBlocked };
      const access = await canAccess(userObj, { type: "lesson", lessonId: parsedLessonId });
      if (!access.allowed) {
        return NextResponse.json(
          { success: false, error: access.reason || "Ushbu darsga savol/izoh yozish uchun ruxsat berilmagan." },
          { status: access.statusCode || 403 }
        );
      }
    }

    // Rate Limit: 1 ta foydalanuvchiga 5 daqiqada maksimal 5 ta savol
    const rateKey = `comment:${user.userId}`;
    const rateCheck = await checkPersistentRateLimit(rateKey, 5, 5 * 60, true);
    if (rateCheck.limited) {
      return NextResponse.json(
        {
          success: false,
          error: "Juda ko'p savol yuborildi. Iltimos, 5 daqiqadan so'ng qayta urinib ko'ring.",
        },
        { status: 429 }
      );
    }

    const comment = await prisma.comment.create({
      data: {
        lessonId: parsedLessonId,
        userId: user.userId,
        question: cleanQuestion,
        isPublished: true,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true, role: true } },
      },
    });

    await recordAuditLog({
      userId: user.userId,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1",
      action: "COMMENT_CREATED",
      details: { commentId: comment.id, lessonId: comment.lessonId },
    });

    return NextResponse.json({
      success: true,
      message: "Savolingiz muvaffaqiyatli yuborildi.",
      comment: {
        id: comment.id,
        lessonId: comment.lessonId,
        question: comment.question,
        questionEscaped: escapeHtml(comment.question),
        content: comment.question,
        contentEscaped: escapeHtml(comment.question),
        answer: comment.answer,
        instructorReply: comment.answer,
        answeredBy: comment.answeredBy,
        answeredAt: comment.answeredAt,
        isPublished: comment.isPublished,
        createdAt: comment.createdAt,
        authorName: comment.user.name,
        author: {
          id: comment.user.id,
          name: comment.user.name,
          avatar: comment.user.avatar || "👤",
          role: comment.user.role,
        },
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PUT /api/comments — Savolga javob berish yoki yashirish (Faqat Ustoz/Admin)
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.instructor, Role.admin]);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { action, commentId, answerText, isPublished } = body;

    if (!commentId) {
      return NextResponse.json({ success: false, error: "commentId ko'rsatilmadi." }, { status: 400 });
    }

    const comment = await prisma.comment.findUnique({ where: { id: String(commentId) } });
    if (!comment) {
      return NextResponse.json({ success: false, error: "Izoh topilmadi." }, { status: 404 });
    }

    if (action === "answer") {
      const validated = validateRawCommentText(answerText);
      if (!validated.valid) {
        return NextResponse.json({ success: false, error: validated.error || "Javob matni noto'g'ri." }, { status: 400 });
      }
      const cleanAnswer = validated.cleanText;

      const updated = await prisma.comment.update({
        where: { id: comment.id },
        data: {
          answer: cleanAnswer,
          answeredBy: user.name || "Instruktor",
          answeredAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, message: "Javob muvaffaqiyatli saqlandi.", comment: updated });
    }

    if (action === "toggle_publish") {
      const updated = await prisma.comment.update({
        where: { id: comment.id },
        data: { isPublished: typeof isPublished === "boolean" ? isPublished : !comment.isPublished },
      });
      return NextResponse.json({ success: true, isPublished: updated.isPublished });
    }

    return NextResponse.json({ success: false, error: "Noma'lum amal." }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/comments — Izohni o'chirish
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.student, Role.instructor, Role.admin]);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("id");

    if (!commentId) {
      return NextResponse.json({ success: false, error: "ID ko'rsatilmadi." }, { status: 400 });
    }

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
      return NextResponse.json({ success: false, error: "Izoh topilmadi." }, { status: 404 });
    }

    // Faqat ustoz/admin yoki izoh egasi o'chira oladi
    const isStaff = user.role === Role.admin || user.role === Role.instructor;
    if (!isStaff && comment.userId !== user.userId) {
      return NextResponse.json(
        { success: false, error: "Siz bu izohni o'chirish huquqiga ega emassiz." },
        { status: 403 }
      );
    }

    await prisma.comment.delete({ where: { id: comment.id } });
    return NextResponse.json({ success: true, message: "Izoh muvaffaqiyatli o'chirildi." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
