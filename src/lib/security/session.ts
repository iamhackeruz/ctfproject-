import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "../db";
import { Role } from "@prisma/client";

export interface SessionUser {
  userId: string;
  role: Role;
  email: string;
  name: string;
  phone?: string | null;
  avatar?: string | null;
  mustChangePassword?: boolean;
  isBlocked?: boolean;
  twoFactorEnabled?: boolean;
  createdAt?: number;
}

const COOKIE_NAME = "cyberedu_session";
const SESSION_SECRET =
  process.env.SESSION_SECRET || "cyberedu-production-session-secret-change-in-prod-2026-9f8e7d";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function signToken(rawToken: string): string {
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(rawToken).digest("hex");
  return `${rawToken}.${sig}`;
}

function verifySignedToken(cookieVal: string): string | null {
  const parts = cookieVal.split(".");
  if (parts.length !== 2) return null;
  const [rawToken, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(rawToken).digest("hex");
  if (sig.length !== expectedSig.length) return null;
  const match = crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSig, "hex"));
  return match ? rawToken : null;
}

/**
 * Yangi bazaviy sessiya yaratadi va imzolangan tokenni qaytaradi.
 */
export async function createDbSession(
  userId: string,
  req: NextRequest
): Promise<{ token: string; user: SessionUser }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Foydalanuvchi topilmadi");
  if (user.isBlocked) throw new Error("Hisob administrator tomonidan bloklangan");

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || null;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 kun

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash,
      ip,
      userAgent,
      expiresAt,
    },
  });

  const sessionUser: SessionUser = {
    userId: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
    phone: user.phone,
    avatar: user.avatar,
    mustChangePassword: user.mustChangePassword,
    isBlocked: user.isBlocked,
    twoFactorEnabled: user.twoFactorEnabled,
  };

  const signedToken = signToken(rawToken);
  return { token: signedToken, user: sessionUser };
}

/**
 * Cookie'dagi sessiyani bazadan tekshiradi.
 */
export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const cookieVal = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookieVal) return null;

  const rawToken = verifySignedToken(cookieVal);
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const dbSession = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!dbSession) return null;
  if (dbSession.revokedAt) return null;
  if (dbSession.expiresAt < new Date()) return null;
  if (dbSession.user.isBlocked) return null;

  // 5-bosqich: Oxirgi faollik (Idle timeout - 2 soat) bo'yicha sessiyani tugatish
  const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;
  if (Date.now() - dbSession.lastActiveAt.getTime() > IDLE_TIMEOUT_MS) {
    await prisma.session
      .update({
        where: { id: dbSession.id },
        data: { revokedAt: new Date() },
      })
      .catch(() => {});
    return null;
  }

  // Har 10 daqiqada oxirgi faollikni yangilash
  if (Date.now() - dbSession.lastActiveAt.getTime() > 10 * 60 * 1000) {
    prisma.session
      .update({
        where: { id: dbSession.id },
        data: { lastActiveAt: new Date() },
      })
      .catch(() => {});
  }

  const { user } = dbSession;
  return {
    userId: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
    phone: user.phone,
    avatar: user.avatar,
    mustChangePassword: user.mustChangePassword,
    isBlocked: user.isBlocked,
    twoFactorEnabled: user.twoFactorEnabled,
  };
}

/**
 * Agar sessiya mavjud bo'lmasa, anonim talaba seansini yaratadi yoki mavjudini qaytaradi.
 */
export async function getOrCreateSession(req: NextRequest): Promise<{
  session: SessionUser;
  isNew: boolean;
  token?: string;
}> {
  const existing = await getSessionUser(req);
  if (existing) {
    return { session: existing, isNew: false };
  }

  // Mehmon/anonim talaba uchun bazada foydalanuvchi va sessiya yaratish
  const guestEmail = `guest_${crypto.randomBytes(6).toString("hex")}@cyberedu.local`;
  const dummyHash = "GUEST_NO_DIRECT_LOGIN";

  const guestUser = await prisma.user.create({
    data: {
      email: guestEmail,
      name: "Talaba",
      passwordHash: dummyHash,
      role: Role.student,
      avatar: "👨‍🎓",
    },
  });

  const { token, user } = await createDbSession(guestUser.id, req);
  return { session: user, isNew: true, token };
}

/**
 * Sessiyani bekor qilish (Logout).
 */
export async function revokeCurrentSession(req: NextRequest): Promise<void> {
  const cookieVal = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookieVal) return;

  const rawToken = verifySignedToken(cookieVal);
  if (!rawToken) return;

  const tokenHash = hashToken(rawToken);
  await prisma.session.updateMany({
    where: { tokenHash },
    data: { revokedAt: new Date() },
  });
}

/**
 * httpOnly, Secure, SameSite=Lax cookie biriktirish.
 */
export function attachSessionCookie(res: NextResponse, token: string): void {
  const isProd = process.env.NODE_ENV === "production";
  const appUrl = process.env.APP_URL || "";
  const isHttps = appUrl.startsWith("https://");

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd && isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 kun
  });
}

/**
 * Cookie'ni o'chirish.
 */
export function clearSessionCookie(res: NextResponse): void {
  const isProd = process.env.NODE_ENV === "production";
  const appUrl = process.env.APP_URL || "";
  const isHttps = appUrl.startsWith("https://");

  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProd && isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Server tomonidagi RBAC himoya tekshiruvi.
 */
export async function requireAuth(
  req: NextRequest,
  allowedRoles?: Role[]
): Promise<{ user: SessionUser } | NextResponse> {
  const user = await getSessionUser(req);

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Avtorizatsiyadan o'tilmagan. Iltimos, tizimga kiring." },
      { status: 401 }
    );
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "Taqiqlangan: Sizda ushbu amalni bajarish uchun yetarli huquq yo'q (RBAC).",
        },
        { status: 403 }
      );
    }
  }

  return { user };
}

/**
 * 1-bosqich testlari bilan moslik uchun imzolangan yengil token yaratish va tekshirish
 */
export function signSession(user: { userId: string; role: string; createdAt?: number }): string {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifySession(token?: string | null): { userId: string; role: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  if (signature.length !== expectedSig.length) return null;
  const isValid = crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSig, "hex"));
  if (!isValid) return null;
  try {
    const raw = Buffer.from(payload, "base64url").toString("utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Foydalanuvchining barcha faol sessiyalarini bekor qilish (parol o'zgarganda).
 */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const res = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
  return res.count;
}

/**
 * Muayyan sessiyani ID bo'yicha bekor qilish.
 */
export async function revokeSessionById(sessionId: string, userId: string): Promise<boolean> {
  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) return false;

  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
  return true;
}

/**
 * Foydalanuvchining barcha faol sessiyalari ro'yxatini olish.
 */
export async function listUserSessions(userId: string, currentReq?: NextRequest) {
  let currentTokenHash: string | null = null;
  if (currentReq) {
    const cookieVal = currentReq.cookies.get(COOKIE_NAME)?.value;
    if (cookieVal) {
      const raw = verifySignedToken(cookieVal);
      if (raw) currentTokenHash = hashToken(raw);
    }
  }

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastActiveAt: "desc" },
    select: {
      id: true,
      ip: true,
      userAgent: true,
      createdAt: true,
      lastActiveAt: true,
      tokenHash: true,
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    ip: s.ip,
    userAgent: s.userAgent,
    createdAt: s.createdAt,
    lastActiveAt: s.lastActiveAt,
    isCurrent: s.tokenHash === currentTokenHash,
  }));
}
