import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { canAccess } from "@/lib/security/entitlements";
import { recordAuditLog } from "@/lib/security/audit";
import {
  validateAttachment,
  generateAttachmentKey,
  attachmentStorage,
} from "@/lib/storage/attachment-storage";
import { enqueueNotification } from "@/lib/notifications/notification-service";
import { NotificationType, NotificationChannel } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid && csrf.response) return csrf.response;

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const { id } = await params;

  try {
    // 1. Kirish huquqini tekshirish (Entitlements / canAccess)
    const access = await canAccess(user ? { id: user.userId, role: user.role } : null, {
      type: "assignment",
      assignmentId: id,
    });

    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: access.reason || "Vazifaga kirish huquqingiz yo'q." },
        { status: access.statusCode || 403 }
      );
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return NextResponse.json({ success: false, error: "Vazifa topilmadi." }, { status: 404 });
    }

    // 2. Muddat va kechikishni tekshirish
    const extension = await prisma.assignmentExtension.findUnique({
      where: {
        assignmentId_userId: {
          assignmentId: id,
          userId: user.userId,
        },
      },
    });

    const effectiveDueAt = extension ? extension.extendedDueAt : assignment.dueAt;
    const now = new Date();
    const isPastDue = now > effectiveDueAt;

    if (isPastDue && !assignment.allowLateSubmission) {
      return NextResponse.json(
        {
          success: false,
          error: "Topshirish muddati o'tgan va kech topshirishga ruxsat berilmagan.",
        },
        { status: 400 }
      );
    }

    const isLate = isPastDue;

    // 3. So'rov ma'lumotlarini qabul qilish (Multipart form-data yoki JSON)
    const contentType = req.headers.get("content-type") || "";
    let textContent: string | null = null;
    let uploadedFileKey: string | null = null;
    let uploadedFileName: string | null = null;
    let uploadedFileSize: number | null = null;
    let uploadedMimeType: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const rawText = formData.get("textContent");
      if (typeof rawText === "string" && rawText.trim().length > 0) {
        textContent = rawText.trim();
      }

      const file = formData.get("file");
      if (file && typeof file === "object" && "arrayBuffer" in file && (file as File).size > 0) {
        const fileObj = file as File;

        if (!assignment.allowFileUpload) {
          return NextResponse.json(
            { success: false, error: "Ushbu vazifada fayl yuklash o'chirilgan." },
            { status: 400 }
          );
        }

        const buffer = Buffer.from(await fileObj.arrayBuffer());
        const allowedList = assignment.allowedFileTypes
          ? assignment.allowedFileTypes.split(",").map((t) => t.trim())
          : ["txt", "md", "pdf", "zip", "png", "jpg", "jpeg", "py", "sh"];

        const validation = validateAttachment(buffer, fileObj.name, allowedList);
        if (!validation.valid) {
          return NextResponse.json(
            { success: false, error: validation.reason || "Fayl formati noto'g'ri." },
            { status: 400 }
          );
        }

        const fileKey = generateAttachmentKey(validation.detectedExt || "bin");
        await attachmentStorage.putBuffer(fileKey, buffer);

        uploadedFileKey = fileKey;
        uploadedFileName = fileObj.name;
        uploadedFileSize = buffer.length;
        uploadedMimeType = validation.detectedMime || fileObj.type || "application/octet-stream";
      }
    } else {
      // JSON orqali topshirish
      const body = await req.json().catch(() => ({}));
      if (typeof body.textContent === "string" && body.textContent.trim().length > 0) {
        textContent = body.textContent.trim();
      }
    }

    if (!textContent && !uploadedFileKey) {
      return NextResponse.json(
        { success: false, error: "Javob matni yoki biriktirilgan fayl kiritilishi shart." },
        { status: 400 }
      );
    }

    // 4. Avvalgi topshirishni tekshirish va versiyalash
    const existingSubmission = await prisma.submission.findUnique({
      where: {
        assignmentId_userId: {
          assignmentId: id,
          userId: user.userId,
        },
      },
    });

    let submission;

    if (existingSubmission) {
      // Avvalgi versiyani tarixga saqlash
      await prisma.submissionHistory.create({
        data: {
          submissionId: existingSubmission.id,
          version: existingSubmission.version,
          textContent: existingSubmission.textContent,
          fileKey: existingSubmission.fileKey,
          fileName: existingSubmission.fileName,
          fileSize: existingSubmission.fileSize,
          mimeType: existingSubmission.mimeType,
          submittedAt: existingSubmission.submittedAt,
          isLate: existingSubmission.isLate,
          score: existingSubmission.score,
          instructorFeedback: existingSubmission.instructorFeedback,
        },
      });

      // Mavjud topshirishni yangilash
      submission = await prisma.submission.update({
        where: { id: existingSubmission.id },
        data: {
          version: existingSubmission.version + 1,
          textContent: textContent ?? existingSubmission.textContent,
          fileKey: uploadedFileKey ?? existingSubmission.fileKey,
          fileName: uploadedFileName ?? existingSubmission.fileName,
          fileSize: uploadedFileSize ?? existingSubmission.fileSize,
          mimeType: uploadedMimeType ?? existingSubmission.mimeType,
          submittedAt: now,
          isLate,
          status: "SUBMITTED",
          score: null, // Qayta topshirilganda baho yangilanadi
          instructorFeedback: null,
          gradedAt: null,
          gradedById: null,
        },
      });
    } else {
      // Yangi topshirish yaratish
      submission = await prisma.submission.create({
        data: {
          assignmentId: id,
          userId: user.userId,
          textContent,
          fileKey: uploadedFileKey,
          fileName: uploadedFileName,
          fileSize: uploadedFileSize,
          mimeType: uploadedMimeType,
          submittedAt: now,
          isLate,
          status: "SUBMITTED",
          version: 1,
        },
      });
    }

    // 5. Audit log yozish
    await recordAuditLog({
      userId: user.userId,
      action: "ASSIGNMENT_SUBMITTED",
      ip,
      details: {
        assignmentId: id,
        submissionId: submission.id,
        isLate,
        version: submission.version,
        hasFile: Boolean(submission.fileKey),
      },
    });

    // 6. Ustozga bildirishnoma yuborish
    if (assignment.createdById) {
      await enqueueNotification({
        userId: assignment.createdById,
        type: NotificationType.SUBMISSION_NEW,
        channel: NotificationChannel.BOTH,
        title: "Yangi vazifa topshirildi",
        message: `${user.name} talaba "${assignment.title}" vazifasini topshirdi.${isLate ? " (Kechikkan)" : ""}`,
      });
    }

    return NextResponse.json({ success: true, submission });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Topshiriqni yuborishda xatolik";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
