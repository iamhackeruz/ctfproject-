import crypto from "crypto";
import QRCode from "qrcode";

// ── 1. Base32 Kodlash va Dekodlash (RFC 4648) ──────────────────────────────
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(input: string): Buffer {
  const cleanInput = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const char = cleanInput[i];
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Base32 da yaroqsiz belgi: ${char}`);
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

// ── 2. TOTP Siri Yaratish ──────────────────────────────────────────────────
/**
 * Standart RFC 6238 bo'yicha 20 baytli (160-bit) kriptografik tasodifiy Base32 sir
 */
export function generateTotpSecret(): string {
  const randomBytes = crypto.randomBytes(20);
  return base32Encode(randomBytes);
}

// ── 3. AES-256-GCM Shifrlash va Deshifrlash ────────────────────────────────
function getTotpEncryptionKey(keyOverride?: string): Buffer {
  const key =
    keyOverride ||
    process.env.TOTP_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    "cyberedu-default-totp-encryption-key-must-be-changed-in-production-2026";

  if (/^[a-fA-F0-9]{64}$/.test(key)) {
    return Buffer.from(key, "hex");
  }
  // Agar ixtiyoriy matn bo'lsa, SHA-256 orqali 32 baytli kalit hosil qilamiz
  return crypto.createHash("sha256").update(key).digest();
}

/**
 * TOTP sirini AES-256-GCM bilan shifrlash (iv:tag:ciphertext)
 */
export function encryptTotpSecret(plainSecret: string, keyOverride?: string): string {
  const keyBuf = getTotpEncryptionKey(keyOverride);
  const iv = crypto.randomBytes(12); // 96-bit IV
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuf, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainSecret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag(); // 128-bit authentication tag

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Shifrlangan TOTP sirini deshifrlash
 */
export function decryptTotpSecret(encryptedStr: string, keyOverride?: string): string {
  if (!encryptedStr || !encryptedStr.includes(":")) {
    throw new Error("Shifrlangan TOTP siri formati noto'g'ri.");
  }

  const parts = encryptedStr.split(":");
  if (parts.length !== 3) {
    throw new Error("AES-256-GCM ma'lumotlari to'liq emas (iv:tag:cipher talab etiladi).");
  }

  const [ivHex, tagHex, cipherHex] = parts;
  const keyBuf = getTotpEncryptionKey(keyOverride);
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuf, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

// ── 4. RFC 6238 TOTP Kodini Yaratish va Tekshirish ─────────────────────────
/**
 * Belgilangan vaqt qadamida 6 raqamli TOTP kodini hisoblash
 */
export function generateTotpCode(
  secretBase32: string,
  stepOffset: number = 0,
  timeMs: number = Date.now()
): string {
  const timeStepSeconds = 30;
  const currentStep = Math.floor(timeMs / 1000 / timeStepSeconds) + stepOffset;

  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(currentStep), 0);

  const key = base32Decode(secretBase32);
  const hmac = crypto.createHmac("sha1", key).update(counterBuf).digest();

  // Dynamic Truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const code = (binary % 1000000).toString().padStart(6, "0");
  return code;
}

export interface TotpVerificationResult {
  valid: boolean;
  step?: bigint;
  error?: string;
}

/**
 * 6 raqamli kodni tekshirish:
 * - Faqat ±1 oraliq (Step -1, Step 0, Step +1)
 * - Replay attack himoyasi: avval ishlatilgan qadamni qayta qabul qilmaslik
 */
export function verifyTotpCode(
  secretBase32: string,
  code: string,
  lastUsedStep?: bigint | number | null,
  timeMs: number = Date.now()
): TotpVerificationResult {
  const cleanCode = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleanCode)) {
    return { valid: false, error: "2FA kodi aniq 6 ta raqamdan iborat bo'lishi kerak." };
  }

  const timeStepSeconds = 30;
  const baseStep = Math.floor(timeMs / 1000 / timeStepSeconds);
  const offsets = [0, -1, 1]; // Joriy vaqt, 30 soniya orqada, 30 soniya oldinda

  for (const offset of offsets) {
    const calcStep = BigInt(baseStep + offset);
    const expected = generateTotpCode(secretBase32, offset, timeMs);

    // Constant-time taqqoslash
    const a = Buffer.from(cleanCode);
    const b = Buffer.from(expected);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      // Replay himoyasi
      if (lastUsedStep !== undefined && lastUsedStep !== null && calcStep <= BigInt(lastUsedStep)) {
        return {
          valid: false,
          error: "Ushbu 2FA kod allaqachon ishlatilgan (Replay Attack himoyasi). Yangi kodni kuting.",
        };
      }
      return { valid: true, step: calcStep };
    }
  }

  return { valid: false, error: "Kiritilgan 2FA kodi noto'g'ri." };
}

// ── 5. Otpauth URI va SVG QR Kod ───────────────────────────────────────────
export function generateTotpUri(
  email: string,
  secretBase32: string,
  issuer: string = "CyberEdu"
): string {
  const cleanEmail = encodeURIComponent(email.trim());
  const cleanIssuer = encodeURIComponent(issuer.trim());
  return `otpauth://totp/${cleanIssuer}:${cleanEmail}?secret=${secretBase32}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
}

export async function generateTotpQrSvg(uri: string): Promise<string> {
  return await QRCode.toString(uri, {
    type: "svg",
    margin: 2,
    width: 220,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });
}

// ── 6. Zaxira Kodlari (Backup Codes) ───────────────────────────────────────
export function cleanBackupCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function hashBackupCode(code: string): string {
  const clean = cleanBackupCode(code);
  return crypto.createHash("sha256").update(clean).digest("hex");
}

/**
 * 10 ta bir martalik zaxira kod generatsiya qilish (XXXX-XXXX formatda)
 */
export function generateBackupCodes(count: number = 10): {
  rawCodes: string[];
  hashedCodes: string[];
} {
  const rawCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    // 8 belgili tasodifiy alfanumerik kod
    const hex = crypto.randomBytes(4).toString("hex").toUpperCase();
    const formatted = `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
    rawCodes.push(formatted);
    hashedCodes.push(hashBackupCode(formatted));
  }

  return { rawCodes, hashedCodes };
}

// ── 7. Vaqtinchalik 2FA Kutish Tokeni (5 daqiqa muddatli) ──────────────────
interface TwoFaPendingPayload {
  userId: string;
  setupRequired: boolean;
  exp: number;
  type: "2fa_pending";
}

function getPendingTokenSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    "cyberedu-production-session-secret-change-in-prod-2026-9f8e7d"
  );
}

export function create2FaPendingToken(userId: string, setupRequired: boolean): string {
  const payload: TwoFaPendingPayload = {
    userId,
    setupRequired,
    exp: Date.now() + 5 * 60 * 1000, // Aniq 5 daqiqa
    type: "2fa_pending",
  };

  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr, "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getPendingTokenSecret())
    .update(payloadB64)
    .digest("hex");

  return `${payloadB64}.${sig}`;
}

export function verify2FaPendingToken(
  token: string
): { userId: string; setupRequired: boolean } | null {
  if (!token || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", getPendingTokenSecret())
    .update(payloadB64)
    .digest("hex");

  if (sig.length !== expectedSig.length) return null;
  const match = crypto.timingSafeEqual(
    Buffer.from(sig, "hex"),
    Buffer.from(expectedSig, "hex")
  );
  if (!match) return null;

  try {
    const jsonStr = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(jsonStr) as TwoFaPendingPayload;

    if (payload.type !== "2fa_pending") return null;
    if (Date.now() > payload.exp) return null; // Muddati o'tgan

    return { userId: payload.userId, setupRequired: payload.setupRequired };
  } catch {
    return null;
  }
}
