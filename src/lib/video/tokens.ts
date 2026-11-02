import crypto from "crypto";

const SECRET = process.env.SESSION_SECRET || "cyberedu-video-secure-token-secret-key-fallback";

interface TokenPayload {
  userId: string;
  lessonId: string;
  exp: number; // millisekund
}

/**
 * 10 daqiqalik imzolangan video tokenini yaratish (CDN yoki doimiy havola o'rniga qisqa muddatli havola)
 */
export function generateSignedVideoToken(
  userId: string,
  lessonId: string,
  ttlMs: number = 10 * 60 * 1000
): string {
  const payload: TokenPayload = {
    userId,
    lessonId,
    exp: Date.now() + ttlMs,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Imzolangan video tokenini tekshirish
 */
export function verifySignedVideoToken(
  token: string
): { valid: boolean; userId?: string; lessonId?: string; error?: string } {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Token topilmadi." };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "Token formati noto'g'ri." };
  }

  const [payloadB64, signature] = parts;

  // Imzoni tekshirish (Timing safe)
  const expectedSig = crypto
    .createHmac("sha256", SECRET)
    .update(payloadB64)
    .digest("base64url");

  const expectedBuf = Buffer.from(expectedSig);
  const actualBuf = Buffer.from(signature);

  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    return { valid: false, error: "Token imzosi noto'g'ri yoki buzilgan." };
  }

  try {
    const raw = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload: TokenPayload = JSON.parse(raw);

    if (Date.now() > payload.exp) {
      return { valid: false, error: "Token muddati tugagan (10 daqiqalik limit)." };
    }

    return {
      valid: true,
      userId: payload.userId,
      lessonId: payload.lessonId,
    };
  } catch {
    return { valid: false, error: "Token ma'lumotlarini o'qib bo'lmadi." };
  }
}
