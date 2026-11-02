import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/security/session";
import { canAccess } from "@/lib/security/entitlements";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ lessonId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { lessonId: paramLessonId } = await params;
  const lessonId = parseInt(paramLessonId, 10);

  if (!lessonId || isNaN(lessonId)) {
    return NextResponse.json({ success: false, error: "Noto'g'ri lessonId" }, { status: 400 });
  }

  const currentUser = await getSessionUser(req);
  if (!currentUser) {
    return NextResponse.json(
      { success: false, error: "Avtorizatsiyadan o'tilmagan." },
      { status: 401 }
    );
  }

  // Kirish huquqini tekshirish
  const access = await canAccess(
    { id: currentUser.userId, role: currentUser.role, isBlocked: currentUser.isBlocked },
    { type: "lesson", lessonId }
  );

  if (!access.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: access.reason || "Ushbu darsga kirish uchun ruxsat berilmagan.",
      },
      { status: access.statusCode || 403 }
    );
  }

  const video = await prisma.video.findUnique({
    where: { lessonId },
    select: {
      id: true,
      lessonId: true,
      durationSec: true,
      sizeBytes: true,
      originalName: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    hasVideo: Boolean(video),
    video: video
      ? {
          id: video.id,
          lessonId: video.lessonId,
          durationSec: video.durationSec,
          sizeBytes: Number(video.sizeBytes),
          originalName: video.originalName,
          createdAt: video.createdAt,
        }
      : null,
    user: {
      name: currentUser.name,
      email: currentUser.email,
    },
  });
}
