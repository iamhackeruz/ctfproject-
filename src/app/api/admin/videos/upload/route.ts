import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { recordAuditLog } from "@/lib/security/audit";
import { videoStorage } from "@/lib/video/storage";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

// Next.js App Router streaming upload max duration
export const maxDuration = 300; // 5 daqiqa

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. CSRF tekshiruvi
  const csrf = verifyCsrf(req);
  if (!csrf.valid && csrf.response) {
    return csrf.response;
  }

  // 2. RBAC: Faqat admin va instructor
  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user: currentUser } = authResult;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";

  try {
    const { searchParams } = new URL(req.url);
    const lessonIdParam = searchParams.get("lessonId") || req.headers.get("x-lesson-id");
    const lessonId = parseInt(lessonIdParam || "", 10);

    if (!lessonId || isNaN(lessonId)) {
      return NextResponse.json(
        { success: false, error: "lessonId parametri kiritilmadi yoki noto'g'ri." },
        { status: 400 }
      );
    }

    // Dars mavjudligini tekshirish
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { video: true },
    });

    if (!lesson) {
      return NextResponse.json(
        { success: false, error: "Bunday dars topilmadi." },
        { status: 404 }
      );
    }

    const maxBytes = parseInt(
      process.env.MAX_VIDEO_SIZE_BYTES || String(1.5 * 1024 * 1024 * 1024),
      10
    );

    // Kriptografik tasodifiy xavfsiz fayl kaliti (Original nom ishlatilmaydi, path traversal bartaraf etilgan)
    const fileKey = `${crypto.randomBytes(24).toString("hex")}.mp4`;
    const originalName =
      req.headers.get("x-file-name") || searchParams.get("originalName") || "video.mp4";
    const durationSec = parseInt(
      req.headers.get("x-duration-sec") || searchParams.get("durationSec") || "0",
      10
    );

    const contentType = req.headers.get("content-type") || "";

    let sizeBytes = 0;

    if (contentType.includes("multipart/form-data")) {
      // Multipart orqali yuklangan bo'lsa
      const formData = await req.formData();
      const file = formData.get("video") as File | null;
      if (!file) {
        return NextResponse.json(
          { success: false, error: "Video fayli yuborilmadi (formData 'video' maydoni bo'sh)." },
          { status: 400 }
        );
      }

      if (file.size > maxBytes) {
        return NextResponse.json(
          {
            success: false,
            error: `Fayl hajmi belgilangan limitdan (${Math.round(maxBytes / (1024 * 1024))} MB) katta.`,
          },
          { status: 413 }
        );
      }

      const stream = file.stream();
      const result = await videoStorage.put(fileKey, stream, maxBytes);
      sizeBytes = result.sizeBytes;
    } else {
      // To'g'ridan-to'g'ri oqimli (Binary stream) yuklash
      if (!req.body) {
        return NextResponse.json(
          { success: false, error: "Video ma'lumotlari oqimi (body) bo'sh." },
          { status: 400 }
        );
      }

      const result = await videoStorage.put(fileKey, req.body, maxBytes);
      sizeBytes = result.sizeBytes;
    }

    // Agar avval video mavjud bo'lgan bo'lsa, eski faylni diskdan tozalash
    if (lesson.video) {
      await videoStorage.delete(lesson.video.fileKey).catch(() => {});
    }

    // Bazada Video yozuvini yaratish / yangilash
    const video = await prisma.video.upsert({
      where: { lessonId },
      create: {
        lessonId,
        fileKey,
        originalName,
        durationSec: isNaN(durationSec) ? 0 : durationSec,
        sizeBytes: BigInt(sizeBytes),
        mimeType: "video/mp4",
        uploadedBy: currentUser.userId,
      },
      update: {
        fileKey,
        originalName,
        durationSec: isNaN(durationSec) ? 0 : durationSec,
        sizeBytes: BigInt(sizeBytes),
        mimeType: "video/mp4",
        uploadedBy: currentUser.userId,
      },
    });

    // Audit log
    await recordAuditLog({
      userId: currentUser.userId,
      action: "VIDEO_UPLOAD",
      ip,
      status: "SUCCESS",
      details: {
        lessonId,
        fileKey,
        originalName,
        sizeBytes,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Video muvaffaqiyatli yuklandi.",
      video: {
        id: video.id,
        lessonId: video.lessonId,
        fileKey: video.fileKey,
        originalName: video.originalName,
        sizeBytes: Number(video.sizeBytes),
        durationSec: video.durationSec,
        createdAt: video.createdAt,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Video yuklashda xatolik yuz berdi.";
    const status = errorMsg.includes("limitdan") || errorMsg.includes("Disk") ? 413 : 400;

    await recordAuditLog({
      userId: currentUser.userId,
      action: "VIDEO_UPLOAD",
      ip,
      status: "FAILED",
      details: { error: errorMsg },
    });

    return NextResponse.json({ success: false, error: errorMsg }, { status });
  }
}
