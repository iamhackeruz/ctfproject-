import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  let pref = await prisma.notificationPreference.findUnique({
    where: { userId: user.userId },
  });

  if (!pref) {
    // Agar mavjud bo'lmasa, default yaratamiz
    pref = await prisma.notificationPreference.create({
      data: { userId: user.userId },
    });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: {
      telegramChatId: true,
      telegramUsername: true,
      telegramConnectedAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    preferences: pref,
    telegram: {
      isConnected: Boolean(dbUser?.telegramChatId),
      username: dbUser?.telegramUsername || null,
      connectedAt: dbUser?.telegramConnectedAt || null,
    },
  });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid && csrf.response) return csrf.response;

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const {
      notifyAssignmentNew,
      notifyDueSoon,
      notifyGraded,
      notifyLessonPublished,
      notifyExpiring,
      notifyPasswordReset,
      notifySubmissionNew,
    } = body;

    const updated = await prisma.notificationPreference.upsert({
      where: { userId: user.userId },
      create: {
        userId: user.userId,
        notifyAssignmentNew: notifyAssignmentNew ?? true,
        notifyDueSoon: notifyDueSoon ?? true,
        notifyGraded: notifyGraded ?? true,
        notifyLessonPublished: notifyLessonPublished ?? true,
        notifyExpiring: notifyExpiring ?? true,
        notifyPasswordReset: notifyPasswordReset ?? true,
        notifySubmissionNew: notifySubmissionNew ?? true,
      },
      update: {
        ...(typeof notifyAssignmentNew === "boolean" && { notifyAssignmentNew }),
        ...(typeof notifyDueSoon === "boolean" && { notifyDueSoon }),
        ...(typeof notifyGraded === "boolean" && { notifyGraded }),
        ...(typeof notifyLessonPublished === "boolean" && { notifyLessonPublished }),
        ...(typeof notifyExpiring === "boolean" && { notifyExpiring }),
        ...(typeof notifyPasswordReset === "boolean" && { notifyPasswordReset }),
        ...(typeof notifySubmissionNew === "boolean" && { notifySubmissionNew }),
      },
    });

    return NextResponse.json({
      success: true,
      preferences: updated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Sozlamalarni saqlashda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
