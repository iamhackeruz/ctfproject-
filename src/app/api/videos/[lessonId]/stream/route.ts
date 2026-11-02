import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/security/session";
import { canAccess } from "@/lib/security/entitlements";
import { recordAuditLog } from "@/lib/security/audit";
import { videoStorage } from "@/lib/video/storage";
import { verifySignedVideoToken } from "@/lib/video/tokens";
import { acquireStreamSlot, releaseStreamSlot } from "@/lib/video/concurrency";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ lessonId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams): Promise<Response> {
  const { lessonId: paramLessonId } = await params;
  const lessonId = parseInt(paramLessonId, 10);

  if (!lessonId || isNaN(lessonId)) {
    return NextResponse.json({ success: false, error: "Noto'g'ri lessonId" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";

  // 1. Foydalanuvchini aniqlash (Sessiya cookie yoki 10 daqiqalik imzolangan token orqali)
  let currentUser = await getSessionUser(req);

  const queryToken = req.nextUrl.searchParams.get("token");
  if (!currentUser && queryToken) {
    const verified = verifySignedVideoToken(queryToken);
    if (verified.valid && verified.userId && String(verified.lessonId) === String(lessonId)) {
      const dbUser = await prisma.user.findUnique({
        where: { id: verified.userId },
        select: { id: true, role: true, email: true, name: true, isBlocked: true },
      });
      if (dbUser && !dbUser.isBlocked) {
        currentUser = {
          userId: dbUser.id,
          role: dbUser.role,
          email: dbUser.email,
          name: dbUser.name,
          isBlocked: dbUser.isBlocked,
        };
      }
    }
  }

  // Mehmon yoki kirmagan bo'lsa darhol 401
  if (!currentUser) {
    return NextResponse.json(
      { success: false, error: "Avtorizatsiyadan o'tilmagan. Iltimos, tizimga kiring." },
      { status: 401 }
    );
  }

  // 2. Markaziy canAccess darvozasi orqali huquqni tekshirish
  const access = await canAccess(
    { id: currentUser.userId, role: currentUser.role, isBlocked: currentUser.isBlocked },
    { type: "lesson", lessonId }
  );

  if (!access.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: access.reason || "Ushbu dars videosini ko'rish uchun ruxsat berilmagan.",
      },
      { status: access.statusCode || 403 }
    );
  }

  // 3. Videoning bazadagi yozuvini topish
  const video = await prisma.video.findUnique({
    where: { lessonId },
  });

  if (!video) {
    return NextResponse.json(
      { success: false, error: "Ushbu dars uchun video topilmadi." },
      { status: 404 }
    );
  }

  // 4. Concurrency cheklovi (Bir vaqtda bitta foydalanuvchiga maksimal 2 ta oqim)
  const streamSessionId =
    req.nextUrl.searchParams.get("streamSessionId") ||
    req.headers.get("x-stream-session") ||
    "default-player-session";

  const concurrency = acquireStreamSlot(currentUser.userId, streamSessionId, String(lessonId));
  if (!concurrency.allowed) {
    return NextResponse.json(
      {
        success: false,
        error:
          concurrency.message ||
          "Bir vaqtning o'zida maksimal 2 ta video oqimi ochilishi mumkin. Iltimos, boshqa qurilma yoki oynadagi videoni to'xtating.",
      },
      { status: 429 }
    );
  }

  try {
    // 5. HTTP Range parsing
    const rangeHeader = req.headers.get("range");
    let range: { start: number; end?: number } | undefined = undefined;

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : undefined;
        range = { start, end };
      }
    }

    const streamInfo = await videoStorage.openStream(video.fileKey, range);

    // 6. Audit log: Faqat oqim boshlanishida (start === 0 yoki range bo'lmaganda) yoziladi
    // Har bir 206 chunk uchun yozilmaydi (server resursini tejash)
    if (!range || range.start === 0) {
      recordAuditLog({
        userId: currentUser.userId,
        action: "VIDEO_STREAM_START",
        ip,
        status: "SUCCESS",
        details: { lessonId, fileKey: video.fileKey },
      }).catch(() => {});
    }

    // 7. Javob sarlavhalari (Himoya va Range)
    const headers = new Headers();
    headers.set("Content-Type", "video/mp4");
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    headers.set("Content-Disposition", "inline");
    headers.set("X-Content-Type-Options", "nosniff");

    // Client abort/uzilish hodisasini boshqarish
    const handleClose = () => {
      streamInfo.stream.destroy();
    };
    req.signal.addEventListener("abort", handleClose);
    streamInfo.stream.on("close", () => {
      req.signal.removeEventListener("abort", handleClose);
    });

    const isPartial = Boolean(rangeHeader);
    const statusCode = isPartial ? 206 : 200;

    if (isPartial) {
      headers.set("Content-Range", `bytes ${streamInfo.start}-${streamInfo.end}/${streamInfo.totalBytes}`);
      headers.set("Content-Length", String(streamInfo.chunkSize));
    } else {
      headers.set("Content-Length", String(streamInfo.totalBytes));
    }

    const webStream = Readable.toWeb(streamInfo.stream) as ReadableStream<Uint8Array>;

    return new Response(webStream, {
      status: statusCode,
      headers,
    });
  } catch (err: unknown) {
    releaseStreamSlot(currentUser.userId, streamSessionId);
    const errorMsg = err instanceof Error ? err.message : "Video oqimini ochishda xatolik.";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
