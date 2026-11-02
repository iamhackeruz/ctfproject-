import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { recordAuditLog } from "@/lib/security/audit";
import { Role } from "@prisma/client";

// GET /api/admin/groups — Guruhlar ro'yxati, a'zolari, guruh scoreboardi va progressi
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user: currentUser } = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("id") || searchParams.get("groupId");

    // Agar aniq bir guruh tafsilotlari so'ralsa
    if (groupId) {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          courses: {
            include: {
              course: {
                select: { id: true, title: true, icon: true, duration: true },
              },
            },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  avatar: true,
                  isBlocked: true,
                  createdAt: true,
                  labSubmissions: {
                    where: { isCorrect: true },
                    select: { pointsEarned: true },
                  },
                  lessonProgress: {
                    where: { completed: true },
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!group) {
        return NextResponse.json({ success: false, error: "Guruh topilmadi." }, { status: 404 });
      }

      // Ustoz doirasi tekshiruvi (IDOR)
      if (currentUser.role === Role.instructor) {
        const isAuthorized = group.instructorId === currentUser.userId || group.createdBy === currentUser.userId;
        if (!isAuthorized) {
          return NextResponse.json(
            { success: false, error: "Siz faqat o'zingiz mas'ul bo'lgan guruh ma'lumotlarini ko'ra olasiz (IDOR himoyasi)." },
            { status: 403 }
          );
        }
      }

      // Guruh scoreboardi va statistikasi
      const memberStats = group.members.map((m) => {
        const totalPoints = m.user.labSubmissions.reduce((acc, s) => acc + (s.pointsEarned || 0), 0);
        const completedLessons = m.user.lessonProgress.length;
        return {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          phone: m.user.phone,
          avatar: m.user.avatar,
          isBlocked: m.user.isBlocked,
          joinedAt: m.joinedAt,
          totalPoints,
          completedLessons,
        };
      });

      // Ballar bo'yicha saralangan scoreboard
      memberStats.sort((a, b) => b.totalPoints - a.totalPoints);

      const totalGroupPoints = memberStats.reduce((acc, m) => acc + m.totalPoints, 0);
      const avgGroupPoints = memberStats.length > 0 ? Math.round(totalGroupPoints / memberStats.length) : 0;

      return NextResponse.json({
        success: true,
        group: {
          id: group.id,
          name: group.name,
          description: group.description,
          instructorId: group.instructorId,
          createdBy: group.createdBy,
          createdAt: group.createdAt,
          courses: group.courses.map((gc) => gc.course),
          scoreboard: memberStats,
          stats: {
            totalMembers: memberStats.length,
            totalGroupPoints,
            avgGroupPoints,
          },
        },
      });
    }

    // Barcha guruhlar ro'yxati (Ustoz faqat o'zinikini ko'radi)
    const whereClause = currentUser.role === Role.instructor
      ? { OR: [{ instructorId: currentUser.userId }, { createdBy: currentUser.userId }] }
      : {};

    const groups = await prisma.group.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            members: true,
            courses: true,
            invitations: true,
          },
        },
        courses: {
          include: {
            course: {
              select: { id: true, title: true, icon: true },
            },
          },
        },
        members: {
          take: 5,
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
        },
      },
    });

    const formatted = groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      instructorId: g.instructorId,
      createdAt: g.createdAt,
      membersCount: g._count.members,
      coursesCount: g._count.courses,
      invitationsCount: g._count.invitations,
      assignedCourses: g.courses.map((c) => ({ ...c.course, endsAt: c.endsAt })),
      sampleMembers: g.members.map((m) => m.user),
    }));

    return NextResponse.json({ success: true, groups: formatted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/admin/groups — Yangi guruh yaratish
export async function POST(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user: currentUser } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { name, description } = body;

    const cleanName = String(name || "").trim();
    if (!cleanName) {
      return NextResponse.json(
        { success: false, error: "Guruh nomi kiritilishi shart." },
        { status: 400 }
      );
    }

    const instructorId = currentUser.role === Role.admin
      ? (body.instructorId ? String(body.instructorId) : null)
      : currentUser.userId;

    const group = await prisma.group.create({
      data: {
        name: cleanName,
        description: description ? String(description).trim() : null,
        instructorId,
        createdBy: currentUser.userId,
      },
    });

    await recordAuditLog({
      userId: currentUser.userId,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1",
      action: "GROUP_CREATE",
      details: { groupId: group.id, name: group.name },
    });

    return NextResponse.json({
      success: true,
      message: "Guruh muvaffaqiyatli yaratildi.",
      group,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PUT /api/admin/groups — Guruhni tahrirlash, talabalarni biriktirish yoki kursga ommaviy yozish
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user: currentUser } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { action, groupId, name, description, userIds, userId, courseId, durationDays, endsAt: inputEndsAt } = body;

    if (!groupId) {
      return NextResponse.json({ success: false, error: "Guruh ID ko'rsatilmadi." }, { status: 400 });
    }

    const group = await prisma.group.findUnique({ where: { id: String(groupId) } });
    if (!group) {
      return NextResponse.json({ success: false, error: "Guruh topilmadi." }, { status: 404 });
    }

    // Ustoz doirasi tekshiruvi (IDOR)
    if (currentUser.role === Role.instructor) {
      const isAuthorized = group.instructorId === currentUser.userId || group.createdBy === currentUser.userId;
      if (!isAuthorized) {
        return NextResponse.json(
          { success: false, error: "Siz faqat o'zingiz mas'ul bo'lgan guruhlarni tahrirlay olasiz (IDOR himoyasi)." },
          { status: 403 }
        );
      }
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";

    // 1. Guruh ma'lumotlarini yangilash
    if (action === "update_info") {
      const updated = await prisma.group.update({
        where: { id: group.id },
        data: {
          name: name ? String(name).trim() : group.name,
          description: description !== undefined ? String(description).trim() : group.description,
          ...(currentUser.role === Role.admin && body.instructorId !== undefined ? { instructorId: body.instructorId ? String(body.instructorId) : null } : {}),
        },
      });
      return NextResponse.json({ success: true, message: "Guruh ma'lumotlari yangilandi.", group: updated });
    }

    // 2. Guruhga talabalarni biriktirish (ko'p talaba)
    if (action === "add_members") {
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return NextResponse.json({ success: false, error: "Qo'shish uchun talabalar tanlanmadi." }, { status: 400 });
      }

      const groupCourses = await prisma.groupCourse.findMany({ where: { groupId: group.id } });

      let added = 0;
      for (const uId of userIds) {
        try {
          await prisma.groupMember.create({
            data: {
              groupId: group.id,
              userId: String(uId),
            },
          });
          added++;

          // Guruhga biriktirilgan kurslar bo'yicha talabaga GROUP huquqini berish
          for (const gc of groupCourses) {
            await prisma.enrollment.upsert({
              where: { userId_courseId: { userId: String(uId), courseId: gc.courseId } },
              update: {},
              create: { userId: String(uId), courseId: gc.courseId },
            }).catch(() => {});

            await prisma.entitlement.create({
              data: {
                userId: String(uId),
                type: "GROUP",
                source: "GROUP",
                courseId: gc.courseId,
                groupId: group.id,
                endsAt: gc.endsAt,
                grantedBy: currentUser.userId,
                reason: `Guruh '${group.name}'ga qo'shilganligi sababli kirish huquqi berildi`,
              },
            }).catch(() => {});
          }
        } catch {
          // mavjud bo'lsa o'tkazib yuborish
        }
      }

      await recordAuditLog({
        userId: currentUser.userId,
        ip: clientIp,
        action: "GROUP_ADD_MEMBERS",
        details: { groupId: group.id, addedCount: added },
      });

      return NextResponse.json({ success: true, message: `${added} ta talaba guruhga biriktirildi.` });
    }

    // 3. Guruhdan talabani chiqarish (Guruh huquqlarini bekor qilish)
    if (action === "remove_member") {
      if (!userId) {
        return NextResponse.json({ success: false, error: "Foydalanuvchi ID ko'rsatilmadi." }, { status: 400 });
      }

      await prisma.groupMember.deleteMany({
        where: {
          groupId: group.id,
          userId: String(userId),
        },
      });

      // Talabaning ushbu guruhga oid barcha GROUP huquqlarini bekor qilish
      await prisma.entitlement.updateMany({
        where: {
          groupId: group.id,
          userId: String(userId),
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, message: "Talaba guruhdan chiqarildi va guruh huquqlari bekor qilindi." });
    }

    // 4. Guruhni kursga ommaviy yozish (Guruhdagi barcha talabalarni biriktirilgan kursga enroll qilish va GROUP Entitlement yaratish)
    if (action === "assign_course") {
      const parsedCourseId = parseInt(String(courseId), 10);
      if (isNaN(parsedCourseId)) {
        return NextResponse.json({ success: false, error: "Noto'g'ri kurs ID" }, { status: 400 });
      }

      const course = await prisma.course.findUnique({ where: { id: parsedCourseId } });
      if (!course) {
        return NextResponse.json({ success: false, error: "Kurs topilmadi." }, { status: 404 });
      }

      // Muddatni hisoblash (durationDays yoki endsAt)
      let calculatedEndsAt: Date | null = null;
      if (typeof durationDays === "number" && durationDays > 0) {
        calculatedEndsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
      } else if (inputEndsAt) {
        const parsedDate = new Date(inputEndsAt);
        if (!isNaN(parsedDate.getTime())) {
          calculatedEndsAt = parsedDate;
        }
      }

      // Guruh-kurs bog'lamasi
      await prisma.groupCourse.upsert({
        where: {
          groupId_courseId: {
            groupId: group.id,
            courseId: course.id,
          },
        },
        update: {
          endsAt: calculatedEndsAt,
        },
        create: {
          groupId: group.id,
          courseId: course.id,
          endsAt: calculatedEndsAt,
        },
      });

      // Guruh a'zolarini ommaviy enroll qilish va muddatli GROUP Entitlement yaratish
      const members = await prisma.groupMember.findMany({ where: { groupId: group.id } });
      let enrolledCount = 0;
      for (const m of members) {
        try {
          await prisma.enrollment.upsert({
            where: {
              userId_courseId: {
                userId: m.userId,
                courseId: course.id,
              },
            },
            update: {},
            create: {
              userId: m.userId,
              courseId: course.id,
            },
          });

          await prisma.entitlement.create({
            data: {
              userId: m.userId,
              type: "GROUP",
              source: "GROUP",
              courseId: course.id,
              groupId: group.id,
              endsAt: calculatedEndsAt,
              grantedBy: currentUser.userId,
              reason: `Guruh '${group.name}' orqali kursga kirish huquqi berildi`,
            },
          });

          enrolledCount++;
        } catch {
          // ignore
        }
      }

      await recordAuditLog({
        userId: currentUser.userId,
        ip: clientIp,
        action: "GROUP_ASSIGN_COURSE",
        details: {
          groupId: group.id,
          courseId: course.id,
          endsAt: calculatedEndsAt,
          enrolledMembersCount: enrolledCount,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Guruh '${course.title}' kursiga muvaffaqiyatli bog'landi va ${enrolledCount} ta talaba kursga yozildi hamda kirish huquqi berildi.`,
        enrolledCount,
        endsAt: calculatedEndsAt,
      });
    }

    // 5. Guruhdan kursni olib tashlash (va GROUP huquqlarini bekor qilish)
    if (action === "remove_course") {
      const parsedCourseId = parseInt(String(courseId), 10);
      if (isNaN(parsedCourseId)) {
        return NextResponse.json({ success: false, error: "Noto'g'ri kurs ID" }, { status: 400 });
      }

      await prisma.groupCourse.deleteMany({
        where: {
          groupId: group.id,
          courseId: parsedCourseId,
        },
      });

      // Talabalarning ushbu guruh orqali berilgan kurs huquqlarini bekor qilish
      const revoked = await prisma.entitlement.updateMany({
        where: {
          groupId: group.id,
          courseId: parsedCourseId,
          type: "GROUP",
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      await recordAuditLog({
        userId: currentUser.userId,
        ip: clientIp,
        action: "GROUP_REMOVE_COURSE",
        details: {
          groupId: group.id,
          courseId: parsedCourseId,
          revokedCount: revoked.count,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Kurs guruhdan olib tashlandi va barcha talabalar uchun kirish huquqi bekor qilindi.",
        revokedCount: revoked.count,
      });
    }

    return NextResponse.json({ success: false, error: "Noma'lum amal (action)." }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/groups — Guruhni o'chirish (Faqat ADMIN)
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.admin]);
  if (authResult instanceof NextResponse) return authResult;
  const { user: currentUser } = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Guruh ID ko'rsatilmadi." }, { status: 400 });
    }

    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) {
      return NextResponse.json({ success: false, error: "Guruh topilmadi." }, { status: 404 });
    }

    // Guruhga tegishli barcha huquqlarni bekor qilish
    await prisma.entitlement.updateMany({
      where: {
        groupId: group.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await prisma.group.delete({ where: { id } });

    await recordAuditLog({
      userId: currentUser.userId,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1",
      action: "GROUP_DELETE",
      details: { groupId: group.id, name: group.name },
    });

    return NextResponse.json({ success: true, message: "Guruh muvaffaqiyatli o'chirildi." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
