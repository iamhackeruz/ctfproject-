import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { Role } from "@prisma/client";
import {
  attachmentStorage,
  sanitizeFilenameForDownload,
} from "@/lib/storage/attachment-storage";
import { Readable } from "stream";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
): Promise<NextResponse> {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const { submissionId } = await params;

  try {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      return NextResponse.json({ success: false, error: "Topshiriq topilmadi." }, { status: 404 });
    }

    // IDOR Xavfsizlik tekshiruvi:
    // Talaba faqat o'zining yuklagan faylini olishi mumkin.
    // Admin va instructor barcha topshiriq fayllarini ko'ra oladi.
    const isStaff = user.role === Role.admin || user.role === Role.instructor;
    if (!isStaff && submission.userId !== user.userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Xavfsizlik xatosi: Boshqa talabaning faylini yuklab olish taqiqlangan (IDOR himoyasi).",
        },
        { status: 403 }
      );
    }

    if (!submission.fileKey) {
      return NextResponse.json(
        { success: false, error: "Ushbu topshiriqda biriktirilgan fayl mavjud emas." },
        { status: 404 }
      );
    }

    const exists = await attachmentStorage.exists(submission.fileKey);
    if (!exists) {
      return NextResponse.json(
        { success: false, error: "Fayl server diskida topilmadi." },
        { status: 404 }
      );
    }

    const nodeStream = await attachmentStorage.openStream(submission.fileKey);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const safeName = sanitizeFilenameForDownload(submission.fileName || "topshiriq_fayli");

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": submission.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Faylni yuklab olishda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
