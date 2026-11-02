import crypto from "crypto";

const FLAG_SECRET =
  process.env.FLAG_SECRET || "cyberedu-flag-secret-2026-dynamic-hmac-key";

/**
 * Har bir foydalanuvchi va lab uchun noyob dinamik flag hosil qiladi.
 * Sirli kalit (FLAG_SECRET) hech qachon konteyner ichiga yoki mijozga yuborilmaydi.
 */
export function generateUserFlag(
  labId: string | number,
  userId: string
): string {
  const cleanLab = String(labId).replace(/[^a-zA-Z0-9_-]/g, "");
  const cleanUser = String(userId).replace(/[^a-zA-Z0-9_-]/g, "");

  const hmac = crypto
    .createHmac("sha256", FLAG_SECRET)
    .update(`${cleanLab}:${cleanUser}`)
    .digest("hex")
    .slice(0, 16);

  const userSlug = cleanUser.startsWith("std_")
    ? cleanUser.slice(4, 12)
    : cleanUser.slice(0, 8);

  return `flag{cyber_${cleanLab}_${userSlug}_${hmac}}`;
}

/**
 * Foydalanuvchi topshirgan flag'ni vaqt bo'yicha xavfsiz (timing-safe) taqqoslaydi.
 */
export function verifyUserFlag(
  labId: string | number,
  userId: string,
  submittedFlag: string
): boolean {
  if (!submittedFlag || typeof submittedFlag !== "string") return false;

  const expected = generateUserFlag(labId, userId).trim().toLowerCase();
  const actual = submittedFlag.trim().toLowerCase();

  if (expected.length !== actual.length) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf-8"),
      Buffer.from(actual, "utf-8")
    );
  } catch {
    return false;
  }
}
