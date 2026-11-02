import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid && csrf.response) return csrf.response;

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    await prisma.notification.updateMany({
      where: {
        userId: user.userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true, message: "Barcha bildirishnomalar o'qilgan deb belgilandi." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Xatolik yuz berdi";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
