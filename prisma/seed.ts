import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/security/password";
import { CURRICULUM_COURSES } from "../src/data/curriculum";
import { DEFAULT_LABS } from "../src/data/default-labs";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://cyberedu:cyberedu_secret_pass_2026@127.0.0.1:5433/cyberedu?schema=public";

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export async function seedDatabase() {
  const isDev = process.env.NODE_ENV !== "production";
  console.log(`[*] Baza ma'lumotlarini to'ldirish (Seeding) boshlandi... (Muhit: ${isDev ? "DEVELOPMENT" : "PRODUCTION"})`);

  // 1. Birlamchi Administrator (Admin) yaratish
  const adminEmail = process.env.ADMIN_INIT_EMAIL || "admin@cyberedu.uz";
  const adminRawPass = process.env.ADMIN_INIT_PASSWORD || "Admin#SuperSecret2026!";
  const adminName = process.env.ADMIN_INIT_NAME || "Bosh Ustoz";
  const adminPhone = process.env.ADMIN_INIT_PHONE || "+998901234567";

  const adminPasswordHash = await hashPassword(adminRawPass);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: adminName,
      displayName: adminName,
      phone: adminPhone,
      role: Role.admin,
      avatar: "👨‍🏫",
      passwordHash: adminPasswordHash,
      mustChangePassword: false,
    },
  });

  console.log(`[+] Administrator tayyor: ${adminUser.email} (${adminUser.role})`);

  // 2. Demo Talaba (Faqat development rejimida yaratiladi - Xavfsizlik qoidasi D)
  let studentUser: { id: string; email: string } | null = null;
  if (isDev) {
    const studentEmail = "student@cyberedu.uz";
    const studentPassHash = await hashPassword("Student#2026!Pass");

    studentUser = await prisma.user.upsert({
      where: { email: studentEmail },
      update: {},
      create: {
        email: studentEmail,
        name: "Sardor Aliyev",
        displayName: "Sardor_Hacker",
        role: Role.student,
        avatar: "👨‍🎓",
        passwordHash: studentPassHash,
        mustChangePassword: false,
      },
    });

    console.log(`[+] [DEV ONLY] Demo talaba tayyor: ${studentUser.email}`);
  }

  // 3. 7 ta O'quv Kursi, Modullar, Konspektlar va Quizlar (4-Bosqich)
  // [XAVFSIZLIK / SEED QOIDASI]: create-only, mavjud bazadagi kontentni HECH QACHON o'zgartirmaydi
  console.log(`[*] 7 ta asosiy kiberxavfsizlik kurslarini tekshirish / yaratish...`);
  for (const c of CURRICULUM_COURSES) {
    const createdCourse = await prisma.course.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        slug: c.slug,
        title: c.title,
        icon: c.icon,
        desc: c.desc,
        fullDesc: c.fullDesc,
        level: c.level,
        levelColor: c.levelColor,
        color: c.color,
        accent: c.accent,
        badge: c.badge,
        bLabel: c.bLabel,
        duration: c.duration,
        tags: c.tags,
        instructorName: c.instructor.name,
        instructorRole: c.instructor.role,
        instructorAvatar: c.instructor.avatar,
        instructorExp: c.instructor.experience,
        whatYouWillLearn: c.whatYouWillLearn,
        prerequisites: c.prerequisites,
        isPublished: true,
      },
    });

    for (let mIdx = 0; mIdx < c.modules.length; mIdx++) {
      const m = c.modules[mIdx];
      const moduleId = c.id * 100 + (mIdx + 1);
      const createdModule = await prisma.module.upsert({
        where: { id: moduleId },
        update: {},
        create: {
          id: moduleId,
          courseId: createdCourse.id,
          title: m.title,
          duration: m.duration,
          order: mIdx + 1,
        },
      });

      for (let lIdx = 0; lIdx < m.lessons.length; lIdx++) {
        const l = m.lessons[lIdx];
        const lessonId = moduleId * 10 + (lIdx + 1);
        const createdLesson = await prisma.lesson.upsert({
          where: { id: lessonId },
          update: {},
          create: {
            id: lessonId,
            moduleId: createdModule.id,
            title: l.title,
            duration: l.duration,
            isFree: l.isFree ?? false,
            content: l.content,
            labSlug: l.labSlug,
            order: lIdx + 1,
          },
        });

        if (l.quiz) {
          const quiz = await prisma.quiz.upsert({
            where: { lessonId: createdLesson.id },
            update: {},
            create: {
              lessonId: createdLesson.id,
              title: l.quiz.title,
              passingScore: l.quiz.passingScore,
              maxAttempts: l.quiz.maxAttempts,
            },
          });

          const existingQuestionsCount = await prisma.quizQuestion.count({ where: { quizId: quiz.id } });
          if (existingQuestionsCount === 0) {
            for (let qIdx = 0; qIdx < l.quiz.questions.length; qIdx++) {
              const q = l.quiz.questions[qIdx];
              await prisma.quizQuestion.create({
                data: {
                  quizId: quiz.id,
                  question: q.question,
                  options: q.options,
                  correctOption: q.correctOption,
                  explanation: q.explanation || null,
                  order: qIdx + 1,
                },
              });
            }
          }
        }
      }
    }
  }

  console.log(`[+] 7 ta kurs, modullar, konspektlar va quizlar tekshirildi/yuklandi.`);

  // 4. 15 ta Kiberxavfsizlik Laboratoriyasi (3-Bosqich talabi)
  console.log(`[*] 15 ta laboratoriya ma'lumotlarini tekshirish / yuklash...`);
  for (const lab of DEFAULT_LABS) {
    await prisma.lab.upsert({
      where: { id: lab.id },
      update: {},
      create: {
        id: lab.id,
        slug: lab.slug,
        title: lab.title,
        category: lab.category,
        difficulty: lab.difficulty,
        points: lab.points,
        type: lab.type,
        description: lab.description,
        hint1: lab.hint1,
        hint2: lab.hint2,
        hint3: lab.hint3,
        guide: lab.guide,
        courseId: lab.courseId,
      },
    });
  }

  console.log(`[+] 15 ta laboratoriya muvaffaqiyatli yuklandi.`);

  // 5. Demo talabani kursga yozib qo'yish (faqat dev)
  if (isDev && studentUser) {
    await prisma.enrollment.upsert({
      where: {
        userId_courseId: {
          userId: studentUser.id,
          courseId: 1,
        },
      },
      update: {},
      create: {
        userId: studentUser.id,
        courseId: 1,
      },
    });
    console.log(`[+] [DEV ONLY] Demo talaba 1-kursga yozildi.`);
  }

  // PostgreSQL serial sequence'ni eng yuqori ID ga moslab yangilash
  await prisma.$executeRawUnsafe(
    "SELECT setval(pg_get_serial_sequence('courses', 'id'), COALESCE(MAX(id), 1)) FROM courses;"
  );

  console.log("[+] Barcha boshlang'ich ma'lumotlar muvaffaqiyatli to'ldirildi!");
}

if (typeof require !== "undefined" && require.main === module) {
  seedDatabase()
    .catch((e) => {
      console.error("[-] Seed xatoligi:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
