import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");

    if (!groupId) {
      return NextResponse.json({ success: false, error: "groupId parametri kiritilishi shart." }, { status: 400 });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ success: false, error: "Guruh topilmadi." }, { status: 404 });
    }

    // Ustoz doirasi tekshiruvi (IDOR)
    if (user.role === Role.instructor) {
      const isAuthorized = group.instructorId === user.userId || group.createdBy === user.userId;
      if (!isAuthorized) {
        return NextResponse.json(
          { success: false, error: "Siz faqat o'zingiz mas'ul bo'lgan guruhlar statistikasini ko'ra olasiz (IDOR himoyasi)." },
          { status: 403 }
        );
      }
    }

    const sessions = await prisma.classSession.findMany({
      where: { groupId },
      orderBy: { sessionDate: "asc" },
      include: {
        records: true,
      },
    });

    const totalSessions = sessions.length;

    // Har bir talaba bo'yicha hisoblash
    const studentStats = group.members.map((m) => {
      let present = 0;
      let absent = 0;
      let late = 0;
      let excused = 0;

      for (const s of sessions) {
        const rec = s.records.find((r) => r.userId === m.userId);
        if (rec) {
          if (rec.status === "PRESENT") present++;
          else if (rec.status === "ABSENT") absent++;
          else if (rec.status === "LATE") late++;
          else if (rec.status === "EXCUSED") excused++;
        } else {
          // Yozuv yo'q bo'lsa
          absent++;
        }
      }

      // Qatnashish foizi: (present + late * 0.8) / total
      const percentage = totalSessions > 0
        ? Math.round(((present + late * 0.8) / totalSessions) * 100)
        : 100;

      return {
        user: m.user,
        present,
        absent,
        late,
        excused,
        totalSessions,
        percentage,
        isAtRisk: absent >= 3, // 3 martadan ko'p qoldirganlar ogohlantiriladi
      };
    });

    const totalStudents = studentStats.length;
    const groupAveragePercentage =
      totalStudents > 0
        ? Math.round(studentStats.reduce((sum, s) => sum + s.percentage, 0) / totalStudents)
        : 100;

    const atRiskCount = studentStats.filter((s) => s.isAtRisk).length;

    return NextResponse.json({
      success: true,
      group: { id: group.id, name: group.name },
      totalSessions,
      groupAveragePercentage,
      atRiskCount,
      students: studentStats,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Davomat statistikasini yuklashda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
