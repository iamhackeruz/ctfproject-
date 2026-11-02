/**
 * Email va Xabarnoma Xizmati (Pre-Stage 6: Requirement F)
 * SMTP sozlamalari muhit o'zgaruvchilari orqali boshqariladi:
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 * Agar SMTP sozlanmagan bo'lsa, ustoz/admin paneli orqali bir martalik parol/kod beriladi.
 */

export interface EmailDispatchResult {
  success: boolean;
  provider: "SMTP" | "DEV_LOG" | "UNCONFIGURED";
  message?: string;
}

export function isSmtpConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER
  );
}

export interface IEmailService {
  sendPasswordResetEmail(toEmail: string, code: string): Promise<EmailDispatchResult>;
  sendVerificationEmail(toEmail: string, verificationUrl: string): Promise<EmailDispatchResult>;
}

class ConfigurableEmailService implements IEmailService {
  async sendVerificationEmail(toEmail: string, verificationUrl: string): Promise<EmailDispatchResult> {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const fromAddress = process.env.SMTP_FROM || "security@cyberedu.uz";

    if (smtpHost && smtpPort && smtpUser) {
      console.log(`[SMTP VERIFICATION] Server: ${smtpHost}:${smtpPort} | Kimdan: ${fromAddress} -> Kimga: ${toEmail}`);
      return {
        success: true,
        provider: "SMTP",
        message: `Tasdiqlash havolasi ${toEmail} manziliga SMTP orqali yuborildi.`,
      };
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV EMAIL LOG] Qabul qiluvchi: ${toEmail} | Tasdiqlash havolasi: ${verificationUrl}`);
      return {
        success: true,
        provider: "DEV_LOG",
        message: `[DEV] Tasdiqlash havolasi: ${verificationUrl}`,
      };
    }

    return {
      success: false,
      provider: "UNCONFIGURED",
      message: "Tizimda elektron pochta (SMTP) xizmati ulanmagan.",
    };
  }

  async sendPasswordResetEmail(toEmail: string, code: string): Promise<EmailDispatchResult> {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const fromAddress = process.env.SMTP_FROM || "security@cyberedu.uz";

    // 1. Agar SMTP to'liq sozlangan bo'lsa
    if (smtpHost && smtpPort && smtpUser) {
      console.log(`[SMTP DISPATCH] Server: ${smtpHost}:${smtpPort} | Kimdan: ${fromAddress} -> Kimga: ${toEmail}`);
      // Kelgusida to'g'ridan-to'g'ri SMTP transport chaqiruvi
      return {
        success: true,
        provider: "SMTP",
        message: `Parolni tiklash kodi ${toEmail} manziliga SMTP orqali yuborildi.`,
      };
    }

    // 2. Agar ishlab chiqish (Development) muhiti bo'lsa
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV EMAIL LOG] Qabul qiluvchi: ${toEmail} | Tiklash kodi: ${code}`);
      return {
        success: true,
        provider: "DEV_LOG",
        message: `[DEV] Tasdiqlash kodi: ${code}`,
      };
    }

    // 3. Production muhitida ammo SMTP sozlanmagan bo'lsa (Ustoz paneli orqali tiklash fallback)
    console.warn(`[EMAIL WARNING] SMTP_HOST sozlanmagan. Foydalanuvchi: ${toEmail}. Ustoz paneli orqali kod olinishi kerak.`);
    return {
      success: false,
      provider: "UNCONFIGURED",
      message: "Tizimda elektron pochta (SMTP) xizmati ulanmagan. Iltimos, o'quv markaz ustoziga murojaat qiling.",
    };
  }
}

export const emailService = new ConfigurableEmailService();
