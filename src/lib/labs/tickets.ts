import crypto from "crypto";

const TICKET_SECRET =
  process.env.LAB_TICKET_SECRET ||
  process.env.DAEMON_SECRET ||
  "cyberedu_lab_ticket_secret_2026";
const TICKET_TTL_MS = 5 * 60 * 1000; // 5 daqiqa bir martalik yoki qisqa muddatli ruxsat

export interface LabTicketData {
  instanceId: string;
  userId: string;
  exp: number;
}

/**
 * Web lab instansiyasiga xavfsiz kirish uchun qisqa muddatli imzolangan token yaratadi.
 */
export function generateLabTicket(instanceId: string, userId: string): string {
  const exp = Date.now() + TICKET_TTL_MS;
  const payload = `${instanceId}:${userId}:${exp}`;
  const sig = crypto.createHmac("sha256", TICKET_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

/**
 * Kiruvchi lab ticket'ini tekshiradi (HMAC va vaqt chegarasi).
 */
export function verifyLabTicket(
  ticket: string,
  expectedInstanceId?: string,
  expectedUserId?: string
): { valid: boolean; instanceId?: string; userId?: string } {
  try {
    const decoded = Buffer.from(ticket, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return { valid: false };

    const [instanceId, userId, expStr, sig] = parts;
    const exp = parseInt(expStr, 10);
    if (isNaN(exp) || Date.now() > exp) return { valid: false };

    if (expectedInstanceId && instanceId !== expectedInstanceId) {
      return { valid: false };
    }
    if (expectedUserId && userId !== expectedUserId) {
      return { valid: false };
    }

    const payload = `${instanceId}:${userId}:${expStr}`;
    const expectedSig = crypto
      .createHmac("sha256", TICKET_SECRET)
      .update(payload)
      .digest("hex");

    const valid = crypto.timingSafeEqual(
      Buffer.from(sig, "hex"),
      Buffer.from(expectedSig, "hex")
    );
    if (!valid) return { valid: false };

    return { valid: true, instanceId, userId };
  } catch {
    return { valid: false };
  }
}
