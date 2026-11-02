import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { recordAuditLog } from "@/lib/security/audit";
import { Role, SubmissionStatus, NotificationType, NotificationChannel } from "@prisma/client";
import { enqueueNotification } from "@/lib/notifications/notification-service";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid && csrf.response) return csrf.response;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const { submissionId } = await params;

  try {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!submission) {
      return NextResponse.json({ success: false, error: "Topshiriq topilmadi." }, { status: 404 });
    }

    // Ustoz doirasi (Instructor Scoping) tekshiruvi: faqat o'z guruhining topshiriqlarini baholashi mumkin
    if (user.role === Role.instructor) {
      let isAuthorized = submission.assignment.createdById === user.userId;
      if (!isAuthorized && submission.assignment.groupId) {
        const grp = await prisma.group.findUnique({
          where: { id: submission.assignment.groupId },
          select: { instructorId: true, createdBy: true },
        });
        if (grp && (grp.instructorId === user.userId || grp.createdBy === user.userId)) {
          isAuthorized = true;
        }
      }
      if (!isAuthorized) {
        return NextResponse.json(
          { success: false, error: "Siz faqat o'zingiz mas'ul bo'lgan guruhlar topshiriqlarini baholay olasiz (IDOR himoyasi)." },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const { score, instructorFeedback, status = "GRADED" } = body;

    const newStatus: SubmissionStatus =
      status === "RETURNED" ? SubmissionStatus.RETURNED : SubmissionStatus.GRADED;

    let parsedScore: number | null = null;
    if (newStatus === SubmissionStatus.GRADED) {
      if (score === undefined || score === null || isNaN(Number(score))) {
        return NextResponse.json(
          { success: false, error: "Baholash uchun ball kiritilishi shart." },
          { status: 400 }
        );
      }
      parsedScore = Number(score);
      if (parsedScore < 0 || parsedScore > submission.assignment.maxScore) {
        return NextResponse.json(
          {
            success: false,
            error: `Ball 0 dan ${submission.assignment.maxScore} gacha bo'lishi kerak.`,
          },
          { status: 400 }
        );
      }
    }

    const now = new Date();
    const updated = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        score: parsedScore,
        instructorFeedback: instructorFeedback ? String(instructorFeedback).trim() : null,
        status: newStatus,
        gradedAt: now,
        gradedById: user.userId,
      },
    });

    // Audit log
    await recordAuditLog({
      userId: user.userId,
      action: newStatus === SubmissionStatus.RETURNED ? "ASSIGNMENT_RETURNED" : "ASSIGNMENT_GRADED",
      ip,
      details: {
        submissionId,
        studentId: submission.userId,
        assignmentId: submission.assignmentId,
        score: parsedScore,
        status: newStatus,
      },
    });

    // Talabaga bildirishnoma yuborish
    if (newStatus === SubmissionStatus.GRADED) {
      await enqueueNotification({
        userId: submission.userId,
        type: NotificationType.SUBMISSION_GRADED,
        channel: NotificationChannel.BOTH,
        title: "Topshirig'ingiz baholandi",
        message: `"${submission.assignment.title}" vazifasi baholandi. Sizning natijangiz: ${parsedScore} / ${submission.assignment.maxScore} ball.${instructorFeedback ? ` Ustoz izohi: ${instructorFeedback}` : ""}`,
      });
    } else {
      await enqueueNotification({
        userId: submission.userId,
        type: NotificationType.SUBMISSION_RETURNED,
        channel: NotificationChannel.BOTH,
        title: "Topshiriq qaytarildi",
        message: `Ustoz "${submission.assignment.title}" vazifangizni qayta ishlash uchun qaytardi.${instructorFeedback ? ` Izoh: ${instructorFeedback}` : ""}`,
      });
    }

    return NextResponse.json({ success: true, submission: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Baholashda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
