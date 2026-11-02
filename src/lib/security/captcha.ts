/**
 * src/lib/security/captcha.ts
 * Cloudflare Turnstile va hCaptcha server tomoni verifikatsiyasi.
 * Botlar va avtomatlashgan ro'yxatdan o'tish hujumlaridan himoya.
 */

export interface CaptchaVerificationResult {
  success: boolean;
  error?: string;
  hostname?: string;
}

export async function verifyCaptchaToken(
  token: string,
  remoteIp?: string
): Promise<CaptchaVerificationResult> {
  const secretKey = process.env.CAPTCHA_SECRET_KEY;
  const provider = (process.env.CAPTCHA_PROVIDER || "turnstile").toLowerCase();

  // Test / Mahalliy ishlab chiqish rejimi uchun bypass:
  if (process.env.NODE_ENV !== "production" || process.env.ALLOW_TEST_ACCOUNTS === "true") {
    if (token === "test-captcha-token-valid" || token === "mock-turnstile-token" || !secretKey) {
      return { success: true, hostname: "localhost" };
    }
  }

  // Production rejimida secret kalit majburiy:
  if (!secretKey) {
    console.error("[CAPTCHA XATOSI] Production muhitida CAPTCHA_SECRET_KEY sozlanmagan!");
    return {
      success: false,
      error: "Xavfsizlik tekshiruvi xizmati to'liq sozlanmagan. Iltimos, administratorga murojaat qiling.",
    };
  }

  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return {
      success: false,
      error: "CAPTCHA tasdiqlash tokeni taqdim etilmadi.",
    };
  }

  try {
    let verifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
    if (provider === "hcaptcha") {
      verifyUrl = "https://hcaptcha.com/siteverify";
    }

    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token.trim());
    if (remoteIp) {
      formData.append("remoteip", remoteIp);
    }

    const res = await fetch(verifyUrl, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return {
        success: false,
        error: "CAPTCHA serveri bilan bog'lanishda xatolik yuz berdi.",
      };
    }

    const data = (await res.json()) as { success?: boolean; hostname?: string; "error-codes"?: string[] };

    if (!data.success) {
      return {
        success: false,
        error: "CAPTCHA tekshiruvidan o'tilmadi. Iltimos, qayta urinib ko'ring.",
      };
    }

    return {
      success: true,
      hostname: data.hostname,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[CAPTCHA TEKSHIRUV XATOSI]", msg);
    return {
      success: false,
      error: "CAPTCHA tekshiruvida kutilmagan tarmoq xatosi.",
    };
  }
}
