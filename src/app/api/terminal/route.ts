import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateSession, attachSessionCookie } from "@/lib/security/session";
import { checkRateLimit } from "@/lib/security/rate-limiter";
import { logTerminalAudit } from "@/lib/security/audit-logger";
import { TerminalSessionManager } from "@/lib/terminal/session-manager";
import { canAccess } from "@/lib/security/entitlements";
import { checkAndRecordTerminalUsage } from "@/lib/security/quota";

const MAX_COMMAND_LENGTH = 1024;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  let clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  if (!clientIp) clientIp = "127.0.0.1";

  // 1. Server tomonida imzolangan httpOnly cookie sessiyasi
  const { session, token } = await getOrCreateSession(req);

  // 2. Rate Limiting (1 daqiqada 30 ta so'rov)
  const rateLimitKey = `${session.userId}:${clientIp}`;
  const rateCheck = checkRateLimit(rateLimitKey, 30, 60000);

  if (!rateCheck.allowed) {
    const errorRes = NextResponse.json(
      {
        stdout: "",
        stderr:
          "Xavfsizlik cheklovi: Juda ko'p so'rov yuborildi. Iltimos, 1 daqiqada ko'pi bilan 30 ta buyruq yuboring.",
        cwd: "/home/student",
        exitCode: 429,
      },
      { status: 429 }
    );
    if (token) attachSessionCookie(errorRes, token);
    return errorRes;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { command, sessionId, courseId, labSlug, currentCwd } = body;

    // 3. Kiritish validatsiyasi
    if (typeof command !== "string" || !command.trim()) {
      const emptyRes = NextResponse.json({
        stdout: "",
        stderr: "",
        cwd: currentCwd || "/home/student",
        exitCode: 0,
      });
      if (token) attachSessionCookie(emptyRes, token);
      return emptyRes;
    }

    // Null byte filtri
    if (command.includes("\0")) {
      const blockedRes = NextResponse.json(
        {
          stdout: "",
          stderr: "Xavfsizlik xatosi: Buyruqda taqiqlangan belgilar mavjud.",
          cwd: currentCwd || "/home/student",
          exitCode: 400,
        },
        { status: 400 }
      );
      if (token) attachSessionCookie(blockedRes, token);
      return blockedRes;
    }

    // Uzunlik tekshiruvi
    if (command.length > MAX_COMMAND_LENGTH) {
      const lenRes = NextResponse.json(
        {
          stdout: "",
          stderr: `Xatolik: Buyruq uzunligi ${MAX_COMMAND_LENGTH} belgidan oshmasligi kerak.`,
          cwd: currentCwd || "/home/student",
          exitCode: 400,
        },
        { status: 400 }
      );
      if (token) attachSessionCookie(lenRes, token);
      return lenRes;
    }

    const trimmedCommand = command.trim();

    // Server markaziy darvozaboni (canAccess tekshiruvi)
    const userRecord = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, isBlocked: true },
    });

    if (labSlug) {
      const access = await canAccess(userRecord, { type: "lab", labId: String(labSlug) });
      if (!access.allowed) {
        const forbiddenRes = NextResponse.json(
          {
            stdout: "",
            stderr: `Kirish rad etildi: ${access.reason || "Ushbu laboratoriyaga kirish huquqingiz yo'q."}`,
            cwd: currentCwd || "/home/student",
            exitCode: 403,
          },
          { status: 403 }
        );
        if (token) attachSessionCookie(forbiddenRes, token);
        return forbiddenRes;
      }
    } else if (courseId) {
      const access = await canAccess(userRecord, { type: "course", courseId: Number(courseId) });
      if (!access.allowed) {
        const forbiddenRes = NextResponse.json(
          {
            stdout: "",
            stderr: `Kirish rad etildi: ${access.reason || "Ushbu kursga kirish huquqingiz yo'q."}`,
            cwd: currentCwd || "/home/student",
            exitCode: 403,
          },
          { status: 403 }
        );
        if (token) attachSessionCookie(forbiddenRes, token);
        return forbiddenRes;
      }
    }

    // Kunlik terminal vaqti kvotasi (dailyTerminalQuotaMinutes)
    const quotaCheck = await checkAndRecordTerminalUsage(session.userId);
    if (!quotaCheck.allowed) {
      const quotaRes = NextResponse.json(
        {
          stdout: "",
          stderr: `Kvota cheklovi: ${quotaCheck.reason || "Kunlik terminal vaqti limiti tugadi."}`,
          cwd: currentCwd || "/home/student",
          exitCode: 429,
        },
        { status: 429 }
      );
      if (token) attachSessionCookie(quotaRes, token);
      return quotaRes;
    }

    // Sessiya ID ni foydalanuvchiga bog'lash
    const safeSessionId =
      sessionId && typeof sessionId === "string"
        ? `${session.userId}_${sessionId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24)}`
        : session.userId;

    const courseOrLab =
      typeof labSlug === "string"
        ? labSlug
        : typeof courseId === "number"
        ? courseId
        : undefined;

    // 4. Buyruqni xavfsiz Sandbox (Docker yoki Fallback Virtual) orqali bajarish
    const result = await TerminalSessionManager.execute(
      safeSessionId,
      session.userId,
      trimmedCommand,
      courseOrLab,
      currentCwd
    );

    const durationMs = Date.now() - startTime;

    // 5. Audit logga yozish
    logTerminalAudit({
      timestamp: new Date().toISOString(),
      userId: session.userId,
      ip: clientIp,
      sessionId: safeSessionId,
      courseId: typeof courseOrLab === "number" ? courseOrLab : undefined,
      command: trimmedCommand.slice(0, 256),
      exitCode: result.exitCode,
      durationMs,
      driver: result.isVirtual ? "virtual" : "docker",
    });

    const response = NextResponse.json({
      stdout: result.stdout,
      stderr: result.stderr,
      cwd: result.cwd,
      exitCode: result.exitCode,
      isVirtual: result.isVirtual,
    });

    // Har doim imzolangan httpOnly cookie'ni biriktirish
    if (token) attachSessionCookie(response, token);
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Noma'lum xatolik";
    const durationMs = Date.now() - startTime;

    logTerminalAudit({
      timestamp: new Date().toISOString(),
      userId: session.userId,
      ip: clientIp,
      sessionId: session.userId,
      command: "ERROR",
      exitCode: 500,
      durationMs,
      driver: "virtual",
      error: message,
    });

    const errRes = NextResponse.json(
      {
        stdout: "",
        stderr: `Server xatoligi: ${message}`,
        cwd: "/home/student",
        exitCode: 500,
      },
      { status: 500 }
    );
    if (token) attachSessionCookie(errRes, token);
    return errRes;
  }
}
