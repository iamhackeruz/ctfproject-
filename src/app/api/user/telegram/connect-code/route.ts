import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { createTelegramConnectCode } from "@/lib/notifications/notification-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid && csrf.response) return csrf.response;

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const connectData = await createTelegramConnectCode(user.userId);
    return NextResponse.json({
      success: true,
      code: connectData.code,
      expiresAt: connectData.expiresAt.toISOString(),
      botUrl: connectData.botUrl,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Kod yaratishda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
