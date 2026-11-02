import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // 1. Kriptografik tasodifiy nonce yaratish (har bir so'rov uchun unikal, Edge runtime mos)
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  let binary = "";
  for (let i = 0; i < randomBytes.length; i++) {
    binary += String.fromCharCode(randomBytes[i]);
  }
  const nonce = btoa(binary);

  // 2. Qat'iy CSP: dev muhitda Turbopack eval/inline ga ruxsat, productionda strict nonce
  const isDev = process.env.NODE_ENV !== "production";
  const scriptPolicy = isDev
    ? `'self' 'unsafe-inline' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  const cspHeader = `
    default-src 'self';
    script-src ${scriptPolicy};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' data: https:;
    font-src 'self' data: https://fonts.gstatic.com;
    connect-src 'self';
    media-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Xavfsizlik sarlavhalarini javobga o'rnatish
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), browsing-topics=()");
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

  return response;
}

export const config = {
  matcher: [
    /*
     * Barcha yo'llar, quyidagilar mustasno:
     * - api/labs/proxy (veb lablar o'zining opaque sandbox CSP'siga ega)
     * - _next/static, _next/image, favicon.ico (statik fayllar)
     */
    {
      source: "/((?!api/labs/proxy|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
