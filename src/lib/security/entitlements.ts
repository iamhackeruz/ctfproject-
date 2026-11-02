import { prisma } from "../db";
import { Role, AccessType, EntitlementType } from "@prisma/client";

export type ResourceTarget =
  | { type: "course"; courseId: number }
  | { type: "lesson"; lessonId: number; courseId?: number }
  | { type: "quiz"; lessonId: number; courseId?: number }
  | { type: "lab"; labId: string }
  | { type: "certificate"; courseId: number }
  | { type: "assignment"; assignmentId: string };

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  statusCode?: number;
  requiresPremium?: boolean;
  requiresPurchase?: boolean;
  isFreePreview?: boolean;
}

export interface UserActiveEntitlements {
  hasSubscriptionOrGrant: boolean;
  courseIds: Set<number>;
}

/**
 * N+1 so'rovlarni oldini olish uchun foydalanuvchining barcha faol huquqlarini 1 ta so'rovda olish.
 */
export async function getUserActiveEntitlements(userId: string): Promise<UserActiveEntitlements> {
  const now = new Date();
  const entitlements = await prisma.entitlement.findMany({
    where: {
      userId,
      revokedAt: null,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    },
    select: {
      type: true,
      courseId: true,
    },
  });

  const courseIds = new Set<number>();
  let hasSubscriptionOrGrant = false;

  for (const e of entitlements) {
    if (e.type === EntitlementType.SUBSCRIPTION || e.type === EntitlementType.GRANT) {
      hasSubscriptionOrGrant = true;
    }
    if (e.courseId) {
      courseIds.add(e.courseId);
    }
  }

  return { hasSubscriptionOrGrant, courseIds };
}

/**
 * Xotiradagi (in-memory) tezkor kurs huquqini tekshirish
 */
export function evaluateCourseAccess(
  course: { id: number; accessType: AccessType; isPublished: boolean; priceUzs?: number },
  user: { id: string; role: Role; isBlocked?: boolean } | null,
  userEntitlements?: UserActiveEntitlements | null
): AccessCheckResult {
  if (user && (user.role === Role.admin || user.role === Role.instructor)) {
    return { allowed: true };
  }

  if (user && user.isBlocked) {
    return {
      allowed: false,
      reason: "Hisobingiz administrator tomonidan bloklangan.",
      statusCode: 403,
    };
  }

  if (!course.isPublished && (!user || (user.role !== Role.admin && user.role !== Role.instructor))) {
    return { allowed: false, reason: "Kurs hozirda mavjud emas yoki qoralama holatida.", statusCode: 404 };
  }

  if (course.accessType === AccessType.FREE) {
    return { allowed: true };
  }

  if (!user) {
    return {
      allowed: false,
      reason: "Ushbu kursni ko'rish uchun avtorizatsiyadan o'ting.",
      statusCode: 401,
    };
  }

  const hasSub = userEntitlements?.hasSubscriptionOrGrant ?? false;
  const hasCourse = userEntitlements?.courseIds.has(course.id) ?? false;

  if (course.accessType === AccessType.PREMIUM) {
    if (hasSub || hasCourse) return { allowed: true };
    return {
      allowed: false,
      reason: "Ushbu kursdan foydalanish uchun Premium obuna talab etiladi.",
      statusCode: 403,
      requiresPremium: true,
    };
  }

  if (course.accessType === AccessType.PAID_COURSE) {
    if (hasSub || hasCourse) return { allowed: true };
    return {
      allowed: false,
      reason: `Ushbu kurs pullik (${course.priceUzs ? course.priceUzs.toLocaleString() : "0"} so'm). Kirish huquqi talab etiladi.`,
      statusCode: 403,
      requiresPurchase: true,
    };
  }

  return { allowed: false, statusCode: 403 };
}

/**
 * Xotiradagi (in-memory) tezkor dars huquqini tekshirish (N+1 muammosini yo'q qiladi)
 */
export function evaluateLessonAccess(
  lesson: { id: number; accessType: AccessType; isFree: boolean; isPublished: boolean },
  course: { id: number; accessType: AccessType; isPublished: boolean; priceUzs?: number },
  user: { id: string; role: Role; isBlocked?: boolean } | null,
  userEntitlements?: UserActiveEntitlements | null
): AccessCheckResult {
  if (user && (user.role === Role.admin || user.role === Role.instructor)) {
    return { allowed: true };
  }

  if (user && user.isBlocked) {
    return {
      allowed: false,
      reason: "Hisobingiz administrator tomonidan bloklangan.",
      statusCode: 403,
    };
  }

  if (!lesson.isPublished && (!user || (user.role !== Role.admin && user.role !== Role.instructor))) {
    return { allowed: false, reason: "Dars hozirda qoralama holatida.", statusCode: 404 };
  }

  if (lesson.isFree) {
    if (!user) {
      return { allowed: false, reason: "Darsni ko'rish uchun tizimga kiring.", statusCode: 401 };
    }
    return { allowed: true, isFreePreview: true };
  }

  if (!user) {
    return {
      allowed: false,
      reason: "Darsni ko'rish uchun tizimga kiring.",
      statusCode: 401,
    };
  }

  const courseAccess = evaluateCourseAccess(course, user, userEntitlements);
  if (!courseAccess.allowed) {
    return courseAccess;
  }

  if (lesson.accessType === AccessType.PREMIUM) {
    if (userEntitlements?.hasSubscriptionOrGrant) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: "Ushbu darsdan foydalanish uchun Premium obuna talab etiladi.",
      statusCode: 403,
      requiresPremium: true,
    };
  }

  return { allowed: true };
}

/**
 * Server markaziy darvozaboni (Central Server Gatekeeper):
 * Har bir so'rov vaqtida huquqlar (Entitlements) bazadan dinamik tekshiriladi.
 * 
 * Qoidalar:
 * 1. Admin va Instructor har doim to'liq kirish huquqiga ega.
 * 2. Bloklangan foydalanuvchilar (isBlocked=true) darhol rad etiladi (403).
 * 3. Bepul (FREE) kurs va darslar — tizimga kirgan barcha talabalarga ochiq.
 * 4. Premium (PREMIUM) kurs, dars yoki lab — faol SUBSCRIPTION yoki GRANT huquqini talab qiladi.
 * 5. Pullik kurs (PAID_COURSE) — kursga xarid/biriktirish (COURSE yoki GROUP) huquqini talab qiladi.
 * 6. Pullik kurs ichidagi isFree=true bo'lgan dars (Bepul namuna / preview) — ro'yxatdan o'tgan talabaga ochiq.
 * 7. Guruh a'zoligi orqali berilgan huquq (GROUP) — faqat revokedAt=null va muddati o'tmagan bo'lsa amal qiladi.
 * 8. Mehmonlar (user=null) faqat umumiy sillabus/tavsifni ko'ra oladi, kontent va amallardan 401 bilan qaytariladi.
 */
export async function canAccess(
  user: { id: string; role: Role; isBlocked?: boolean } | null,
  resource: ResourceTarget
): Promise<AccessCheckResult> {
  // 1. Staff (admin, instructor) har doim to'liq kirish huquqiga ega
  if (user && (user.role === Role.admin || user.role === Role.instructor)) {
    return { allowed: true };
  }

  // 2. Bloklangan foydalanuvchi darhol rad etiladi
  if (user && user.isBlocked) {
    return {
      allowed: false,
      reason: "Hisobingiz administrator tomonidan bloklangan.",
      statusCode: 403,
    };
  }

  switch (resource.type) {
    case "course": {
      const course = await prisma.course.findUnique({
        where: { id: resource.courseId },
        select: { id: true, accessType: true, priceUzs: true, isPublished: true },
      });

      if (!course) {
        return { allowed: false, reason: "Kurs topilmadi.", statusCode: 404 };
      }

      const userEntitlements = user ? await getUserActiveEntitlements(user.id) : null;
      return evaluateCourseAccess(course, user, userEntitlements);
    }

    case "lesson": {
      const lesson = await prisma.lesson.findUnique({
        where: { id: resource.lessonId },
        select: {
          id: true,
          accessType: true,
          isFree: true,
          isPublished: true,
          module: {
            select: {
              courseId: true,
              course: {
                select: { id: true, accessType: true, priceUzs: true, isPublished: true },
              },
            },
          },
        },
      });

      if (!lesson) {
        return { allowed: false, reason: "Dars topilmadi.", statusCode: 404 };
      }

      const userEntitlements = user ? await getUserActiveEntitlements(user.id) : null;
      return evaluateLessonAccess(lesson, lesson.module.course, user, userEntitlements);
    }

    case "quiz": {
      const lesson = await prisma.lesson.findUnique({
        where: { id: resource.lessonId },
        select: { id: true, isFree: true, module: { select: { courseId: true } } },
      });
      if (!lesson) {
        return { allowed: false, reason: "Dars yoki quiz topilmadi.", statusCode: 404 };
      }

      return canAccess(user, { type: "lesson", lessonId: lesson.id, courseId: lesson.module.courseId });
    }

    case "lab": {
      const cleanLabId = resource.labId.trim();
      const lab = await prisma.lab.findFirst({
        where: {
          OR: [{ id: cleanLabId }, { slug: cleanLabId }],
        },
        select: {
          id: true,
          slug: true,
          accessType: true,
          courseId: true,
          lessonId: true,
        },
      });

      if (!lab) {
        return { allowed: false, reason: "Laboratoriya topilmadi.", statusCode: 404 };
      }

      if (!user) {
        return { allowed: false, reason: "Laboratoriyani bajarish uchun tizimga kiring.", statusCode: 401 };
      }

      // Agar lab kursga biriktirilgan bo'lsa, avval kurs huquqi tekshiriladi
      if (lab.courseId) {
        const courseAccess = await canAccess(user, { type: "course", courseId: lab.courseId });
        if (!courseAccess.allowed) {
          return courseAccess;
        }
      }

      if (lab.accessType === AccessType.PREMIUM) {
        const userEntitlements = await getUserActiveEntitlements(user.id);
        if (!userEntitlements.hasSubscriptionOrGrant) {
          return {
            allowed: false,
            reason: "Ushbu laboratoriya uchun Premium obuna talab etiladi.",
            statusCode: 403,
            requiresPremium: true,
          };
        }
      }

      return { allowed: true };
    }

    case "certificate": {
      if (!user) {
        return { allowed: false, reason: "Sertifikat olish uchun tizimga kiring.", statusCode: 401 };
      }

      return canAccess(user, { type: "course", courseId: resource.courseId });
    }

    case "assignment": {
      const assignment = await prisma.assignment.findUnique({
        where: { id: resource.assignmentId },
        select: { id: true, courseId: true, groupId: true, isPublished: true },
      });

      if (!assignment) {
        return { allowed: false, reason: "Vazifa topilmadi.", statusCode: 404 };
      }

      if (!user) {
        return { allowed: false, reason: "Vazifani ko'rish uchun tizimga kiring.", statusCode: 401 };
      }

      if (!assignment.isPublished && user.role !== Role.admin && user.role !== Role.instructor) {
        return { allowed: false, reason: "Vazifa hali e'lon qilinmagan.", statusCode: 404 };
      }

      if (assignment.groupId) {
        const isMember = await prisma.groupMember.findFirst({
          where: { groupId: assignment.groupId, userId: user.id },
        });
        if (!isMember) {
          return { allowed: false, reason: "Ushbu vazifa sizning guruhingizga tegishli emas.", statusCode: 403 };
        }
      }

      if (assignment.courseId) {
        const courseAccess = await canAccess(user, { type: "course", courseId: assignment.courseId });
        if (!courseAccess.allowed) {
          return courseAccess;
        }
      }

      return { allowed: true };
    }

    default:
      return { allowed: false, statusCode: 403 };
  }
}
