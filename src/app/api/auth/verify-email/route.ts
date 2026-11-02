import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/services/email-verification";
import { recordAuditLog } from "@/lib/security/audit";
import { getReliableClientIp } from "@/lib/security/client-ip";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") || "";
  return handleVerification(token, req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as { token?: string };
    const token = body.token || "";
    return handleVerification(token, req);
  } catch {
    return NextResponse.json({ success: false, error: "Noto'g'ri so'rov formati" }, { status: 400 });
  }
}

async function handleVerification(token: string, req: NextRequest): Promise<NextResponse> {
  const clientIp = getReliableClientIp(req);

  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: "Tasdiqlash tokeni ko'rsatilmadi." },
      { status: 400 }
    );
  }

  const result = await verifyEmailToken(token.trim());

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error || "Tasdiqlash kodi yaroqsiz." },
      { status: 400 }
    );
  }

  // Audit log yozish
  await recordAuditLog({
    userId: result.userId,
    action: "EMAIL_VERIFIED" as any,
    details: { email: result.email },
    ip: clientIp || "127.0.0.1",
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    message: "Elektron pochta muvaffaqiyatli tasdiqlandi. Endi tizimga kirishingiz mumkin.",
  });
}
