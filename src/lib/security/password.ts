import { hash, verify } from "@node-rs/argon2";

// Keng tarqalgan va zaif parollar qora ro'yxati (Common Passwords Blacklist)
const COMMON_PASSWORDS = new Set([
  "1234567890",
  "12345678901",
  "password123",
  "password1234",
  "qwertyuiop",
  "admin123456",
  "administrator",
  "cyberedu123",
  "cybersecurity",
  "iloveyou123",
  "welcome1234",
  "letmein1234",
  "parol123456",
  "uzbekistan1",
]);

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Parol siyosatini tekshiradi:
 * 1. Minimal uzunlik 10 belgi.
 * 2. Keng tarqalgan va zaif parollarni rad etish.
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Parol kiritilishi shart." };
  }

  if (password.length < 10) {
    return {
      valid: false,
      error: "Xavfsizlik talabi: Parol uzunligi kamida 10 ta belgidan iborat bo'lishi kerak.",
    };
  }

  const normalized = password.toLowerCase().trim();
  if (COMMON_PASSWORDS.has(normalized)) {
    return {
      valid: false,
      error: "Xavfsizlik xatosi: Ushbu parol juda keng tarqalgan va zaif. Murakkabroq parol tanlang.",
    };
  }

  return { valid: true };
}

/**
 * Parolni argon2id algoritmi bilan xeshlaydi.
 */
export async function hashPassword(plain: string): Promise<string> {
  // Algorithm 2: Argon2id (OWASP va kiberxavfsizlik tavsiyasi)
  return await hash(plain, {
    algorithm: 2,
    memoryCost: 19456, // 19 MiB
    timeCost: 2,       // 2 iterations
    parallelism: 1,
  });
}

/**
 * Parol xeshini tekshiradi (timing-safe).
 */
export async function verifyPasswordHash(
  hashVal: string,
  plain: string
): Promise<boolean> {
  try {
    return await verify(hashVal, plain);
  } catch {
    return false;
  }
}
