import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { recordAuditLog } from "@/lib/security/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid && csrf.response) return csrf.response;

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";

  try {
    const existing = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { telegramChatId: true },
    });

    await prisma.user.update({
      where: { id: user.userId },
      data: {
        telegramChatId: null,
        telegramUsername: null,
        telegramConnectedAt: null,
      },
    });

    await recordAuditLog({
      userId: user.userId,
      action: "TELEGRAM_DISCONNECTED",
      ip,
      details: { previousChatId: existing?.telegramChatId },
    });

    return NextResponse.json({
      success: true,
      message: "Telegram hisob muvaffaqiyatli uzildi.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Xatolik yuz berdi";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
