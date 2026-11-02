import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { recordAuditLog } from "@/lib/security/audit";
import { Role, AttendanceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid && csrf.response) return csrf.response;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const { sessionId } = await params;

  try {
    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: {
        group: {
          select: {
            id: true,
            instructorId: true,
            createdBy: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ success: false, error: "Mashg'ulot topilmadi." }, { status: 404 });
    }

    // Ustoz doirasi tekshiruvi (IDOR)
    if (user.role === Role.instructor) {
      const isAuthorized =
        session.createdById === user.userId ||
        session.group.instructorId === user.userId ||
        session.group.createdBy === user.userId;
      if (!isAuthorized) {
        return NextResponse.json(
          { success: false, error: "Siz faqat o'zingiz mas'ul bo'lgan guruhlar davomatini belgilay olasiz (IDOR himoyasi)." },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const { records } = body;

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { success: false, error: "Davomat yozuvlari (records) ro'yxati taqdim etilishi kerak." },
        { status: 400 }
      );
    }

    const validStatuses = new Set(["PRESENT", "ABSENT", "LATE", "EXCUSED"]);
    const now = new Date();

    await prisma.$transaction(
      records.map((r: { userId: string; status: AttendanceStatus; note?: string }) => {
        const status = validStatuses.has(r.status) ? r.status : "PRESENT";
        return prisma.attendanceRecord.upsert({
          where: {
            sessionId_userId: {
              sessionId,
              userId: r.userId,
            },
          },
          create: {
            sessionId,
            userId: r.userId,
            status,
            note: r.note ? String(r.note).trim() : null,
            markedById: user.userId,
            markedAt: now,
          },
          update: {
            status,
            note: r.note ? String(r.note).trim() : null,
            markedById: user.userId,
            markedAt: now,
          },
        });
      })
    );

    await recordAuditLog({
      userId: user.userId,
      action: "ATTENDANCE_MARKED",
      ip,
      details: { sessionId, recordCount: records.length },
    });

    return NextResponse.json({
      success: true,
      message: "Davomat muvaffaqiyatli saqlandi.",
      count: records.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Davomatni saqlashda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
