import { NextRequest, NextResponse } from "next/server";
import { processReminders } from "@/lib/reminders/scheduler";
import { getReliableClientIp } from "@/lib/security/client-ip";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleReminders(req);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleReminders(req);
}

async function handleReminders(req: NextRequest): Promise<NextResponse> {
  const clientIp = getReliableClientIp(req);
  const cronSecret = process.env.CRON_SECRET;

  // Xavfsizlik tekshiruvi:
  // 1. Agar CRON_SECRET o'rnatilgan bo'lsa, sarlavha (X-Cron-Secret yoki Authorization: Bearer) yoki parametr orqali tekshirish
  if (cronSecret) {
    const headerSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("authorization") || "";
    const bearerSecret = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;
    const { searchParams } = new URL(req.url);
    const querySecret = searchParams.get("secret");

    const isAuthorized =
      headerSecret === cronSecret ||
      bearerSecret === cronSecret ||
      querySecret === cronSecret;

    if (!isAuthorized) {
      // Faqat localhost ga ruxsat berilishi mumkin
      const isLocalhost = clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "localhost";
      if (!isLocalhost) {
        return NextResponse.json({ success: false, error: "Ruxsat berilmadi (Cron secret noto'g'ri)" }, { status: 403 });
      }
    }
  }

  try {
    const result = await processReminders();
    return NextResponse.json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Eslatmalarni qayta ishlashda kutilmagan xato";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
