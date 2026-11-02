import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    // Talabaning guruhlarini aniqlash
    const memberships = await prisma.groupMember.findMany({
      where: { userId: user.userId },
      include: {
        group: { select: { id: true, name: true } },
      },
    });

    const groupIds = memberships.map((m) => m.groupId);

    // Guruhlarning barcha mashg'ulotlari
    const sessions = await prisma.classSession.findMany({
      where: {
        groupId: { in: groupIds },
      },
      include: {
        group: { select: { id: true, name: true } },
        records: {
          where: { userId: user.userId },
          include: {
            markedBy: { select: { name: true } },
          },
        },
      },
      orderBy: { sessionDate: "desc" },
    });

    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    const sessionList = sessions.map((s) => {
      const rec = s.records[0] || null;
      const status = rec ? rec.status : "ABSENT";
      if (status === "PRESENT") present++;
      else if (status === "ABSENT") absent++;
      else if (status === "LATE") late++;
      else if (status === "EXCUSED") excused++;

      return {
        sessionId: s.id,
        sessionDate: s.sessionDate,
        topic: s.topic,
        groupName: s.group.name,
        status,
        note: rec?.note || null,
        markedAt: rec?.markedAt || null,
        markedBy: rec?.markedBy?.name || null,
      };
    });

    const totalSessions = sessions.length;
    const percentage = totalSessions > 0
      ? Math.round(((present + late * 0.8) / totalSessions) * 100)
      : 100;

    return NextResponse.json({
      success: true,
      stats: {
        totalSessions,
        present,
        absent,
        late,
        excused,
        percentage,
        isAtRisk: absent >= 3,
      },
      sessions: sessionList,
      groups: memberships.map((m) => m.group),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Davomat ma'lumotlarini yuklashda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
