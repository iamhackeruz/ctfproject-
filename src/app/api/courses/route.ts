import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { getUserActiveEntitlements, evaluateLessonAccess } from "@/lib/security/entitlements";
import { Role } from "@prisma/client";

// GET /api/courses — Kurslarni olish (Talabaga faqat published, Ustozga barchasi)
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getSessionUser(req);
    const isStaff = user && (user.role === Role.admin || user.role === Role.instructor);

    const courseWhere: Record<string, unknown> = isStaff ? {} : { isPublished: true };
    const lessonWhere: Record<string, unknown> = isStaff ? {} : { isPublished: true };

    const courses = await prisma.course.findMany({
      where: courseWhere,
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              where: lessonWhere,
              orderBy: { order: "asc" },
            },
          },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });

    const userObj = user ? { id: user.userId, role: user.role, isBlocked: user.isBlocked } : null;
    const userEntitlements = (!isStaff && userObj) ? await getUserActiveEntitlements(userObj.id) : null;

    // N+1 muammosiz: barcha darslar huquqini xotirada tezkor baholash
    const processedCourses = courses.map((course) => {
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
              lockedMessage: access.reason || "Ushbu dars qulflangan.",
            };
          }
          return { ...les, isLocked: false };
        });
        return { ...mod, lessons: processedLessons };
      });
      return { ...course, modules: processedModules };
    });

    return NextResponse.json({ success: true, courses: processedCourses });
  } catch (err) {
    console.error("Kurslarni olishda xatolik:", err);
    return NextResponse.json({ success: false, error: "Kurslarni yuklab bo'lmadi." }, { status: 500 });
  }
}

// POST /api/courses — Yangi kurs yaratish (RBAC: Faqat Admin yoki Instructor)
export async function POST(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) {
    return authResult; // 401 yoki 403 qaytaradi
  }

  const { user } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { title, desc, fullDesc, level, duration, tags, modules } = body;

    if (!title || !desc) {
      return NextResponse.json(
        { success: false, error: "Kurs sarlavhasi va tavsifi kiritilishi shart." },
        { status: 400 }
      );
    }

    const slug = `course-${Date.now()}`;
    const levelVal = level || "Boshlang'ich";
    const levelColor =
      levelVal === "Ilg'or" ? "badge-orange" : levelVal === "O'rta" ? "badge-blue" : "badge-green";

    const newCourse = await prisma.course.create({
      data: {
        slug,
        title: title.trim(),
        desc: desc.trim(),
        fullDesc: (fullDesc || desc).trim(),
        level: levelVal,
        levelColor,
        duration: duration || "8 soat",
        tags: Array.isArray(tags) ? tags : ["Kiberxavfsizlik"],
        instructorName: user.name || "Bosh Ustoz",
        instructorRole: "Kiberxavfsizlik Eksperti",
        instructorAvatar: user.avatar || "👨‍🏫",
        whatYouWillLearn: ["Amaliy ko'nikmalar", "Xavfsizlik choralari"],
        prerequisites: ["Boshlang'ich IT bilimlari"],
        isPublished: true,
      },
    });

    // Modullar va darslar qo'shilgan bo'lsa
    if (Array.isArray(modules)) {
      let modIdx = 0;
      for (const m of modules) {
        modIdx++;
        const createdMod = await prisma.module.create({
          data: {
            courseId: newCourse.id,
            title: m.title || `${modIdx}-Modul`,
            duration: m.duration || "1 soat",
            order: modIdx,
          },
        });

        if (Array.isArray(m.lessons)) {
          let lesIdx = 0;
          for (const l of m.lessons) {
            lesIdx++;
            await prisma.lesson.create({
              data: {
                moduleId: createdMod.id,
                title: l.title || `${lesIdx}-Dars`,
                duration: l.duration || "15 daqiqa",
                order: lesIdx,
                content: `### ${l.title || "Dars"}\nUshbu darsning amaliy va nazariy konspekti.`,
              },
            });
          }
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1",
        action: "COURSE_CREATE",
        status: "SUCCESS",
        details: JSON.stringify({ courseId: newCourse.id, title: newCourse.title }),
      },
    });

    return NextResponse.json({ success: true, course: newCourse });
  } catch (err) {
    console.error("Kurs yaratish xatosi:", err);
    return NextResponse.json({ success: false, error: "Kursni saqlab bo'lmadi." }, { status: 500 });
  }
}
