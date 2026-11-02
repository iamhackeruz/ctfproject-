import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { recordAuditLog } from "@/lib/security/audit";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10))) : 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      ...(groupId && { groupId }),
    };

    if (user.role === Role.instructor) {
      where.OR = [
        { createdById: user.userId },
        { group: { instructorId: user.userId } },
        { group: { createdBy: user.userId } },
      ];
    }

    const [total, sessions] = await Promise.all([
      prisma.classSession.count({ where }),
      prisma.classSession.findMany({
        where,
        include: {
          group: { select: { id: true, name: true, instructorId: true } },
          creator: { select: { id: true, name: true } },
          _count: {
            select: { records: true },
          },
        },
        orderBy: { sessionDate: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      sessions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Mashg'ulotlarni yuklashda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid && csrf.response) return csrf.response;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";

  try {
    const body = await req.json().catch(() => ({}));
    const { groupId, sessionDate, topic } = body;

    if (!groupId || typeof groupId !== "string") {
      return NextResponse.json({ success: false, error: "Guruh (groupId) tanlanishi shart." }, { status: 400 });
    }

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return NextResponse.json({ success: false, error: "Dars mavzusi kiritilishi shart." }, { status: 400 });
    }

    if (!sessionDate || isNaN(new Date(sessionDate).getTime())) {
      return NextResponse.json({ success: false, error: "Dars sanasi va vaqti to'g'ri kiritilishi shart." }, { status: 400 });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: { select: { userId: true } },
      },
    });

    if (!group) {
      return NextResponse.json({ success: false, error: "Guruh topilmadi." }, { status: 404 });
    }

    // Ustoz doirasi (Instructor Scoping): faqat o'zi mas'ul bo'lgan guruh uchun mashg'ulot yaratishi mumkin
    if (user.role === Role.instructor && group.instructorId !== user.userId && group.createdBy !== user.userId) {
      return NextResponse.json(
        { success: false, error: "Siz faqat o'zingiz mas'ul bo'lgan guruhlar uchun mashg'ulot yarata olasiz (IDOR himoyasi)." },
        { status: 403 }
      );
    }

    const session = await prisma.classSession.create({
      data: {
        groupId,
        sessionDate: new Date(sessionDate),
        topic: topic.trim(),
        createdById: user.userId,
      },
    });

    // Guruh talabalari uchun boshlang'ich davomat yozuvlarini yaratish (STANDART: PRESENT)
    if (group.members.length > 0) {
      await prisma.attendanceRecord.createMany({
        data: group.members.map((m) => ({
          sessionId: session.id,
          userId: m.userId,
          status: "PRESENT",
          markedById: user.userId,
        })),
        skipDuplicates: true,
      });
    }

    await recordAuditLog({
      userId: user.userId,
      action: "CLASS_SESSION_CREATED",
      ip,
      details: { sessionId: session.id, groupId, topic: session.topic, date: session.sessionDate },
    });

    return NextResponse.json({ success: true, session });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Mashg'ulot yaratishda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
