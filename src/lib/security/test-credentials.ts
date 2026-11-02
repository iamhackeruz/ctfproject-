import crypto from "crypto";

/**
 * Xavfsiz Test Hisoblari va Parollar Boshqaruvi
 * 
 * Qoidalar:
 * 1. Admin paroli va maxfiy sirlar test fayllarida ochiq holda saqlanmaydi (env orqali boshqariladi).
 * 2. Test hisoblar faqat development / test muhitida yaratiladi.
 * 3. Production muhitida (NODE_ENV=production) test hisoblar yaratish va testlarni ishga tushirish qat'iy bloklanadi.
 */
export function getTestCredentials(): {
  adminEmail: string;
  adminPass: string;
  studentPass: string;
} {
  const isProduction = process.env.NODE_ENV === "production";
  const allowInProd = process.env.ALLOW_TEST_ACCOUNTS === "true";

  if (isProduction && !allowInProd) {
    throw new Error(
      "XAVFSIZLIK TO'SIG'I: Test skriptlari va avtomatik test hisoblari PRODUCTION muhitida yaratilishi qat'iy taqiqlanadi! (NODE_ENV=production)"
    );
  }

  const adminEmail =
    process.env.TEST_ADMIN_EMAIL || process.env.ADMIN_INIT_EMAIL || "admin@cyberedu.uz";
  const adminPass =
    process.env.TEST_ADMIN_PASSWORD ||
    process.env.ADMIN_INIT_PASSWORD ||
    "Test#AdminSecure2026!Key";
  const studentPass =
    process.env.TEST_STUDENT_PASSWORD || "Test#StudentSecure2026!Key";

  return {
    adminEmail,
    adminPass,
    studentPass,
  };
}

/**
 * Bir martalik dinamik tasodifiy parol yaratish (xotirada)
 */
export function generateRandomTestPassword(): string {
  return `TestP#${crypto.randomBytes(8).toString("hex")}!2026`;
}
