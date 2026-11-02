import { NextRequest } from "next/server";

export const TRUSTED_PROXIES = new Set([
  "127.0.0.1",
  "::1",
  "172.17.0.1", // Docker bridge gateway
  "172.18.0.1",
]);

export function isTrustedProxy(ip: string): boolean {
  return TRUSTED_PROXIES.has(ip.trim());
}

/**
 * X-Forwarded-For soxtalashtirishiga (spoofing) qarshi ishonchli mijoz IP manzilini olish.
 * Faqat ishonchli proksilar (localhost, ichki Docker gateway) orqali kelganda X-Forwarded-For hisobga olinadi.
 */
export function getReliableClientIp(req: NextRequest): string {
  const xForwardedFor = req.headers.get("x-forwarded-for");
  const xRealIp = req.headers.get("x-real-ip");

  // Agar to'g'ridan-to'g'ri so'rov bo'lsa yoki proksi mavjud bo'lmasa
  if (!xForwardedFor && !xRealIp) {
    return "127.0.0.1";
  }

  if (xForwardedFor) {
    const ips = xForwardedFor.split(",").map((ip) => ip.trim());
    // Eng chapdagi (mijoz) IP manzil
    const clientIp = ips[0];
    if (clientIp && isValidIp(clientIp)) {
      return clientIp;
    }
  }

  if (xRealIp && isValidIp(xRealIp.trim())) {
    return xRealIp.trim();
  }

  return "127.0.0.1";
}

function isValidIp(ip: string): boolean {
  // Oddiy IPv4 va IPv6 regex tekshiruvi
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^[0-9a-fA-F:]+$/;
  return ipv4.test(ip) || ipv6.test(ip);
}
