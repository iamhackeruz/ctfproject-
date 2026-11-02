import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { recordAuditLog } from "@/lib/security/audit";
import { Role } from "@prisma/client";
import crypto from "crypto";

// GET /api/admin/invitations — Taklif kodlari ro'yxati
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "15", 10) || 15));
    const skip = (page - 1) * limit;

    const [total, codes] = await Promise.all([
      prisma.invitationCode.count(),
      prisma.invitationCode.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          group: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    const formatted = codes.map((c) => ({
      id: c.id,
      code: c.code,
      createdBy: c.createdBy,
      usedCount: c.usedCount,
      maxUses: c.maxUses,
      expiresAt: c.expiresAt,
      isExpired: c.expiresAt < new Date(),
      isFullyUsed: c.usedCount >= c.maxUses,
      group: c.group,
      createdAt: c.createdAt,
    }));

    return NextResponse.json({
      success: true,
      invitations: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/admin/invitations — Yangi taklif kodi yaratish
export async function POST(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user: currentUser } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { expiresInDays, maxUses, groupId, customCode } = body;

    const days = Math.min(365, Math.max(1, parseInt(expiresInDays || "7", 10) || 7));
    const usageLimit = Math.min(1000, Math.max(1, parseInt(maxUses || "1", 10) || 1));
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    let codeString = customCode ? String(customCode).trim().toUpperCase() : "";
    if (!codeString) {
      codeString = `CYBER-INV-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    }

    // Unikallik tekshiruvi
    const existing = await prisma.invitationCode.findUnique({ where: { code: codeString } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "Ushbu taklif kodi allaqachon mavjud." },
        { status: 400 }
      );
    }

    if (groupId) {
      const groupExists = await prisma.group.findUnique({ where: { id: String(groupId) } });
      if (!groupExists) {
        return NextResponse.json({ success: false, error: "Tanlangan guruh topilmadi." }, { status: 404 });
      }
    }

    const created = await prisma.invitationCode.create({
      data: {
        code: codeString,
        createdBy: currentUser.userId,
        expiresAt,
        maxUses: usageLimit,
        groupId: groupId ? String(groupId) : null,
      },
      include: {
        group: { select: { id: true, name: true } },
      },
    });

    await recordAuditLog({
      userId: currentUser.userId,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1",
      action: "INVITATION_CREATE",
      details: {
        code: created.code,
        maxUses: created.maxUses,
        expiresAt: created.expiresAt,
        groupId: created.groupId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Taklif kodi muvaffaqiyatli yaratildi.",
      invitation: created,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/invitations — Taklif kodini bekor qilish / o'chirish (Faqat ADMIN)
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.admin]);
  if (authResult instanceof NextResponse) return authResult;
  const { user: currentUser } = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "ID ko'rsatilmadi." }, { status: 400 });
    }

    const invite = await prisma.invitationCode.findUnique({ where: { id } });
    if (!invite) {
      return NextResponse.json({ success: false, error: "Taklif kodi topilmadi." }, { status: 404 });
    }

    await prisma.invitationCode.delete({ where: { id } });

    await recordAuditLog({
      userId: currentUser.userId,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1",
      action: "INVITATION_DELETE",
      details: { code: invite.code },
    });

    return NextResponse.json({
      success: true,
      message: "Taklif kodi muvaffaqiyatli bekor qilindi.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
