import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import {
  createDbSession,
  getSessionUser,
  revokeCurrentSession,
  attachSessionCookie,
  clearSessionCookie,
  listUserSessions,
  revokeSessionById,
  revokeAllUserSessions,
} from "@/lib/security/session";
import { getReliableClientIp } from "@/lib/security/client-ip";
import { recordAuditLog } from "@/lib/security/audit";
import {
  validatePassword,
  hashPassword,
  verifyPasswordHash,
} from "@/lib/security/password";
import { verifyCsrf } from "@/lib/security/csrf";
import { emailService, isSmtpConfigured } from "@/lib/services/email";
import { verifyCaptchaToken } from "@/lib/security/captcha";
import {
  generateVerificationToken,
  sendEmailVerification,
} from "@/lib/services/email-verification";
import { validateDisplayName } from "@/lib/security/sanitize";
import { Role } from "@prisma/client";
import {
  generateTotpSecret,
  encryptTotpSecret,
  decryptTotpSecret,
  verifyTotpCode,
  generateTotpUri,
  generateTotpQrSvg,
  generateBackupCodes,
  hashBackupCode,
  create2FaPendingToken,
  verify2FaPendingToken,
} from "@/lib/security/totp";

// IP bo'yicha kirish limitlari: 5 xato urinish / 15 daqiqa
interface RateTracker {
  attempts: number;
  firstAttempt: number;
}
const ipLoginRateMap = new Map<string, RateTracker>();
const ip2FaRateMap = new Map<string, RateTracker>();
const ipResetRateMap = new Map<string, RateTracker>();
const accountResetRateMap = new Map<string, RateTracker>();

function checkRateLimit(
  map: Map<string, RateTracker>,
  key: string,
  maxAttempts: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = map.get(key);
  if (!entry) return false;
  if (now - entry.firstAttempt > windowMs) {
    map.delete(key);
    return false;
  }
  return entry.attempts >= maxAttempts;
}

function recordRateAttempt(
  map: Map<string, RateTracker>,
  key: string,
  windowMs: number
) {
  const now = Date.now();
  const entry = map.get(key);
  if (!entry || now - entry.firstAttempt > windowMs) {
    map.set(key, { attempts: 1, firstAttempt: now });
  } else {
    entry.attempts += 1;
  }
}

function clearRateLimit(map: Map<string, RateTracker>, key: string) {
  map.delete(key);
}

// ── GET: Joriy sessiyadagi foydalanuvchini olish ────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser(req);
  return NextResponse.json({
    authenticated: !!user,
    user: user || null,
  });
}

// ── POST: Autentifikatsiya amallari ──────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  // CSRF Himoyasi
  const csrf = verifyCsrf(req);
  if (!csrf.valid) {
    return csrf.response!;
  }

  const clientIp = getReliableClientIp(req);

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // 1. KIRISH (LOGIN)
    if (action === "login") {
      const { emailOrUsername, email, password } = body;
      const cleanInput = (emailOrUsername || email || "").trim().toLowerCase();
      const cleanPass = (password || "").trim();

      if (!cleanInput || !cleanPass) {
        return NextResponse.json(
          { success: false, error: "Login va parolni to'liq kiriting." },
          { status: 400 }
        );
      }

      // IP bo'yicha Rate Limit tekshiruvi (Begona akkauntlarni DoS qulflashidan himoya)
      const ipBlocked = checkRateLimit(ipLoginRateMap, clientIp, 5, 15 * 60 * 1000);
      if (ipBlocked) {
        await prisma.auditLog.create({
          data: {
            ip: clientIp,
            action: "LOGIN",
            status: "BLOCKED_IP",
            details: JSON.stringify({
              reason: "IP rate limit exceeded",
              attemptedUser: cleanInput,
            }),
          },
        });
        return NextResponse.json(
          {
            success: false,
            error:
              "Xavfsizlik cheklovi: Ushbu tarmoqdan juda ko'p muvaffaqiyatsiz urinishlar. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring.",
          },
          { status: 429 }
        );
      }

      // Foydalanuvchini qidirish
      const user = await prisma.user.findFirst({
        where: { email: cleanInput },
      });

      // Agar hisob admin tomonidan butunlay bloklangan bo'lsa
      if (user && user.isBlocked) {
        return NextResponse.json(
          {
            success: false,
            error: "Ushbu hisob administrator tomonidan bloklangan. Tizimga kirish taqiqlanadi.",
          },
          { status: 403 }
        );
      }

      // Agar hisob vaqtincha bloklangan bo'lsa
      if (user && user.lockoutUntil && user.lockoutUntil > new Date()) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Xavfsizlik cheklovi: Hisob vaqtincha bloklangan. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring.",
          },
          { status: 423 }
        );
      }

      // Timing attack / User enumeration himoyasi:
      const DUMMY_HASH =
        "$argon2id$v=19$m=19456,t=2,p=1$ZqW3ENhiho/rBky6cd6EUg$6oRYXgRcgRKBohcuxcJJvc71xbH4CH1mfHBLZ1rBPiE";
      const hashToCheck = user ? user.passwordHash : DUMMY_HASH;
      const isPasswordValid = await verifyPasswordHash(hashToCheck, cleanPass);

      if (!user || !isPasswordValid) {
        // IP hisoblagichini oshiramiz
        recordRateAttempt(ipLoginRateMap, clientIp, 15 * 60 * 1000);

        if (user) {
          const attempts = user.failedLoginAttempts + 1;
          const lockoutUntil =
            attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: attempts, lockoutUntil },
          });
        }

        await prisma.auditLog.create({
          data: {
            ip: clientIp,
            action: "LOGIN",
            status: "FAILURE",
            details: JSON.stringify({ email: cleanInput }),
          },
        });

        // Foydalanuvchi mavjudligini oshkor qilmaydigan bir xil xabar
        return NextResponse.json(
          { success: false, error: "Login yoki parol noto'g'ri kiritildi." },
          { status: 401 }
        );
      }

      // Muvaffaqiyatli parol kiritildi: login limitlarini tozalash
      clearRateLimit(ipLoginRateMap, clientIp);
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockoutUntil: null },
      });

      // Agar foydalanuvchining elektron pochtasi tasdiqlanmagan bo'lsa
      if (!user.emailVerified) {
        return NextResponse.json(
          {
            success: false,
            error: "Elektron pochtangiz hali tasdiqlanmagan. Iltimos, pochtangizga yuborilgan tasdiqlash havolasini oching.",
          },
          { status: 403 }
        );
      }

      // ── 2FA TEKSHIRUVI ──────────────────────────────────────────────────
      const is2FaMandatory =
        user.role === Role.admin ||
        user.role === Role.instructor ||
        user.role === Role.accountant;

      const isTestBypass =
        process.env.NODE_ENV !== "production" &&
        process.env.ALLOW_TEST_ACCOUNTS === "true" &&
        !user.twoFactorEnabled &&
        !body.enforce2Fa &&
        req.headers.get("x-enforce-2fa") !== "true";

      // 1. Foydalanuvchida 2FA allaqachon yoqilgan bo'lsa
      if (user.twoFactorEnabled) {
        const twoFactorToken = create2FaPendingToken(user.id, false);
        return NextResponse.json({
          success: true,
          requires2Fa: true,
          setupRequired: false,
          twoFactorToken,
          message: "2FA tasdiqlash kodi talab etiladi.",
        });
      }

      // 2. Foydalanuvchi roli uchun 2FA majburiy, lekin hali sozlanmagan bo'lsa (Birinchi kirish)
      if (is2FaMandatory && !isTestBypass) {
        const twoFactorToken = create2FaPendingToken(user.id, true);
        return NextResponse.json({
          success: true,
          requires2Fa: true,
          setupRequired: true,
          twoFactorToken,
          message: "Ushbu hisob uchun 2FA sozlanishi majburiy.",
        });
      }

      // 3. Agar 2FA talab etilmasa (yoki test bypass bo'lsa), to'liq sessiya yaratish
      const { token, user: sessionUser } = await createDbSession(user.id, req);

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          ip: clientIp,
          action: "LOGIN",
          status: "SUCCESS",
        },
      });

      const res = NextResponse.json({
        success: true,
        user: sessionUser,
      });
      attachSessionCookie(res, token);
      return res;
    }

    // ── 1.1 2FA SOZLASHNI BOSHLASH (2FA Setup Init) ───────────────────────
    if (action === "2fa_setup_init") {
      let targetUserId: string | null = null;

      // Vaqtinchalik 2FA tokeni orqali (Login jarayonida)
      if (body.twoFactorToken) {
        const verified = verify2FaPendingToken(body.twoFactorToken);
        if (!verified) {
          return NextResponse.json(
            { success: false, error: "2FA sessiya muddati tugagan (5 daqiqa). Qaytadan login qiling." },
            { status: 401 }
          );
        }
        targetUserId = verified.userId;
      } else {
        // Faol sessiya orqali (Profil sozlamalaridan)
        const sessionUser = await getSessionUser(req);
        if (!sessionUser) {
          return NextResponse.json({ success: false, error: "Avtorizatsiyadan o'tilmagan." }, { status: 401 });
        }
        targetUserId = sessionUser.userId;
      }

      const user = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, email: true, name: true },
      });
      if (!user) {
        return NextResponse.json({ success: false, error: "Foydalanuvchi topilmadi." }, { status: 404 });
      }

      // Yangi 20 baytli Base32 sir yaratish va AES-256-GCM bilan shifrlash
      const plainSecret = generateTotpSecret();
      const encryptedSecret = encryptTotpSecret(plainSecret);

      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorTempSecret: encryptedSecret },
      });

      const uri = generateTotpUri(user.email, plainSecret);
      const qrSvg = await generateTotpQrSvg(uri);

      return NextResponse.json({
        success: true,
        secret: plainSecret,
        uri,
        qrSvg,
      });
    }

    // ── 1.2 2FA SOZLASHNI TASDIQLASH (2FA Setup Confirm) ─────────────────
    if (action === "2fa_setup_confirm") {
      let targetUserId: string | null = null;

      if (body.twoFactorToken) {
        const verified = verify2FaPendingToken(body.twoFactorToken);
        if (!verified) {
          return NextResponse.json(
            { success: false, error: "2FA sessiya muddati tugagan (5 daqiqa). Qaytadan login qiling." },
            { status: 401 }
          );
        }
        targetUserId = verified.userId;
      } else {
        const sessionUser = await getSessionUser(req);
        if (!sessionUser) {
          return NextResponse.json({ success: false, error: "Avtorizatsiyadan o'tilmagan." }, { status: 401 });
        }
        targetUserId = sessionUser.userId;
      }

      const cleanCode = String(body.totpCode || "").trim();
      if (!cleanCode) {
        return NextResponse.json({ success: false, error: "6 xonali 2FA kodini kiriting." }, { status: 400 });
      }

      const user = await prisma.user.findUnique({
        where: { id: targetUserId },
      });
      if (!user || !user.twoFactorTempSecret) {
        return NextResponse.json(
          { success: false, error: "2FA sozlash jarayoni topilmadi. Avval boshlang." },
          { status: 400 }
        );
      }

      let tempSecret = "";
      try {
        tempSecret = decryptTotpSecret(user.twoFactorTempSecret);
      } catch {
        return NextResponse.json({ success: false, error: "Shifrlangan sirni ochishda xatolik." }, { status: 500 });
      }

      const verifyRes = verifyTotpCode(tempSecret, cleanCode);
      if (!verifyRes.valid) {
        return NextResponse.json(
          { success: false, error: verifyRes.error || "2FA kodi noto'g'ri kiritildi." },
          { status: 400 }
        );
      }

      // 10 ta bir martalik zaxira kodlar yaratish
      const { rawCodes, hashedCodes } = generateBackupCodes(10);

      // Bazada saqlash
      await prisma.$transaction([
        prisma.twoFactorBackupCode.deleteMany({ where: { userId: user.id } }),
        prisma.twoFactorBackupCode.createMany({
          data: hashedCodes.map((codeHash) => ({
            userId: user.id,
            codeHash,
            used: false,
          })),
        }),
        prisma.user.update({
          where: { id: user.id },
          data: {
            twoFactorEnabled: true,
            twoFactorSecret: user.twoFactorTempSecret,
            twoFactorTempSecret: null,
            twoFactorLastUsedStep: verifyRes.step,
            twoFactorFailedAttempts: 0,
            twoFactorLockoutUntil: null,
          },
        }),
      ]);

      // Boshqa barcha sessiyalarni bekor qilish (Xavfsizlik talabi 6)
      await revokeAllUserSessions(user.id);

      // Yangi to'liq sessiya yaratish
      const { token, user: sessionUser } = await createDbSession(user.id, req);

      await recordAuditLog({
        userId: user.id,
        action: "2FA_ENABLED",
        ip: clientIp,
        status: "SUCCESS",
        details: { setupCompleted: true },
      });

      const res = NextResponse.json({
        success: true,
        message: "2FA muvaffaqiyatli faollashtirildi!",
        backupCodes: rawCodes,
        user: sessionUser,
      });
      attachSessionCookie(res, token);
      return res;
    }

    // ── 1.3 2FA KOD BILAN KIRISH (2FA Verify Login) ──────────────────────
    if (action === "2fa_verify_login") {
      const cleanToken = String(body.twoFactorToken || "").trim();
      const cleanCode = String(body.totpCode || "").trim();

      if (!cleanToken || !cleanCode) {
        return NextResponse.json(
          { success: false, error: "2FA tokeni va 6 xonali kod kiritilishi shart." },
          { status: 400 }
        );
      }

      const verified = verify2FaPendingToken(cleanToken);
      if (!verified) {
        return NextResponse.json(
          { success: false, error: "2FA sessiya muddati tugagan (5 daqiqa). Qaytadan login qiling." },
          { status: 401 }
        );
      }

      // IP bo'yicha cheklov
      if (checkRateLimit(ip2FaRateMap, clientIp, 5, 15 * 60 * 1000)) {
        return NextResponse.json(
          { success: false, error: "Xavfsizlik cheklovi: Ushbu tarmoqdan juda ko'p muvaffaqiyatsiz 2FA urinishlar. 15 daqiqadan so'ng qayta urinib ko'ring." },
          { status: 429 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: verified.userId },
      });
      if (!user) {
        return NextResponse.json({ success: false, error: "Foydalanuvchi topilmadi." }, { status: 404 });
      }

      // Hisob vaqtincha bloklangan bo'lsa (Lockout)
      if (user.twoFactorLockoutUntil && user.twoFactorLockoutUntil > new Date()) {
        return NextResponse.json(
          { success: false, error: "Xavfsizlik cheklovi: 2FA kiritishda 5 ta xato. Hisob 15 daqiqaga qulflangan." },
          { status: 423 }
        );
      }

      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        return NextResponse.json(
          { success: false, error: "Ushbu foydalanuvchida 2FA faollashtirilmagan." },
          { status: 400 }
        );
      }

      let secret = "";
      try {
        secret = decryptTotpSecret(user.twoFactorSecret);
      } catch {
        return NextResponse.json({ success: false, error: "Shifrlangan sirni ochishda xatolik." }, { status: 500 });
      }

      const verifyRes = verifyTotpCode(secret, cleanCode, user.twoFactorLastUsedStep);

      if (!verifyRes.valid) {
        recordRateAttempt(ip2FaRateMap, clientIp, 15 * 60 * 1000);
        const attempts = user.twoFactorFailedAttempts + 1;
        const lockoutUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            twoFactorFailedAttempts: attempts,
            twoFactorLockoutUntil: lockoutUntil,
          },
        });

        await recordAuditLog({
          userId: user.id,
          action: "2FA_VERIFY",
          ip: clientIp,
          status: "FAILED",
          details: { reason: verifyRes.error || "Kod noto'g'ri" },
        });

        const isLocked = attempts >= 5;
        return NextResponse.json(
          {
            success: false,
            error: isLocked
              ? "Xavfsizlik cheklovi: 2FA kiritishda 5 ta xato. Hisob 15 daqiqaga qulflangan."
              : (verifyRes.error || "2FA kodi noto'g'ri kiritildi."),
          },
          { status: isLocked ? 423 : 400 }
        );
      }

      // Muvaffaqiyatli kirish
      clearRateLimit(ip2FaRateMap, clientIp);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorFailedAttempts: 0,
          twoFactorLockoutUntil: null,
          twoFactorLastUsedStep: verifyRes.step,
        },
      });

      const { token, user: sessionUser } = await createDbSession(user.id, req);

      await recordAuditLog({
        userId: user.id,
        action: "2FA_VERIFY",
        ip: clientIp,
        status: "SUCCESS",
      });

      const res = NextResponse.json({
        success: true,
        user: sessionUser,
      });
      attachSessionCookie(res, token);
      return res;
    }

    // ── 1.4 ZAXIRA KOD BILAN KIRISH (2FA Backup Code Login) ──────────────
    if (action === "2fa_backup_login") {
      const cleanToken = String(body.twoFactorToken || "").trim();
      const cleanCode = String(body.backupCode || "").trim();

      if (!cleanToken || !cleanCode) {
        return NextResponse.json(
          { success: false, error: "2FA tokeni va zaxira kodi kiritilishi shart." },
          { status: 400 }
        );
      }

      const verified = verify2FaPendingToken(cleanToken);
      if (!verified) {
        return NextResponse.json(
          { success: false, error: "2FA sessiya muddati tugagan (5 daqiqa). Qaytadan login qiling." },
          { status: 401 }
        );
      }

      if (checkRateLimit(ip2FaRateMap, clientIp, 5, 15 * 60 * 1000)) {
        return NextResponse.json(
          { success: false, error: "Xavfsizlik cheklovi: Ushbu tarmoqdan juda ko'p urinishlar. 15 daqiqadan so'ng qayta urinib ko'ring." },
          { status: 429 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: verified.userId },
      });
      if (!user) {
        return NextResponse.json({ success: false, error: "Foydalanuvchi topilmadi." }, { status: 404 });
      }

      if (user.twoFactorLockoutUntil && user.twoFactorLockoutUntil > new Date()) {
        return NextResponse.json(
          { success: false, error: "Xavfsizlik cheklovi: 2FA kiritishda 5 ta xato. Hisob 15 daqiqaga qulflangan." },
          { status: 423 }
        );
      }

      const codeHash = hashBackupCode(cleanCode);
      const backupRecord = await prisma.twoFactorBackupCode.findFirst({
        where: {
          userId: user.id,
          codeHash,
          used: false,
        },
      });

      if (!backupRecord) {
        recordRateAttempt(ip2FaRateMap, clientIp, 15 * 60 * 1000);
        const attempts = user.twoFactorFailedAttempts + 1;
        const lockoutUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            twoFactorFailedAttempts: attempts,
            twoFactorLockoutUntil: lockoutUntil,
          },
        });

        await recordAuditLog({
          userId: user.id,
          action: "2FA_BACKUP_LOGIN",
          ip: clientIp,
          status: "FAILED",
          details: { reason: "Noto'g'ri yoki allaqachon ishlatilgan zaxira kod" },
        });

        const isLocked = attempts >= 5;
        return NextResponse.json(
          {
            success: false,
            error: isLocked
              ? "Xavfsizlik cheklovi: 2FA kiritishda 5 ta xato. Hisob 15 daqiqaga qulflangan."
              : "Kiritilgan zaxira kodi noto'g'ri yoki allaqachon ishlatilgan.",
          },
          { status: isLocked ? 423 : 400 }
        );
      }

      // Zaxira kodni ishlatilgan deb belgilash
      await prisma.twoFactorBackupCode.update({
        where: { id: backupRecord.id },
        data: { used: true, usedAt: new Date() },
      });

      clearRateLimit(ip2FaRateMap, clientIp);
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorFailedAttempts: 0, twoFactorLockoutUntil: null },
      });

      const { token, user: sessionUser } = await createDbSession(user.id, req);

      await recordAuditLog({
        userId: user.id,
        action: "2FA_BACKUP_LOGIN",
        ip: clientIp,
        status: "SUCCESS",
        details: { backupCodeUsed: true },
      });

      const res = NextResponse.json({
        success: true,
        user: sessionUser,
        warning: "Eslatma: Bir martalik zaxira kod ishlatildi. Sozlamalardan yangi kodlar yaratib oling.",
      });
      attachSessionCookie(res, token);
      return res;
    }

    // ── 1.5 2FA NI O'CHIRISH (2FA Disable) ────────────────────────────────
    if (action === "2fa_disable") {
      const sessionUser = await getSessionUser(req);
      if (!sessionUser) {
        return NextResponse.json({ success: false, error: "Avtorizatsiyadan o'tilmagan." }, { status: 401 });
      }

      // Majburiy rollar uchun o'chirish taqiqlanadi
      if (
        sessionUser.role === Role.admin ||
        sessionUser.role === Role.instructor ||
        sessionUser.role === Role.accountant
      ) {
        return NextResponse.json(
          { success: false, error: "Ushbu rol (admin/ustoz/hisobchi) uchun 2FA majburiy. Uni o'chirib bo'lmaydi." },
          { status: 403 }
        );
      }

      // Talaba uchun: joriy parol va 2FA kod kiritilishi shart
      const { currentPassword, totpCode } = body;
      if (!currentPassword || !totpCode) {
        return NextResponse.json(
          { success: false, error: "2FA ni o'chirish uchun joriy parol va 6 xonali 2FA kodi talab etiladi." },
          { status: 400 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: sessionUser.userId },
      });
      if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        return NextResponse.json({ success: false, error: "2FA yoqilmagan." }, { status: 400 });
      }

      const isPassValid = await verifyPasswordHash(user.passwordHash, currentPassword);
      if (!isPassValid) {
        return NextResponse.json({ success: false, error: "Joriy parol noto'g'ri kiritildi." }, { status: 400 });
      }

      let secret = "";
      try {
        secret = decryptTotpSecret(user.twoFactorSecret);
      } catch {
        return NextResponse.json({ success: false, error: "Shifrlangan sirni ochishda xatolik." }, { status: 500 });
      }

      const verifyRes = verifyTotpCode(secret, totpCode, user.twoFactorLastUsedStep);
      if (!verifyRes.valid) {
        return NextResponse.json({ success: false, error: "2FA kodi noto'g'ri kiritildi." }, { status: 400 });
      }

      // 2FA ni o'chirish va barcha sessiyalarni bekor qilish
      await prisma.$transaction([
        prisma.twoFactorBackupCode.deleteMany({ where: { userId: user.id } }),
        prisma.user.update({
          where: { id: user.id },
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

      await revokeAllUserSessions(user.id);

      await recordAuditLog({
        userId: user.id,
        action: "2FA_DISABLED",
        ip: clientIp,
        status: "SUCCESS",
      });

      const res = NextResponse.json({
        success: true,
        message: "2FA muvaffaqiyatli o'chirildi. Xavfsizlik yuzasidan barcha sessiyalar bekor qilindi.",
      });
      clearSessionCookie(res);
      return res;
    }

    // ── 1.6 ZAXIRA KODLARNI QAYTA GENERATSIYA QILISH ──────────────────────
    if (action === "2fa_regenerate_backup_codes") {
      const sessionUser = await getSessionUser(req);
      if (!sessionUser) {
        return NextResponse.json({ success: false, error: "Avtorizatsiyadan o'tilmagan." }, { status: 401 });
      }

      const cleanCode = String(body.totpCode || "").trim();
      if (!cleanCode) {
        return NextResponse.json({ success: false, error: "Amalni tasdiqlash uchun 6 xonali 2FA kodini kiriting." }, { status: 400 });
      }

      const user = await prisma.user.findUnique({
        where: { id: sessionUser.userId },
      });
      if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        return NextResponse.json({ success: false, error: "2FA yoqilmagan." }, { status: 400 });
      }

      const secret = decryptTotpSecret(user.twoFactorSecret);
      const verifyRes = verifyTotpCode(secret, cleanCode, user.twoFactorLastUsedStep);
      if (!verifyRes.valid) {
        return NextResponse.json({ success: false, error: "2FA kodi noto'g'ri." }, { status: 400 });
      }

      const { rawCodes, hashedCodes } = generateBackupCodes(10);
      await prisma.$transaction([
        prisma.twoFactorBackupCode.deleteMany({ where: { userId: user.id } }),
        prisma.twoFactorBackupCode.createMany({
          data: hashedCodes.map((codeHash) => ({
            userId: user.id,
            codeHash,
            used: false,
          })),
        }),
        prisma.user.update({
          where: { id: user.id },
          data: { twoFactorLastUsedStep: verifyRes.step },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: "10 ta yangi zaxira kod yaratildi. Ularni xavfsiz joyda saqlang!",
        backupCodes: rawCodes,
      });
    }

    // ── 1.7 ADMIN TOMONIDAN 2FA NI TIKLASH (Reset 2FA by Admin) ───────────
    if (action === "2fa_admin_reset") {
      const sessionUser = await getSessionUser(req);
      if (!sessionUser || sessionUser.role !== Role.admin) {
        return NextResponse.json(
          { success: false, error: "Faqat administrator boshqa foydalanuvchining 2FA sini tiklay oladi." },
          { status: 403 }
        );
      }

      const { targetUserId } = body;
      if (!targetUserId) {
        return NextResponse.json({ success: false, error: "targetUserId kiritilishi shart." }, { status: 400 });
      }

      if (targetUserId === sessionUser.userId) {
        return NextResponse.json(
          { success: false, error: "O'z hisobingiz 2FA sini ushbu usulda tiklay olmaysiz." },
          { status: 400 }
        );
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
      });
      if (!targetUser) {
        return NextResponse.json({ success: false, error: "Foydalanuvchi topilmadi." }, { status: 404 });
      }

      await prisma.$transaction([
        prisma.twoFactorBackupCode.deleteMany({ where: { userId: targetUserId } }),
        prisma.user.update({
          where: { id: targetUserId },
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

      // Tiklangan foydalanuvchining barcha sessiyalarini bekor qilish (Xavfsizlik talabi 5)
      await revokeAllUserSessions(targetUserId);

      await recordAuditLog({
        userId: sessionUser.userId,
        action: "2FA_RESET_BY_ADMIN",
        ip: clientIp,
        status: "SUCCESS",
        details: { targetUserId, targetEmail: targetUser.email },
      });

      return NextResponse.json({
        success: true,
        message: `${targetUser.email} foydalanuvchisining 2FA himoyasi muvaffaqiyatli tiklandi (o'chirildi) va barcha faol sessiyalari bekor qilindi.`,
      });
    }

    // 2. RO'YXATDAN O'TISH (REGISTER)
    if (action === "register") {
      const { name, email, password, inviteCode } = body;
      const cleanEmail = (email || "").trim().toLowerCase();
      const cleanName = (name || "").trim();

      if (!cleanEmail || !cleanName || !password) {
        return NextResponse.json(
          { success: false, error: "Barcha maydonlarni to'ldiring." },
          { status: 400 }
        );
      }

      const nameCheck = validateDisplayName(cleanName);
      if (!nameCheck.valid) {
        return NextResponse.json(
          { success: false, error: nameCheck.error },
          { status: 400 }
        );
      }

      const passCheck = validatePassword(password);
      if (!passCheck.valid) {
        return NextResponse.json(
          { success: false, error: passCheck.error },
          { status: 400 }
        );
      }

      // Pre-Stage 6 Requirement E: Standart holda ochiq ro'yxatdan o'tish O'CHIRILGAN.
      const allowPublic =
        process.env.ALLOW_PUBLIC_REGISTRATION === "true" ||
        (process.env.NODE_ENV !== "production" && req.headers.get("x-test-allow-public-reg") === "true");
      const callerUser = await getSessionUser(req);
      const isPrivileged =
        callerUser && (callerUser.role === Role.admin || callerUser.role === Role.instructor);

      let matchedInvite: Awaited<ReturnType<typeof prisma.invitationCode.findUnique>> = null;

      if (inviteCode && typeof inviteCode === "string" && inviteCode.trim()) {
        const invite = await prisma.invitationCode.findUnique({
          where: { code: inviteCode.trim().toUpperCase() },
        });

        if (!invite || invite.usedCount >= invite.maxUses || invite.expiresAt < new Date()) {
          return NextResponse.json(
            {
              success: false,
              error: "Taklif kodi noto'g'ri, foydalanish limiti tugagan yoki muddati o'tgan.",
            },
            { status: 400 }
          );
        }
        matchedInvite = invite;
      } else if (!allowPublic && !isPrivileged) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Ochiq ro'yxatdan o'tish yopiq. Ro'yxatdan o'tish uchun o'quv markaz ustozidan taklif kodi (invite code) oling.",
          },
          { status: 403 }
        );
      } else {
        // OCHIQ RO'YXATDAN O'TISH OQIMI (ALLOW_PUBLIC_REGISTRATION=true)
        // 1. SMTP tekshiruvi: pochta xizmati sozlanmagan bo'lsa ro'yxat ochilmasin
        if (!isSmtpConfigured() && process.env.NODE_ENV === "production") {
          return NextResponse.json(
            {
              success: false,
              error: "Ochiq ro'yxatdan o'tish hozirda faol emas (elektron pochta xizmati sozlanmagan).",
            },
            { status: 503 }
          );
        }

        // 2. CAPTCHA tekshiruvi
        const captchaToken = body.captchaToken || "";
        const captchaResult = await verifyCaptchaToken(captchaToken, clientIp);
        if (!captchaResult.success) {
          return NextResponse.json(
            {
              success: false,
              error: captchaResult.error || "CAPTCHA tekshiruvidan o'tilmadi. Iltimos, qayta urinib ko'ring.",
            },
            { status: 400 }
          );
        }

        // 3. IP bo'yicha kunlik limit (Kuniga maks 3 ta hisob)
        const maxDailyPerIp = parseInt(process.env.MAX_DAILY_REGISTRATIONS_PER_IP || "3", 10);
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const dailyRegistrations = await prisma.user.count({
          where: {
            registrationIp: clientIp,
            createdAt: { gte: startOfToday },
          },
        });

        if (dailyRegistrations >= maxDailyPerIp) {
          return NextResponse.json(
            {
              success: false,
              error: "Bir kunda bitta IP manzildan ro'yxatdan o'tishlar soni limitdan oshdi. Iltimos, ertaga qayta urinib ko'ring.",
            },
            { status: 429 }
          );
        }

        // 4. Enumeratsiyaga qarshi bir xil javob (Agar email allaqachon mavjud bo'lsa)
        const existingUser = await prisma.user.findUnique({
          where: { email: cleanEmail },
        });

        if (existingUser) {
          return NextResponse.json({
            success: true,
            requiresEmailVerification: true,
            message: "Tasdiqlash havolasi ko'rsatilgan elektron pochtaga yuborildi. Iltimos, pochtangizni tekshiring.",
          });
        }

        // 5. Ochiq ro'yxatdan o'tuvchi uchun email verification tokeni yaratish
        const { rawToken, tokenHash, expiresAt } = generateVerificationToken();
        const dailyTerminal = parseInt(process.env.DEFAULT_DAILY_TERMINAL_MINUTES || "60", 10);
        const dailyLab = parseInt(process.env.DEFAULT_DAILY_LAB_MINUTES || "30", 10);
        const passwordHash = await hashPassword(password);

        await prisma.user.create({
          data: {
            email: cleanEmail,
            name: nameCheck.cleanName || cleanName,
            displayName: nameCheck.cleanName || cleanName,
            passwordHash,
            role: Role.student,
            avatar: "👨‍🎓",
            emailVerified: false,
            verificationTokenHash: tokenHash,
            verificationExpires: expiresAt,
            registrationIp: clientIp,
            dailyTerminalQuotaMinutes: dailyTerminal,
            dailyLabQuotaMinutes: dailyLab,
          },
        });

        await sendEmailVerification(cleanEmail, rawToken);

        return NextResponse.json({
          success: true,
          requiresEmailVerification: true,
          message: "Tasdiqlash havolasi ko'rsatilgan elektron pochtaga yuborildi. Iltimos, pochtangizni tekshiring.",
        });
      }

      // Taklif kodi orqali kirgan talaba uchun ro'yxatdan o'tish:
      // Foydalanuvchi bor-yo'qligini tekshirish
      const existingUser = await prisma.user.findUnique({
        where: { email: cleanEmail },
      });

      if (existingUser) {
        return NextResponse.json({
          success: true,
          message:
            "Ro'yxatdan o'tish so'rovi qabul qilindi. Tizimga kirishingiz mumkin.",
        });
      }

      const passwordHash = await hashPassword(password);
      const newUser = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: nameCheck.cleanName || cleanName,
          displayName: nameCheck.cleanName || cleanName,
          passwordHash,
          role: Role.student,
          avatar: "👨‍🎓",
          emailVerified: true, // Taklif kodi bilan kelgan talaba darhol tasdiqlanadi
          registrationIp: clientIp,
        },
      });

      if (matchedInvite) {
        const nextUsedCount = (matchedInvite.usedCount || 0) + 1;
        await prisma.invitationCode.update({
          where: { id: matchedInvite.id },
          data: {
            usedBy: newUser.id,
            usedCount: nextUsedCount,
            usedAt: nextUsedCount >= matchedInvite.maxUses ? new Date() : (matchedInvite.usedAt || new Date()),
          },
        });

        // Agar taklif kodi ma'lum guruhga tegishli bo'lsa, talabani avtomatik biriktirish va guruh kurslariga huquq berish
        if (matchedInvite.groupId) {
          await prisma.groupMember
            .create({
              data: {
                groupId: matchedInvite.groupId,
                userId: newUser.id,
              },
            })
            .catch(() => {});

          const groupCourses = await prisma.groupCourse.findMany({
            where: { groupId: matchedInvite.groupId },
          });

          for (const gc of groupCourses) {
            await prisma.enrollment
              .upsert({
                where: { userId_courseId: { userId: newUser.id, courseId: gc.courseId } },
                update: {},
                create: { userId: newUser.id, courseId: gc.courseId },
              })
              .catch(() => {});

            await prisma.entitlement
              .create({
                data: {
                  userId: newUser.id,
                  type: "GROUP",
                  source: "GROUP",
                  courseId: gc.courseId,
                  groupId: matchedInvite.groupId,
                  reason: `Taklif kodi (${matchedInvite.code}) orqali guruh kursiga biriktirildi`,
                },
              })
              .catch(() => {});
          }
        }
      }

      // Birlamchi 1-kursga yozib qo'yish
      await prisma.enrollment
        .create({
          data: {
            userId: newUser.id,
            courseId: 1,
          },
        })
        .catch(() => {});

      const { token, user: sessionUser } = await createDbSession(
        newUser.id,
        req
      );

      await prisma.auditLog.create({
        data: {
          userId: newUser.id,
          ip: clientIp,
          action: "REGISTER",
          status: "SUCCESS",
        },
      });

      const res = NextResponse.json({
        success: true,
        user: sessionUser,
        message: "Ro'yxatdan o'tish muvaffaqiyatli yakunlandi!",
      });
      attachSessionCookie(res, token);
      return res;
    }

    // 3. TIZIMDAN CHIQISH (LOGOUT)
    if (action === "logout") {
      await revokeCurrentSession(req);
      const res = NextResponse.json({
        success: true,
        message: "Tizimdan muvaffaqiyatli chiqildi.",
      });
      clearSessionCookie(res);
      return res;
    }

    // 4. PAROL TIKLASH SO'ROVI (REQUEST RESET)
    if (action === "request-reset" || action === "request_reset_code") {
      const { email, identifier } = body;
      const cleanInput = (email || identifier || "").trim().toLowerCase();

      // IP va Akkaunt bo'yicha rate limit: soatiga ko'pi bilan 3 ta so'rov
      const ipResetBlocked = checkRateLimit(
        ipResetRateMap,
        clientIp,
        3,
        60 * 60 * 1000
      );
      const accountResetBlocked = checkRateLimit(
        accountResetRateMap,
        cleanInput,
        3,
        60 * 60 * 1000
      );

      if (ipResetBlocked || accountResetBlocked) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Xavfsizlik cheklovi: Parolni tiklash so'rovlari ko'payib ketdi. Iltimos, 1 soatdan so'ng qayta urinib ko'ring.",
          },
          { status: 429 }
        );
      }

      recordRateAttempt(ipResetRateMap, clientIp, 60 * 60 * 1000);
      recordRateAttempt(accountResetRateMap, cleanInput, 60 * 60 * 1000);

      // Bir xil umumiy javob (User Enumeration qarshi)
      const genericMsg =
        "Agar ushbu email tizimda mavjud bo'lsa, parolni tiklash kodi yuborildi.";

      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: cleanInput }, { phone: cleanInput }],
        },
      });

      let generatedCode = "123456";

      if (user) {
        // Bir martalik, 6 xonali tasdiqlash kodi
        const rawCode = crypto.randomInt(100000, 999999).toString();
        generatedCode = rawCode;
        const tokenHash = crypto
          .createHash("sha256")
          .update(rawCode)
          .digest("hex");
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 daqiqa

        // Eski faol tokenlarni bekor qilish
        await prisma.passwordResetToken.deleteMany({
          where: { userId: user.id },
        });

        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            failedAttempts: 0,
            expiresAt,
          },
        });

        // Email / SMS orqali yuborish
        await emailService.sendPasswordResetEmail(user.email, rawCode);

        await prisma.auditLog.create({
          data: {
            userId: user.id,
            ip: clientIp,
            action: "PASSWORD_RESET_REQUEST",
            status: "SUCCESS",
          },
        });
      }

      // Xavfsizlik: Production muhitida sirli kod hech qachon HTTP response'da qaytarilmaydi!
      const isDev = process.env.NODE_ENV !== "production";
      return NextResponse.json({
        success: true,
        message: genericMsg,
        maskedPhone: "+998 ** *** ** 89",
        code: isDev ? generatedCode : undefined,
      });
    }

    // 5. PAROLNI TIKLASHNI TASDIQLASH (VERIFY RESET)
    if (action === "verify-reset" || action === "verify_reset_code") {
      const { email, identifier, code, newPassword } = body;
      const cleanInput = (email || identifier || "").trim().toLowerCase();
      const cleanCode = (code || "").trim();

      if (!cleanInput || !cleanCode || !newPassword) {
        return NextResponse.json(
          { success: false, error: "Barcha maydonlar to'ldirilishi shart." },
          { status: 400 }
        );
      }

      const passCheck = validatePassword(newPassword);
      if (!passCheck.valid) {
        return NextResponse.json(
          { success: false, error: passCheck.error },
          { status: 400 }
        );
      }

      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: cleanInput }, { phone: cleanInput }],
        },
      });

      if (!user) {
        return NextResponse.json(
          {
            success: false,
            error: "Tiklash kodi noto'g'ri yoki muddati tugagan.",
          },
          { status: 400 }
        );
      }

      // Faol tokenni topish
      const resetRecord = await prisma.passwordResetToken.findFirst({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (!resetRecord) {
        return NextResponse.json(
          {
            success: false,
            error: "Tiklash kodi noto'g'ri yoki muddati o'tgan.",
          },
          { status: 400 }
        );
      }

      // Kodni xeshini hisoblash
      const inputHash = crypto
        .createHash("sha256")
        .update(cleanCode)
        .digest("hex");

      const isMatch =
        crypto.timingSafeEqual(
          Buffer.from(resetRecord.tokenHash, "hex"),
          Buffer.from(inputHash, "hex")
        );

      if (!isMatch) {
        const nextAttempts = resetRecord.failedAttempts + 1;
        // Agar 5 ta xato urinish bo'lsa, kod darhol butunlay bekor qilinadi
        const shouldInvalidate = nextAttempts >= 5;

        await prisma.passwordResetToken.update({
          where: { id: resetRecord.id },
          data: {
            failedAttempts: nextAttempts,
            usedAt: shouldInvalidate ? new Date() : null,
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: user.id,
            ip: clientIp,
            action: "PASSWORD_RESET_VERIFY_FAILED",
            status: shouldInvalidate ? "TOKEN_REVOKED" : "FAILURE",
            details: JSON.stringify({ attempts: nextAttempts }),
          },
        });

        return NextResponse.json(
          {
            success: false,
            error: shouldInvalidate
              ? "Xavfsizlik cheklovi: 5 marta noto'g'ri kod kiritilgani sababli ushbu tasdiqlash kodi bekor qilindi. Qaytadan kod so'rang."
              : `Tasdiqlash kodi noto'g'ri. Qolgan urinishlar: ${5 - nextAttempts}`,
          },
          { status: 400 }
        );
      }

      // Parolni yangilash va tokenni bir martalik qilib 'usedAt' belgilash
      const newHash = await hashPassword(newPassword);
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            passwordHash: newHash,
            failedLoginAttempts: 0,
            lockoutUntil: null,
          },
        }),
        prisma.passwordResetToken.update({
          where: { id: resetRecord.id },
          data: { usedAt: new Date() },
        }),
        // Parol o'zgargach barcha faol sessiyalarni bekor qilish
        prisma.session.updateMany({
          where: { userId: user.id },
          data: { revokedAt: new Date() },
        }),
      ]);

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          ip: clientIp,
          action: "PASSWORD_RESET_SUCCESS",
          status: "SUCCESS",
        },
      });

      return NextResponse.json({
        success: true,
        message:
          "Parolingiz muvaffaqiyatli yangilandi! Endi yangi parol bilan kirishingiz mumkin.",
      });
    }

    // ── 5. PROFILNI YANGILASH (displayName xavfsiz o'zgartirish) ────────
    if (action === "update_profile") {
      const user = await getSessionUser(req);
      if (!user) {
        return NextResponse.json(
          { success: false, error: "Avtorizatsiyadan o'tilmagan." },
          { status: 401 }
        );
      }

      const { displayName } = body;
      const check = validateDisplayName(displayName);
      if (!check.valid) {
        return NextResponse.json(
          { success: false, error: check.error },
          { status: 400 }
        );
      }

      const updated = await prisma.user.update({
        where: { id: user.userId },
        data: { displayName: check.cleanName },
        select: { id: true, name: true, displayName: true, email: true },
      });

      return NextResponse.json({
        success: true,
        user: updated,
        message: "Profil muvaffaqiyatli yangilandi.",
      });
    }

    // ── 5.1 SHAXSIY SOZLAMALAR VA PAROLNI YANGILASH (Eski parolni so'rab) ──
    if (action === "update_credentials") {
      const user = await getSessionUser(req);
      if (!user) {
        return NextResponse.json({ success: false, error: "Avtorizatsiyadan o'tilmagan." }, { status: 401 });
      }

      const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
      if (!dbUser) {
        return NextResponse.json({ success: false, error: "Foydalanuvchi topilmadi." }, { status: 404 });
      }

      const { newName, newPhone, oldPassword, newPassword } = body;
      const dataToUpdate: Record<string, unknown> = {};

      if (newName && typeof newName === "string" && newName.trim()) {
        const nameValid = validateDisplayName(newName.trim());
        if (!nameValid.valid) {
          return NextResponse.json({ success: false, error: nameValid.error }, { status: 400 });
        }
        dataToUpdate.name = nameValid.cleanName;
        dataToUpdate.displayName = nameValid.cleanName;
      }

      if (newPhone !== undefined) {
        dataToUpdate.phone = String(newPhone).trim() || null;
      }

      if (newPassword && typeof newPassword === "string" && newPassword.trim()) {
        // Agar birinchi sozlash (mustChangePassword) bo'lmasa, eski parol talab qilinadi
        if (!dbUser.mustChangePassword) {
          if (!oldPassword || typeof oldPassword !== "string") {
            return NextResponse.json(
              { success: false, error: "Parolni o'zgartirish uchun joriy (eski) parolingizni kiritishingiz shart." },
              { status: 400 }
            );
          }
          const isOldValid = await verifyPasswordHash(dbUser.passwordHash, oldPassword.trim());
          if (!isOldValid) {
            return NextResponse.json(
              { success: false, error: "Joriy (eski) parol noto'g'ri kiritildi." },
              { status: 400 }
            );
          }
        }

        const passCheck = validatePassword(newPassword.trim());
        if (!passCheck.valid) {
          return NextResponse.json({ success: false, error: passCheck.error }, { status: 400 });
        }

        dataToUpdate.passwordHash = await hashPassword(newPassword.trim());
        dataToUpdate.mustChangePassword = false;
      }

      const updated = await prisma.user.update({
        where: { id: dbUser.id },
        data: dataToUpdate,
        select: { id: true, name: true, displayName: true, email: true, phone: true, role: true },
      });

      await recordAuditLog({
        userId: dbUser.id,
        ip: clientIp,
        action: "USER_CREDENTIALS_UPDATE",
        details: { updatedFields: Object.keys(dataToUpdate) },
      });

      return NextResponse.json({
        success: true,
        message: "Profil va sozlamalar muvaffaqiyatli saqlandi.",
        user: updated,
      });
    }

    // ── 6. FOYDALANUVCHINING FAOL SESSIYALARI (Pre-Stage 5: Requirement 3) ────
    if (action === "list-sessions") {
      const user = await getSessionUser(req);
      if (!user) {
        return NextResponse.json(
          { success: false, error: "Avtorizatsiya talab qilinadi." },
          { status: 401 }
        );
      }
      const sessions = await listUserSessions(user.userId, req);
      return NextResponse.json({ success: true, sessions });
    }

    // ── 7. MUAYYAN SESSIYANI BEKOR QILISH ───────────────────────────────
    if (action === "revoke-session") {
      const user = await getSessionUser(req);
      if (!user) {
        return NextResponse.json(
          { success: false, error: "Avtorizatsiya talab qilinadi." },
          { status: 401 }
        );
      }
      const { sessionId } = body;
      if (!sessionId) {
        return NextResponse.json(
          { success: false, error: "Sessiya ID ko'rsatilmadi." },
          { status: 400 }
        );
      }
      const ok = await revokeSessionById(sessionId, user.userId);
      await recordAuditLog({
        userId: user.userId,
        action: "SESSION_REVOKED",
        ip: clientIp,
        details: { sessionId },
      });
      return NextResponse.json({ success: ok });
    }

    // ── 7.1 BARCHA BOSHQ QURILMALARDAN CHIQISH ───────────────────────────
    if (action === "revoke-all-sessions") {
      const user = await getSessionUser(req);
      if (!user) {
        return NextResponse.json(
          { success: false, error: "Avtorizatsiya talab qilinadi." },
          { status: 401 }
        );
      }
      const count = await revokeAllUserSessions(user.userId);
      await recordAuditLog({
        userId: user.userId,
        action: "ALL_SESSIONS_REVOKED",
        ip: clientIp,
        details: { count },
      });
      return NextResponse.json({ success: true, count });
    }

    // ── 8. TAKLIF KODI YARATISH (Pre-Stage 6: Requirement E) ─────────────
    if (action === "create-invite") {
      const user = await getSessionUser(req);
      if (!user || (user.role !== Role.admin && user.role !== Role.instructor)) {
        return NextResponse.json(
          { success: false, error: "Faqat ustoz yoki admin taklif kodi yaratishi mumkin." },
          { status: 403 }
        );
      }

      const rawCode = `CYBER-INV-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 kun

      const invite = await prisma.invitationCode.create({
        data: {
          code: rawCode,
          createdBy: user.userId,
          expiresAt,
        },
      });

      await recordAuditLog({
        userId: user.userId,
        action: "ROLE_CHANGE",
        ip: clientIp,
        details: { action: "CREATE_INVITE_CODE", code: invite.code },
      });

      return NextResponse.json({
        success: true,
        code: invite.code,
        expiresAt: invite.expiresAt,
      });
    }

    // ── 9. VAQTINCHALIK PAROL BERISH (Pre-Stage 6: Requirement F) ──────
    if (action === "generate-temp-password") {
      const user = await getSessionUser(req);
      if (!user || (user.role !== Role.admin && user.role !== Role.instructor)) {
        return NextResponse.json(
          { success: false, error: "Faqat ustoz yoki admin vaqtinchalik parol bera oladi." },
          { status: 403 }
        );
      }

      const { studentEmail, email, userId } = body;
      const cleanTarget = (studentEmail || email || "").trim().toLowerCase();
      if (!cleanTarget && !userId) {
        return NextResponse.json(
          { success: false, error: "Talaba elektron pochtasi yoki ID raqami ko'rsatilmadi." },
          { status: 400 }
        );
      }

      const targetStudent = await prisma.user.findFirst({
        where: userId ? { id: userId } : { email: cleanTarget },
      });

      if (!targetStudent) {
        return NextResponse.json(
          { success: false, error: "Bunday elektron pochtali talaba topilmadi." },
          { status: 404 }
        );
      }

      // Bir martalik vaqtinchalik parol (kamida 12 belgi)
      const tempPass = `Temp#${crypto.randomBytes(4).toString("hex")}!2026`;
      const tempHash = await hashPassword(tempPass);

      await prisma.user.update({
        where: { id: targetStudent.id },
        data: {
          passwordHash: tempHash,
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
      });

      // Talabaning barcha mavjud sessiyalarini bekor qilish
      await revokeAllUserSessions(targetStudent.id);

      await recordAuditLog({
        userId: user.userId,
        action: "PASSWORD_RESET",
        ip: clientIp,
        details: {
          action: "INSTRUCTOR_ISSUED_TEMP_PASSWORD",
          studentId: targetStudent.id,
          studentEmail: targetStudent.email,
        },
      });

      return NextResponse.json({
        success: true,
        tempPassword: tempPass,
        message:
          "Talaba uchun vaqtinchalik parol yaratildi. Talaba birinchi kirishda yangi shaxsiy parol o'rnatishi shart.",
      });
    }

    return NextResponse.json(
      { success: false, error: "Noma'lum amal." },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error("Auth API xatosi:", err);
    const message =
      err instanceof Error ? err.message : "Serverda xatolik yuz berdi.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
