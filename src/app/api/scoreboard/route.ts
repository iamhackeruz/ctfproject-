import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { escapeHtml } from "@/lib/security/sanitize";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    // Barcha to'g'ri topshirilgan lablarni olish
    const submissions = await prisma.labSubmission.findMany({
      where: {
        isCorrect: true,
        user: { isBlocked: false },
        ...(category && category !== "Barchasi"
          ? { lab: { category: { equals: category, mode: "insensitive" } } }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatar: true,
          },
        },
        lab: {
          select: {
            id: true,
            slug: true,
            title: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Foydalanuvchilar bo'yicha guruhlash
    interface UserScoreMeta {
      userId: string;
      displayName: string;
      avatar: string;
      totalScore: number;
      solvedLabs: Set<string>;
      firstBloodCount: number;
      lastSolvedAt: Date;
    }

    const userMap = new Map<string, UserScoreMeta>();

    for (const sub of submissions) {
      const u = sub.user;
      // Xavfsizlik: Email hech qachon oshkor qilinmaydi!
      const displayName = u.displayName || u.name || "Anonim Talaba";
      const avatar = u.avatar || "👨‍🎓";

      let entry = userMap.get(u.id);
      if (!entry) {
        entry = {
          userId: u.id,
          displayName,
          avatar,
          totalScore: 0,
          solvedLabs: new Set<string>(),
          firstBloodCount: 0,
          lastSolvedAt: sub.createdAt,
        };
        userMap.set(u.id, entry);
      }

      if (!entry.solvedLabs.has(sub.labId)) {
        entry.solvedLabs.add(sub.labId);
        entry.totalScore += sub.pointsEarned;
        if (sub.isFirstBlood) {
          entry.firstBloodCount += 1;
        }
        if (sub.createdAt > entry.lastSolvedAt) {
          entry.lastSolvedAt = sub.createdAt;
        }
      }
    }

    // Saralash: Ball kamayish tartibida, teng bo'lsa vaqt bo'yicha oldinroq yechgan yuqorida
    const leaderboard = Array.from(userMap.values())
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        return a.lastSolvedAt.getTime() - b.lastSolvedAt.getTime();
      })
      .map((entry, index) => ({
        rank: index + 1,
        displayName: escapeHtml(entry.displayName),
        avatar: entry.avatar,
        totalScore: entry.totalScore,
        solvedCount: entry.solvedLabs.size,
        firstBloodCount: entry.firstBloodCount,
        lastSolvedAt: entry.lastSolvedAt.toISOString(),
      }));

    // First Blood faxriy ro'yxati
    const firstBloods = submissions
      .filter((s) => s.isFirstBlood)
      .map((s) => ({
        labTitle: s.lab.title,
        labCategory: s.lab.category,
        displayName: escapeHtml(s.user.displayName || s.user.name || "Anonim"),
        avatar: s.user.avatar || "🩸",
        solvedAt: s.createdAt.toISOString(),
      }));

    return NextResponse.json({
      success: true,
      category: category || "Barchasi",
      totalParticipants: userMap.size,
      totalSolves: submissions.length,
      leaderboard,
      firstBloods,
    });
  } catch (err) {
    console.error("Scoreboard GET xatosi:", err);
    return NextResponse.json(
      { success: false, error: "Reyting jadvalini yuklab bo'lmadi." },
      { status: 500 }
    );
  }
}
