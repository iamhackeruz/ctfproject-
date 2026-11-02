import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";

// GET /api/user/entitlements — Talabaning shaxsiy kirish huquqlari (Mening huquqlarim)
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const now = new Date();
    const entitlements = await prisma.entitlement.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      include: {
        course: {
          select: { id: true, title: true, icon: true, accessType: true, duration: true },
        },
        plan: {
          select: { id: true, name: true, interval: true, priceUzs: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
    });

    const formatted = entitlements.map((e) => {
      let status: "active" | "expired" | "revoked" = "active";
      if (e.revokedAt) {
        status = "revoked";
      } else if (e.endsAt && e.endsAt < now) {
        status = "expired";
      }

      return {
        id: e.id,
        type: e.type,
        source: e.source,
        course: e.course,
        plan: e.plan,
        group: e.group,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        status,
        reason: e.reason,
      };
    });

    const activeCount = formatted.filter((f) => f.status === "active").length;

    return NextResponse.json({
      success: true,
      entitlements: formatted,
      activeCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
