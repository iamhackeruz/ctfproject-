import { NextRequest } from "next/server";

// Standart xavfsiz ishonchli proksilar (Loopback va Docker ichki tarmoqlari)
const DEFAULT_TRUSTED_PROXIES = [
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "10.0.0.0/8",      // RFC 1918 Class A
  "172.16.0.0/12",   // RFC 1918 Class B (Docker bridge tarmoqlari 172.16.0.0 - 172.31.255.255)
  "192.168.0.0/16",  // RFC 1918 Class C
];

function normalizeIp(ip: string): string {
  const clean = ip.trim();
  if (clean.startsWith("::ffff:")) {
    return clean.slice(7);
  }
  return clean;
}

export function isValidIp(ip: string): boolean {
  const norm = normalizeIp(ip);
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4.test(norm)) {
    const parts = norm.split(".").map(Number);
    return parts.every((p) => p >= 0 && p <= 255);
  }
  const ipv6 = /^[0-9a-fA-F:]+$/;
  return ipv6.test(norm);
}

function ipv4ToLong(ip: string): number {
  const parts = normalizeIp(ip).split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isIpInCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes("/")) {
    return normalizeIp(ip) === normalizeIp(cidr);
  }
  const [range, bitsStr] = cidr.split("/");
  const bits = parseInt(bitsStr, 10);
  if (isNaN(bits) || bits < 0 || bits > 32) return false;

  // Hozirda faqat IPv4 CIDR tekshiruvi (Docker tarmoqlari IPv4 ishlatadi)
  if (!isValidIp(ip) || !isValidIp(range) || ip.includes(":") || range.includes(":")) {
    return false;
  }

  const ipLong = ipv4ToLong(ip);
  const rangeLong = ipv4ToLong(range);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;

  return (ipLong & mask) === (rangeLong & mask);
}

/**
 * Berilgan IP manzil ishonchli proksi (Caddy, Docker gateway, localhost) ekanligini tekshirish.
 */
export function isTrustedProxy(ip: string): boolean {
  const norm = normalizeIp(ip);
  if (!isValidIp(norm)) return false;

  const envProxies = process.env.TRUSTED_PROXIES
    ? process.env.TRUSTED_PROXIES.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const allRules = [...DEFAULT_TRUSTED_PROXIES, ...envProxies];

  for (const rule of allRules) {
    if (isIpInCidr(norm, rule)) {
      return true;
    }
  }

  return false;
}

/**
 * X-Forwarded-For soxtalashtirishiga (spoofing) qarshi ishonchli mijoz IP manzilini olish.
 * Standart xavfsizlik qoidasi: O'ng tomondan chapga (Right-to-Left) tahlil qilinadi.
 * Ishonchli proksilar (Caddy, Docker) o'ng tomondan olib tashlanadi va birinchi
 * ishonchsiz (haqiqiy tashqi mijoz) IP qaytariladi.
 * Mijoz o'zi soxta "X-Forwarded-For: 1.1.1.1" yuborgan taqdirda ham, Caddy uning haqiqiy
 * IP sini o'ng tomonga qo'shgani sababli, soxta IP hisobga olinmaydi!
 */
export function getReliableClientIp(req: NextRequest): string {
  const xForwardedFor = req.headers.get("x-forwarded-for");
  const xRealIp = req.headers.get("x-real-ip");

  if (xForwardedFor) {
    const rawIps = xForwardedFor
      .split(",")
      .map((ip) => normalizeIp(ip))
      .filter((ip) => isValidIp(ip));

    if (rawIps.length > 0) {
      // O'ngdan chapga qarab ishonchli proksilarni qirqish (Right-to-Left peeling)
      for (let i = rawIps.length - 1; i >= 0; i--) {
        const candidate = rawIps[i];
        if (!isTrustedProxy(candidate)) {
          // Birinchi ishonchsiz (tashqi) IP — bu haqiqiy mijoz!
          return candidate;
        }
      }

      // Agar zanjirdagi barcha IP lar ishonchli bo'lsa (masalan, ichki so'rov), eng chapdagisini qaytaramiz
      return rawIps[0];
    }
  }

  if (xRealIp) {
    const normReal = normalizeIp(xRealIp);
    if (isValidIp(normReal)) {
      return normReal;
    }
  }

  return "127.0.0.1";
}
