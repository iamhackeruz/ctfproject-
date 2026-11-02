import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20", 10)), 100);
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          channel: true,
          title: true,
          message: true,
          isRead: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({
        where: { userId: user.userId },
      }),
      prisma.notification.count({
        where: {
          userId: user.userId,
          isRead: false,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bildirishnomalarni yuklashda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
