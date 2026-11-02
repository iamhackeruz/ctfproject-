import { prisma } from "../db";
import { NotificationType, NotificationChannel, Role } from "@prisma/client";
import { enqueueNotification } from "../notifications/notification-service";
import { pruneUnverifiedAccounts } from "../services/email-verification";

export interface ReminderProcessResult {
  due24hSent: number;
  due2hSent: number;
  expiringEntitlementsSent: number;
  skippedDuplicates: number;
  unverifiedPruned?: number;
}

/**
 * Muddat eslatmalarini tekshirish va yuborish (Idempotent fon vazifasi).
 * - Vazifa muddatiga 24 soat qolganda
 * - Vazifa muddatiga 2 soat qolganda
 * - Premium / Huquq muddati tugashiga 3 kun qolganda
 * Har bir eslatma unikal `dedupKey` ga ega bo'lib, qayta ishga tushganda yoki server qayta yuklanganda dublikat yaratmaydi.
 */
export async function processReminders(): Promise<ReminderProcessResult> {
  const now = new Date();
  const nowMs = now.getTime();
  let due24hSent = 0;
  let due2hSent = 0;
  let expiringEntitlementsSent = 0;
  let skippedDuplicates = 0;

  // ── 1. VAZIFA MUDDATLARI ESLATMALARI (24 soat va 2 soat) ──────────────────
  // Hozirdan 24 soat keyingi vaqt oralig'idagi barcha e'lon qilingan vazifalar
  const in24Hours = new Date(nowMs + 24 * 60 * 60 * 1000);

  const upcomingAssignments = await prisma.assignment.findMany({
    where: {
      isPublished: true,
      dueAt: {
        gt: now,
        lte: in24Hours,
      },
    },
    include: {
      group: {
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, role: true },
              },
            },
          },
        },
      },
      submissions: {
        select: { userId: true, status: true },
      },
    },
  });

  for (const assignment of upcomingAssignments) {
    const dueMs = assignment.dueAt.getTime();
    const msRemaining = dueMs - nowMs;
    const isUnder2Hours = msRemaining <= 2 * 60 * 60 * 1000; // <= 2 soat
    const isUnder24Hours = msRemaining <= 24 * 60 * 60 * 1000; // <= 24 soat

    // Ushbu vazifaga daxldor talabalar ro'yxati (faqat student roli)
    const students = (assignment.group?.members || [])
      .map((m) => m.user)
      .filter((u) => u.role === Role.student);

    // Allaqachon topshirgan talabalar (SUBMITTED yoki GRADED)
    const submittedUserIds = new Set(
      assignment.submissions
        .filter((s) => s.status === "SUBMITTED" || s.status === "GRADED")
        .map((s) => s.userId)
    );

    for (const student of students) {
      if (submittedUserIds.has(student.id)) {
        // Talaba allaqachon topshirgan bo'lsa, eslatma yuborilmaydi
        continue;
      }

      const dueFormatted = assignment.dueAt.toLocaleString("uz-UZ", {
        timeZone: "Asia/Tashkent",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // A) 2 soatlik eslatma
      if (isUnder2Hours) {
        const dedupKey = `reminder:assignment:${assignment.id}:due2h:${student.id}`;
        const existing = await prisma.notification.findUnique({
          where: { dedupKey },
        });

        if (!existing) {
          try {
            await enqueueNotification({
              userId: student.id,
              type: NotificationType.ASSIGNMENT_DUE_SOON,
              channel: NotificationChannel.BOTH,
              title: "Shoshiling: Vazifa muddatiga 2 soat qoldi!",
              message: `"${assignment.title}" topshirig'ini yakunlashga 2 soatdan kam vaqt qoldi. Muddat: ${dueFormatted}. Kechikmasdan topshiring!`,
              dedupKey,
            });
            due2hSent++;
          } catch {
            skippedDuplicates++;
          }
        } else {
          skippedDuplicates++;
        }
      }
      // B) 24 soatlik eslatma (faqat 2 soatdan ko'p vaqt bo'lsa)
      else if (isUnder24Hours) {
        const dedupKey = `reminder:assignment:${assignment.id}:due24h:${student.id}`;
        const existing = await prisma.notification.findUnique({
          where: { dedupKey },
        });

        if (!existing) {
          try {
            await enqueueNotification({
              userId: student.id,
              type: NotificationType.ASSIGNMENT_DUE_SOON,
              channel: NotificationChannel.BOTH,
              title: "Topshiriq muddati oz qoldi (24 soat)",
              message: `"${assignment.title}" vazifasini topshirish muddatiga 24 soat qoldi. Muddat: ${dueFormatted}.`,
              dedupKey,
            });
            due24hSent++;
          } catch {
            skippedDuplicates++;
          }
        } else {
          skippedDuplicates++;
        }
      }
    }
  }

  // ── 2. PREMIUM HUQUQ TUGASH ESLATMALARI (3 kun qolganda) ─────────────────
  const in3Days = new Date(nowMs + 3 * 24 * 60 * 60 * 1000);

  // UserEntitlement bo'yicha
  const expiringUserEntitlements = await prisma.entitlement.findMany({
    where: {
      revokedAt: null,
      endsAt: {
        gt: now,
        lte: in3Days,
      },
    },
    include: {
      course: { select: { title: true } },
    },
  });

  for (const ent of expiringUserEntitlements) {
    if (!ent.userId || !ent.endsAt) continue;

    const dedupKey = `reminder:entitlement:${ent.id}:expiring3d:${ent.userId}`;
    const existing = await prisma.notification.findUnique({
      where: { dedupKey },
    });

    if (!existing) {
      const expFormatted = ent.endsAt.toLocaleDateString("uz-UZ", {
        timeZone: "Asia/Tashkent",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const courseTitle = ent.course?.title ? `"${ent.course.title}" kursi uchun ` : "";

      try {
        await enqueueNotification({
          userId: ent.userId,
          type: NotificationType.ENTITLEMENT_EXPIRING,
          channel: NotificationChannel.BOTH,
          title: "Obuna muddati tugamoqda (3 kun qoldi)",
          message: `Sizning CyberEdu platformasidagi ${courseTitle}kirish huquqingiz muddati 3 kundan so'ng (${expFormatted}) tugaydi. Davom ettirish uchun ta'lim administratoriga murojaat qiling.`,
          dedupKey,
        });
        expiringEntitlementsSent++;
      } catch {
        skippedDuplicates++;
      }
    } else {
      skippedDuplicates++;
    }
  }

  // GroupCourse bo'yicha (guruh muddati tugayotgan bo'lsa)
  const expiringGroupCourses = await prisma.groupCourse.findMany({
    where: {
      endsAt: {
        gt: now,
        lte: in3Days,
      },
    },
    include: {
      group: {
        include: {
          members: {
            include: { user: { select: { id: true, role: true } } },
          },
        },
      },
      course: { select: { title: true } },
    },
  });

  for (const gc of expiringGroupCourses) {
    if (!gc.endsAt) continue;
    const expFormatted = gc.endsAt.toLocaleDateString("uz-UZ", {
      timeZone: "Asia/Tashkent",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    for (const member of gc.group.members) {
      if (member.user.role !== Role.student) continue;

      const dedupKey = `reminder:groupcourse:${gc.id}:expiring3d:${member.user.id}`;
      const existing = await prisma.notification.findUnique({
        where: { dedupKey },
      });

      if (!existing) {
        try {
          await enqueueNotification({
            userId: member.user.id,
            type: NotificationType.ENTITLEMENT_EXPIRING,
            channel: NotificationChannel.BOTH,
            title: "Guruh kursi muddati tugamoqda (3 kun qoldi)",
            message: `"${gc.group.name}" guruhingiz uchun "${gc.course.title}" kursiga kirish muddati 3 kundan keyin (${expFormatted}) tugaydi.`,
            dedupKey,
          });
          expiringEntitlementsSent++;
        } catch {
          skippedDuplicates++;
        }
      } else {
        skippedDuplicates++;
      }
    }
  }

  // ── 3. 7 KUNDAN OSHGAN TASDIQLANMAGAN HISOBLARNI TOZALASH ───────────────
  let unverifiedPruned = 0;
  try {
    unverifiedPruned = await pruneUnverifiedAccounts();
  } catch (err) {
    console.error("[PRUNING XATOSI]", err);
  }

  return {
    due24hSent,
    due2hSent,
    expiringEntitlementsSent,
    skippedDuplicates,
    unverifiedPruned,
  };
}
