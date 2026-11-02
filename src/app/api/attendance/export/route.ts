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

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");

    if (!groupId) {
      return NextResponse.json({ success: false, error: "groupId parametri kiritilishi shart." }, { status: 400 });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ success: false, error: "Guruh topilmadi." }, { status: 404 });
    }

    // Ustoz doirasi tekshiruvi (IDOR)
    if (user.role === Role.instructor) {
      const isAuthorized = group.instructorId === user.userId || group.createdBy === user.userId;
      if (!isAuthorized) {
        return NextResponse.json(
          { success: false, error: "Siz faqat o'zingiz mas'ul bo'lgan guruhlar davomatini eksport qila olasiz (IDOR himoyasi)." },
          { status: 403 }
        );
      }
    }

    const sessions = await prisma.classSession.findMany({
      where: { groupId },
      include: { records: true },
    });

    const totalSessions = sessions.length;

    const headers = [
      "Talaba Ismi",
      "Email",
      "Telefon",
      "Guruh",
      "Umumiy Mashg'ulotlar",
      "Qatnashdi (PRESENT)",
      "Qoldirdi (ABSENT)",
      "Kechikdi (LATE)",
      "Sababli (EXCUSED)",
      "Davomat Foizi (%)",
      "Holat",
    ];

    const rows = group.members.map((m) => {
      let present = 0;
      let absent = 0;
      let late = 0;
      let excused = 0;

      for (const s of sessions) {
        const rec = s.records.find((r) => r.userId === m.userId);
        if (rec) {
          if (rec.status === "PRESENT") present++;
          else if (rec.status === "ABSENT") absent++;
          else if (rec.status === "LATE") late++;
          else if (rec.status === "EXCUSED") excused++;
        } else {
          absent++;
        }
      }

      const percentage = totalSessions > 0
        ? Math.round(((present + late * 0.8) / totalSessions) * 100)
        : 100;
      const statusText = absent >= 3 ? "Xavf ostida (3+ dars qoldirilgan)" : "Qoniqarli";

      return [
        m.user.name,
        m.user.email,
        m.user.phone || "-",
        group.name,
        totalSessions,
        present,
        absent,
        late,
        excused,
        `${percentage}%`,
        statusText,
      ];
    });

    const csvContent =
      "\uFEFF" +
      [headers.map(safeCell).join(",")]
        .concat(rows.map((row) => row.map(safeCell).join(",")))
        .join("\r\n");

    const safeGroupName = group.name.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 30);
    const filename = `davomat_${safeGroupName}_${Date.now()}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Davomat eksportida xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
