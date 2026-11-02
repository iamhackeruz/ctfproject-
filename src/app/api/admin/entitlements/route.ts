import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { recordAuditLog } from "@/lib/security/audit";
import { Role, EntitlementType, EntitlementSource } from "@prisma/client";

// GET /api/admin/entitlements — Huquqlar ro'yxati, rejalari va filtrlari (Admin / Instructor)
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || undefined;
    const groupId = searchParams.get("groupId") || undefined;
    const status = searchParams.get("status") || "all"; // all | active | expired | revoked

    const now = new Date();
    const where: Record<string, unknown> = {};

    if (userId) where.userId = userId;
    if (groupId) where.groupId = groupId;

    if (status === "active") {
      where.revokedAt = null;
      where.startsAt = { lte: now };
      where.OR = [{ endsAt: null }, { endsAt: { gte: now } }];
    } else if (status === "revoked") {
      where.revokedAt = { not: null };
    } else if (status === "expired") {
      where.revokedAt = null;
      where.endsAt = { lt: now };
    }

    const [entitlements, plans, courses] = await Promise.all([
      prisma.entitlement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
          course: {
            select: { id: true, title: true, accessType: true, priceUzs: true },
          },
          plan: {
            select: { id: true, name: true, code: true, interval: true, priceUzs: true },
          },
          group: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { priceUzs: "asc" },
      }),
      prisma.course.findMany({
        select: { id: true, title: true, accessType: true, priceUzs: true },
        orderBy: { id: "asc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      entitlements,
      plans,
      courses,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/admin/entitlements — Kirish huquqini berish yoki bekor qilish (Admin / Instructor)
export async function POST(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user: currentUser } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { action, userId, userIds, groupId, type, courseId, planId, durationDays, reason, entitlementId } = body;
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";

    // 1. Huquqni bekor qilish (Revoke)
    if (action === "revoke") {
      if (!entitlementId) {
        return NextResponse.json({ success: false, error: "Huquq ID ko'rsatilmadi." }, { status: 400 });
      }

      const entitlement = await prisma.entitlement.findUnique({
        where: { id: String(entitlementId) },
        include: { user: true },
      });

      if (!entitlement) {
        return NextResponse.json({ success: false, error: "Huquq topilmadi." }, { status: 404 });
      }

      const revoked = await prisma.entitlement.update({
        where: { id: entitlement.id },
        data: {
          revokedAt: new Date(),
          reason: reason ? `${entitlement.reason ? entitlement.reason + " | " : ""}Bekor qilindi: ${String(reason).trim()}` : entitlement.reason,
        },
      });

      await recordAuditLog({
        userId: currentUser.userId,
        ip: clientIp,
        action: "ENTITLEMENT_REVOKE",
        details: {
          entitlementId: entitlement.id,
          targetUserId: entitlement.userId,
          targetUserEmail: entitlement.user.email,
          reason: reason || "Admin/Ustoz tomonidan bekor qilindi",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Kirish huquqi muvaffaqiyatli bekor qilindi.",
        entitlement: revoked,
      });
    }

    // 2. Guruh bo'yicha ommaviy huquq berish (Grant Group)
    if (action === "grant_group") {
      if (!groupId) {
        return NextResponse.json({ success: false, error: "Guruh ID ko'rsatilmadi." }, { status: 400 });
      }

      const group = await prisma.group.findUnique({
        where: { id: String(groupId) },
        include: { members: true },
      });

      if (!group) {
        return NextResponse.json({ success: false, error: "Guruh topilmadi." }, { status: 404 });
      }

      if (group.members.length === 0) {
        return NextResponse.json({ success: false, error: "Guruhda hech qanday talaba mavjud emas." }, { status: 400 });
      }

      const endsAt = durationDays && Number(durationDays) > 0
        ? new Date(Date.now() + Number(durationDays) * 24 * 60 * 60 * 1000)
        : null;

      const entType: EntitlementType = type === "SUBSCRIPTION" ? EntitlementType.SUBSCRIPTION : type === "GRANT" ? EntitlementType.GRANT : EntitlementType.GROUP;
      const targetCourseId = courseId ? parseInt(String(courseId), 10) : null;

      let grantedCount = 0;
      for (const m of group.members) {
        await prisma.entitlement.create({
          data: {
            userId: m.userId,
            type: entType,
            source: EntitlementSource.GROUP,
            courseId: targetCourseId,
            planId: planId ? String(planId) : null,
            groupId: group.id,
            endsAt,
            grantedBy: currentUser.userId,
            reason: reason ? String(reason).trim() : `Guruh '${group.name}' bo'yicha ommaviy berildi`,
          },
        });
        grantedCount++;
      }

      await recordAuditLog({
        userId: currentUser.userId,
        ip: clientIp,
        action: "ENTITLEMENT_GROUP_GRANT",
        details: {
          groupId: group.id,
          groupName: group.name,
          grantedCount,
          type: entType,
          courseId: targetCourseId,
          durationDays: durationDays || "cheksiz",
        },
      });

      return NextResponse.json({
        success: true,
        message: `Guruhdagi ${grantedCount} ta talabaga muvaffaqiyatli kirish huquqi berildi.`,
        grantedCount,
      });
    }

    // 3. Talaba(lar)ga to'g'ridan-to'g'ri huquq berish (Grant)
    if (action === "grant") {
      const targetIds: string[] = Array.isArray(userIds)
        ? userIds.map(String)
        : userId
        ? [String(userId)]
        : [];

      if (targetIds.length === 0) {
        return NextResponse.json({ success: false, error: "Talaba ID(lari) ko'rsatilmadi." }, { status: 400 });
      }

      const entType: EntitlementType =
        type === "SUBSCRIPTION"
          ? EntitlementType.SUBSCRIPTION
          : type === "COURSE"
          ? EntitlementType.COURSE
          : EntitlementType.GRANT;

      const targetCourseId = courseId ? parseInt(String(courseId), 10) : null;
      const endsAt = durationDays && Number(durationDays) > 0
        ? new Date(Date.now() + Number(durationDays) * 24 * 60 * 60 * 1000)
        : null;

      let grantedCount = 0;
      for (const uId of targetIds) {
        const userExists = await prisma.user.findUnique({ where: { id: uId } });
        if (!userExists) continue;

        await prisma.entitlement.create({
          data: {
            userId: uId,
            type: entType,
            source: EntitlementSource.MANUAL,
            courseId: targetCourseId,
            planId: planId ? String(planId) : null,
            endsAt,
            grantedBy: currentUser.userId,
            reason: reason ? String(reason).trim() : "Admin/Ustoz tomonidan berildi",
          },
        });

        // Agar aniq kurs huquqi berilsa, talabani o'sha kursga avtomatik enroll qilish
        if (targetCourseId) {
          await prisma.enrollment.upsert({
            where: { userId_courseId: { userId: uId, courseId: targetCourseId } },
            update: {},
            create: { userId: uId, courseId: targetCourseId },
          }).catch(() => {});
        }

        grantedCount++;
      }

      await recordAuditLog({
        userId: currentUser.userId,
        ip: clientIp,
        action: "ENTITLEMENT_GRANT",
        details: {
          targetUserIds: targetIds,
          grantedCount,
          type: entType,
          courseId: targetCourseId,
          durationDays: durationDays || "cheksiz",
          reason: reason || "Admin/Ustoz tomonidan berildi",
        },
      });

      return NextResponse.json({
        success: true,
        message: `${grantedCount} ta talabaga kirish huquqi muvaffaqiyatli taqdim etildi.`,
        grantedCount,
      });
    }

    return NextResponse.json({ success: false, error: "Noma'lum amal (action)." }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
