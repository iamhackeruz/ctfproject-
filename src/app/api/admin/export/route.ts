import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { Role } from "@prisma/client";

/**
 * Formula Injection (CSV Injection) himoyasi:
 * Agar matn '=', '+', '-', '@', '\t', '\r' bilan boshlansa, uni bitta tirnoq (') bilan himoyalaymiz.
 */
function safeCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = String(value).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // Qo'shtirnoqlarni escape qilish
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req, [Role.admin]);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "students"; // students | quizzes | labs | certificates

    let csvContent = "";
    let filename = `cyberedu_${type}_${Date.now()}.csv`;

    if (type === "students") {
      filename = `cyberedu_talabalar_${Date.now()}.csv`;
      const students = await prisma.user.findMany({
        where: { role: Role.student },
        orderBy: { createdAt: "desc" },
        include: {
          groupMemberships: { include: { group: true } },
          _count: {
            select: {
              enrollments: true,
              lessonProgress: { where: { completed: true } },
              labSubmissions: { where: { isCorrect: true } },
              certificates: true,
            },
          },
        },
      });

      const header = ["ID", "Ism", "Email", "Telefon", "Guruh", "Kurslar soni", "Yakunlangan darslar", "Yechilgan lablar", "Sertifikatlar", "Holat", "Ro'yxatdan o'tgan sana"];
      const rows = students.map((s) => [
        s.id,
        s.name,
        s.email,
        s.phone || "",
        s.groupMemberships.map((m) => m.group.name).join(", "),
        s._count.enrollments,
        s._count.lessonProgress,
        s._count.labSubmissions,
        s._count.certificates,
        s.isBlocked ? "Bloklangan" : "Faol",
        s.createdAt.toISOString().slice(0, 10),
      ]);

      csvContent = [
        header.map(safeCell).join(","),
        ...rows.map((r) => r.map(safeCell).join(",")),
      ].join("\r\n");
    } else if (type === "labs") {
      filename = `cyberedu_laboratoriyalar_${Date.now()}.csv`;
      const submissions = await prisma.labSubmission.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, email: true } },
          lab: { select: { title: true, category: true, points: true } },
        },
      });

      const header = ["ID", "Talaba", "Email", "Laboratoriya", "Kategoriya", "Natija", "Topshirilgan Flag", "Ball", "First Blood", "Vaqt"];
      const rows = submissions.map((sub) => [
        sub.id,
        sub.user.name,
        sub.user.email,
        sub.lab.title,
        sub.lab.category,
        sub.isCorrect ? "To'g'ri" : "Xato",
        sub.submittedFlag,
        sub.pointsEarned,
        sub.isFirstBlood ? "HA" : "YO'Q",
        sub.createdAt.toISOString(),
      ]);

      csvContent = [
        header.map(safeCell).join(","),
        ...rows.map((r) => r.map(safeCell).join(",")),
      ].join("\r\n");
    } else if (type === "quizzes") {
      filename = `cyberedu_quiz_ballari_${Date.now()}.csv`;
      const quizSubs = await prisma.quizSubmission.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, email: true } },
          quiz: { select: { title: true, passingScore: true } },
        },
      });

      const header = ["ID", "Talaba", "Email", "Test Nomi", "Ball", "O'tish Bali", "Natija", "Urinishlar Soni", "Sana"];
      const rows = quizSubs.map((qs) => [
        qs.id,
        qs.user.name,
        qs.user.email,
        qs.quiz.title,
        `${qs.score}%`,
        `${qs.quiz.passingScore}%`,
        qs.passed ? "O'tdi" : "Yiqildi",
        qs.attemptsCount,
        qs.createdAt.toISOString(),
      ]);

      csvContent = [
        header.map(safeCell).join(","),
        ...rows.map((r) => r.map(safeCell).join(",")),
      ].join("\r\n");
    } else if (type === "certificates") {
      filename = `cyberedu_sertifikatlar_${Date.now()}.csv`;
      const certs = await prisma.certificate.findMany({
        orderBy: { issuedAt: "desc" },
        include: {
          user: { select: { name: true, email: true } },
        },
      });

      const header = ["Sertifikat ID", "Kod", "Talaba", "Email", "Kurs Nomi", "Baho", "Berilgan Sana"];
      const rows = certs.map((c) => [
        c.id,
        c.certificateCode,
        c.userName,
        c.user.email,
        c.courseTitle,
        c.grade,
        c.issuedAt.toISOString().slice(0, 10),
      ]);

      csvContent = [
        header.map(safeCell).join(","),
        ...rows.map((r) => r.map(safeCell).join(",")),
      ].join("\r\n");
    } else {
      return NextResponse.json({ success: false, error: "Noma'lum eksport turi." }, { status: 400 });
    }

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
