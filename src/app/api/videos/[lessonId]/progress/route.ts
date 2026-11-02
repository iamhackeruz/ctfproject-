import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/security/session";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ lessonId: string }>;
}

// GET /api/videos/[lessonId]/progress — Saqlangan progressni olish
export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const currentUser = await getSessionUser(req);
  if (!currentUser) {
    return NextResponse.json({ success: false, error: "Avtorizatsiyadan o'tilmagan." }, { status: 401 });
  }

  const { lessonId: paramLessonId } = await params;
  const lessonId = parseInt(paramLessonId, 10);
  if (!lessonId || isNaN(lessonId)) {
    return NextResponse.json({ success: false, error: "Noto'g'ri lessonId" }, { status: 400 });
  }

  const progress = await prisma.videoProgress.findUnique({
    where: {
      userId_lessonId: {
        userId: currentUser.userId,
        lessonId,
      },
    },
  });

  return NextResponse.json({
    success: true,
    progress: progress
      ? {
          positionSec: progress.positionSec,
          completed: progress.completed,
          updatedAt: progress.updatedAt,
        }
      : {
          positionSec: 0,
          completed: false,
        },
  });
}

// POST /api/videos/[lessonId]/progress — Progressni saqlash (qolgan joydan davom etish)
export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const currentUser = await getSessionUser(req);
  if (!currentUser) {
    return NextResponse.json({ success: false, error: "Avtorizatsiyadan o'tilmagan." }, { status: 401 });
  }

  const { lessonId: paramLessonId } = await params;
  const lessonId = parseInt(paramLessonId, 10);
  if (!lessonId || isNaN(lessonId)) {
    return NextResponse.json({ success: false, error: "Noto'g'ri lessonId" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const positionSec = Math.max(0, parseFloat(body.positionSec || "0") || 0);
    const completed = Boolean(body.completed);

    const progress = await prisma.videoProgress.upsert({
      where: {
        userId_lessonId: {
          userId: currentUser.userId,
          lessonId,
        },
      },
      create: {
        userId: currentUser.userId,
        lessonId,
        positionSec,
        completed,
      },
      update: {
        positionSec,
        completed: completed ? true : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      progress: {
        positionSec: progress.positionSec,
        completed: progress.completed,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Progressni saqlashda xatolik.";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
