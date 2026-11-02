/**
 * Foydalanuvchi DisplayName validatsiyasi va HTML chiqishini sanitizatsiya qilish moduli.
 */

const DISPLAY_NAME_REGEX = /^[a-zA-Z0-9_\-. \u0400-\u04FF\u0100-\u024F]{2,32}$/;

export function validateDisplayName(name: unknown): { valid: boolean; error?: string; cleanName?: string } {
  if (typeof name !== "string") {
    return { valid: false, error: "Ism matn ko'rinishida bo'lishi shart." };
  }

  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 32) {
    return {
      valid: false,
      error: "Ko'rsatiladigan nom uzunligi 2 dan 32 belgiga teng bo'lishi kerak.",
    };
  }

  // HTML / Skript / XSS belgilarini qat'iy taqiqlash
  if (/[<>&"'/\\`]/.test(trimmed)) {
    return {
      valid: false,
      error: "Nomda xavfsizlik nuqtai nazaridan maxsus belgilar (<, >, &, \", ', /, \\) ruxsat etilmaydi.",
    };
  }

  if (!DISPLAY_NAME_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: "Nom faqat harflar, raqamlar, probel, nuqta va chiziqchadan iborat bo'lishi mumkin.",
    };
  }

  return { valid: true, cleanName: trimmed };
}

/**
 * XSS hujumlariga qarshi HTML maxsus belgilarini xavfsiz almashtirish.
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}
