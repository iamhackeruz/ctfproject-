import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { Role, SubmissionStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const { id } = await params;

  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") as SubmissionStatus | null;
    const isLateParam = searchParams.get("isLate");
    const search = searchParams.get("search")?.trim() || "";
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10))) : 20;
    const skip = (page - 1) * limit;

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, title: true } },
        group: { select: { id: true, name: true, instructorId: true, createdBy: true } },
      },
    });

    if (!assignment) {
      return NextResponse.json({ success: false, error: "Vazifa topilmadi." }, { status: 404 });
    }

    // Ustoz doirasi (Instructor Scoping) tekshiruvi
    if (user.role === Role.instructor) {
      let isAuthorized = assignment.createdById === user.userId;
      if (!isAuthorized && assignment.group) {
        if (assignment.group.instructorId === user.userId || assignment.group.createdBy === user.userId) {
          isAuthorized = true;
        }
      }
      if (!isAuthorized) {
        return NextResponse.json(
          { success: false, error: "Siz faqat o'zingiz mas'ul bo'lgan guruhlar topshiriqlarini ko'ra olasiz (IDOR himoyasi)." },
          { status: 403 }
        );
      }
    }

    const where: Prisma.SubmissionWhereInput = {
      assignmentId: id,
      ...(statusParam && { status: statusParam as SubmissionStatus }),
      ...(isLateParam !== null && isLateParam !== undefined && { isLate: isLateParam === "true" }),
      ...(search
        ? {
            user: {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };

    const [total, submissions] = await Promise.all([
      prisma.submission.count({ where }),
      prisma.submission.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              avatar: true,
              groupMemberships: {
                include: { group: { select: { id: true, name: true } } },
              },
            },
          },
          grader: {
            select: { id: true, name: true },
          },
          history: {
            orderBy: { version: "desc" },
          },
        },
        orderBy: { submittedAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      assignment,
      submissions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Topshiriqlarni yuklashda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
