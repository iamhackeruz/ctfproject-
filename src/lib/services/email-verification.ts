/**
 * src/lib/services/email-verification.ts
 * Ochiq ro'yxatdan o'tgan foydalanuvchilarning elektron pochtasini tasdiqlash
 * va 7 kundan oshgan tasdiqlanmagan hisoblarni avtomatik tozalash (pruning).
 */

import crypto from "crypto";
import { prisma } from "../db";
import { emailService } from "./email";
import { Role } from "@prisma/client";

const TOKEN_EXPIRY_MINUTES = 30; // 30 daqiqa yaroqlilik muddati
const UNVERIFIED_ACCOUNT_PRUNE_DAYS = 7; // 7 kundan keyin o'chirish

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateVerificationToken(): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);
  return { rawToken, tokenHash, expiresAt };
}

export async function sendEmailVerification(
  email: string,
  rawToken: string
): Promise<{ success: boolean; message?: string }> {
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;

  const dispatch = await emailService.sendVerificationEmail(email, verifyUrl);
  return {
    success: dispatch.success,
    message: dispatch.message,
  };
}

export async function verifyEmailToken(rawToken: string): Promise<{
  success: boolean;
  error?: string;
  userId?: string;
  email?: string;
}> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length === 0) {
    return {
      success: false,
      error: "Tasdiqlash tokeni taqdim etilmadi.",
    };
  }

  const tokenHash = hashToken(rawToken.trim());
  const now = new Date();

  const user = await prisma.user.findFirst({
    where: {
      verificationTokenHash: tokenHash,
    },
  });

  if (!user) {
    return {
      success: false,
      error: "Tasdiqlash kodi topilmadi yoki allaqachon ishlatilgan.",
    };
  }

  if (user.verificationExpires && user.verificationExpires < now) {
    return {
      success: false,
      error: "Tasdiqlash kodining amal qilish muddati tugagan (30 daqiqa). Iltimos, qayta ro'yxatdan o'ting.",
    };
  }

  // Hisobni tasdiqlash va tokenni tozalash
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verificationTokenHash: null,
      verificationExpires: null,
    },
  });

  return {
    success: true,
    userId: user.id,
    email: user.email,
  };
}

/**
 * 7 kundan oshgan va pochtasi tasdiqlanmagan talaba hisoblarini tozalash
 */
export async function pruneUnverifiedAccounts(): Promise<number> {
  const cutoffDate = new Date(Date.now() - UNVERIFIED_ACCOUNT_PRUNE_DAYS * 24 * 60 * 60 * 1000);

  const deleteResult = await prisma.user.deleteMany({
    where: {
      emailVerified: false,
      role: Role.student,
      createdAt: { lt: cutoffDate },
    },
  });

  if (deleteResult.count > 0) {
    console.log(`[PRUNING] ${deleteResult.count} ta 7 kundan oshgan tasdiqlanmagan hisob tozalandi.`);
  }

  return deleteResult.count;
}
