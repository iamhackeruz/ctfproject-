import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security/session";
import { videoStorage } from "@/lib/video/storage";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/admin/videos/storage-stats — Video xotirasi holati
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const stats = await videoStorage.getStats();
    return NextResponse.json({
      success: true,
      stats: {
        usedBytes: stats.usedBytes,
        freeBytes: stats.freeBytes,
        totalBytes: stats.totalBytes,
        videoCount: stats.videoCount,
        usedFormatted: `${(stats.usedBytes / (1024 * 1024)).toFixed(2)} MB`,
        freeFormatted: `${(stats.freeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`,
        totalFormatted: `${(stats.totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Xotira statistikasini olishda xatolik.";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
