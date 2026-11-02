import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { hashPassword, validatePassword } from "@/lib/security/password";
import { recordAuditLog } from "@/lib/security/audit";
import { Role } from "@prisma/client";
import crypto from "crypto";

// GET /api/admin/users — Foydalanuvchilar ro'yxati (Pagination, Qidiruv, Filtrlar)
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user: currentUser } = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10", 10) || 10));
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const roleParam = searchParams.get("role") || "";
    const groupId = searchParams.get("groupId") || "";
    const status = searchParams.get("status") || "all"; // all | active | blocked

    // Instructor faqat talabalarni ko'ra oladi
    const where: Record<string, unknown> = {};

    if (currentUser.role === Role.instructor) {
      where.role = Role.student;
    } else if (roleParam && Object.values(Role).includes(roleParam as Role)) {
      where.role = roleParam as Role;
    }

    if (status === "blocked") {
      where.isBlocked = true;
    } else if (status === "active") {
      where.isBlocked = false;
    }

    if (groupId) {
      where.groupMemberships = {
        some: { groupId },
      };
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          displayName: true,
          role: true,
          phone: true,
          avatar: true,
          isBlocked: true,
          mustChangePassword: true,
          twoFactorEnabled: true,
          createdAt: true,
          _count: {
            select: {
              enrollments: true,
              labSubmissions: { where: { isCorrect: true } },
              certificates: true,
            },
          },
          groupMemberships: {
            include: {
              group: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
    ]);

    const formattedUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      displayName: u.displayName,
      role: u.role,
      phone: u.phone,
      avatar: u.avatar,
      isBlocked: u.isBlocked,
      mustChangePassword: u.mustChangePassword,
      twoFactorEnabled: u.twoFactorEnabled,
      createdAt: u.createdAt,
      enrollmentsCount: u._count.enrollments,
      solvedLabsCount: u._count.labSubmissions,
      certificatesCount: u._count.certificates,
      groups: u.groupMemberships.map((gm) => gm.group),
    }));

    return NextResponse.json({
      success: true,
      users: formattedUsers,
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

// POST /api/admin/users — Yangi talaba yoki xodim yaratish (Vaqtinchalik parol)
export async function POST(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user: currentUser } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { name, email, phone, role: desiredRole, groupId, tempPassword: customPass } = body;

    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanName = String(name || "").trim();
    const cleanPhone = String(phone || "").trim();

    if (!cleanEmail || !cleanEmail.includes("@") || !cleanName) {
      return NextResponse.json(
        { success: false, error: "Ism va to'g'ri elektron pochta kiritilishi shart." },
        { status: 400 }
      );
    }

    // Role Mass Assignment himoyasi:
    // Faqat admin boshqa rollarni (instructor, accountant) bera oladi.
    // Instructor faqat talaba (student) yarata oladi.
    let assignedRole: Role = Role.student;
    if (currentUser.role === Role.admin) {
      if (desiredRole && Object.values(Role).includes(desiredRole as Role)) {
        assignedRole = desiredRole as Role;
      }
    } else {
      assignedRole = Role.student;
    }

    // Mavjud email tekshiruvi
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "Ushbu elektron pochta bilan hisob allaqachon mavjud." },
        { status: 400 }
      );
    }

    const tempPassword =
      customPass && String(customPass).length >= 10
        ? String(customPass)
        : `Talaba#${crypto.randomBytes(4).toString("hex")}!2026`;

    const strength = validatePassword(tempPassword);
    if (!strength.valid) {
      return NextResponse.json({ success: false, error: strength.error }, { status: 400 });
    }

    const passwordHash = await hashPassword(tempPassword);

    const newUser = await prisma.user.create({
      data: {
        email: cleanEmail,
        name: cleanName,
        phone: cleanPhone || null,
        role: assignedRole,
        passwordHash,
        mustChangePassword: true, // Birinchi kirishda almashtirish majburiy
      },
    });

    if (groupId) {
      const group = await prisma.group.findUnique({ where: { id: String(groupId) } });
      if (group) {
        await prisma.groupMember.create({
          data: {
            groupId: group.id,
            userId: newUser.id,
          },
        });
      }
    }

    await recordAuditLog({
      userId: currentUser.userId,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1",
      action: "USER_CREATED",
      details: {
        createdUserId: newUser.id,
        createdEmail: newUser.email,
        assignedRole: newUser.role,
        createdByRole: currentUser.role,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Foydalanuvchi muvaffaqiyatli yaratildi.",
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
      tempPassword,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PUT /api/admin/users — Foydalanuvchi amallari (Rol o'zgartirish, Bloklash, Parol tiklash, Sessiyalarni tugatish)
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user: currentUser } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { action, userId: targetUserId, isBlocked } = body;
    const newRole = body.newRole || body.role;

    if (!targetUserId) {
      return NextResponse.json({ success: false, error: "userId ko'rsatilmadi." }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: String(targetUserId) } });
    if (!targetUser) {
      return NextResponse.json({ success: false, error: "Foydalanuvchi topilmadi." }, { status: 404 });
    }

    // Instructor faqat talaba (student) bilan amallar bajara oladi
    if (currentUser.role === Role.instructor && targetUser.role !== Role.student) {
      return NextResponse.json(
        { success: false, error: "Ustoz faqat talabalar hisobini boshqara oladi." },
        { status: 403 }
      );
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";

    // 1. ROLNI O'ZGARTIRISH (Faqat ADMIN)
    if (action === "update_role" || action === "change_role") {
      if (currentUser.role !== Role.admin) {
        return NextResponse.json(
          { success: false, error: "Foydalanuvchi rolini faqat administrator o'zgartira oladi." },
          { status: 403 }
        );
      }

      if (!newRole || !Object.values(Role).includes(newRole as Role)) {
        return NextResponse.json({ success: false, error: "Noto'g'ri rol tanlandi." }, { status: 400 });
      }

      // Oxirgi adminni demote qilishdan himoya
      if (targetUser.role === Role.admin && newRole !== Role.admin) {
        const adminCount = await prisma.user.count({ where: { role: Role.admin } });
        if (adminCount <= 1) {
          return NextResponse.json(
            { success: false, error: "Tizimdagi oxirgi administrator rolini o'zgartirib bo'lmaydi." },
            { status: 400 }
          );
        }
      }

      const updated = await prisma.user.update({
        where: { id: targetUser.id },
        data: { role: newRole as Role },
      });

      await recordAuditLog({
        userId: currentUser.userId,
        ip: clientIp,
        action: "ROLE_CHANGE",
        details: {
          targetUserId: targetUser.id,
          targetEmail: targetUser.email,
          oldRole: targetUser.role,
          newRole: updated.role,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Foydalanuvchi roli muvaffaqiyatli yangilandi.",
        user: { id: updated.id, email: updated.email, role: updated.role },
      });
    }

    // 2. BLOKLASH / BLOKDAN CHIQARISH (Faqat ADMIN)
    if (action === "toggle_block") {
      if (currentUser.role !== Role.admin) {
        return NextResponse.json(
          { success: false, error: "Hisobni bloklash huquqi faqat administratorda mavjud." },
          { status: 403 }
        );
      }

      if (targetUser.id === currentUser.userId) {
        return NextResponse.json(
          { success: false, error: "Administrator o'z hisobini bloklay olmaydi." },
          { status: 400 }
        );
      }

      const nextBlocked = typeof isBlocked === "boolean" ? isBlocked : !targetUser.isBlocked;

      // Agar bloklanayotgan bo'lsa, mavjud sessiyalarini darhol bekor qilish
      if (nextBlocked) {
        await prisma.session.updateMany({
          where: { userId: targetUser.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      const updated = await prisma.user.update({
        where: { id: targetUser.id },
        data: { isBlocked: nextBlocked },
      });

      await recordAuditLog({
        userId: currentUser.userId,
        ip: clientIp,
        action: nextBlocked ? "USER_BLOCKED" : "USER_UNBLOCKED",
        details: {
          targetUserId: targetUser.id,
          targetEmail: targetUser.email,
          isBlocked: nextBlocked,
        },
      });

      return NextResponse.json({
        success: true,
        message: nextBlocked
          ? "Foydalanuvchi bloklandi va uning barcha faol sessiyalari to'xtatildi."
          : "Foydalanuvchi blokdan chiqarildi.",
        isBlocked: updated.isBlocked,
      });
    }

    // 3. PAROLNI TIKLASH / VAQTINCHALIK PAROL BERISH
    if (action === "reset_password") {
      const tempPass = `CyberPass#${crypto.randomBytes(4).toString("hex")}!2026`;
      const passHash = await hashPassword(tempPass);

      await prisma.user.update({
        where: { id: targetUser.id },
        data: {
          passwordHash: passHash,
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
      });

      // Eski sessiyalarni tugatish
      await prisma.session.updateMany({
        where: { userId: targetUser.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await recordAuditLog({
        userId: currentUser.userId,
        ip: clientIp,
        action: "PASSWORD_RESET",
        details: {
          targetUserId: targetUser.id,
          targetEmail: targetUser.email,
          resetBy: currentUser.role,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Foydalanuvchi uchun yangi vaqtinchalik parol berildi.",
        tempPassword: tempPass,
      });
    }

    // 4. BARCHA SESSIYALARNI BEKOR QILISH
    if (action === "revoke_sessions") {
      const result = await prisma.session.updateMany({
        where: { userId: targetUser.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await recordAuditLog({
        userId: currentUser.userId,
        ip: clientIp,
        action: "ALL_SESSIONS_REVOKED",
        details: {
          targetUserId: targetUser.id,
          targetEmail: targetUser.email,
          revokedCount: result.count,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Foydalanuvchining ${result.count} ta faol sessiyasi bekor qilindi.`,
      });
    }

    return NextResponse.json({ success: false, error: "Noma'lum amal (action)." }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/users — Foydalanuvchini o'chirish (Faqat ADMIN)
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.admin]);
  if (authResult instanceof NextResponse) return authResult;
  const { user: currentUser } = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("id");

    if (!targetUserId) {
      return NextResponse.json({ success: false, error: "Foydalanuvchi ID ko'rsatilmadi." }, { status: 400 });
    }

    // 1. O'z hisobini o'chira olmasin
    if (targetUserId === currentUser.userId) {
      return NextResponse.json(
        { success: false, error: "Administrator o'z hisobini o'chira olmaydi." },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return NextResponse.json({ success: false, error: "Foydalanuvchi topilmadi." }, { status: 404 });
    }

    // 2. Oxirgi adminni o'chira olmasin
    if (targetUser.role === Role.admin) {
      const adminCount = await prisma.user.count({ where: { role: Role.admin } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { success: false, error: "Tizimdagi oxirgi administratorni o'chirib bo'lmaydi." },
          { status: 400 }
        );
      }
    }

    await prisma.user.delete({ where: { id: targetUserId } });

    await recordAuditLog({
      userId: currentUser.userId,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1",
      action: "USER_DELETED",
      details: {
        deletedUserId: targetUser.id,
        deletedEmail: targetUser.email,
        deletedRole: targetUser.role,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Foydalanuvchi muvaffaqiyatli o'chirildi.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
