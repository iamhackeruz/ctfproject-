/**
 * CyberEdu Platform — Production First-Run Administrator Initialization
 * 
 * Ushbu skript ishlab chiqarish muhitida faqat bir marta ishlaydi:
 * - Bazada birorta ham administrator yo'qligini tekshiradi.
 * - Agar admin mavjud bo'lsa, hech qanday o'zgartirish kiritmaydi (Idempotent).
 * - Agar admin bo'lmasa, ADMIN_INIT_EMAIL va ADMIN_INIT_PASSWORD orqali xavfsiz yaratadi.
 * - Demo talaba va soxta ma'lumotlar YARATILMAYDI.
 */

try {
  process.loadEnvFile();
} catch {}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require("module");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request: string, parent: unknown, isMain: boolean, options: unknown) {
  if (request.startsWith("@/")) {
    const sub = request.slice(2);
    const resolvedPath = path.resolve(__dirname, "../src", sub);
    return origResolve.call(this, resolvedPath, parent, isMain, options);
  }
  return origResolve.call(this, request, parent, isMain, options);
};

import { prisma } from "../src/lib/db";
import { Role } from "@prisma/client";
import { hashPassword } from "../src/lib/security/password";
import { CURRICULUM_COURSES } from "../src/data/curriculum";
import { DEFAULT_LABS } from "../src/data/default-labs";
import crypto from "crypto";

async function initProductionAdmin() {
  console.log("\n========================================================");
  console.log("   CYBEREDU PRODUCTION BIRINCHI ISHGA TUSHIRISH (FIRST-RUN)");
  console.log("========================================================\n");

  // 1. Bazada admin mavjudligini tekshirish
  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.admin },
  });

  let adminUser;
  if (existingAdmin) {
    console.log(`[!] Bazada administrator hisobi allaqachon mavjud: ${existingAdmin.email}`);
    console.log("[!] Xavfsizlik qoidasi: Yangi admin yaratilmadi, mavjud hisob saqlandi.");
    adminUser = existingAdmin;
  } else {
    // 2. Yangi birinchi admin yaratish
    const adminEmail = (process.env.ADMIN_INIT_EMAIL || "admin@cyberedu.uz").trim().toLowerCase();
    const adminPass = process.env.ADMIN_INIT_PASSWORD || `Admin#${crypto.randomBytes(8).toString("hex")}!2026`;
    const adminName = process.env.ADMIN_INIT_NAME || "Bosh Kiberxavfsizlik Ustoz";

    if (adminPass.length < 10) {
      throw new Error("ADMIN_INIT_PASSWORD kamida 10 belgidan iborat bo'lishi shart!");
    }

    const passwordHash = await hashPassword(adminPass);

    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        displayName: "CyberEdu_Admin",
        role: Role.admin,
        avatar: "👨‍🏫",
        passwordHash,
        mustChangePassword: false,
      },
    });

    console.log(`[+] Birlamchi administrator muvaffaqiyatli yaratildi:`);
    console.log(`    Email: ${adminUser.email}`);
    console.log(`    Ism:   ${adminUser.name}`);
    if (!process.env.ADMIN_INIT_PASSWORD) {
      console.log(`    Parol (tasodifiy generatsiya): ${adminPass}`);
      console.log(`    [DIQQAT] Ushbu parolni darhol xavfsiz joyga saqlang!`);
    }
  }

  // 3. Kurslar va laboratoriyalarni bazaga yuklash (agar kurslar bo'sh bo'lsa)
  const courseCount = await prisma.course.count();
  if (courseCount === 0) {
    console.log("[*] O'quv dasturi (Curriculum) kurslarini yuklash boshlandi...");
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
    console.log(`[+] Barcha kurslar va testlar yuklandi.`);
  }

  // 4. Laboratoriyalarni yuklash
  const labCount = await prisma.lab.count();
  if (labCount === 0) {
    console.log("[*] Standart laboratoriyalarni yuklash...");
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
    console.log(`[+] Barcha laboratoriyalar yuklandi.`);
  }

  // 5. Standart obuna rejalari (Plans) yuklash
  const planCount = await prisma.plan.count();
  if (planCount === 0) {
    console.log("[*] Standart obuna rejalari (Plans) yuklash...");
    await prisma.plan.createMany({
      data: [
        { name: "Premium Oylik", code: "premium-monthly", interval: "MONTHLY", priceUzs: 150000, isActive: true },
        { name: "Premium Yillik", code: "premium-yearly", interval: "YEARLY", priceUzs: 1200000, isActive: true },
        { name: "Premium Butun Umrlik", code: "premium-lifetime", interval: "LIFETIME", priceUzs: 2500000, isActive: true },
      ],
    });
    console.log(`[+] Standart obuna rejalari yaratildi.`);
  }

  console.log("\n========================================================");
  console.log("   ✅ PRODUCTION TIZIM ISHGA TUSHISHGA TAYYOR!");
  console.log("========================================================\n");
}

initProductionAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Xatolik:", err);
    process.exit(1);
  });
