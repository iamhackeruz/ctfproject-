import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSession } from "@/lib/security/session";
import { prisma } from "@/lib/db";
import { verifyLabTicket } from "@/lib/labs/tickets";
import { canAccess } from "@/lib/security/entitlements";

const INSTANCE_ID_REGEX = /^[a-zA-Z0-9_-]{4,48}$/;

interface RouteContext {
  params: Promise<{
    instanceId: string;
    path?: string[];
  }>;
}

export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  return handleProxyRequest(req, context);
}

export async function POST(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  return handleProxyRequest(req, context);
}

export async function PUT(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  return handleProxyRequest(req, context);
}

async function handleProxyRequest(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { instanceId, path } = await context.params;

  // 1. Parametr validatsiyasi va SSRF / Path-traversal himoyasi
  if (!instanceId || !INSTANCE_ID_REGEX.test(instanceId)) {
    return NextResponse.json({ error: "Noto'g'ri instansiya identifikatori" }, { status: 400 });
  }

  // SSRF tekshiruvi: Mijozdan kelgan host, port yoki url override parametrlarini qat'iy rad etish
  const searchParams = req.nextUrl.searchParams;
  if (
    searchParams.has("host") ||
    searchParams.has("port") ||
    searchParams.has("target") ||
    searchParams.has("url") ||
    searchParams.has("dest")
  ) {
    return NextResponse.json(
      { error: "Xavfsizlik xatosi: Server tomoni proksi manzilini mijoz orqali o'zgartirish taqiqlangan (SSRF himoyasi)." },
      { status: 400 }
    );
  }

  // 2. Autentifikatsiya: Bir martalik imzolangan ticket yoki platforma sessiyasi
  const ticketParam = searchParams.get("ticket") || undefined;
  const ticketCookie = req.cookies.get(`lab_ticket_${instanceId}`)?.value;
  const activeTicket = ticketParam || ticketCookie;

  let effectiveUserId: string | null = null;
  let isTicketAuthenticated = false;

  if (activeTicket) {
    const verified = verifyLabTicket(activeTicket, instanceId);
    if (verified.valid && verified.userId) {
      effectiveUserId = verified.userId;
      isTicketAuthenticated = true;
    }
  }

  if (!effectiveUserId) {
    const { session } = await getOrCreateSession(req);
    effectiveUserId = session.userId;
  }

  // 3. Instansiyani faqat serverdagi bazadan topish (IDOR himoyasi)
  const instance = await prisma.webLabInstance.findFirst({
    where: {
      containerId: instanceId,
      userId: effectiveUserId,
      status: "running",
      expiresAt: { gt: new Date() },
    },
    include: {
      lab: true,
    },
  });

  if (!instance) {
    return NextResponse.json(
      { error: "Veb-laboratoriya instansiyasi topilmadi yoki muddati o'tgan. Iltimos qaytadan ishga tushiring." },
      { status: 404 }
    );
  }

  // Markaziy darvozabon: foydalanuvchining labga kirish huquqi faol ekanini tekshirish
  const userRecord = await prisma.user.findUnique({
    where: { id: effectiveUserId },
    select: { id: true, role: true, isBlocked: true },
  });

  if (!userRecord || userRecord.isBlocked) {
    return NextResponse.json({ error: "Foydalanuvchi hisobi bloklangan yoki mavjud emas." }, { status: 403 });
  }

  const access = await canAccess(userRecord, { type: "lab", labId: instance.lab.slug || instance.lab.id });
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.reason || "Ushbu laboratoriyaga kirish huquqi mavjud emas." },
      { status: access.statusCode || 403 }
    );
  }

  // Ichki xavfsiz port oralig'i tekshiruvi (6001 - 6100)
  if (typeof instance.hostPort !== "number" || instance.hostPort < 6000 || instance.hostPort > 6200) {
    return NextResponse.json(
      { error: "Xavfsizlik xatosi: Noto'g'ri instansiya porti" },
      { status: 500 }
    );
  }

  // 4. Upstream manzilini qat'iy 127.0.0.1 da tuzish
  const subPath = path && path.length > 0 ? "/" + path.join("/") : "/";
  // Ticket parametrini upstreamga uzatmaslik
  const cleanSearch = new URLSearchParams(req.nextUrl.searchParams);
  cleanSearch.delete("ticket");
  const searchStr = cleanSearch.toString() ? `?${cleanSearch.toString()}` : "";
  const targetUrl = `http://127.0.0.1:${instance.hostPort}${subPath}${searchStr}`;

  try {
    const headers = new Headers();

    // 5. Platforma maxfiy sarlavhalarini (cookie, authorization, csrf) upstreamga O'TKAZMASLIK
    req.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (
        !["host", "connection", "transfer-encoding", "authorization", "x-csrf-token"].includes(lower) &&
        lower !== "cookie"
      ) {
        headers.set(key, value);
      }
    });

    // Faqat veb-lab konteyneri o'zi o'rnatgan lab-cookie'larni uzatish (platforma sessiyasi butunlay tozalandi)
    const clientCookie = req.headers.get("cookie");
    if (clientCookie) {
      const filteredCookies = clientCookie
        .split(";")
        .map((c) => c.trim())
        .filter((c) => !c.startsWith("cyberedu_session=") && !c.startsWith("lab_ticket_"))
        .join("; ");
      if (filteredCookies) {
        headers.set("cookie", filteredCookies);
      }
    }

    let body: BodyInit | undefined = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const buffer = await req.arrayBuffer();
      if (buffer.byteLength > 0) {
        body = Buffer.from(buffer);
      }
    }

    let upstreamRes: Response | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        upstreamRes = await fetch(targetUrl, {
          method: req.method,
          headers,
          body,
          signal: AbortSignal.timeout(6000),
        });
        if (upstreamRes) break;
      } catch (err) {
        lastError = err;
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    if (!upstreamRes) {
      throw lastError || new Error("Upstream javob bermadi");
    }

    // 6. Xavfsizlik sarlavhalari bilan boyitilgan javobni qaytarish
    const resHeaders = new Headers();
    upstreamRes.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      // Upstreamdan kelgan ba'zi sarlavhalarni xavfsiz qabul qilish
      if (!["content-security-policy", "x-frame-options"].includes(lower)) {
        resHeaders.set(key, val);
      }
    });

    // Qat'iy xavfsizlik va izolyatsiya sarlavhalari (allow-same-origin olib tashlangan - opaque origin)
    resHeaders.set(
      "Content-Security-Policy",
      "default-src 'self' 'unsafe-inline' data:; frame-ancestors 'self'; sandbox allow-forms allow-scripts;"
    );
    resHeaders.set("X-Content-Type-Options", "nosniff");
    resHeaders.set("X-Frame-Options", "SAMEORIGIN");
    resHeaders.set("Referrer-Policy", "no-referrer");

    // Agar ticket orqali yangi kirilgan bo'lsa, lab scope cookie o'rnatish
    if (isTicketAuthenticated && activeTicket && ticketParam) {
      resHeaders.append(
        "Set-Cookie",
        `lab_ticket_${instanceId}=${encodeURIComponent(activeTicket)}; Path=/api/labs/proxy/${instanceId}; SameSite=Lax; HttpOnly; Max-Age=1800`
      );
    }

    const resBody = await upstreamRes.arrayBuffer();

    return new NextResponse(Buffer.from(resBody), {
      status: upstreamRes.status,
      headers: resHeaders,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Laboratoriya bilan aloqa uzildi: ${msg}` },
      { status: 502 }
    );
  }
}
