import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { recordAuditLog } from "@/lib/security/audit";
import { sendTelegramDirectMessage } from "@/lib/notifications/notification-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";

  // 1. Webhook Secret Token tekshiruvi (Telegram bot xavfsizligi)
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret && webhookSecret.trim() !== "") {
    const receivedSecret = req.headers.get("x-telegram-bot-api-secret-token");
    if (!receivedSecret || receivedSecret !== webhookSecret) {
      return NextResponse.json(
        { success: false, error: "Telegram webhook siri noto'g'ri yoki taqdim etilmagan." },
        { status: 403 }
      );
    }
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.message) {
      // Telegram ba'zan boshqa turdagi hodisalar (callback_query, my_chat_member) yuboradi
      return NextResponse.json({ ok: true });
    }

    const { message } = body;
    const chatId = String(message.chat?.id || "");
    const text = (message.text || "").trim();
    const fromUser = message.from || {};
    const telegramUsername = fromUser.username ? `@${fromUser.username}` : null;

    if (!chatId) {
      return NextResponse.json({ ok: true });
    }

    // 2. /start [CODE] buyrug'ini tahlil qilish
    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      const rawCode = (parts[1] || "").trim().toUpperCase();

      if (!rawCode) {
        await sendTelegramDirectMessage(
          chatId,
          "👋 <b>Assalomu alaykum!</b>\n\nBu CyberEdu platformasining rasmiy bildirishnoma boti. Hisobingizni ulash uchun CyberEdu profilingizdagi 6 belgili kodni kiriting:\n<code>/start KOD</code>"
        );
        return NextResponse.json({ ok: true });
      }

      // Kodni SHA-256 orqali bazadan qidirish
      const codeHash = crypto.createHash("sha256").update(rawCode).digest("hex");
      const connectCode = await prisma.telegramConnectCode.findUnique({
        where: { codeHash },
        include: { user: true },
      });

      const now = new Date();
      if (!connectCode || connectCode.usedAt !== null || connectCode.expiresAt < now) {
        await sendTelegramDirectMessage(
          chatId,
          "❌ <b>Ulanish kodi noto'g'ri yoki muddati tugagan.</b>\n\nIltimos, platformadagi profilingizga kirib yangi kod oling."
        );
        return NextResponse.json({ ok: true });
      }

      // Foydalanuvchini Telegram bilan bog'lash
      const user = connectCode.user;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          telegramChatId: chatId,
          telegramUsername: telegramUsername,
          telegramConnectedAt: now,
        },
      });

      // Kodni ishlatilgan deb belgilash
      await prisma.telegramConnectCode.update({
        where: { id: connectCode.id },
        data: { usedAt: now },
      });

      // Audit log yozish
      await recordAuditLog({
        userId: user.id,
        action: "TELEGRAM_CONNECTED",
        ip,
        details: { telegramChatId: chatId, telegramUsername },
      });

      // Muvaffaqiyat xabarini yuborish
      await sendTelegramDirectMessage(
        chatId,
        `✅ <b>Hisobingiz muvaffaqiyatli ulandi!</b>\n\nHurmatli <b>${user.name}</b>, endi yangi vazifalar, darslar, baholar va muhim eslatmalar sizga to'g'ridan-to'g'ri shu bot orqali yuboriladi.\n\nHisobni uzish uchun <code>/stop</code> buyrug'ini yuborishingiz mumkin.`
      );

      return NextResponse.json({ ok: true });
    }

    // 3. /stop yoki /disconnect buyrug'ini tahlil qilish
    if (text === "/stop" || text === "/disconnect") {
      const user = await prisma.user.findFirst({
        where: { telegramChatId: chatId },
      });

      if (!user) {
        await sendTelegramDirectMessage(
          chatId,
          "ℹ️ Ushbu Telegram hisob hech qanday CyberEdu foydalanuvchisiga ulanmagan."
        );
        return NextResponse.json({ ok: true });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          telegramChatId: null,
          telegramUsername: null,
          telegramConnectedAt: null,
        },
      });

      await recordAuditLog({
        userId: user.id,
        action: "TELEGRAM_DISCONNECTED",
        ip,
        details: { previousChatId: chatId },
      });

      await sendTelegramDirectMessage(
        chatId,
        "ℹ️ <b>Telegram hisobingiz tizimdan uzildi.</b>\n\nQayta ulash uchun CyberEdu profilingizdan yangi kod olishingiz mumkin."
      );

      return NextResponse.json({ ok: true });
    }

    // 4. Boshqa matn yoki /help
    await sendTelegramDirectMessage(
      chatId,
      "🤖 <b>CyberEdu Bot Buyruqlari:</b>\n\n" +
        "• <code>/start KOD</code> — Hisobni platforma bilan bog'lash\n" +
        "• <code>/stop</code> — Hisobni platformadan uzish\n" +
        "• <code>/help</code> — Yordam ma'lumotlari"
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[TelegramWebhook] Xatolik:", err);
    return NextResponse.json({ ok: true }); // Telegram resend qilmasligi uchun 200 qaytarish
  }
}
