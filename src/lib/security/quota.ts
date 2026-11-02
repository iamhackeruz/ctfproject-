/**
 * src/lib/security/quota.ts
 * Kunlik terminal va veb-laboratoriya kvotalarini tekshirish va sarflangan vaqt hisobini yuritish.
 * - Server vaqti (UTC sana) bo'yicha har kuni 00:00 da avtomatik nolga aylanadi.
 * - Admin, instructor va taklif kodi (invite code) bilan kirgan o'quv markaz talabalari uchun kvota cheklanmagan (unlimited).
 * - Ochiq ro'yxatdan o'tgan talabalarga kunlik cheklovlar (masalan, 60 min terminal, 30 min lab).
 */

import { prisma } from "../db";
import { Role } from "@prisma/client";

export function getTodayServerDate(): string {
  // Server vaqti bo'yicha bugungi sana (UTC YYYY-MM-DD)
  return new Date().toISOString().slice(0, 10);
}

export function isUserQuotaExempt(user: {
  role: Role;
  registeredWithInvite?: boolean;
  dailyTerminalQuotaMinutes?: number;
  dailyLabQuotaMinutes?: number;
}): boolean {
  // 1. Admin va Ustozlar cheklanmagan
  if (user.role === Role.admin || user.role === Role.instructor || user.role === Role.accountant) {
    return true;
  }
  // 2. Taklif kodi bilan kelgan o'quv markaz talabalari cheklanmagan
  if (user.registeredWithInvite === true) {
    return true;
  }
  // 3. Kvotasi 0 qilib belgilangan (unlimited) foydalanuvchilar
  if (user.dailyTerminalQuotaMinutes === 0 && user.dailyLabQuotaMinutes === 0) {
    return true;
  }
  return false;
}

export interface QuotaCheckResult {
  allowed: boolean;
  remainingMinutes: number;
  usedMinutes: number;
  quotaMinutes: number;
  reason?: string;
}

/**
 * Terminaldan foydalanish kvotasini tekshirish va buyruq vaqtini sarflangan vaqtga qo'shish.
 */
export async function checkAndRecordTerminalUsage(
  userId: string,
  commandDurationMs: number = 0
): Promise<QuotaCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      registeredWithInvite: true,
      dailyTerminalQuotaMinutes: true,
      dailyLabQuotaMinutes: true,
    },
  });

  if (!user) {
    return {
      allowed: false,
      remainingMinutes: 0,
      usedMinutes: 0,
      quotaMinutes: 0,
      reason: "Foydalanuvchi hisobi topilmadi.",
    };
  }

  if (isUserQuotaExempt(user) || user.dailyTerminalQuotaMinutes <= 0) {
    return {
      allowed: true,
      remainingMinutes: Infinity,
      usedMinutes: 0,
      quotaMinutes: 0,
    };
  }

  const today = getTodayServerDate();
  const usage = await prisma.dailyResourceUsage.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  const used = usage?.terminalMinutes || 0;
  const quota = user.dailyTerminalQuotaMinutes;

  if (used >= quota) {
    return {
      allowed: false,
      remainingMinutes: 0,
      usedMinutes: used,
      quotaMinutes: quota,
      reason: `Kunlik terminal vaqti limiti tugadi (${quota} daqiqa). Limit ertaga server vaqti bilan soat 00:00 da yangilanadi.`,
    };
  }

  // Sarflangan vaqtni hisoblash: buyruqlar orasidagi faollik oralig'iga qarab
  const now = new Date();
  let deltaMinutes = 1.0; // Standart faollik bloki: 1 daqiqa
  if (usage?.lastTerminalAt) {
    const elapsedMs = now.getTime() - usage.lastTerminalAt.getTime();
    if (elapsedMs > 0 && elapsedMs <= 120_000) {
      // 2 daqiqa ichida faol terish: haqiqiy o'tgan daqiqani qo'shish
      deltaMinutes = Math.max(0.1, Number((elapsedMs / 60000).toFixed(2)));
    }
  }

  // Agar buyruq bajarilishi uzoqroq vaqt olgan bo'lsa
  if (commandDurationMs > 60_000) {
    deltaMinutes = Math.max(deltaMinutes, Number((commandDurationMs / 60000).toFixed(2)));
  }

  const updatedUsage = await prisma.dailyResourceUsage.upsert({
    where: { userId_date: { userId, date: today } },
    create: {
      userId,
      date: today,
      terminalMinutes: deltaMinutes,
      lastTerminalAt: now,
    },
    update: {
      terminalMinutes: { increment: deltaMinutes },
      lastTerminalAt: now,
    },
  });

  const newUsed = updatedUsage.terminalMinutes;
  return {
    allowed: true,
    remainingMinutes: Math.max(0, quota - newUsed),
    usedMinutes: newUsed,
    quotaMinutes: quota,
  };
}

/**
 * Web Lab instansiyasini ochishdan oldin kunlik lab kvotasini tekshirish.
 */
export async function checkLabQuota(userId: string): Promise<QuotaCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      registeredWithInvite: true,
      dailyTerminalQuotaMinutes: true,
      dailyLabQuotaMinutes: true,
    },
  });

  if (!user) {
    return {
      allowed: false,
      remainingMinutes: 0,
      usedMinutes: 0,
      quotaMinutes: 0,
      reason: "Foydalanuvchi hisobi topilmadi.",
    };
  }

  if (isUserQuotaExempt(user) || user.dailyLabQuotaMinutes <= 0) {
    return {
      allowed: true,
      remainingMinutes: Infinity,
      usedMinutes: 0,
      quotaMinutes: 0,
    };
  }

  const today = getTodayServerDate();
  const usage = await prisma.dailyResourceUsage.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  const used = usage?.labMinutes || 0;
  const quota = user.dailyLabQuotaMinutes;

  if (used >= quota) {
    return {
      allowed: false,
      remainingMinutes: 0,
      usedMinutes: used,
      quotaMinutes: quota,
      reason: `Kunlik laboratoriya (Web Lab) vaqti limiti tugadi (${quota} daqiqa). Limit ertaga server vaqti bilan soat 00:00 da yangilanadi.`,
    };
  }

  return {
    allowed: true,
    remainingMinutes: Math.max(0, quota - used),
    usedMinutes: used,
    quotaMinutes: quota,
  };
}

/**
 * Web Lab instansiyasi uchun sarflangan vaqtni hisobga yozish.
 */
export async function recordLabUsage(userId: string, minutes: number): Promise<void> {
  if (minutes <= 0) return;
  const today = getTodayServerDate();
  const now = new Date();

  await prisma.dailyResourceUsage.upsert({
    where: { userId_date: { userId, date: today } },
    create: {
      userId,
      date: today,
      labMinutes: minutes,
      lastLabAt: now,
    },
    update: {
      labMinutes: { increment: minutes },
      lastLabAt: now,
    },
  });
}
