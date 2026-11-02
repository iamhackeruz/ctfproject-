import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";

// GET /api/progress — Foydalanuvchi darslar progressi
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: true, completedLessons: {}, authenticated: false });
  }

  try {
    const progressRecords = await prisma.lessonProgress.findMany({
      where: { userId: user.userId, completed: true },
    });

    // Kurslar bo'yicha yakunlangan darslar indekslari
    const completedLessons: Record<number, number[]> = {};

    for (const p of progressRecords) {
      if (!completedLessons[p.courseId]) {
        completedLessons[p.courseId] = [];
      }
      completedLessons[p.courseId].push(p.lessonId);
    }

    return NextResponse.json({ success: true, completedLessons });
  } catch (err) {
    console.error("Progress GET xatosi:", err);
    return NextResponse.json({ success: false, error: "Progressni yuklab bo'lmadi." }, { status: 500 });
  }
}

// POST /api/progress — Darsni tugatilgan deb belgilash
export async function POST(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { user } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { courseId, lessonId } = body;

    const parsedCourseId = parseInt(courseId, 10);
    const parsedLessonId = parseInt(lessonId, 10);

    if (isNaN(parsedCourseId) || isNaN(parsedLessonId)) {
      return NextResponse.json({ success: false, error: "Kurs yoki Dars ID noto'g'ri." }, { status: 400 });
    }

    const record = await prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: {
          userId: user.userId,
          lessonId: parsedLessonId,
        },
      },
      update: { completed: true, completedAt: new Date() },
      create: {
        userId: user.userId,
        courseId: parsedCourseId,
        lessonId: parsedLessonId,
        completed: true,
      },
    });

    return NextResponse.json({ success: true, record });
  } catch (err) {
    console.error("Progress POST xatosi:", err);
    return NextResponse.json({ success: false, error: "Progressni saqlashda xatolik." }, { status: 500 });
  }
}
