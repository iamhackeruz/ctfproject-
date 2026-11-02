import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";

// GET /api/enroll — Foydalanuvchi yozilgan kurslar ro'yxati
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { user } = authResult;

  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: user.userId },
      include: {
        course: {
          include: {
            modules: {
              include: {
                lessons: true,
              },
            },
          },
        },
      },
    });

    // 2. Foydalanuvchi a'zo bo'lgan guruhlar orqali biriktirilgan kurslar
    const groupMemberships = await prisma.groupMember.findMany({
      where: { userId: user.userId },
      include: {
        group: {
          include: {
            courses: {
              include: {
                course: {
                  include: {
                    modules: { include: { lessons: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    // 3. Foydalanuvchining faol shaxsiy va guruh kirish huquqlari (Entitlements)
    const now = new Date();
    const activeEntitlements = await prisma.entitlement.findMany({
      where: {
        userId: user.userId,
        courseId: { not: null },
        revokedAt: null,
        startsAt: { lte: now },
        OR: [
          { endsAt: null },
          { endsAt: { gt: now } },
        ],
      },
      include: {
        course: {
          include: {
            modules: { include: { lessons: true } },
          },
        },
      },
    });

    const directIds = enrollments.map((e) => e.courseId);
    const groupCourseIds = groupMemberships.flatMap((m) => m.group.courses.map((gc) => gc.courseId));
    const entitlementCourseIds = activeEntitlements
      .map((ent) => ent.courseId)
      .filter((id): id is number => typeof id === "number");

    const allEnrolledIds = Array.from(new Set([...directIds, ...groupCourseIds, ...entitlementCourseIds]));

    return NextResponse.json({ success: true, enrollments, enrolledCourseIds: allEnrolledIds });
  } catch (err) {
    console.error("Enrollment GET xatosi:", err);
    return NextResponse.json({ success: false, error: "Yozilgan kurslarni yuklab bo'lmadi." }, { status: 500 });
  }
}

// POST /api/enroll — Kursga yozilish
export async function POST(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { user } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { courseId } = body;

    const parsedId = typeof courseId === "number" ? courseId : parseInt(courseId, 10);
    if (isNaN(parsedId)) {
      return NextResponse.json({ success: false, error: "Kurs ID noto'g'ri." }, { status: 400 });
    }

    const course = await prisma.course.findUnique({ where: { id: parsedId } });
    if (!course) {
      return NextResponse.json({ success: false, error: "Kurs topilmadi." }, { status: 404 });
    }

    const enrollment = await prisma.enrollment.upsert({
      where: {
        userId_courseId: {
          userId: user.userId,
          courseId: parsedId,
        },
      },
      update: {},
      create: {
        userId: user.userId,
        courseId: parsedId,
      },
    });

    return NextResponse.json({ success: true, message: "Kursga muvaffaqiyatli yozildingiz!", enrollment });
  } catch (err) {
    console.error("Enrollment POST xatosi:", err);
    return NextResponse.json({ success: false, error: "Kursga yozilishda xatolik." }, { status: 500 });
  }
}
