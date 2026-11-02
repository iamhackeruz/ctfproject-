import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { canAccess } from "@/lib/security/entitlements";
import { recordAuditLog } from "@/lib/security/audit";
import { Role, NotificationType, NotificationChannel } from "@prisma/client";
import { attachmentStorage } from "@/lib/storage/attachment-storage";
import { enqueueNotification } from "@/lib/notifications/notification-service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const { id } = await params;

  try {
    const access = await canAccess(user ? { id: user.userId, role: user.role } : null, {
      type: "assignment",
      assignmentId: id,
    });

    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: access.reason || "Ushbu vazifaga kirish huquqingiz yo'q." },
        { status: access.statusCode || 403 }
      );
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, title: true } },
        group: { select: { id: true, name: true } },
        lesson: { select: { id: true, title: true } },
      },
    });

    if (!assignment) {
      return NextResponse.json({ success: false, error: "Vazifa topilmadi." }, { status: 404 });
    }

    const isStaff = user.role === Role.admin || user.role === Role.instructor;

    if (isStaff) {
      // Ustoz doirasi (Instructor Scoping)
      if (user.role === Role.instructor) {
        let isAuthorized = assignment.createdById === user.userId;
        if (!isAuthorized && assignment.groupId) {
          const grp = await prisma.group.findUnique({
            where: { id: assignment.groupId },
            select: { instructorId: true, createdBy: true },
          });
          if (grp && (grp.instructorId === user.userId || grp.createdBy === user.userId)) {
            isAuthorized = true;
          }
        }
        if (!isAuthorized) {
          return NextResponse.json(
            { success: false, error: "Siz faqat o'zingiz mas'ul bo'lgan guruhlar vazifasini ko'ra olasiz (IDOR himoyasi)." },
            { status: 403 }
          );
        }
      }

      const stats = await prisma.submission.groupBy({
        by: ["status"],
        where: { assignmentId: id },
        _count: { _all: true },
      });

      const lateCount = await prisma.submission.count({
        where: { assignmentId: id, isLate: true },
      });

      return NextResponse.json({
        success: true,
        assignment,
        stats: {
          byStatus: stats,
          lateCount,
        },
      });
    }

    // Talaba uchun: o'zining topshirishi, uzaytirish (agar mavjud bo'lsa) va versiyalar tarixi
    const extension = await prisma.assignmentExtension.findUnique({
      where: {
        assignmentId_userId: {
          assignmentId: id,
          userId: user.userId,
        },
      },
    });

    const submission = await prisma.submission.findUnique({
      where: {
        assignmentId_userId: {
          assignmentId: id,
          userId: user.userId,
        },
      },
      include: {
        history: {
          orderBy: { version: "desc" },
        },
      },
    });

    const effectiveDueAt = extension ? extension.extendedDueAt : assignment.dueAt;

    return NextResponse.json({
      success: true,
      assignment: {
        ...assignment,
        effectiveDueAt,
        hasExtension: Boolean(extension),
        extensionReason: extension?.reason || null,
      },
      submission,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Vazifani yuklashda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid && csrf.response) return csrf.response;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const { id } = await params;

  try {
    const existing = await prisma.assignment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Vazifa topilmadi." }, { status: 404 });
    }

    // Ustoz doirasi (Instructor Scoping) tekshiruvi
    if (user.role === Role.instructor) {
      let isAuthorized = existing.createdById === user.userId;
      if (!isAuthorized && existing.groupId) {
        const grp = await prisma.group.findUnique({
          where: { id: existing.groupId },
          select: { instructorId: true, createdBy: true },
        });
        if (grp && (grp.instructorId === user.userId || grp.createdBy === user.userId)) {
          isAuthorized = true;
        }
      }
      if (!isAuthorized) {
        return NextResponse.json(
          { success: false, error: "Siz faqat o'zingiz mas'ul bo'lgan guruhlar vazifalarini o'chira olasiz (IDOR himoyasi)." },
          { status: 403 }
        );
      }
    }

    // Ustoz doirasi (Instructor Scoping) tekshiruvi
    if (user.role === Role.instructor) {
      let isAuthorized = existing.createdById === user.userId;
      if (!isAuthorized && existing.groupId) {
        const grp = await prisma.group.findUnique({
          where: { id: existing.groupId },
          select: { instructorId: true, createdBy: true },
        });
        if (grp && (grp.instructorId === user.userId || grp.createdBy === user.userId)) {
          isAuthorized = true;
        }
      }
      if (!isAuthorized) {
        return NextResponse.json(
          { success: false, error: "Siz faqat o'zingiz mas'ul bo'lgan guruhlar vazifalarini tahrirlay olasiz (IDOR himoyasi)." },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const {
      title,
      description,
      courseId,
      groupId,
      lessonId,
      dueAt,
      maxScore,
      allowFileUpload,
      allowedFileTypes,
      isPublished,
      allowLateSubmission,
      latePenaltyPercent,
    } = body;

    const updated = await prisma.assignment.update({
      where: { id },
      data: {
        ...(title && { title: String(title).trim() }),
        ...(description && { description: String(description).trim() }),
        ...(courseId !== undefined && { courseId: courseId ? parseInt(String(courseId), 10) : null }),
        ...(groupId !== undefined && { groupId: groupId ? String(groupId) : null }),
        ...(lessonId !== undefined && { lessonId: lessonId ? parseInt(String(lessonId), 10) : null }),
        ...(dueAt && { dueAt: new Date(dueAt) }),
        ...(maxScore !== undefined && { maxScore: Number(maxScore) }),
        ...(allowFileUpload !== undefined && { allowFileUpload: Boolean(allowFileUpload) }),
        ...(allowedFileTypes !== undefined && { allowedFileTypes: String(allowedFileTypes) }),
        ...(isPublished !== undefined && { isPublished: Boolean(isPublished) }),
        ...(allowLateSubmission !== undefined && { allowLateSubmission: Boolean(allowLateSubmission) }),
        ...(latePenaltyPercent !== undefined && { latePenaltyPercent: Number(latePenaltyPercent) }),
      },
    });

    await recordAuditLog({
      userId: user.userId,
      action: "ASSIGNMENT_UPDATED",
      ip,
      details: { assignmentId: id, title: updated.title },
    });

    // Agar endi e'lon qilingan bo'lsa (avval qoralama edi)
    if (!existing.isPublished && updated.isPublished) {
      void notifyStudentsAboutAssignment(updated);
    }

    return NextResponse.json({ success: true, assignment: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Vazifani tahrirlashda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid && csrf.response) return csrf.response;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const { id } = await params;

  try {
    const existing = await prisma.assignment.findUnique({
      where: { id },
      include: {
        submissions: { select: { fileKey: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Vazifa topilmadi." }, { status: 404 });
    }

    // Ustoz doirasi (Instructor Scoping) tekshiruvi
    if (user.role === Role.instructor) {
      let isAuthorized = existing.createdById === user.userId;
      if (!isAuthorized && existing.groupId) {
        const grp = await prisma.group.findUnique({
          where: { id: existing.groupId },
          select: { instructorId: true, createdBy: true },
        });
        if (grp && (grp.instructorId === user.userId || grp.createdBy === user.userId)) {
          isAuthorized = true;
        }
      }
      if (!isAuthorized) {
        return NextResponse.json(
          { success: false, error: "Siz faqat o'zingiz mas'ul bo'lgan guruhlar vazifalarini o'chira olasiz (IDOR himoyasi)." },
          { status: 403 }
        );
      }
    }

    // Topshiriqlarga tegishli fayllarni diskdan o'chirish
    for (const sub of existing.submissions) {
      if (sub.fileKey) {
        await attachmentStorage.delete(sub.fileKey).catch(() => null);
      }
    }

    await prisma.assignment.delete({ where: { id } });

    await recordAuditLog({
      userId: user.userId,
      action: "ASSIGNMENT_DELETED",
      ip,
      details: { assignmentId: id, title: existing.title },
    });

    return NextResponse.json({ success: true, message: "Vazifa muvaffaqiyatli o'chirildi." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Vazifani o'chirishda xatolik";
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
