import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { recordAuditLog } from "@/lib/security/audit";
import { Role, NotificationType, NotificationChannel } from "@prisma/client";
import { enqueueNotification } from "@/lib/notifications/notification-service";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid && csrf.response) return csrf.response;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const { id } = await params;

  try {
    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment) {
      return NextResponse.json({ success: false, error: "Vazifa topilmadi." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { userId, extendedDueAt, reason } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ success: false, error: "Talaba identifikatori (userId) kiritilmagan." }, { status: 400 });
    }

    if (!extendedDueAt || isNaN(new Date(extendedDueAt).getTime())) {
      return NextResponse.json({ success: false, error: "Yangi muddat (extendedDueAt) noto'g'ri." }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ success: false, error: "Talaba topilmadi." }, { status: 404 });
    }

    const extension = await prisma.assignmentExtension.upsert({
      where: {
        assignmentId_userId: {
          assignmentId: id,
          userId,
        },
      },
      create: {
        assignmentId: id,
        userId,
        extendedDueAt: new Date(extendedDueAt),
        grantedById: user.userId,
        reason: reason ? String(reason).trim() : null,
      },
      update: {
        extendedDueAt: new Date(extendedDueAt),
        grantedById: user.userId,
        reason: reason ? String(reason).trim() : null,
      },
    });

    await recordAuditLog({
      userId: user.userId,
      action: "ASSIGNMENT_EXTENSION_GRANTED",
      ip,
      details: { assignmentId: id, studentId: userId, extendedDueAt },
    });

    // Talabaga bildirishnoma yuborish
    const formattedDate = new Date(extendedDueAt).toLocaleString("uz-UZ");
    await enqueueNotification({
      userId,
      type: NotificationType.ASSIGNMENT_DUE_SOON,
      channel: NotificationChannel.BOTH,
      title: "Vazifa muddati uzaytirildi",
      message: `"${assignment.title}" vazifasi topshirish muddati siz uchun ${formattedDate} gacha uzaytirildi.${reason ? ` Sabab: ${reason}` : ""}`,
    });

    return NextResponse.json({ success: true, extension });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Muddatni uzaytirishda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
