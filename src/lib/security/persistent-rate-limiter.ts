import { prisma } from "../db";

/**
 * PostgreSQL bazasiga tayanuvchi, server qayta ishga tushganda ham saqlanib qoluvchi
 * ishonchli (persistent) Rate Limiter.
 */
export async function checkPersistentRateLimit(
  key: string,
  maxPoints: number,
  windowSeconds: number,
  increment = true
): Promise<{ limited: boolean; remainingPoints: number; retryAfterSeconds?: number }> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);

  try {
    const entry = await prisma.rateLimitEntry.findUnique({
      where: { key },
    });

    // 1. Agar yozuv mavjud bo'lmasa yoki vaqt oynasi tugagan bo'lsa
    if (!entry || entry.resetAt < now) {
      if (increment) {
        await prisma.rateLimitEntry.upsert({
          where: { key },
          update: {
            count: 1,
            resetAt,
          },
          create: {
            key,
            count: 1,
            resetAt,
          },
        });
        return {
          limited: false,
          remainingPoints: Math.max(0, maxPoints - 1),
        };
      }
      return {
        limited: false,
        remainingPoints: maxPoints,
      };
    }

    // 2. Agar limit oshgan bo'lsa
    if (entry.count >= maxPoints) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt.getTime() - now.getTime()) / 1000));
      return {
        limited: true,
        remainingPoints: 0,
        retryAfterSeconds: retryAfter,
      };
    }

    // 3. Hisoblagichni oshirish
    if (increment) {
      const updated = await prisma.rateLimitEntry.update({
        where: { key },
        data: {
          count: { increment: 1 },
        },
      });

      return {
        limited: false,
        remainingPoints: Math.max(0, maxPoints - updated.count),
      };
    }

    return {
      limited: false,
      remainingPoints: Math.max(0, maxPoints - entry.count),
    };
  } catch (err) {
    // Agar baza bilan bog'liq vaqtinchalik muammo bo'lsa, xavfsiz holda davom etish
    console.error("Rate limit xatosi:", err);
    return { limited: false, remainingPoints: 1 };
  }
}

/**
 * Muddati o'tgan eski rate limit yozuvlarini tozalash
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  try {
    const res = await prisma.rateLimitEntry.deleteMany({
      where: {
        resetAt: { lt: new Date() },
      },
    });
    return res.count;
  } catch {
    return 0;
  }
}
