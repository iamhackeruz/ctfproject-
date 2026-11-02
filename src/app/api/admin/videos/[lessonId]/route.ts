import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { recordAuditLog } from "@/lib/security/audit";
import { videoStorage } from "@/lib/video/storage";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ lessonId: string }>;
}

// GET /api/admin/videos/[lessonId] — Video ma'lumotlarini olish
export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;

  const { lessonId: paramLessonId } = await params;
  const lessonId = parseInt(paramLessonId, 10);
  if (!lessonId || isNaN(lessonId)) {
    return NextResponse.json({ success: false, error: "Noto'g'ri lessonId" }, { status: 400 });
  }

  const video = await prisma.video.findUnique({
    where: { lessonId },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!video) {
    return NextResponse.json(
      { success: false, error: "Ushbu dars uchun video mavjud emas." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    video: {
      id: video.id,
      lessonId: video.lessonId,
      fileKey: video.fileKey,
      originalName: video.originalName,
      sizeBytes: Number(video.sizeBytes),
      durationSec: video.durationSec,
      createdAt: video.createdAt,
      uploader: video.user,
    },
  });
}

// DELETE /api/admin/videos/[lessonId] — Videoni diskdan va bazadan tozalash
export async function DELETE(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid && csrf.response) return csrf.response;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user: currentUser } = authResult;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const { lessonId: paramLessonId } = await params;
  const lessonId = parseInt(paramLessonId, 10);
  if (!lessonId || isNaN(lessonId)) {
    return NextResponse.json({ success: false, error: "Noto'g'ri lessonId" }, { status: 400 });
  }

  const video = await prisma.video.findUnique({ where: { lessonId } });
  if (!video) {
    return NextResponse.json(
      { success: false, error: "O'chirilishi kerak bo'lgan video topilmadi." },
      { status: 404 }
    );
  }

  try {
    // 1. Diskdan o'chirish
    await videoStorage.delete(video.fileKey);

    // 2. Bazadan o'chirish
    await prisma.video.delete({ where: { lessonId } });

    // 3. Ushbu darsning progress ma'lumotlarini ham tozalash
    await prisma.videoProgress.deleteMany({ where: { lessonId } });

    // 4. Audit log
    await recordAuditLog({
      userId: currentUser.userId,
      action: "VIDEO_DELETE",
      ip,
      status: "SUCCESS",
      details: { lessonId, fileKey: video.fileKey },
    });

    return NextResponse.json({
      success: true,
      message: "Video darslik muvaffaqiyatli o'chirildi.",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Videoni o'chirishda xatolik yuz berdi.";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
