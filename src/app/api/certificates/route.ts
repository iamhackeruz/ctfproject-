import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getSessionUser, requireAuth } from "@/lib/security/session";
import { canAccess } from "@/lib/security/entitlements";

// GET /api/certificates — Sertifikatlarni olish yoki kod bo'yicha tekshirish
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim().toUpperCase();

  // 1. Agar kod berilgan bo'lsa — ommaviy tekshiruv (public verification)
  if (code) {
    const cert = await prisma.certificate.findUnique({
      where: { certificateCode: code },
      include: {
        course: {
          select: { title: true, icon: true, duration: true },
        },
      },
    });

    if (!cert) {
      return NextResponse.json(
        { success: false, error: "Bunday kodli sertifikat topilmadi yoki soxta." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      valid: true,
      certificate: {
        code: cert.certificateCode,
        userName: cert.userName,
        courseTitle: cert.courseTitle,
        issuedAt: cert.issuedAt,
        grade: cert.grade,
      },
    });
  }

  // 2. Foydalanuvchining o'z sertifikatlari
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Avtorizatsiya talab qilinadi." }, { status: 401 });
  }

  const userCertificates = await prisma.certificate.findMany({
    where: { userId: user.userId },
    orderBy: { issuedAt: "desc" },
  });

  return NextResponse.json({ success: true, certificates: userCertificates });
}

// POST /api/certificates — Kurs tugatilgach yangi sertifikat chiqarish
export async function POST(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { user } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { courseId } = body;

    const parsedId = parseInt(courseId, 10);
    if (isNaN(parsedId)) {
      return NextResponse.json({ success: false, error: "Kurs ID noto'g'ri." }, { status: 400 });
    }

    const course = await prisma.course.findUnique({ where: { id: parsedId } });
    if (!course) {
      return NextResponse.json({ success: false, error: "Kurs topilmadi." }, { status: 404 });
    }

    // Server markaziy darvozaboni (canAccess tekshiruvi)
    const access = await canAccess(
      { id: user.userId, role: user.role, isBlocked: user.isBlocked },
      { type: "certificate", courseId: parsedId }
    );
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: access.reason || "Ushbu kurs sertifikatini olish uchun kirish huquqi mavjud emas." },
        { status: access.statusCode || 403 }
      );
    }

    // Mavjud sertifikat bormi?
    const existing = await prisma.certificate.findFirst({
      where: { userId: user.userId, courseId: parsedId },
    });

    if (existing) {
      return NextResponse.json({ success: true, certificate: existing });
    }

    // XAVFSIZLIK: Kursning barcha darslari va quizlari tugatilganligini serverda tekshirish (Requirement 7 & 8)
    const allLessons = await prisma.lesson.findMany({
      where: { module: { courseId: parsedId } },
      include: { quiz: true },
    });

    if (allLessons.length === 0) {
      return NextResponse.json(
        { success: false, error: "Ushbu kursda hali darslar mavjud emas." },
        { status: 400 }
      );
    }

    const lessonIds = allLessons.map((l) => l.id);
    const completedCount = await prisma.lessonProgress.count({
      where: {
        userId: user.userId,
        courseId: parsedId,
        lessonId: { in: lessonIds },
        completed: true,
      },
    });

    if (completedCount < allLessons.length) {
      return NextResponse.json(
        {
          success: false,
          error: `Sertifikat olish uchun kursning barcha darslarini (${completedCount}/${allLessons.length}) to'liq tugatishingiz kerak!`,
        },
        { status: 400 }
      );
    }

    // Mavjud quizlar tekshiruvi
    const quizIds = allLessons
      .map((l) => l.quiz?.id)
      .filter((qId): qId is number => typeof qId === "number");

    if (quizIds.length > 0) {
      const passedQuizzesCount = await prisma.quizSubmission.count({
        where: {
          userId: user.userId,
          quizId: { in: quizIds },
          passed: true,
        },
      });

      if (passedQuizzesCount < quizIds.length) {
        return NextResponse.json(
          {
            success: false,
            error: "Sertifikat olish uchun kursning barcha dars testlarini (quiz) muvaffaqiyatli topshirishingiz shart!",
          },
          { status: 400 }
        );
      }
    }

    // Kursga biriktirilgan amaliy laboratoriyalar tekshiruvi (Pre-Stage 5: Requirement D)
    const courseLabs = await prisma.lab.findMany({
      where: { courseId: parsedId },
      select: { id: true, title: true },
    });

    if (courseLabs.length > 0) {
      const courseLabIds = courseLabs.map((l) => l.id);
      const solvedLabCount = await prisma.labSubmission.count({
        where: {
          userId: user.userId,
          labId: { in: courseLabIds },
          isCorrect: true,
        },
      });

      // Kamida N ta lab topshirilgan bo'lishi shart (kursdagi lablarning kamida yarmi, minimal 1 ta)
      const requiredLabCount = Math.max(1, Math.min(courseLabs.length, Math.ceil(courseLabs.length * 0.5)));
      if (solvedLabCount < requiredLabCount) {
        return NextResponse.json(
          {
            success: false,
            error: `Sertifikat olish uchun kursga biriktirilgan laboratoriyalardan kamida ${requiredLabCount} tasini (${solvedLabCount}/${requiredLabCount}) muvaffaqiyatli topshirishingiz shart!`,
          },
          { status: 400 }
        );
      }
    }

    // Yangi noyob kod: CYBER-2026-XXXXXX
    const certCode = `CYBER-2026-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const cert = await prisma.certificate.create({
      data: {
        certificateCode: certCode,
        userId: user.userId,
        courseId: parsedId,
        userName: user.name || "Talaba",
        courseTitle: course.title,
        grade: "A'lo (100%)",
      },
    });

    return NextResponse.json({ success: true, certificate: cert });
  } catch (err) {
    console.error("Sertifikat yaratish xatosi:", err);
    return NextResponse.json({ success: false, error: "Sertifikat berishda xatolik." }, { status: 500 });
  }
}
