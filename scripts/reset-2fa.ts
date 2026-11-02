#!/usr/bin/env node
/**
 * ==============================================================================
 * CyberEdu Platform — Favqulodda Administrator 2FA Tiklash Skripti (scripts/reset-2fa.ts)
 *
 * Ishlatilishi:
 *   ADMIN_RESET_TOKEN="kriptografik_maxfiy_token" node scripts/reset-2fa.js [admin_email]
 *
 * Xavfsizlik qoidalari:
 * 1. Faqat server shell'ida to'g'ridan-to'g'ri ishga tushiriladi (HTTP orqali ulanib bo'lmaydi).
 * 2. ADMIN_RESET_TOKEN muhit o'zgaruvchisi kiritilishi shart.
 * 3. Audit log tizimiga '2FA_RESET_SHELL' yozuvi qoldiriladi.
 * 4. Tiklangan administratorning barcha faol sessiyalari xavfsizlik yuzasidan darhol bekor qilinadi.
 * ==============================================================================
 */

try {
  process.loadEnvFile();
} catch {}

import { prisma } from "../src/lib/db";
import { Role } from "@prisma/client";
import { revokeAllUserSessions } from "../src/lib/security/session";
import { recordAuditLog } from "../src/lib/security/audit";

async function main() {
  const resetToken = process.env.ADMIN_RESET_TOKEN;
  if (!resetToken || resetToken.trim().length < 16) {
    console.error("\n❌ XAVFSIZLIK XATOSI: ADMIN_RESET_TOKEN muhit o'zgaruvchisi o'rnatilmagan yoki juda qisqa (kamida 16 belgi).");
    console.error("Ishlatish namunasi:");
    console.error("  ADMIN_RESET_TOKEN=\"xavfsiz_token\" npx tsx scripts/reset-2fa.ts [admin_email]\n");
    process.exit(1);
  }

  const targetEmail = process.argv[2]?.trim().toLowerCase();

  let adminUser;
  if (targetEmail) {
    adminUser = await prisma.user.findFirst({
      where: { email: targetEmail },
    });
    if (!adminUser) {
      console.error(`\n❌ XATO: '${targetEmail}' pochtasiga ega foydalanuvchi topilmadi.\n`);
      process.exit(1);
    }
  } else {
    // Agar email ko'rsatilmagan bo'lsa, birinchi faol adminni topish
    adminUser = await prisma.user.findFirst({
      where: { role: Role.admin, isBlocked: false },
      orderBy: { createdAt: "asc" },
    });
    if (!adminUser) {
      console.error("\n❌ XATO: Tizimda faol administrator topilmadi.\n");
      process.exit(1);
    }
  }

  console.log(`\n[*] Administrator 2FA holati tekshirilmoqda: ${adminUser.name} (${adminUser.email})`);

  // 1. Bazada 2FA holatini tozalash
  await prisma.$transaction([
    prisma.twoFactorBackupCode.deleteMany({ where: { userId: adminUser.id } }),
    prisma.user.update({
      where: { id: adminUser.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorTempSecret: null,
        twoFactorFailedAttempts: 0,
        twoFactorLockoutUntil: null,
        twoFactorLastUsedStep: null,
      },
    }),
  ]);

  // 2. Barcha faol sessiyalarni bekor qilish
  const revokedCount = await revokeAllUserSessions(adminUser.id);

  // 3. Xavfsizlik audit logiga yozish
  await recordAuditLog({
    userId: adminUser.id,
    action: "2FA_RESET_SHELL",
    ip: "127.0.0.1 (CLI Shell)",
    status: "SUCCESS",
    details: {
      targetEmail: adminUser.email,
      revokedSessions: revokedCount,
      timestamp: new Date().toISOString(),
    },
  });

  console.log(`✅ MUVAFFAQIShAT: ${adminUser.email} hisobining 2FA himoyasi muvaffaqiyatli tiklandi!`);
  console.log(`   - 2FA holati: O'chirildi (first login da yangidan sozlashi shart)`);
  console.log(`   - Bekor qilingan faol sessiyalar: ${revokedCount} ta`);
  console.log(`   - Audit log yozuvi: 2FA_RESET_SHELL saqlandi.\n`);
}

main()
  .catch((err) => {
    console.error("Kutilmagan xatolik yuz berdi:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
