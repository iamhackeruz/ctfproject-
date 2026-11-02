import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { getUserActiveEntitlements, evaluateLessonAccess } from "@/lib/security/entitlements";
import { Role } from "@prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/courses/[id] — Kurs tafsilotlari (Server-side Draft va Entitlements himoyasi bilan)
export async function GET(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { id } = await context.params;
  const courseId = parseInt(id, 10);

  if (isNaN(courseId)) {
    return NextResponse.json({ success: false, error: "Noto'g'ri kurs ID" }, { status: 400 });
  }

  const user = await getSessionUser(req);
  const isStaff = user && (user.role === Role.admin || user.role === Role.instructor);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            where: isStaff ? {} : { isPublished: true },
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });

  if (!course) {
    return NextResponse.json({ success: false, error: "Kurs topilmadi" }, { status: 404 });
  }

  // Agar kurs qoralama (draft / unpublished) bo'lsa va talaba so'rayotgan bo'lsa
  if (!isStaff && !course.isPublished) {
    return NextResponse.json({ success: false, error: "Kurs hozirda mavjud emas yoki qoralama holatida." }, { status: 404 });
  }

  const userObj = user ? { id: user.userId, role: user.role, isBlocked: user.isBlocked } : null;
  const userEntitlements = (!isStaff && userObj) ? await getUserActiveEntitlements(userObj.id) : null;

  // Server markaziy darvozaboni (N+1 siz tezkor tekshiruv)
  const processedModules = course.modules.map((mod) => {
    const processedLessons = mod.lessons.map((les) => {
      if (isStaff) {
        return { ...les, isLocked: false };
      }
      const access = evaluateLessonAccess(les, course, userObj, userEntitlements);
      if (!access.allowed) {
        return {
          ...les,
          content: null,
          isLocked: true,
          lockedMessage: access.reason || "Ushbu dars qulflangan. Premium obuna yoki kursga kirish huquqi talab etiladi.",
        };
      }
      return { ...les, isLocked: false };
    });
    return { ...mod, lessons: processedLessons };
  });

  return NextResponse.json({ success: true, course: { ...course, modules: processedModules } });
}

// DELETE /api/courses/[id] — Kursni o'chirish (Barcha kurslar uchun ID cheklovisiz)
export async function DELETE(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;

  const { user } = authResult;
  const { id } = await context.params;
  const courseId = parseInt(id, 10);

  if (isNaN(courseId)) {
    return NextResponse.json({ success: false, error: "Noto'g'ri kurs ID" }, { status: 400 });
  }

  try {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json({ success: false, error: "Kurs topilmadi" }, { status: 404 });
    }

    await prisma.course.delete({ where: { id: courseId } });

    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1",
        action: "COURSE_DELETE",
        status: "SUCCESS",
        details: JSON.stringify({ courseId, title: course.title }),
      },
    });

    return NextResponse.json({ success: true, message: "Kurs muvaffaqiyatli o'chirildi." });
  } catch (err) {
    console.error("Kursni o'chirishda xatolik:", err);
    return NextResponse.json({ success: false, error: "Kursni o'chirib bo'lmadi." }, { status: 500 });
  }
}

// PUT /api/courses/[id] — Kurs, modullar va darslarni batafsil tahrirlash (RBAC: Admin / Instructor)
export async function PUT(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await context.params;
  const courseId = parseInt(id, 10);

  if (isNaN(courseId)) {
    return NextResponse.json({ success: false, error: "Noto'g'ri kurs ID" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // 0. Kurs ma'lumotlarini tahrirlash (Kirish turi va Narx bilan)
    if (action === "update_course_info") {
      const { title, desc, fullDesc, accessType, priceUzs, isPublished } = body;
      const updated = await prisma.course.update({
        where: { id: courseId },
        data: {
          title: title ? String(title).trim() : undefined,
          desc: desc ? String(desc).trim() : undefined,
          fullDesc: fullDesc ? String(fullDesc).trim() : undefined,
          accessType: accessType || undefined,
          priceUzs: typeof priceUzs === "number" ? Math.max(0, priceUzs) : undefined,
          isPublished: typeof isPublished === "boolean" ? isPublished : undefined,
        },
      });
      return NextResponse.json({ success: true, message: "Kurs ma'lumotlari muvaffaqiyatli yangilandi.", course: updated });
    }

    // 1. Yangi modul qo'shish
    if (action === "add_module") {
      const { title, duration } = body;
      const count = await prisma.module.count({ where: { courseId } });
      const createdMod = await prisma.module.create({
        data: {
          courseId,
          title: String(title || "Yangi Modul").trim(),
          duration: String(duration || "1 soat").trim(),
          order: count + 1,
        },
      });
      return NextResponse.json({ success: true, message: "Modul muvaffaqiyatli qo'shildi.", module: createdMod });
    }

    // 2. Modulni tahrirlash
    if (action === "edit_module") {
      const { moduleId, title, duration } = body;
      const updated = await prisma.module.update({
        where: { id: Number(moduleId) },
        data: {
          title: title ? String(title).trim() : undefined,
          duration: duration ? String(duration).trim() : undefined,
        },
      });
      return NextResponse.json({ success: true, message: "Modul yangilandi.", module: updated });
    }

    // 3. Modulni o'chirish
    if (action === "delete_module") {
      const { moduleId } = body;
      await prisma.module.delete({ where: { id: Number(moduleId) } });
      return NextResponse.json({ success: true, message: "Modul muvaffaqiyatli o'chirildi." });
    }

    // 4. Modullar tartibini o'zgartirish (reorder_modules)
    if (action === "reorder_modules") {
      const { moduleIds } = body;
      if (Array.isArray(moduleIds)) {
        for (let i = 0; i < moduleIds.length; i++) {
          await prisma.module.update({
            where: { id: Number(moduleIds[i]) },
            data: { order: i + 1 },
          });
        }
      }
      return NextResponse.json({ success: true, message: "Modullar tartibi saqlandi." });
    }

    // 5. Yangi dars qo'shish
    if (action === "add_lesson") {
      const { moduleId, title, duration, isFree, content, labSlug, isPublished, accessType } = body;
      const count = await prisma.lesson.count({ where: { moduleId: Number(moduleId) } });
      const createdLesson = await prisma.lesson.create({
        data: {
          moduleId: Number(moduleId),
          title: String(title || "Yangi Dars").trim(),
          duration: String(duration || "15 daqiqa").trim(),
          isFree: typeof isFree === "boolean" ? isFree : false,
          isPublished: typeof isPublished === "boolean" ? isPublished : true,
          accessType: accessType || "FREE",
          content: content !== undefined ? String(content) : "## Dars mavzusi\n\nBu yerga dars konspektini yozing.",
          labSlug: labSlug ? String(labSlug).trim() : null,
          order: count + 1,
        },
      });
      return NextResponse.json({ success: true, message: "Dars muvaffaqiyatli qo'shildi.", lesson: createdLesson });
    }

    // 6. Darsni tahrirlash (Matn, isFree, isPublished, labSlug, accessType)
    if (action === "edit_lesson") {
      const { lessonId, title, duration, isFree, content, labSlug, isPublished, accessType } = body;
      const updatedLesson = await prisma.lesson.update({
        where: { id: Number(lessonId) },
        data: {
          title: title ? String(title).trim() : undefined,
          duration: duration ? String(duration).trim() : undefined,
          isFree: typeof isFree === "boolean" ? isFree : undefined,
          isPublished: typeof isPublished === "boolean" ? isPublished : undefined,
          accessType: accessType || undefined,
          content: content !== undefined ? String(content) : undefined,
          labSlug: labSlug !== undefined ? (labSlug ? String(labSlug).trim() : null) : undefined,
        },
      });
      return NextResponse.json({ success: true, message: "Dars muvaffaqiyatli yangilandi.", lesson: updatedLesson });
    }

    // 7. Darsni o'chirish
    if (action === "delete_lesson") {
      const { lessonId } = body;
      await prisma.lesson.delete({ where: { id: Number(lessonId) } });
      return NextResponse.json({ success: true, message: "Dars muvaffaqiyatli o'chirildi." });
    }

    // 8. Darslar tartibini o'zgartirish (reorder_lessons)
    if (action === "reorder_lessons") {
      const { lessonIds } = body;
      if (Array.isArray(lessonIds)) {
        for (let i = 0; i < lessonIds.length; i++) {
          await prisma.lesson.update({
            where: { id: Number(lessonIds[i]) },
            data: { order: i + 1 },
          });
        }
      }
      return NextResponse.json({ success: true, message: "Darslar tartibi saqlandi." });
    }

    // 9. Draft / Published almashtirish (toggle_publish)
    if (action === "toggle_publish") {
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) return NextResponse.json({ success: false, error: "Kurs topilmadi" }, { status: 404 });
      const updated = await prisma.course.update({
        where: { id: courseId },
        data: { isPublished: !course.isPublished },
      });
      return NextResponse.json({ success: true, isPublished: updated.isPublished, message: updated.isPublished ? "Kurs e'lon qilindi." : "Kurs qoralamaga o'tkazildi." });
    }

    // 10. Standart umumiy kurs tahriri
    const { title, desc, fullDesc, level, duration, isPublished, tags, icon } = body;
    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data: {
        ...(title ? { title: String(title).trim() } : {}),
        ...(desc ? { desc: String(desc).trim() } : {}),
        ...(fullDesc ? { fullDesc: String(fullDesc).trim() } : {}),
        ...(level ? { level: String(level).trim() } : {}),
        ...(duration ? { duration: String(duration).trim() } : {}),
        ...(icon ? { icon: String(icon).trim() } : {}),
        ...(Array.isArray(tags) ? { tags } : {}),
        ...(typeof isPublished === "boolean" ? { isPublished } : {}),
      },
    });

    return NextResponse.json({ success: true, course: updatedCourse, message: "Kurs muvaffaqiyatli yangilandi." });
  } catch (err) {
    console.error("Kursni yangilashda xatolik:", err);
    return NextResponse.json({ success: false, error: "Kursni yangilab bo'lmadi." }, { status: 500 });
  }
}
