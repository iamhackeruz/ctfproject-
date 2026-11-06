/**
 * scripts/backup-to-channel-and-reset.ts
 * CyberEdu — Avvalgi ma'lumotlarni zaxiralash, Telegram kanalga yuborish
 * va bazani tozalab, foydalanuvchilar uchun 0 dan toza ishga tushirish skripti.
 *
 * Ishlatish:
 *   npx tsx scripts/backup-to-channel-and-reset.ts [.env fayli]
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { prisma } from "../src/lib/db";
import { Role } from "@prisma/client";
import { hashPassword } from "../src/lib/security/password";

const envArg = process.argv[2] || ".env.production";
const envPath = path.resolve(process.cwd(), envArg);

console.log("\n==========================================================");
console.log("   CYBEREDU MA'LUMOTLARNI ZAXIRALASH, KANALGA YUBORISH");
console.log("   VA BAZANI FOYDALANUVCHILAR UCHUN TOZA ISHGA TUSHIRISH");
console.log("==========================================================\n");

// 1. Env faylni o'qish
function loadEnvVars(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf-8");
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      vars[key] = val;
    }
  }
  return vars;
}

const envVars = loadEnvVars(envPath);
const botToken = envVars.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
const channelId = envVars.TELEGRAM_BACKUP_CHANNEL_ID || envVars.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_BACKUP_CHANNEL_ID || "";
const pgUser = envVars.POSTGRES_USER || "cyberedu_prod_user";
const pgDb = envVars.POSTGRES_DB || "cyberedu_clean_prod";

async function main() {
  // ── 1-QADAM: STATISTIKANI YIG'ISH ──────────────────────────────────────────
  console.log("[1/5] Avvalgi ishlangan ma'lumotlar statistikasi yig'ilmoqda...");
  const [
    totalUsers,
    totalStudents,
    totalSolves,
    totalSubmissions,
    totalAttendances,
    totalAuditLogs,
    usersList,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: Role.student } }),
    prisma.labSubmission.count(),
    prisma.submission.count(),
    prisma.attendanceRecord.count(),
    prisma.auditLog.count(),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true, telegramUsername: true },
      take: 50,
    }),
  ]);

  console.log(`  • Jami foydalanuvchilar: ${totalUsers} (Talabalar: ${totalStudents})`);
  console.log(`  • Topshirilgan lablar:   ${totalSolves}`);
  console.log(`  • Vazifa topshiriqlari:  ${totalSubmissions}`);
  console.log(`  • Davomat qaydlari:      ${totalAttendances}`);
  console.log(`  • Xavfsizlik loglari:    ${totalAuditLogs}`);

  // ── 2-QADAM: MA'LUMOTLAR BAZASINI FAYLGA TO'LIQ ZAXIRALASH (BACKUP) ──────
  console.log("\n[2/5] PostgreSQL ma'lumotlar bazasining to'liq nusxasi olinmoqda...");
  const backupDir = path.resolve(process.cwd(), "backups/db");
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
  const backupFilename = `cyberedu_backup_preclean_${timestamp}.sql.gz`;
  const backupFilePath = path.join(backupDir, backupFilename);
  const reportFilename = `cyberedu_users_report_${timestamp}.json`;
  const reportFilePath = path.join(backupDir, reportFilename);

  // JSON hisoboti
  fs.writeFileSync(
    reportFilePath,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        stats: { totalUsers, totalStudents, totalSolves, totalSubmissions, totalAttendances, totalAuditLogs },
        users: usersList,
      },
      null,
      2
    )
  );

  // pg_dump orqali to'liq bazani olish
  try {
    const dumpCmd = `docker exec cyberedu-postgres-prod pg_dump -U "${pgUser}" "${pgDb}" | gzip -9 > "${backupFilePath}"`;
    execSync(dumpCmd, { stdio: "inherit" });
    const stat = fs.statSync(backupFilePath);
    console.log(`✅ To'liq SQL zaxira saqlandi: ${backupFilename} (${Math.round(stat.size / 1024)} KB)`);
    console.log(`✅ Foydalanuvchilar hisoboti: ${reportFilename}`);
  } catch (err) {
    console.error("❌ Zaxira nusxa olishda xatolik yuz berdi:", err);
    process.exit(1);
  }

  // ── 3-QADAM: TELEGRAM KANALGA YUBORISH (AGAR SOZLANGAN BO'LSA) ──────────────
  console.log("\n[3/5] Ma'lumotlarni Telegram kanalga yuborish tekshirilmoqda...");
  const isBotConfigured = botToken && botToken.length > 20 && !botToken.includes("SIZNING_BOT_TOKEN");
  const isChannelConfigured = channelId && channelId.length > 2 && !channelId.includes("KANAL");

  if (isBotConfigured && isChannelConfigured) {
    try {
      console.log(`  Telegram kanalga (${channelId}) xabar va zaxira fayl yuborilmoqda...`);

      // 1. Matnli xabar
      const captionText =
        `📦 <b>CyberEdu — Avvalgi Ma'lumotlar Zaxirasi va Hisoboti</b>\n\n` +
        `📅 Sana: <code>${new Date().toLocaleString("uz-UZ")}</code>\n` +
        `👥 Jami foydalanuvchilar: <b>${totalUsers}</b> (Talabalar: ${totalStudents})\n` +
        `🧪 Yechilgan lablar: <b>${totalSolves}</b>\n` +
        `📝 Vazifalar: <b>${totalSubmissions}</b>\n` +
        `📊 Davomat: <b>${totalAttendances}</b>\n` +
        `🔒 Audit loglari: <b>${totalAuditLogs}</b>\n\n` +
        `ℹ️ Ushbu ma'lumotlar arxivlandi. Tizim yangi foydalanuvchilar uchun tozalandi.`;

      // 2. SQL zaxirani fayl sifatida yuborish (multipart/form-data)
      const fileBytes = fs.readFileSync(backupFilePath);
      const formData = new FormData();
      formData.append("chat_id", channelId);
      formData.append("caption", captionText);
      formData.append("parse_mode", "HTML");
      formData.append(
        "document",
        new Blob([fileBytes], { type: "application/gzip" }),
        backupFilename
      );

      const sendDocRes = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
        method: "POST",
        body: formData,
      });

      const sendDocData = await sendDocRes.json().catch(() => ({}));
      if (sendDocRes.ok && sendDocData.ok) {
        console.log(`✅ Zaxira fayli Telegram kanalga (${channelId}) muvaffaqiyatli yetkazildi!`);
      } else {
        console.warn(`⚠️ Telegram kanalga yuborishda xatolik:`, sendDocData);
        console.warn(`Zaxira nusxangiz lokal diskda xavfsiz saqlanmoqda: ${backupFilePath}`);
      }
    } catch (tgErr) {
      console.warn(`⚠️ Telegram API xatosi:`, tgErr);
    }
  } else {
    console.log("ℹ️ TELEGRAM_BOT_TOKEN yoki TELEGRAM_BACKUP_CHANNEL_ID to'ldirilmagan.");
    console.log(`ℹ️ Zaxira fayllari xavfsiz holatda server diskida saqlab qolindi:`);
    console.log(`   - ${backupFilePath}`);
    console.log(`   - ${reportFilePath}`);
    console.log(`(Token va kanal ID ni .env fayliga kiritganingizdan so'ng xohlasangiz bularni kanalga yuborishingiz mumkin).`);
  }

  // ── 4-QADAM: BAZANI FOYDALANUVCHILAR UCHUN TOZALASH (CLEAN RESET) ──────────
  console.log("\n[4/5] Bazadagi avvalgi test va eski ma'lumotlar tozalanmoqda...");

  // Bog'liqliklar tartibida xavfsiz tozalash
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE 
    "attendance_records",
    "class_sessions",
    "assignment_extensions",
    "submission_history",
    "submissions",
    "assignments",
    "telegram_connect_codes",
    "notifications",
    "notification_preferences",
    "daily_resource_usages",
    "web_lab_instances",
    "lab_hint_unlocks",
    "lab_submissions",
    "quiz_submissions",
    "lesson_progress",
    "video_progress",
    "enrollments",
    "comments",
    "certificates",
    "password_reset_tokens",
    "sessions",
    "audit_logs",
    "group_members",
    "group_courses",
    "groups",
    "entitlements"
    CASCADE;`);

  // Admin bo'lmagan barcha foydalanuvchilarni tozalash (faqat asosiy admin qoladi)
  await prisma.user.deleteMany({
    where: {
      role: { not: Role.admin },
    },
  });

  // Agar admin ham bo'lmasa, bitta toza bosh administrator yaratish
  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.admin },
  });

  const adminEmail = (envVars.ADMIN_INIT_EMAIL || "admin@cyberedu.uz").trim().toLowerCase();
  const adminPass = envVars.ADMIN_INIT_PASSWORD || "Admin#CyberEdu2026!Secure";
  const adminName = envVars.ADMIN_INIT_NAME || "CyberEdu Bosh Administrator";

  if (!existingAdmin) {
    const passHash = await hashPassword(adminPass);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        displayName: "CyberEdu_Admin",
        role: Role.admin,
        avatar: "👨‍🏫",
        passwordHash: passHash,
        mustChangePassword: false,
      },
    });
    console.log(`✅ Toza administrator yaratildi: ${adminEmail}`);
  } else {
    // Adminning eskirgan sessiyalarini tozalash
    await prisma.session.deleteMany({ where: { userId: existingAdmin.id } });
    console.log(`✅ Asosiy administrator saqlandi: ${existingAdmin.email}`);
  }

  // 4. Kurslar bazada to'liq mavjudligini ta'minlash (Curriculum)
  const courseCount = await prisma.course.count();
  console.log(`✅ O'quv dasturi kurslari bazada to'liq saqlandi (${courseCount} ta kurs faol).`);

  // ── 5-QADAM: CONTAINERLARNI QAYTA ISHGA TUSHIRISH ───────────────────────────
  console.log("\n[5/5] Sayt toza rejimda qayta yuklanmoqda...");
  try {
    execSync("docker compose --env-file .env.production restart app", { stdio: "inherit" });
  } catch {
    console.log("Konteynerni qayta ishga tushirish o'tkazib yuborildi.");
  }

  console.log("\n==========================================================");
  console.log("🎉 TABRIKLAYMIZ! TIZIM TO'LIQ TOZALANDI VA TAYYOR!");
  console.log("==========================================================");
  console.log("1. Avvalgi ma'lumotlar zaxirasi xavfsiz saqlandi:");
  console.log(`   📂 ${backupFilePath}`);
  console.log("2. Barcha test ma'lumotlar tozalandi.");
  console.log("3. Tizim endi haqiqiy foydalanuvchilar (talabalar) ro'yxatdan");
  console.log("   o'tib, darslarni 0 dan boshlashlari uchun tayyor!");
  console.log("==========================================================\n");
}

main()
  .catch((e) => {
    console.error("Xatolik yuz berdi:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
