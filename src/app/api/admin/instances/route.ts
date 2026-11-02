import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { recordAuditLog } from "@/lib/security/audit";
import { Role } from "@prisma/client";

const SIDECAR_URL = process.env.SIDECAR_URL || "http://127.0.0.1:5055";
const SIDECAR_SECRET = process.env.DAEMON_SECRET || process.env.SIDECAR_SECRET || "default_sidecar_daemon_secret_2026_long";

// GET /api/admin/instances — Faol terminal va web lab instansiyalari
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;

  try {
    // 1. Bazadagi faol web lab instansiyalar
    const runningWebLabs = await prisma.webLabInstance.findMany({
      where: {
        status: "running",
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        lab: { select: { id: true, title: true, category: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const webInstances = runningWebLabs.map((inst) => {
      const remainingMs = Math.max(0, inst.expiresAt.getTime() - Date.now());
      const remainingMinutes = Math.round(remainingMs / 60000);
      return {
        id: inst.id,
        type: "web-instance",
        labId: inst.labId,
        labTitle: inst.lab.title,
        category: inst.lab.category,
        user: inst.user,
        hostPort: inst.hostPort,
        createdAt: inst.createdAt,
        expiresAt: inst.expiresAt,
        remainingMinutes,
        containerId: inst.containerId,
      };
    });

    // 2. Sidecar daemondan umumiy holat va limitlarni olish
    let sidecarStats = {
      status: "ok",
      activeTerminals: 0,
      activeWebLabs: webInstances.length,
      globalLimit: 20,
    };

    try {
      const res = await fetch(`${SIDECAR_URL}/health`, {
        headers: { "x-sidecar-token": SIDECAR_SECRET },
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        sidecarStats = {
          ...sidecarStats,
          ...data,
          activeWebLabs: webInstances.length,
        };
      }
    } catch {
      // Offline fallback
    }

    return NextResponse.json({
      success: true,
      instances: webInstances,
      stats: sidecarStats,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/instances — Instansiyani majburan to'xtatish
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user: currentUser } = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get("id");

    if (!instanceId) {
      return NextResponse.json({ success: false, error: "Instansiya ID ko'rsatilmadi." }, { status: 400 });
    }

    const inst = await prisma.webLabInstance.findUnique({
      where: { id: instanceId },
      include: { lab: true },
    });

    if (!inst) {
      return NextResponse.json({ success: false, error: "Instansiya topilmadi." }, { status: 404 });
    }

    // Sidecar orqali konteynerni to'xtatish
    try {
      await fetch(`${SIDECAR_URL}/web-lab/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sidecar-token": SIDECAR_SECRET,
        },
        body: JSON.stringify({ instanceId: inst.id }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Agar sidecar offline bo'lsa ham bazada status o'zgartiriladi
    }

    await prisma.webLabInstance.update({
      where: { id: inst.id },
      data: { status: "stopped" },
    });

    await recordAuditLog({
      userId: currentUser.userId,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1",
      action: "INSTANCE_FORCE_STOP",
      details: {
        instanceId: inst.id,
        labSlug: inst.lab.slug,
        stoppedBy: currentUser.role,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Instansiya majburan to'xtatildi.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
