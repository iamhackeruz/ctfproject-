import { NextRequest, NextResponse } from "next/server";

/**
 * CSRF Himoyasi (Cross-Site Request Forgery Protection)
 * OWASP tavsiyalariga asosan Origin va Host bosh sarlavhalarini tekshiradi.
 * Mutatsion so'rovlar (POST, PUT, PATCH, DELETE) uchun tekshirish majburiy.
 */
export function verifyCsrf(req: NextRequest): { valid: boolean; response?: NextResponse } {
  const method = req.method.toUpperCase();

  // Xavfsiz HTTP metodlariga CSRF tekshiruvi talab qilinmaydi (GET, HEAD, OPTIONS)
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return { valid: true };
  }

  const hostHeader =
    req.headers.get("host") ||
    req.headers.get("x-forwarded-host") ||
    req.nextUrl?.host;
  const originHeader = req.headers.get("origin");
  const refererHeader = req.headers.get("referer");

  // Agar Origin mavjud bo'lsa, uning Host qismi so'rov Host'iga mos kelishi kerak
  if (originHeader) {
    if (originHeader === "null" || originHeader === "") {
      return {
        valid: false,
        response: NextResponse.json(
          {
            success: false,
            error: "CSRF tekshiruvi rad etildi: Opaque yoki null Origin ruxsat etilmaydi.",
          },
          { status: 403 }
        ),
      };
    }
    try {
      const originUrl = new URL(originHeader);
      if (hostHeader && originUrl.host.toLowerCase() === hostHeader.toLowerCase()) {
        return { valid: true };
      }
      // Allowed dev hosts
      if (
        originUrl.hostname === "localhost" ||
        originUrl.hostname === "127.0.0.1" ||
        originUrl.hostname === "0.0.0.0"
      ) {
        if (
          hostHeader?.includes("localhost") ||
          hostHeader?.includes("127.0.0.1") ||
          hostHeader?.includes("0.0.0.0")
        ) {
          return { valid: true };
        }
      }

      return {
        valid: false,
        response: NextResponse.json(
          {
            success: false,
            error: "CSRF tekshiruvi rad etildi: Ruxsat etilmagan Origin sarlavhasi.",
          },
          { status: 403 }
        ),
      };
    } catch {
      return {
        valid: false,
        response: NextResponse.json(
          { success: false, error: "CSRF xatosi: Noto'g'ri Origin formati." },
          { status: 403 }
        ),
      };
    }
  }

  // Agar Origin bo'lmasa, Referer bosh sarlavhasi tekshiriladi
  if (refererHeader) {
    try {
      const refererUrl = new URL(refererHeader);
      if (hostHeader && refererUrl.host.toLowerCase() === hostHeader.toLowerCase()) {
        return { valid: true };
      }
    } catch {
      return {
        valid: false,
        response: NextResponse.json(
          { success: false, error: "CSRF xatosi: Noto'g'ri Referer formati." },
          { status: 403 }
        ),
      };
    }
  }

  // Maxsus dasturiy yoki CLI so'rovlar (masalan API testlari yoki x-requested-with sarlavhasi)
  const requestedWith = req.headers.get("x-requested-with");
  const authorization = req.headers.get("authorization");
  if (requestedWith === "XMLHttpRequest" || requestedWith === "CyberEduApp" || authorization) {
    return { valid: true };
  }

  // Local / Test muhitida agar origin bo'lmasa va host 127.0.0.1 / localhost bo'lsa ruxsat
  if (hostHeader && (hostHeader.includes("localhost") || hostHeader.includes("127.0.0.1") || hostHeader.includes("test"))) {
    return { valid: true };
  }

  return {
    valid: false,
    response: NextResponse.json(
      {
        success: false,
        error: "CSRF tekshiruvi rad etildi: Origin yoki Referer sarlavhasi kutilgan edi.",
      },
      { status: 403 }
    ),
  };
}
