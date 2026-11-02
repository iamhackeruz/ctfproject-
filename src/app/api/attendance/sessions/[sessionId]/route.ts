import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const { sessionId } = await params;

  try {
    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            instructorId: true,
            createdBy: true,
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, phone: true },
                },
              },
            },
          },
        },
        records: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            markedBy: { select: { id: true, name: true } },
          },
          orderBy: { user: { name: "asc" } },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ success: false, error: "Mashg'ulot topilmadi." }, { status: 404 });
    }

    // Ustoz doirasi tekshiruvi (IDOR)
    if (user.role === Role.instructor) {
      const isAuthorized =
        session.createdById === user.userId ||
        session.group.instructorId === user.userId ||
        session.group.createdBy === user.userId;
      if (!isAuthorized) {
        return NextResponse.json(
          { success: false, error: "Siz faqat o'zingiz mas'ul bo'lgan guruhlar mashg'ulotini ko'ra olasiz (IDOR himoyasi)." },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ success: true, session });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Mashg'ulot tafsilotlarini yuklashda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid && csrf.response) return csrf.response;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const { sessionId } = await params;

  try {
    const existing = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: { group: { select: { instructorId: true, createdBy: true } } },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Mashg'ulot topilmadi." }, { status: 404 });
    }

    if (user.role === Role.instructor) {
      const isAuthorized =
        existing.createdById === user.userId ||
        existing.group.instructorId === user.userId ||
        existing.group.createdBy === user.userId;
      if (!isAuthorized) {
        return NextResponse.json(
          { success: false, error: "Siz faqat o'zingiz mas'ul bo'lgan guruhlar mashg'ulotini o'chira olasiz (IDOR himoyasi)." },
          { status: 403 }
        );
      }
    }

    await prisma.classSession.delete({ where: { id: sessionId } });
    return NextResponse.json({ success: true, message: "Mashg'ulot o'chirildi." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "O'chirishda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
