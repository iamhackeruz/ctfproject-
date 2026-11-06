/**
 * scripts/setup-telegram-webhook.ts
 * CyberEdu — Telegram Bot Webhook Sozlash va Salomatligini Tekshirish CLI Vositasi.
 * Ishlatish: npx tsx scripts/setup-telegram-webhook.ts [.env fayli]
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const envArg = process.argv[2] || ".env.production";
const envPath = path.resolve(process.cwd(), envArg);

console.log("\n==========================================================");
console.log("   CYBEREDU TELEGRAM BOT VA WEBHOOK SOZLASH VOSITASI");
console.log("==========================================================\n");

if (!fs.existsSync(envPath)) {
  console.error(`❌ XATO: '${envPath}' fayli topilmadi!`);
  process.exit(1);
}

// Env faylni o'qish
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx !== -1) {
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    envVars[key] = val;
  }
}

const botToken = envVars.TELEGRAM_BOT_TOKEN || "";
const botUsername = envVars.TELEGRAM_BOT_USERNAME || "";
let webhookSecret = envVars.TELEGRAM_WEBHOOK_SECRET || "";
let domain = envVars.DOMAIN || "";
const appUrl = envVars.APP_URL || "";

if (!domain && appUrl) {
  try {
    domain = new URL(appUrl).hostname;
  } catch {}
}

console.log(`Konfiguratsiya fayli: ${envArg}`);
console.log(`Platforma domeni:     ${domain || "aniqlanmagan"}`);
console.log(`Bot username:         ${botUsername || "aniqlanmagan"}`);

if (!botToken || botToken === "mock_telegram_token") {
  console.log("\n⚠️ [DIQQAT] TELEGRAM_BOT_TOKEN kiritilmagan!");
  console.log("Telegramda @BotFather ga kirib yangi bot yarating va tokenni faylga yozing:");
  console.log(`  Fayl: ${envArg}`);
  console.log(`  TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"`);
  console.log(`  TELEGRAM_BOT_USERNAME="MeningCyberBotim"`);
  console.log("\nSo'ngra ushbu skriptni qayta ishga tushiring.\n");
  process.exit(0);
}

async function run() {
  // 1. Webhook secret mavjud bo'lmasa, yangi generatsiya qilish
  if (!webhookSecret) {
    console.log("[*] Yangi kriptografik tasodifiy TELEGRAM_WEBHOOK_SECRET yaratilmoqda...");
    webhookSecret = crypto.randomBytes(32).toString("hex");
    fs.appendFileSync(envPath, `\nTELEGRAM_WEBHOOK_SECRET="${webhookSecret}"\n`);
    console.log(`✅ Maxfiy kalit ${envArg} ga saqlandi.`);
  }

  // 2. Telegram API getMe
  console.log("\n[1/3] Telegram Bot tekshirilmoqda (getMe)...");
  const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
  const meData = await meRes.json().catch(() => ({}));

  if (!meRes.ok || !meData.ok) {
    console.error(`❌ XATO: Bot tokeni noto'g'ri yoki Telegram API bilan aloqa yo'q!`);
    console.error(`Tafsilot:`, meData);
    process.exit(1);
  }

  const realBotName = meData.result?.username || "";
  console.log(`✅ Bot topildi va tasdiqlandi: @${realBotName} (${meData.result?.first_name || ""})`);

  // Username faylda boshqacha bo'lsa yangilash
  if (realBotName && realBotName !== botUsername) {
    let updatedEnv = fs.readFileSync(envPath, "utf-8");
    if (updatedEnv.includes("TELEGRAM_BOT_USERNAME=")) {
      updatedEnv = updatedEnv.replace(/TELEGRAM_BOT_USERNAME=".*"/g, `TELEGRAM_BOT_USERNAME="${realBotName}"`);
      updatedEnv = updatedEnv.replace(/TELEGRAM_BOT_USERNAME='.*'/g, `TELEGRAM_BOT_USERNAME="${realBotName}"`);
    } else {
      updatedEnv += `\nTELEGRAM_BOT_USERNAME="${realBotName}"\n`;
    }
    fs.writeFileSync(envPath, updatedEnv);
    console.log(`✅ TELEGRAM_BOT_USERNAME="${realBotName}" qilib ${envArg} faylida yangilandi.`);
  }

  // 3. Webhook manzilini o'rnatish
  const targetDomain = domain || "cyberedu.uz";
  const webhookUrl = `https://${targetDomain}/api/telegram/webhook`;
  console.log(`\n[2/3] Webhook o'rnatilmoqda: ${webhookUrl}...`);

  const setWebhookRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: webhookSecret,
      drop_pending_updates: false,
    }),
  });

  const setData = await setWebhookRes.json().catch(() => ({}));
  if (!setWebhookRes.ok || !setData.ok) {
    console.error(`❌ XATO: Webhook o'rnatilmadi:`, setData);
    process.exit(1);
  }
  console.log(`✅ Webhook muvaffaqiyatli bog'landi! (${setData.description || "OK"})`);

  // 4. Webhook ma'lumotlarini tekshirish
  console.log(`\n[3/3] Webhook holati tekshirilmoqda (getWebhookInfo)...`);
  const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
  const infoData = await infoRes.json().catch(() => ({}));

  if (infoData.ok) {
    console.log(`  URL:             ${infoData.result?.url}`);
    console.log(`  Maxfiy token:    ${infoData.result?.has_custom_certificate !== undefined ? "Himoyalangan (Secret token faol)" : "OK"}`);
    console.log(`  Kutilayotganlar: ${infoData.result?.pending_update_count || 0} ta xabar`);
    if (infoData.result?.last_error_message) {
      console.log(`  Oxirgi xatolik:  ${infoData.result?.last_error_message}`);
    }
  }

  console.log("\n==========================================================");
  console.log(`🎉 Barcha sozlamalar muvaffaqiyatli yakunlandi!`);
  console.log(`Talabalar endi profilingizdagi 'Telegram'ni ulash' orqali`);
  console.log(`@${realBotName} botiga ulanishlari mumkin.`);
  console.log("==========================================================\n");
}

run().catch((err) => {
  console.error("Kutilmagan xatolik:", err);
  process.exit(1);
});
