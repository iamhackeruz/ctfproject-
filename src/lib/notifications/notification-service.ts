import crypto from "crypto";
import { prisma } from "../db";
import {
  NotificationType,
  NotificationChannel,
  NotificationStatus,
} from "@prisma/client";

// Maxfiy ma'lumotlarni xabarlarda yashirish (Privacy Scrubbing)
export function scrubSensitiveNotificationText(text: string): string {
  if (!text) return "";
  let scrubbed = text;

  // 1. Bayroqlar (flag{...})
  scrubbed = scrubbed.replace(/flag\{[a-zA-Z0-9_\-]+\}/gi, "FLAG{******}");

  // 2. Parollar va tokenlar
  scrubbed = scrubbed.replace(/(parol[a-z]*[:=]\s*)([^\s]+)/gi, "$1********");
  scrubbed = scrubbed.replace(/(password[a-z]*[:=]\s*)([^\s]+)/gi, "$1********");
  scrubbed = scrubbed.replace(/(token[a-z]*[:=]\s*)([^\s]+)/gi, "$1********");

  // 3. To'liq elektron pochta manzillarini niqoblash (u***@domen.uz)
  scrubbed = scrubbed.replace(
    /\b([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]*@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b/g,
    "$1***@$2"
  );

  return scrubbed;
}

// Telegram Rate Limiter (Sekundiga maksimum 25 ta so'rov)
let lastSentTime = 0;
const MIN_SEND_INTERVAL_MS = 40; // 1000ms / 25 = 40ms

async function throttleTelegramRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastSentTime;
  if (elapsed < MIN_SEND_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_SEND_INTERVAL_MS - elapsed));
  }
  lastSentTime = Date.now();
}

/**
 * Telegram Bot orqali to'g'ridan-to'g'ri xabar yuborish
 */
export async function sendTelegramDirectMessage(
  chatId: string,
  messageText: string
): Promise<{ success: boolean; error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || botToken.trim() === "" || botToken === "mock_telegram_token") {
    // Agar bot tokeni o'rnatilmagan bo'lsa (dev/test rejimida), xavfsiz holda logga yozamiz
    return { success: false, error: "TELEGRAM_BOT_TOKEN muhit o'zgaruvchisi o'rnatilmagan." };
  }

  const safeMessage = scrubSensitiveNotificationText(messageText);

  try {
    await throttleTelegramRateLimit();

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: safeMessage,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      const errorMsg = data.description || `Telegram API HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Bildirishnoma turiga ko'ra foydalanuvchi sozlamasini tekshirish
 */
export async function shouldSendNotification(
  userId: string,
  type: NotificationType
): Promise<boolean> {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  if (!pref) {
    // Default holatda barcha bildirishnomalar yoqilgan
    return true;
  }

  switch (type) {
    case NotificationType.ASSIGNMENT_NEW:
      return pref.notifyAssignmentNew;
    case NotificationType.ASSIGNMENT_DUE_SOON:
      return pref.notifyDueSoon;
    case NotificationType.SUBMISSION_GRADED:
    case NotificationType.SUBMISSION_RETURNED:
      return pref.notifyGraded;
    case NotificationType.LESSON_PUBLISHED:
      return pref.notifyLessonPublished;
    case NotificationType.ENTITLEMENT_EXPIRING:
      return pref.notifyExpiring;
    case NotificationType.PASSWORD_RESET:
      return pref.notifyPasswordReset;
    case NotificationType.SUBMISSION_NEW:
      return pref.notifySubmissionNew;
    default:
      return true;
  }
}

export interface EnqueueNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  channel?: NotificationChannel;
  dedupKey?: string;
}

/**
 * Bildirishnomalar navbatiga yangi xabar qo'shish va asinxron yuborish.
 * Asosiy oqimni (API javobini) qulflab qo'ymaydi.
 */
export async function enqueueNotification(
  params: EnqueueNotificationParams
): Promise<{ notificationId: string; status: NotificationStatus }> {
  const { userId, type, title, message, channel = NotificationChannel.BOTH, dedupKey } = params;

  // 1. Sozlamalarga ko'ra bildirishnoma ruxsat etilganligini tekshirish
  const allowed = await shouldSendNotification(userId, type);
  if (!allowed) {
    return { notificationId: "", status: NotificationStatus.FAILED };
  }

  // 2. Maxfiy ma'lumotlarni tozalash
  const safeTitle = scrubSensitiveNotificationText(title);
  const safeMessage = scrubSensitiveNotificationText(message);

  // 3. Bazada Notification yozuvini yaratish (dedupKey bilan)
  let notification;
  try {
    notification = await prisma.notification.create({
      data: {
        userId,
        type,
        channel,
        title: safeTitle,
        message: safeMessage,
        dedupKey,
        status: NotificationStatus.PENDING,
      },
    });
  } catch (err: unknown) {
    // Agar dedupKey unikal cheklovi bo'yicha dublikat bo'lsa
    if (dedupKey) {
      const existing = await prisma.notification.findUnique({
        where: { dedupKey },
      });
      if (existing) {
        return { notificationId: existing.id, status: existing.status };
      }
    }
    throw err;
  }

  // 4. Asinxron ravishda Telegramga yuborishga urinish
  if (channel === NotificationChannel.TELEGRAM || channel === NotificationChannel.BOTH) {
    // Fon rejimida asinxron bajarish
    void (async () => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { telegramChatId: true },
        });

        if (!user?.telegramChatId) {
          // Telegram ulanmagan bo'lsa, faqat in-app qoladi
          return;
        }

        const telegramText = `<b>${escapeTelegramHtml(safeTitle)}</b>\n\n${escapeTelegramHtml(safeMessage)}`;
        const sendResult = await sendTelegramDirectMessage(user.telegramChatId, telegramText);

        if (sendResult.success) {
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              status: NotificationStatus.SENT,
              sentAt: new Date(),
              attempts: { increment: 1 },
            },
          });
        } else {
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              status: NotificationStatus.FAILED,
              attempts: { increment: 1 },
              lastAttemptAt: new Date(),
              error: sendResult.error || "Telegram yuborishda xatolik",
            },
          });
        }
      } catch (err) {
        console.error("[NotificationService] Telegramga yuborishda kutilmagan xato:", err);
      }
    })();
  }

  return { notificationId: notification.id, status: NotificationStatus.PENDING };
}

/**
 * Telegram HTML belgilash uchun maxsus belgilarni escape qilish
 */
function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Telegram ulanish uchun 6 belgili bir martalik tasodifiy kod yaratish (10 daqiqa yashaydi).
 */
export async function createTelegramConnectCode(userId: string): Promise<{ code: string; expiresAt: Date; botUrl: string }> {
  // Avvalgi muddati o'tmagan yoki ishlatilmagan kodlarni bekor qilish
  await prisma.telegramConnectCode.deleteMany({
    where: { userId },
  });

  // 6 ta belgili kriptografik tasodifiy kod (masalan: 789B2F)
  const code = crypto.randomBytes(3).toString("hex").toUpperCase();
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 daqiqa

  await prisma.telegramConnectCode.create({
    data: {
      userId,
      codeHash,
      expiresAt,
    },
  });

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "CyberEduUzBot";
  const botUrl = `https://t.me/${botUsername}?start=${code}`;

  return { code, expiresAt, botUrl };
}
