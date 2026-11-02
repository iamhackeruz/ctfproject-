import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid && csrf.response) return csrf.response;

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const { id } = await params;

  try {
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return NextResponse.json({ success: false, error: "Bildirishnoma topilmadi." }, { status: 404 });
    }

    if (notification.userId !== user.userId) {
      return NextResponse.json({ success: false, error: "Ruxsat etilmagan." }, { status: 403 });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true, notification: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Xatolik yuz berdi";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
