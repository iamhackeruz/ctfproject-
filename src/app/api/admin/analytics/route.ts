import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { Role } from "@prisma/client";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(req, [Role.admin, Role.instructor]);
  if (auth instanceof NextResponse) return auth;

  try {
    const totalUsers = await prisma.user.count({ where: { role: Role.student } });
    const totalEnrollments = await prisma.enrollment.count();
    const totalSubmissions = await prisma.labSubmission.count();
    const correctSubmissions = await prisma.labSubmission.count({ where: { isCorrect: true } });

    // Eng ko'p yechilgan laboratoriyalar
    const labsWithStats = await prisma.lab.findMany({
      include: {
        _count: {
          select: {
            submissions: true,
            hintUnlocks: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });

    const labAnalytics = labsWithStats.map((l) => ({
      id: l.id,
      slug: l.slug,
      title: l.title,
      category: l.category,
      difficulty: l.difficulty,
      points: l.points,
      totalSubmissions: l._count.submissions,
      hintsUsedCount: l._count.hintUnlocks,
    }));

    // Eng ko'p hint ishlatilgan top 5 laboratoriya
    const topHintLabs = [...labAnalytics]
      .sort((a, b) => b.hintsUsedCount - a.hintsUsedCount)
      .slice(0, 5);

    // So'nggi 20 ta topshirish (audit / jurnal uchun)
    const recentSubmissions = await prisma.labSubmission.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, displayName: true, email: true } },
        lab: { select: { id: true, title: true, points: true } },
      },
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        totalEnrollments,
        totalSubmissions,
        correctSubmissions,
        successRate:
          totalSubmissions > 0
            ? Math.round((correctSubmissions / totalSubmissions) * 100)
            : 0,
      },
      topHintLabs,
      labAnalytics,
      recentSubmissions: recentSubmissions.map((s) => ({
        id: s.id,
        userName: s.user.displayName || s.user.name,
        userEmail: s.user.email,
        labTitle: s.lab.title,
        submittedFlag: s.submittedFlag,
        isCorrect: s.isCorrect,
        pointsEarned: s.pointsEarned,
        isFirstBlood: s.isFirstBlood,
        hintsUsed: s.hintsUsed,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("Admin Analytics GET xatosi:", err);
    return NextResponse.json(
      { success: false, error: "Tahliliy ma'lumotlarni yuklab bo'lmadi." },
      { status: 500 }
    );
  }
}
