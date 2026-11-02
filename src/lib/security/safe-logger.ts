/**
 * src/lib/security/safe-logger.ts
 * Xavfsiz log yuritish moduli:
 * Har qanday parol, sessiya tokeni, API sirlari, shaxsiy kalitlar va
 * cookie'larni log fayllariga yoki terminalga tushishidan oldin avtomatik tsenzura (masking) qiladi.
 */

const SENSITIVE_PATTERNS = [
  /(?:password|parol|secret|token|totp|apiKey|credential|authorization|cookie)["']?\s*[:=]\s*["']?([^"',\s&]+)["']?/gi,
  /Bearer\s+([a-zA-Z0-9_\-\.]+)/gi,
  /flag\{[a-zA-Z0-9_-]+\}/gi,
  /cyberedu_session=[a-zA-Z0-9_\-\.]+/gi,
];

export function sanitizeLogMessage(msg: string): string {
  if (typeof msg !== "string") {
    try {
      msg = JSON.stringify(msg);
    } catch {
      return "[Unserializable object]";
    }
  }

  let sanitized = msg;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      if (match.toLowerCase().startsWith("bearer ")) {
        return "Bearer [REDACTED]";
      }
      if (match.toLowerCase().startsWith("cyberedu_session=")) {
        return "cyberedu_session=[REDACTED]";
      }
      if (match.toLowerCase().startsWith("flag{")) {
        return "flag{[REDACTED]}";
      }
      const parts = match.split(/[:=]/);
      if (parts.length >= 2) {
        return `${parts[0]}: "[REDACTED]"`;
      }
      return "[REDACTED]";
    });
  }

  return sanitized;
}

export function logInfo(message: string, meta?: unknown) {
  const safeMsg = sanitizeLogMessage(message);
  if (meta !== undefined) {
    console.log(`[INFO] ${safeMsg}`, sanitizeLogMessage(typeof meta === "object" ? JSON.stringify(meta) : String(meta)));
  } else {
    console.log(`[INFO] ${safeMsg}`);
  }
}

export function logWarn(message: string, meta?: unknown) {
  const safeMsg = sanitizeLogMessage(message);
  if (meta !== undefined) {
    console.warn(`[WARN] ${safeMsg}`, sanitizeLogMessage(typeof meta === "object" ? JSON.stringify(meta) : String(meta)));
  } else {
    console.warn(`[WARN] ${safeMsg}`);
  }
}

export function logError(message: string, err?: unknown) {
  const safeMsg = sanitizeLogMessage(message);
  const errMsg = err instanceof Error ? `${err.name}: ${err.message}` : typeof err === "object" ? JSON.stringify(err) : String(err || "");
  console.error(`[ERROR] ${safeMsg} ${sanitizeLogMessage(errMsg)}`);
}
