import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";

export const MAX_BODY_SIZE_BYTES = 64 * 1024; // 64 KB maksimal ruxsat etilgan hajm

// ── ZOD SCHEMAS ────────────────────────────────────────────────────────────

export const authLoginSchema = z.object({
  action: z.literal("login").optional(),
  email: z.string().email("Yaroqsiz elektron pochta manzili").max(100),
  password: z.string().min(1, "Parol kiritilishi shart").max(128),
});

export const authRegisterSchema = z.object({
  action: z.literal("register").optional(),
  name: z.string().min(2, "Ism kamida 2 ta belgi bo'lishi kerak").max(50),
  email: z.string().email("Yaroqsiz elektron pochta manzili").max(100),
  password: z.string().min(10, "Parol kamida 10 ta belgidan iborat bo'lishi shart").max(128),
});

export const authPasswordResetRequestSchema = z.object({
  action: z.literal("request-reset"),
  email: z.string().email().max(100),
});

export const authPasswordResetConfirmSchema = z.object({
  action: z.literal("confirm-reset"),
  email: z.string().email().max(100),
  code: z.string().min(4).max(12),
  newPassword: z.string().min(10).max(128),
});

export const authPasswordChangeSchema = z.object({
  action: z.literal("change-password"),
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(10).max(128),
});

export const labSubmitFlagSchema = z.object({
  action: z.literal("submit_flag").optional(),
  labId: z.string().min(2).max(100),
  flag: z.string().min(4).max(150),
});

export const labStartInstanceSchema = z.object({
  action: z.literal("start_instance"),
  labId: z.string().min(2).max(100),
});

export const quizSubmitSchema = z.object({
  answers: z.record(z.string(), z.union([z.number(), z.string()])),
});

export const certificateClaimSchema = z.object({
  courseId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
});

export const terminalCommandSchema = z.object({
  sessionId: z.string().min(3).max(64),
  command: z.string().min(1).max(2048),
  labSlug: z.string().max(64).optional(),
});

export const courseUpdateSchema = z.object({
  title: z.string().min(3).max(150).optional(),
  desc: z.string().max(500).optional(),
  fullDesc: z.string().max(5000).optional(),
  isPublished: z.boolean().optional(),
});

// ── HAJM LIMITI VA PARSING ─────────────────────────────────────────────────

/**
 * Request body hajmini 64KB dan oshmasligini tekshirish (Payload Too Large himoyasi).
 */
export async function parseJsonWithLimit<T>(
  req: NextRequest,
  schema: z.ZodType<T>,
  maxBytes = MAX_BODY_SIZE_BYTES
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      return {
        success: false,
        response: NextResponse.json(
          { success: false, error: "So'rov hajmi ruxsat etilgan limitdan (64KB) katta." },
          { status: 413 }
        ),
      };
    }

    const bodyBuffer = await req.arrayBuffer();
    if (bodyBuffer.byteLength > maxBytes) {
      return {
        success: false,
        response: NextResponse.json(
          { success: false, error: "So'rov hajmi ruxsat etilgan limitdan oshdi." },
          { status: 413 }
        ),
      };
    }

    const rawText = Buffer.from(bodyBuffer).toString("utf-8");
    const json = rawText ? JSON.parse(rawText) : {};
    const parsed = schema.parse(json);

    return { success: true, data: parsed };
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      const firstIssue = err.issues[0]?.message || "Validatsiya xatosi";
      return {
        success: false,
        response: NextResponse.json(
          { success: false, error: firstIssue, details: err.issues },
          { status: 400 }
        ),
      };
    }

    if (err instanceof SyntaxError) {
      return {
        success: false,
        response: NextResponse.json(
          { success: false, error: "Noto'g'ri JSON formati." },
          { status: 400 }
        ),
      };
    }

    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: "So'rovni o'qishda xatolik yuz berdi." },
        { status: 400 }
      ),
    };
  }
}

/**
 * Xatolarda ichki ma'lumotlarni (stack trace, SQL so'rovlar, baza jadvallari)
 * mijozga oshkor qilmasdan xavfsiz javob qaytarish.
 */
export function safeApiError(err: unknown, context = "API"): NextResponse {
  // Haqiqiy xato server konsoliga xavfsiz log qilinadi
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[XAVFSIZLIK LOG] ${context} ichki xatosi:`, msg, stack || "");

  // Mijozga hech qachon stack trace yoki SQL xabari berilmaydi
  return NextResponse.json(
    {
      success: false,
      error: "Ichki tizim xatoligi yuz berdi. Iltimos, keyinroq qayta urinib ko'ring.",
    },
    { status: 500 }
  );
}
