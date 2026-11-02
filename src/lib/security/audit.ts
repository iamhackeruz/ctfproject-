import fs from "fs";
import path from "path";
import { prisma } from "../db";

const LOG_DIR = path.resolve(process.cwd(), "logs");
const AUDIT_FILE = path.join(LOG_DIR, "audit.log");
const MAX_LOG_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_BACKUPS = 5;

// Maxfiy ma'lumotlarni yashirish (Masking)
const SENSITIVE_KEYS = new Set([
  "password",
  "newpassword",
  "currentpassword",
  "token",
  "secret",
  "authorization",
  "flag",
  "submittedflag",
  "code",
  "totp",
  "totpcode",
  "backupcode",
  "backupcodes",
  "twofactorsecret",
  "twofactortempsecret",
]);

export function maskSensitiveData(data: unknown): unknown {
  if (!data) return data;
  if (typeof data === "string") {
    // flag{...} larni yashirish: flag{****}
    return data.replace(/flag\{[a-zA-Z0-9_-]+\}/g, "flag{******}");
  }
  if (typeof data === "object") {
    if (Array.isArray(data)) {
      return data.map(maskSensitiveData);
    }
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lower)) {
        sanitized[key] = "[MAXFIY_MA'LUMOT_YASHIRILDI]";
      } else if (typeof val === "object" && val !== null) {
        sanitized[key] = maskSensitiveData(val);
      } else if (typeof val === "string") {
        sanitized[key] = val.replace(/flag\{[a-zA-Z0-9_-]+\}/g, "flag{******}");
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }
  return data;
}

/**
 * Log faylini aylantirish (Rotation: audit.log -> audit.log.1 ...)
 */
function rotateLogsIfNeeded() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    if (fs.existsSync(AUDIT_FILE)) {
      const stats = fs.statSync(AUDIT_FILE);
      if (stats.size >= MAX_LOG_SIZE) {
        for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
          const src = `${AUDIT_FILE}.${i}`;
          const dest = `${AUDIT_FILE}.${i + 1}`;
          if (fs.existsSync(src)) {
            if (i === MAX_BACKUPS - 1) {
              fs.unlinkSync(src);
            } else {
              fs.renameSync(src, dest);
            }
          }
        }
        fs.renameSync(AUDIT_FILE, `${AUDIT_FILE}.1`);
      }
    }
  } catch (err) {
    console.error("Log aylantirish xatosi:", err);
  }
}

export type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "ROLE_CHANGE"
  | "COURSE_UPDATE"
  | "COURSE_DELETE"
  | "LAB_SUBMISSION"
  | "TERMINAL_COMMAND"
  | "PASSWORD_RESET"
  | "SESSION_REVOKED"
  | "ALL_SESSIONS_REVOKED"
  | "USER_CREDENTIALS_UPDATE"
  | "USER_CREATED"
  | "USER_BLOCKED"
  | "USER_UNBLOCKED"
  | "USER_DELETED"
  | "CSV_IMPORT"
  | "USERS_CSV_IMPORT"
  | "GROUP_CREATED"
  | "GROUP_CREATE"
  | "GROUP_UPDATED"
  | "GROUP_DELETED"
  | "GROUP_DELETE"
  | "GROUP_MEMBER_ADDED"
  | "GROUP_MEMBER_REMOVED"
  | "GROUP_ADD_MEMBERS"
  | "GROUP_COURSE_ASSIGNED"
  | "GROUP_ASSIGN_COURSE"
  | "GROUP_REMOVE_COURSE"
  | "INSTANCE_FORCE_STOP"
  | "INVITATION_CREATED"
  | "INVITATION_CREATE"
  | "INVITATION_REVOKED"
  | "INVITATION_DELETE"
  | "COMMENT_CREATED"
  | "COMMENT_DELETED"
  | "COMMENT_ANSWERED"
  | "ENTITLEMENT_GRANT"
  | "ENTITLEMENT_GROUP_GRANT"
  | "ENTITLEMENT_REVOKE"
  | "VIDEO_UPLOAD"
  | "VIDEO_DELETE"
  | "VIDEO_STREAM_START"
  | "ASSIGNMENT_CREATED"
  | "ASSIGNMENT_UPDATED"
  | "ASSIGNMENT_DELETED"
  | "ASSIGNMENT_SUBMITTED"
  | "ASSIGNMENT_GRADED"
  | "ASSIGNMENT_RETURNED"
  | "ASSIGNMENT_EXTENSION_GRANTED"
  | "CLASS_SESSION_CREATED"
  | "ATTENDANCE_MARKED"
  | "TELEGRAM_CONNECTED"
  | "TELEGRAM_DISCONNECTED"
  | "2FA_ENABLED"
  | "2FA_DISABLED"
  | "2FA_VERIFY"
  | "2FA_BACKUP_LOGIN"
  | "2FA_RESET_BY_ADMIN"
  | "2FA_RESET_SHELL"
  | "CRON_REMINDERS_RUN";

/**
 * Tizim xavfsizlik audit logini qayd etish (Baza va Fayl rotatsiyasi).
 */
export async function recordAuditLog(params: {
  userId?: string | null;
  action: AuditAction;
  ip: string;
  status?: "SUCCESS" | "FAILED" | "BLOCKED";
  details?: Record<string, unknown> | string;
}): Promise<void> {
  const { userId, action, ip, status = "SUCCESS", details } = params;
  const maskedDetails = details ? maskSensitiveData(details) : null;
  const detailsString =
    typeof maskedDetails === "string" ? maskedDetails : JSON.stringify(maskedDetails);

  // 1. PostgreSQL bazasidagi audit_logs jadvaliga yozish
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        ip,
        status,
        details: detailsString,
      },
    });
  } catch (err) {
    console.error("Audit log bazaga yozilmadi:", err);
  }

  // 2. Faylga xavfsiz rotatsiya bilan yozish
  try {
    rotateLogsIfNeeded();
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      action,
      userId: userId || "anonymous",
      ip,
      status,
      details: maskedDetails,
    });
    fs.appendFileSync(AUDIT_FILE, entry + "\n", "utf8");
  } catch (err) {
    console.error("Audit log faylga yozilmadi:", err);
  }
}
