import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Formula Injection (CSV Injection) himoyasi:
 * Agar matn '=', '+', '-', '@', '\t', '\r' bilan boshlansa, uni bitta tirnoq (') bilan himoyalaymiz.
 */
function safeCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = String(value).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return NextResponse.json({ success: false, error: "Vazifa topilmadi." }, { status: 404 });
    }

    const submissions = await prisma.submission.findMany({
      where: { assignmentId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            groupMemberships: {
              include: { group: { select: { name: true } } },
            },
          },
        },
        grader: {
          select: { name: true },
        },
      },
      orderBy: { submittedAt: "asc" },
    });

    const headers = [
      "Topshiriq ID",
      "Talaba Ismi",
      "Email",
      "Guruh",
      "Topshirilgan Vaqt",
      "Kechikkan",
      "Holat",
      "Ball",
      "Maksimal Ball",
      "Baholagan Ustoz",
      "Ustoz Izohi",
    ];

    const rows = submissions.map((s) => {
      const groups = s.user.groupMemberships.map((m) => m.group.name).join(", ");
      return [
        s.id,
        s.user.name,
        s.user.email,
        groups || "-",
        s.submittedAt.toISOString(),
        s.isLate ? "Ha" : "Yo'q",
        s.status,
        s.score !== null ? s.score : "-",
        assignment.maxScore,
        s.grader?.name || "-",
        s.instructorFeedback || "-",
      ];
    });

    const csvContent =
      "\uFEFF" + // UTF-8 BOM
      [headers.map(safeCell).join(",")]
        .concat(rows.map((row) => row.map(safeCell).join(",")))
        .join("\r\n");

    const safeTitle = assignment.title.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 30);
    const filename = `baholar_${safeTitle}_${Date.now()}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "CSV eksportda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
