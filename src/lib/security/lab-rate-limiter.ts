interface LabSubmissionAttempt {
  attempts: number;
  firstAttempt: number;
}

const labSubmissionRateMap = new Map<string, LabSubmissionAttempt>();

/**
 * Noto'g'ri flag topshirish uchun rate limit tekshiruvi:
 * 5 ta xato urinish / 1 daqiqa / foydalanuvchi / lab
 */
export function checkLabSubmissionRateLimit(
  userId: string,
  labId: string,
  increment = true
): { limited: boolean; remainingAttempts: number; retryAfterSeconds?: number } {
  const key = `${userId}:${labId}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 daqiqa
  const maxAttempts = 5;

  const entry = labSubmissionRateMap.get(key);

  if (!entry || now - entry.firstAttempt > windowMs) {
    if (increment) {
      labSubmissionRateMap.set(key, { attempts: 1, firstAttempt: now });
      return { limited: false, remainingAttempts: maxAttempts - 1 };
    }
    return { limited: false, remainingAttempts: maxAttempts };
  }

  if (entry.attempts >= maxAttempts) {
    const retryAfter = Math.ceil((entry.firstAttempt + windowMs - now) / 1000);
    return { limited: true, remainingAttempts: 0, retryAfterSeconds: retryAfter };
  }

  if (increment) {
    entry.attempts += 1;
  }

  return {
    limited: false,
    remainingAttempts: Math.max(0, maxAttempts - entry.attempts),
  };
}

/**
 * Noto'g'ri urinishni hisobga olish.
 */
export function recordFailedLabSubmission(userId: string, labId: string): number {
  const res = checkLabSubmissionRateLimit(userId, labId, true);
  return res.remainingAttempts;
}
