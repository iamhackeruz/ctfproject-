#!/usr/bin/env python3
"""
bot/bot.py — CTF v2 Telegram Bot
3 Bosqichli Musobaqa Boshqaruvi:
  1-bosqich: Linux System Audit (SSH)
  2-bosqich: Web Pentest & 10 ta Zaiflik Matrixi (Apex Target)
  3-bosqich: Hisobot qabul qilish (PDF / Word)
"""

import os
import sys
import logging
from datetime import datetime

from telegram import (
    Update, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove,
    InlineKeyboardMarkup, InlineKeyboardButton
)
from telegram.ext import (
    Application, CommandHandler, MessageHandler, ConversationHandler,
    CallbackQueryHandler, ContextTypes, filters
)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
sys.path.insert(0, PROJECT_ROOT)

from core_db import db as ctf_db
from bot.config import BOT_TOKEN, SERVER_IP, WEB_TARGET_PORT, DASHBOARD_PORT, ADMIN_IDS, REPORTS_DIR

logging.basicConfig(format="%(asctime)s | %(levelname)s | %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

# Holatlar
ASK_NAME, ASK_PHONE, MAIN_MENU, WAITING_FLAG, WAITING_REPORT = range(5)

# Klaviaturani sozlash
MAIN_KB = ReplyKeyboardMarkup([
    ["📊 Holatim", "🚩 Flag yuborish"],
    ["🏆 Jonli Reyting", "🌐 Web Target"],
    ["📝 Hisobot topshirish", "ℹ️ Yordam"]
], resize_keyboard=True, is_persistent=True)

CANCEL_KB = ReplyKeyboardMarkup([["❌ Bekor qilish"]], resize_keyboard=True)

PHONE_KB = ReplyKeyboardMarkup([
    [KeyboardButton("📱 Telefon raqamni yuborish", request_contact=True)],
    ["⏩ O'tkazib yuborish"]
], resize_keyboard=True, one_time_keyboard=True)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    p = ctf_db.get_participant_by_tg(user.id)

    if p:
        await update.message.reply_text(
            f"Xush kelibsiz, {p['full_name']}!\n"
            f"Siz allaqachon ro'yxatdan o'tgansiz.\n"
            f"Jami ballingiz: {p['total_score']} ball.\n"
            f"Quyidagi menyudan foydalaning:",
            reply_markup=MAIN_KB
        )
        return ConversationHandler.END

    await update.message.reply_text(
        "👋 Assalomu alaykum! Kiberxavfsizlik CTF v2 musobaqasiga xush kelibsiz!\n\n"
        "Musobaqada qatnashish uchun to'liq ism-familiyangizni kiriting:",
        reply_markup=ReplyKeyboardRemove()
    )
    return ASK_NAME

async def ask_name_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    full_name = update.message.text.strip()
    if len(full_name) < 3:
        await update.message.reply_text("Iltimos, haqiqiy ism-familiyangizni kiriting:")
        return ASK_NAME

    context.user_data["full_name"] = full_name
    await update.message.reply_text(
        f"Rahmat, {full_name}!\n"
        "Endi aloqa uchun telefon raqamingizni yuboring (tugmani bosing yoki o'tkazib yuboring):",
        reply_markup=PHONE_KB
    )
    return ASK_PHONE

async def ask_phone_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    phone = None
    if update.message.contact:
        phone = update.message.contact.phone_number
    elif update.message.text and update.message.text != "⏩ O'tkazib yuborish":
        phone = update.message.text.strip()

    full_name = context.user_data.get("full_name", update.effective_user.full_name)
    tg_user = update.effective_user
    username = tg_user.username or f"student_{tg_user.id}"

    # Ishtirokchini bazaga kiritish
    p = ctf_db.register_participant(
        username=username,
        full_name=full_name,
        phone=phone,
        telegram_id=tg_user.id,
        ssh_password="Password2026!"
    )

    welcome_text = (
        f"🎉 Tabriklaymiz, {full_name}! Siz ro'yxatdan o'tdingiz.\n\n"
        f"📋 SIZNING AKKAUNTINGIZ:\n"
        f"• Username: @{username}\n"
        f"• SSH Login: {username}\n"
        f"• Parol: Password2026!\n\n"
        f"🗺 MUSOBAQA STRATEGIYASI (3 BOSQICH):\n"
        f"1️⃣ 1-BOSQICH (Linux Auditi): SSH orqali kiring (~/apex_corp). Flagni toping (+500 ball).\n"
        f"2️⃣ 2-BOSQICH (Web Pentest): http://{SERVER_IP}:{WEB_TARGET_PORT} manzilidagi 10 ta OWASP zaifliklarni fosh qiling (Jami 3000 ball).\n"
        f"3️⃣ 3-BOSQICH (Reporting): Kamida 1200 ball to'plasangiz, avtomatik Hisobot (PoC) topshirish ochiladi!\n\n"
        f"Katta Ekran Jonli Matritsasi: http://{SERVER_IP}:{DASHBOARD_PORT}"
    )

    await update.message.reply_text(welcome_text, reply_markup=MAIN_KB)
    return ConversationHandler.END

async def show_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    p = ctf_db.get_participant_by_tg(user.id)
    if not p:
        await update.message.reply_text("Siz ro'yxatdan o'tmagansiz. /start ni bosing.")
        return

    conn = ctf_db.get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT c.code, c.title, c.points, s.solved_at
        FROM challenges c
        LEFT JOIN solves s ON c.id = s.challenge_id AND s.participant_id = ?
        ORDER BY c.id ASC
    """, (p["id"],))
    challenges = cur.fetchall()
    conn.close()

    stage1_str = "✅ Yakunlangan (+500 ball)" if p["stage1_solved"] else "⏳ Jarayonda (Linux ~/apex_corp)"

    matrix_lines = []
    solved_cnt = 0
    for ch in challenges:
        if ch["solved_at"]:
            solved_cnt += 1
            matrix_lines.append(f"  🟢 [{ch['code']}] {ch['title'][:25]} (+{ch['points']}b)")
        else:
            matrix_lines.append(f"  ⚪ [{ch['code']}] {ch['title'][:25]} ({ch['points']}b)")

    report_str = "🔒 Qulflangan (<1200 ball)"
    if p["report_file"]:
        report_str = f"✅ Topshirildi (+{p['report_score']} hakam balli)"
    elif p["stage3_unlocked"]:
        report_str = "🔓 OCHILGAN (Hisobot yuborishingiz mumkin!)"

    msg = (
        f"📊 CTF v2 SHAXSIY NATIJANGIZ:\n"
        f"👤 {p['full_name']} (@{p['username']})\n"
        f"🏆 Jami Ball: {p['total_score']} ball\n"
        f"🌐 Web Pentest: {p['stage2_score']} / 3000 ball\n\n"
        f"📌 1-Bosqich (Linux): {stage1_str}\n\n"
        f"📌 2-Bosqich (Web Zaifliklar Matrixi {solved_cnt}/10):\n"
        + "\n".join(matrix_lines) +
        f"\n\n📌 3-Bosqich (Reporting): {report_str}"
    )

    await update.message.reply_text(msg, reply_markup=MAIN_KB)

async def prompt_flag(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Topilgan flagingizni yuboring (masalan: FLAG{...}):",
        reply_markup=CANCEL_KB
    )
    return WAITING_FLAG

async def submit_flag_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    if text == "❌ Bekor qilish":
        await update.message.reply_text("Bekor qilindi.", reply_markup=MAIN_KB)
        return ConversationHandler.END

    user = update.effective_user
    p = ctf_db.get_participant_by_tg(user.id)
    if not p:
        await update.message.reply_text("Siz ro'yxatdan o'tmagansiz. /start ni bosing.")
        return ConversationHandler.END

    # 1-bosqich tekshiruvi
    if not p["stage1_solved"]:
        ok, msg = ctf_db.submit_stage1_flag(p["username"], text)
        if ok:
            await update.message.reply_text(f"🎉 {msg}", reply_markup=MAIN_KB)
            return ConversationHandler.END
        else:
            # 2-bosqich flagi sifatida tekshirib ko'rish
            ok2, msg2, details = ctf_db.submit_stage2_flag(p["id"], text)
            if ok2:
                await update.message.reply_text(f"🎉 {msg2}", reply_markup=MAIN_KB)
                return ConversationHandler.END
            await update.message.reply_text(f"❌ Noto'g'ri flag! Qaytadan urinib ko'ring yoki /start ni bosing.", reply_markup=MAIN_KB)
            return ConversationHandler.END
    else:
        # 2-bosqich tekshiruvi
        ok, msg, details = ctf_db.submit_stage2_flag(p["id"], text)
        if ok:
            await update.message.reply_text(f"🎉 {msg}", reply_markup=MAIN_KB)
        else:
            await update.message.reply_text(f"❌ {msg}", reply_markup=MAIN_KB)
        return ConversationHandler.END

async def show_leaderboard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = ctf_db.get_live_matrix_data()
    participants = data["participants"][:10]

    if not participants:
        await update.message.reply_text("Hozircha reyting bo'sh.")
        return

    text = "🏆 JONLI TOP-10 REYTING:\n\n"
    for i, p in enumerate(participants, 1):
        icon = "🥇" if i == 1 else ("🥈" if i == 2 else ("🥉" if i == 3 else f"{i}."))
        text += f"{icon} {p['full_name']} — {p['total_score']} ball (Web: {p['stage2_score']}b)\n"

    text += f"\n📺 Katta Ekranda jonli kuzatish: http://{SERVER_IP}:{DASHBOARD_PORT}"
    await update.message.reply_text(text, reply_markup=MAIN_KB)

async def show_web_target(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = (
        f"🌐 2-BOSQICH WEB TARGET NISHONI:\n\n"
        f"• Veb sayt manzili: http://{SERVER_IP}:{WEB_TARGET_PORT}\n"
        f"• Tashkilot: Apex Global Technologies\n\n"
        f"💡 QIDIRILADIGAN 10 TA ZAIFLIK:\n"
        f"1. Info Disclosure / Git leak (100b)\n"
        f"2. User Enumeration / OSINT (150b)\n"
        f"3. Broken Auth & Rate Limit Bypass (200b)\n"
        f"4. IDOR (Shartnomalar) (250b)\n"
        f"5. Stored XSS (Cookie theft) (250b)\n"
        f"6. LFI / Path Traversal (300b)\n"
        f"7. SQL Injection UNION (350b)\n"
        f"8. Insecure File Upload (Webshell) (400b)\n"
        f"9. Privilege Escalation (JWT) (500b)\n"
        f"10. RCE / Command Injection (Vault) (500b)\n\n"
        f"Topgan flagingizni '🚩 Flag yuborish' orqali yuboring!"
    )
    await update.message.reply_text(msg, reply_markup=MAIN_KB)

async def prompt_report(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    p = ctf_db.get_participant_by_tg(user.id)
    if not p:
        await update.message.reply_text("Iltimos avval /start ni bosing.")
        return

    if not p["stage3_unlocked"]:
        qolgan = max(0, 1200 - p["stage2_score"])
        await update.message.reply_text(
            f"🔒 3-Bosqich (Reporting) hozircha qulflangan!\n"
            f"Buning uchun 2-bosqichda kamida 1200 ball to'plashingiz kerak.\n"
            f"Sizning joriy web ballingiz: {p['stage2_score']} ball (yana {qolgan} ball kerak).",
            reply_markup=MAIN_KB
        )
        return

    await update.message.reply_text(
        "📝 3-BOSQICH (REPORTING) HISOBOT TOPSHIRISH:\n\n"
        "Iltimos, tayyorlagan hisobotingizni (.pdf yoki .docx) fayl ko'rinishida ushbu chatga yuboring:",
        reply_markup=CANCEL_KB
    )
    return WAITING_REPORT

async def handle_report_file(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    p = ctf_db.get_participant_by_tg(user.id)
    doc = update.message.document

    if not doc:
        if update.message.text == "❌ Bekor qilish":
            await update.message.reply_text("Bekor qilindi.", reply_markup=MAIN_KB)
            return ConversationHandler.END
        await update.message.reply_text("Iltimos, hujjat faylini (.pdf yoki .docx) yuboring:")
        return WAITING_REPORT

    filename = f"{p['username']}_{doc.file_name}"
    os.makedirs(REPORTS_DIR, exist_ok=True)
    save_path = os.path.join(REPORTS_DIR, filename)

    new_file = await context.bot.get_file(doc.file_id)
    await new_file.download_to_drive(save_path)

    ok, msg = ctf_db.submit_report(p["id"], save_path)
    await update.message.reply_text(
        f"✅ {msg}\nFayl muvaffaqiyatli qabul qilindi: {doc.file_name}",
        reply_markup=MAIN_KB
    )
    return ConversationHandler.END

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin2026")
AUTHENTICATED_ADMINS = set(ADMIN_IDS) if ADMIN_IDS else set()

def is_admin(user_id: int) -> bool:
    return user_id in AUTHENTICATED_ADMINS

def get_admin_menu_markup():
    unread_cnt = len(ctf_db.get_reports(filter_mode="unread"))
    all_cnt = len(ctf_db.get_reports(filter_mode="all"))

    buttons = [
        [InlineKeyboardButton(f"📥 O'qilmagan Hisobotlar ({unread_cnt} ta)", callback_data="admin_unread")],
        [InlineKeyboardButton(f"📚 Barcha Hisobotlar / Qayta o'qish ({all_cnt} ta)", callback_data="admin_all")],
        [InlineKeyboardButton("📊 Natijalarni Excelda Yuklab Olish (.xlsx)", callback_data="admin_export")]
    ]
    return InlineKeyboardMarkup(buttons)

async def admin_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    args = context.args

    if args:
        provided_pass = args[0].strip()
        if provided_pass == ADMIN_PASSWORD:
            AUTHENTICATED_ADMINS.add(user.id)
            await update.message.reply_text(
                "✅ Admin muvaffaqiyatli tasdiqlandi!\nCTF v2 Hakamlar va Admin Paneli menyusiga xush kelibsiz:",
                reply_markup=get_admin_menu_markup()
            )
            return
        else:
            await update.message.reply_text("❌ Admin paroli noto'g'ri!")
            return

    if not is_admin(user.id):
        await update.message.reply_text(
            "🔒 Hakamlar va Admin paneliga kirish uchun parolni kiriting:\n\n"
            "👉 Buyruq: <code>/admin admin2026</code>",
            parse_mode="HTML"
        )
        return

    await update.message.reply_text(
        "👑 CTF v2 HAKAMLAR VA ADMIN PANELI:\n\n"
        "Quyidagi bo'limlardan birini tanlang:",
        reply_markup=get_admin_menu_markup()
    )

async def admin_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user = query.from_user
    data = query.data

    if not is_admin(user.id):
        await query.answer("⛔️ Avtorizatsiyadan o'tilmagan. /admin <parol> ni bosing.", show_alert=True)
        return

    await query.answer()

    if data == "admin_menu":
        await query.edit_message_text(
            "👑 CTF v2 HAKAMLAR VA ADMIN PANELI:\n\n"
            "Quyidagi bo'limlardan birini tanlang:",
            reply_markup=get_admin_menu_markup()
        )
        return

    if data == "admin_unread":
        reports = ctf_db.get_reports(filter_mode="unread")
        if not reports:
            kb = InlineKeyboardMarkup([
                [InlineKeyboardButton("📚 Barcha Hisobotlar (Qayta o'qish)", callback_data="admin_all")],
                [InlineKeyboardButton("🔙 Asosiy Menyu", callback_data="admin_menu")]
            ])
            await query.edit_message_text(
                "✅ Barcha hisobotlar o'qib chiqilgan!\nYangi o'qilmagan hisobotlar mavjud emas.",
                reply_markup=kb
            )
            return

        kb_rows = []
        for p in reports:
            btn_text = f"🔴 {p['full_name']} (@{p['username']})"
            kb_rows.append([InlineKeyboardButton(btn_text, callback_data=f"view_rep_{p['id']}")])
        kb_rows.append([InlineKeyboardButton("🔙 Asosiy Menyu", callback_data="admin_menu")])

        await query.edit_message_text(
            f"📥 O'QILMAGAN HISOBOTLAR ({len(reports)} ta):\n"
            "O'qish va faylni yuklab olish uchun ishtirokchini tanlang:",
            reply_markup=InlineKeyboardMarkup(kb_rows)
        )
        return

    if data == "admin_all":
        reports = ctf_db.get_reports(filter_mode="all")
        if not reports:
            kb = InlineKeyboardMarkup([
                [InlineKeyboardButton("🔙 Asosiy Menyu", callback_data="admin_menu")]
            ])
            await query.edit_message_text(
                "Hozircha hech bir ishtirokchi hisobot topshirmagan.",
                reply_markup=kb
            )
            return

        kb_rows = []
        for p in reports:
            icon = "🟢" if p.get("report_read") else "🔴"
            btn_text = f"{icon} {p['full_name']} (@{p['username']})"
            kb_rows.append([InlineKeyboardButton(btn_text, callback_data=f"view_rep_{p['id']}")])
        kb_rows.append([InlineKeyboardButton("🔙 Asosiy Menyu", callback_data="admin_menu")])

        await query.edit_message_text(
            f"📚 BARCHA TOPSHIRILGAN HISOBOTLAR ({len(reports)} ta):\n"
            "🟢 = O'qilgan | 🔴 = Yangi (o'qilmagan)\n\n"
            "Qayta o'qish va faylni yuklab olish uchun ishtirokchini tanlang:",
            reply_markup=InlineKeyboardMarkup(kb_rows)
        )
        return

    if data.startswith("view_rep_"):
        pid = int(data.split("_")[2])
        p = ctf_db.get_report_by_participant(pid)
        if not p:
            await query.edit_message_text("❌ Hisobot topilmadi.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Orqaga", callback_data="admin_all")]]))
            return

        # O'qilgan deb belgilash
        ctf_db.mark_report_read(pid, 1)

        filename = os.path.basename(p["report_file"]) if p.get("report_file") else "—"
        s1_str = "✅ Yakunlangan (500b)" if p.get("stage1_solved") else "⏳ Tugallanmagan"
        phone_str = p.get("phone") or "—"
        tg_str = f"@{p.get('telegram_id')}" if p.get('telegram_id') and str(p.get('telegram_id')).isdigit() is False else str(p.get('telegram_id') or '—')

        msg = (
            f"📄 ISHTIROKCHI HISOBOTI:\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"👤 F.I.Sh: <b>{p['full_name']}</b>\n"
            f"🆔 Login: <code>@{p['username']}</code>\n"
            f"📱 Telefon: <code>{phone_str}</code>\n"
            f"🌐 Telegram: {tg_str}\n\n"
            f"📊 NATIJALAR:\n"
            f"• 1-Bosqich (Linux): {s1_str}\n"
            f"• 2-Bosqich (Web Pentest): {p['stage2_score']} ball\n"
            f"• Jami Ball: <b>{p['total_score']} ball</b>\n\n"
            f"📅 Topshirilgan vaqt: {p.get('report_submitted_at') or '—'}\n"
            f"📁 Fayl nomi: <code>{filename}</code>\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"Fayl quyida yuborilmoqda..."
        )

        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("🔄 Qayta O'qilmagan deb belgilash", callback_data=f"unread_rep_{pid}")],
            [InlineKeyboardButton("📥 Keyingi o'qilmagan", callback_data="admin_unread"), InlineKeyboardButton("📚 Barcha hisobotlar", callback_data="admin_all")],
            [InlineKeyboardButton("🔙 Admin Asosiy Menyu", callback_data="admin_menu")]
        ])

        await query.message.reply_text(msg, parse_mode="HTML", reply_markup=kb)

        # Faylni telegram orqali yuborish
        report_path = p.get("report_file")
        if report_path and os.path.exists(report_path):
            try:
                with open(report_path, "rb") as f:
                    await context.bot.send_document(
                        chat_id=user.id,
                        document=f,
                        filename=filename,
                        caption=f"📎 @{p['username']} ({p['full_name']}) hisobot hujjati"
                    )
            except Exception as e:
                await query.message.reply_text(f"⚠️ Faylni yuborishda xatolik: {e}")
        else:
            await query.message.reply_text(f"⚠️ Fayl server diskida topilmadi ({report_path}).")
        return

    if data.startswith("unread_rep_"):
        pid = int(data.split("_")[2])
        ctf_db.mark_report_read(pid, 0)
        await query.answer("Ushbu hisobot qayta O'QILMAGAN deb belgilandi!", show_alert=True)
        # Barcha hisobotlar ro'yxatiga qaytish
        reports = ctf_db.get_reports(filter_mode="all")
        kb_rows = []
        for p in reports:
            icon = "🟢" if p.get("report_read") else "🔴"
            btn_text = f"{icon} {p['full_name']} (@{p['username']})"
            kb_rows.append([InlineKeyboardButton(btn_text, callback_data=f"view_rep_{p['id']}")])
        kb_rows.append([InlineKeyboardButton("🔙 Asosiy Menyu", callback_data="admin_menu")])

        await query.edit_message_text(
            f"📚 BARCHA TOPSHIRILGAN HISOBOTLAR ({len(reports)} ta):\n"
            "🟢 = O'qilgan | 🔴 = Yangi (o'qilmagan)\n\n"
            "Qayta o'qish uchun ishtirokchini tanlang:",
            reply_markup=InlineKeyboardMarkup(kb_rows)
        )
        return

    if data == "admin_export":
        from core_db import analytics
        stream = analytics.export_excel_bytes()
        filename = f"CTF_v2_Natijalar_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
        await context.bot.send_document(
            chat_id=user.id,
            document=stream,
            filename=filename,
            caption="📊 CTF v2 Yakuniy Natijalari (Barcha ishtirokchilar va vaqtlar)"
        )
        return

async def export_excel_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not is_admin(user.id):
        await update.message.reply_text("⛔️ Ushbu buyruq faqat CTF hakamlari va adminlar uchun! Kirish: /admin admin2026")
        return

    from core_db import analytics
    stream = analytics.export_excel_bytes()
    filename = f"CTF_v2_Natijalar_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    await update.message.reply_document(
        document=stream,
        filename=filename,
        caption="📊 CTF v2 Yakuniy Natijalari (To'liq yakunlaganlar va jarayondagilar ro'yxati)"
    )

def main():
    if not BOT_TOKEN or BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        print("[!] BOT_TOKEN o'rnatilmagan. Botni ishga tushirish uchun bot/config.py ni sozlang.")
        sys.exit(0)

    app = Application.builder().token(BOT_TOKEN).build()

    # Ro'yxatdan o'tish handler
    reg_conv = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            ASK_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, ask_name_handler)],
            ASK_PHONE: [MessageHandler(filters.CONTACT | (filters.TEXT & ~filters.COMMAND), ask_phone_handler)],
        },
        fallbacks=[CommandHandler("start", start)]
    )

    # Flag yuborish handler
    flag_conv = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^🚩 Flag yuborish$"), prompt_flag)],
        states={
            WAITING_FLAG: [MessageHandler(filters.TEXT & ~filters.COMMAND, submit_flag_handler)]
        },
        fallbacks=[CommandHandler("cancel", lambda u, c: u.message.reply_text("Bekor qilindi", reply_markup=MAIN_KB))]
    )

    # Hisobot yuborish handler
    report_conv = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^📝 Hisobot topshirish$"), prompt_report)],
        states={
            WAITING_REPORT: [MessageHandler(filters.Document.ALL | filters.TEXT, handle_report_file)]
        },
        fallbacks=[CommandHandler("cancel", lambda u, c: u.message.reply_text("Bekor qilindi", reply_markup=MAIN_KB))]
    )

    app.add_handler(reg_conv)
    app.add_handler(flag_conv)
    app.add_handler(report_conv)
    app.add_handler(CommandHandler("admin", admin_cmd))
    app.add_handler(CommandHandler("reports", admin_cmd))
    app.add_handler(CommandHandler("export", export_excel_cmd))
    app.add_handler(CallbackQueryHandler(admin_callback))
    app.add_handler(MessageHandler(filters.Regex("^📊 Holatim$"), show_status))
    app.add_handler(MessageHandler(filters.Regex("^🏆 Jonli Reyting$"), show_leaderboard))
    app.add_handler(MessageHandler(filters.Regex("^🌐 Web Target$"), show_web_target))

    print(f"[*] CTF v2 Telegram Bot ishga tushmoqda...")
    app.run_polling()

if __name__ == "__main__":
    main()
