import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { verifyCsrf } from "@/lib/security/csrf";
import { hashPassword } from "@/lib/security/password";
import { recordAuditLog } from "@/lib/security/audit";
import { Role } from "@prisma/client";
import crypto from "crypto";

/**
 * Formula Injection (CSV Injection) zararsizlantirish:
 * Agar qiymat '=', '+', '-', '@' bilan boshlansa, uni bitta tirnoq (') bilan oldidan to'sib qo'yamiz.
 */
export function sanitizeCsvFormulaInjection(val: string): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const csrf = verifyCsrf(req);
  if (!csrf.valid) return csrf.response!;

  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;
  const { user: currentUser } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const csvContent = body.csvContent || body.csvData;
    const { defaultGroupId } = body;

    if (!csvContent || typeof csvContent !== "string") {
      return NextResponse.json(
        { success: false, error: "CSV matni yuborilmadi." },
        { status: 400 }
      );
    }

    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      return NextResponse.json({ success: false, error: "CSV bo'sh." }, { status: 400 });
    }

    // Maksimal 500 qator limiti
    if (lines.length > 501) {
      // 1-qator sarlavha + 500 qator
      return NextResponse.json(
        { success: false, error: "CSV fayl hajmi maksimal 500 qatordan oshmasligi shart." },
        { status: 400 }
      );
    }

    let startIndex = 0;
    const firstLineLower = lines[0].toLowerCase();
    if (firstLineLower.includes("email") || firstLineLower.includes("ism") || firstLineLower.includes("name")) {
      startIndex = 1;
    }

    const importedUsers: Array<{ id: string; email: string; name: string; tempPass: string }> = [];
    const errors: Array<{ row: number; email?: string; error: string }> = [];

    for (let i = startIndex; i < lines.length; i++) {
      const lineNum = i + 1;
      const row = lines[i];

      // CSV parser (oddiy vergul yoki nuqta-vergul bilan ajratilgan)
      const delimiter = row.includes(";") ? ";" : ",";
      const parts = row.split(delimiter).map((p) => p.replace(/^["']|["']$/g, "").trim());

      const rawName = parts[0] || "";
      const rawEmail = parts[1] || "";
      const rawPhone = parts[2] || "";

      const trimmedName = rawName.trim();
      const trimmedEmail = rawEmail.trim().toLowerCase();
      const trimmedPhone = rawPhone.trim();

      // Formula injection tekshiruvi: =, +, -, @ bilan boshlanuvchi ismlarni rad etish
      if (/^[=+\-@\t\r]/.test(trimmedName)) {
        errors.push({
          row: lineNum,
          email: trimmedEmail,
          error: "Foydalanuvchi ismi xavfli formulalar bilan boshlanishi taqiqlangan (=, +, -, @)",
        });
        continue;
      }

      if (!trimmedEmail || !trimmedEmail.includes("@")) {
        errors.push({ row: lineNum, email: rawEmail, error: "Noto'g'ri elektron pochta manzili" });
        continue;
      }

      if (!trimmedName) {
        errors.push({ row: lineNum, email: trimmedEmail, error: "Foydalanuvchi ismi kiritilmagan" });
        continue;
      }

      const existing = await prisma.user.findUnique({ where: { email: trimmedEmail } });
      if (existing) {
        errors.push({ row: lineNum, email: trimmedEmail, error: "Foydalanuvchi allaqachon mavjud" });
        continue;
      }

      const tempPass = `Talaba#${crypto.randomBytes(4).toString("hex")}!2026`;
      const passwordHash = await hashPassword(tempPass);

      const created = await prisma.user.create({
        data: {
          email: trimmedEmail,
          name: trimmedName,
          phone: trimmedPhone || null,
          role: Role.student,
          passwordHash,
          mustChangePassword: true,
          registeredWithInvite: true,
          dailyTerminalQuotaMinutes: 0,
          dailyLabQuotaMinutes: 0,
        },
      });

      if (defaultGroupId) {
        await prisma.groupMember
          .create({
            data: {
              groupId: String(defaultGroupId),
              userId: created.id,
            },
          })
          .catch(() => {});
      }

      importedUsers.push({
        id: created.id,
        email: created.email,
        name: created.name,
        tempPass,
      });
    }

    await recordAuditLog({
      userId: currentUser.userId,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1",
      action: "USERS_CSV_IMPORT",
      details: {
        totalRows: lines.length - startIndex,
        importedCount: importedUsers.length,
        errorsCount: errors.length,
      },
    });

    return NextResponse.json({
      success: true,
      importedCount: importedUsers.length,
      importedUsers,
      errorsCount: errors.length,
      errors,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
