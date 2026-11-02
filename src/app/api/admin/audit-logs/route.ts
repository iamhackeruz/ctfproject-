import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { maskSensitiveData } from "@/lib/security/audit";
import { Role } from "@prisma/client";

// GET /api/admin/audit-logs — Xavfsizlik auditi jurnali (Faqat ADMIN)
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req, [Role.admin]);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
    const action = (searchParams.get("action") || "").trim();
    const userId = (searchParams.get("userId") || "").trim();
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: Record<string, unknown> = {};

    if (action) {
      where.action = { contains: action, mode: "insensitive" };
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      const createdAtFilter: Record<string, Date> = {};
      if (startDate) createdAtFilter.gte = new Date(startDate);
      if (endDate) createdAtFilter.lte = new Date(endDate);
      where.createdAt = createdAtFilter;
    }

    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
    ]);

    // Maxfiy ma'lumotlarni niqoblash (Masking)
    const formattedLogs = logs.map((log) => {
      let parsedDetails = null;
      if (log.details) {
        try {
          const parsed = JSON.parse(log.details);
          parsedDetails = maskSensitiveData(parsed);
        } catch {
          parsedDetails = log.details;
        }
      }

      return {
        id: log.id,
        userId: log.userId,
        userName: log.user?.name || "Tizim / Mehmon",
        userEmail: log.user?.email || "—",
        userRole: log.user?.role || "—",
        ip: log.ip,
        action: log.action,
        status: log.status,
        details: parsedDetails,
        createdAt: log.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      logs: formattedLogs,
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
