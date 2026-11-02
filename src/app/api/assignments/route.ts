import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { recordAuditLog } from "@/lib/security/audit";
import { Role, NotificationType, NotificationChannel } from "@prisma/client";
import { enqueueNotification } from "@/lib/notifications/notification-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const courseIdParam = searchParams.get("courseId");
    const groupIdParam = searchParams.get("groupId");
    const courseId = courseIdParam ? parseInt(courseIdParam, 10) : undefined;
    const groupId = groupIdParam || undefined;

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10))) : 20;
    const skip = (page - 1) * limit;

    const isStaff = user.role === Role.admin || user.role === Role.instructor;

    if (isStaff) {
      // Ustoz doirasi (Instructor Scoping): ustoz faqat o'zi mas'ul bo'lgan yoki yaratgan vazifalarni ko'radi
      const staffWhere: Record<string, unknown> = {
        ...(courseId && { courseId }),
        ...(groupId && { groupId }),
      };

      if (user.role === Role.instructor) {
        staffWhere.OR = [
          { createdById: user.userId },
          { group: { instructorId: user.userId } },
          { group: { createdBy: user.userId } },
        ];
      }

      const [total, assignments] = await Promise.all([
        prisma.assignment.count({ where: staffWhere }),
        prisma.assignment.findMany({
          where: staffWhere,
          include: {
            course: { select: { id: true, title: true } },
            group: { select: { id: true, name: true, instructorId: true } },
            lesson: { select: { id: true, title: true } },
            _count: {
              select: {
                submissions: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ]);

      return NextResponse.json({
        success: true,
        assignments,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    }

    // Talabalar uchun: faqat o'zlari a'zo bo'lgan guruhlar yoki kurslar bo'yicha e'lon qilingan vazifalar
    const userGroups = await prisma.groupMember.findMany({
      where: { userId: user.userId },
      select: { groupId: true },
    });
    const groupIds = userGroups.map((g) => g.groupId);

    const userEnrollments = await prisma.enrollment.findMany({
      where: { userId: user.userId },
      select: { courseId: true },
    });
    const courseIds = userEnrollments.map((e) => e.courseId);

    const assignments = await prisma.assignment.findMany({
      where: {
        isPublished: true,
        OR: [
          ...(groupIds.length > 0 ? [{ groupId: { in: groupIds } }] : []),
          ...(courseIds.length > 0 ? [{ courseId: { in: courseIds } }] : []),
        ],
      },
      include: {
        course: { select: { id: true, title: true } },
        group: { select: { id: true, name: true } },
        lesson: { select: { id: true, title: true } },
        extensions: {
          where: { userId: user.userId },
          select: { extendedDueAt: true, reason: true },
        },
        submissions: {
          where: { userId: user.userId },
          select: {
            id: true,
            status: true,
            score: true,
            isLate: true,
            submittedAt: true,
            gradedAt: true,
            instructorFeedback: true,
            version: true,
            fileName: true,
          },
        },
      },
      orderBy: { dueAt: "asc" },
    });

    const mapped = assignments.map((a) => {
      const activeSubmission = a.submissions[0] || null;
      const extension = a.extensions[0] || null;
      const effectiveDueAt = extension ? extension.extendedDueAt : a.dueAt;
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        dueAt: a.dueAt,
        effectiveDueAt,
        hasExtension: Boolean(extension),
        extensionReason: extension?.reason || null,
        maxScore: a.maxScore,
        allowFileUpload: a.allowFileUpload,
        allowedFileTypes: a.allowedFileTypes,
        allowLateSubmission: a.allowLateSubmission,
        latePenaltyPercent: a.latePenaltyPercent,
        course: a.course,
        group: a.group,
        lesson: a.lesson,
        mySubmission: activeSubmission,
      };
    });

    return NextResponse.json({ success: true, assignments: mapped });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Vazifalarni yuklashda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid && csrf.response) return csrf.response;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";

  try {
    const body = await req.json().catch(() => ({}));
    const {
      title,
      description,
      courseId,
      groupId,
      lessonId,
      dueAt,
      maxScore = 100,
      allowFileUpload = true,
      allowedFileTypes = "txt,md,pdf,zip,png,jpg,py,sh",
      isPublished = false,
      allowLateSubmission = false,
      latePenaltyPercent = 0,
    } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Vazifa sarlavhasi kiritilishi shart." },
        { status: 400 }
      );
    }

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { success: false, error: "Vazifa tavsifi kiritilishi shart." },
        { status: 400 }
      );
    }

    if (!dueAt || isNaN(new Date(dueAt).getTime())) {
      return NextResponse.json(
        { success: false, error: "Topshirish muddati (dueAt) to'g'ri ko'rsatilishi shart." },
        { status: 400 }
      );
    }

    // Ustoz doirasi (Instructor Scoping): guruh uchun vazifa yaratayotganda tekshirish
    if (groupId) {
      const targetGroup = await prisma.group.findUnique({
        where: { id: String(groupId) },
        select: { id: true, instructorId: true, createdBy: true },
      });
      if (!targetGroup) {
        return NextResponse.json({ success: false, error: "Guruh topilmadi." }, { status: 404 });
      }
      if (
        user.role === Role.instructor &&
        targetGroup.instructorId !== user.userId &&
        targetGroup.createdBy !== user.userId
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Siz faqat o'zingiz mas'ul bo'lgan guruhlar uchun vazifa yarata olasiz (IDOR himoyasi).",
          },
          { status: 403 }
        );
      }
    }

    const assignment = await prisma.assignment.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        courseId: courseId ? parseInt(String(courseId), 10) : null,
        groupId: groupId ? String(groupId) : null,
        lessonId: lessonId ? parseInt(String(lessonId), 10) : null,
        dueAt: new Date(dueAt),
        maxScore: Number(maxScore) || 100,
        allowFileUpload: Boolean(allowFileUpload),
        allowedFileTypes: String(allowedFileTypes || "txt,md,pdf,zip,png,jpg,py,sh"),
        isPublished: Boolean(isPublished),
        allowLateSubmission: Boolean(allowLateSubmission),
        latePenaltyPercent: Number(latePenaltyPercent) || 0,
        createdById: user.userId,
      },
    });

    await recordAuditLog({
      userId: user.userId,
      action: "ASSIGNMENT_CREATED",
      ip,
      details: { assignmentId: assignment.id, title: assignment.title },
    });

    // Agar vazifa birdaniga e'lon qilingan bo'lsa, tegishli talabalarga bildirishnoma yuborish
    if (assignment.isPublished) {
      void notifyStudentsAboutAssignment(assignment);
    }

    return NextResponse.json({ success: true, assignment });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Vazifa yaratishda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

async function notifyStudentsAboutAssignment(assignment: {
  id: string;
  title: string;
  groupId: string | null;
  courseId: number | null;
  dueAt: Date;
}) {
  try {
    const studentIds = new Set<string>();

    if (assignment.groupId) {
      const members = await prisma.groupMember.findMany({
        where: { groupId: assignment.groupId },
        select: { userId: true },
      });
      members.forEach((m) => studentIds.add(m.userId));
    }

    if (assignment.courseId) {
      const enrolled = await prisma.enrollment.findMany({
        where: { courseId: assignment.courseId },
        select: { userId: true },
      });
      enrolled.forEach((e) => studentIds.add(e.userId));
    }

    const formattedDate = assignment.dueAt.toLocaleString("uz-UZ");

    for (const sId of studentIds) {
      await enqueueNotification({
        userId: sId,
        type: NotificationType.ASSIGNMENT_NEW,
        channel: NotificationChannel.BOTH,
        title: "Yangi uy vazifasi e'lon qilindi",
        message: `"${assignment.title}" vazifasi e'lon qilindi. Topshirish muddati: ${formattedDate}.`,
      });
    }
  } catch (err) {
    console.error("[notifyStudentsAboutAssignment] Xatolik:", err);
  }
}
