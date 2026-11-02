import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/security/session";
import { releaseStreamSlot } from "@/lib/video/concurrency";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const currentUser = await getSessionUser(req);
  if (!currentUser) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const streamSessionId = searchParams.get("streamSessionId") || "default-player-session";

  releaseStreamSlot(currentUser.userId, streamSessionId);

  return NextResponse.json({ success: true });
}
