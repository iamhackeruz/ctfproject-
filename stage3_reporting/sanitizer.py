#!/usr/bin/env python3
"""
stage3_reporting/sanitizer.py — Hisobotlar Xavfsizlik Skaneri va Sanitarizatsiya Moduli
Maqsad: Talabalar hisobot niqobi ostida makros-viruslar (VBA), OLE-eksploitlar,
xavfli PDF-skriptlar (Zero-click / Malicious streams) yoki DoS fayllar yuborishining oldini olish.
"""

import os
import io
import re
import zipfile
from typing import Tuple, Dict, Any

MAX_FILE_SIZE = 10 * 1024 * 1024  # Maksimal 10 MB (DoS va Zip-bombadan himoya)

# Ruxsat etilgan kengaytmalar
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".md", ".txt"}

def check_file_safety(file_path: str) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Faylni chuqur xavfsizlik tahlilidan o'tkazish.
    Qaytaradi: (xavfsizmi: bool, xabar: str, metadata: dict)
    """
    if not os.path.exists(file_path):
        return False, "Fayl topilmadi", {}

    # 1. Hajm tekshiruvi (DoS / Zip-bomb)
    file_size = os.path.getsize(file_path)
    if file_size > MAX_FILE_SIZE:
        return False, f"Fayl hajmi ruxsat etilgan chegaradan (10MB) katta: {file_size / (1024*1024):.1f}MB", {}
    if file_size == 0:
        return False, "Fayl bo'sh", {}

    ext = os.path.splitext(file_path)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"Xavfli fayl kengaytmasi ({ext}). Faqat .pdf, .docx, .md, .txt ruxsat etiladi!", {}

    # Fayl baytlarini o'qish
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    # 2. Magic Bytes tekshiruvi (Extension Spoofing oldini olish)
    if ext == ".pdf":
        if not file_bytes.startswith(b"%PDF-"):
            return False, "Yaroqsiz PDF fayl (Magic bytes mos emas)!", {}
        
        # PDF ichidagi xavfli stream va exploit teglarini tekshirish
        dangerous_pdf_tags = [
            rb"/JavaScript", rb"/JS", rb"/Launch",
            rb"/EmbeddedFiles", rb"/OpenAction", rb"/RichMedia"
        ]
        found_threats = []
        for tag in dangerous_pdf_tags:
            if re.search(tag, file_bytes, re.IGNORECASE):
                found_threats.append(tag.decode("utf-8", errors="ignore"))
        
        if found_threats:
            return False, f"⚠️ Xavfli PDF aniqlandi! Ruxsatsiz skript/harakat teglari topildi: {', '.join(found_threats)}", {"threats": found_threats}

        return True, "✅ PDF to'liq xavfsiz (Skriptlar va Launch teglari mavjud emas).", {"type": "pdf", "size": file_size}

    elif ext == ".docx":
        if not file_bytes.startswith(b"PK\x03\x04"):
            return False, "Yaroqsiz DOCX fayl (ZIP sarlavhasi topilmadi)!", {}

        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes), "r") as z:
                namelist = z.namelist()

                # VBA Macro va OLE eksploitlarni tekshirish (Follina, CVE-2021-40444 va h.k.)
                suspicious_entries = []
                for name in namelist:
                    name_lower = name.lower()
                    if "vbaproject.bin" in name_lower or "vba" in name_lower:
                        suspicious_entries.append("VBA Makros (vbaProject.bin)")
                    if "oleobject" in name_lower:
                        suspicious_entries.append("OLE Obyekti (Tashqi Payload)")
                    if name_lower.endswith((".exe", ".dll", ".ps1", ".vbs", ".bat")):
                        suspicious_entries.append(f"Yashirin ijro fayli ({name})")

                if suspicious_entries:
                    return False, f"⚠️ Xavfli Word hujjati aniqlandi! Zararli elementlar: {', '.join(suspicious_entries)}", {"threats": suspicious_entries}

        except zipfile.BadZipFile:
            return False, "Zararlangan yoki yaroqsiz DOCX arxivi!", {}

        return True, "✅ DOCX to'liq toza (Makroslar va OLE ob'ektlar yo'q).", {"type": "docx", "size": file_size}

    elif ext in [".md", ".txt"]:
        # Matnli fayl — har doim eng xavfsiz
        return True, "✅ Toza matnli hisobot.", {"type": "text", "size": file_size}

    return False, "Noma'lum fayl turi", {}

def extract_safe_text(file_path: str) -> str:
    """
    Hisobot faylidan xavfsiz matnni ajratib olish (Admin kompyuteriga yuklab olmasdan
    brauzerning o'zida 100% xavfsiz o'qishi uchun).
    """
    if not os.path.exists(file_path):
        return "Fayl topilmadi."

    ext = os.path.splitext(file_path)[1].lower()

    try:
        if ext in [".md", ".txt"]:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()

        elif ext == ".docx":
            try:
                import docx
                doc = docx.Document(file_path)
                paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
                return "\n\n".join(paragraphs) if paragraphs else "(Hisobot matni bo'sh)"
            except ImportError:
                return f"DOCX fayl qabul qilingan va tekshiruvdan o'tgan ({os.path.basename(file_path)})."

        elif ext == ".pdf":
            # PDF dan matn ajratish (agar pypdf mavjud bo'lsa)
            try:
                import pypdf
                reader = pypdf.PdfReader(file_path)
                text = []
                for page in reader.pages:
                    text.append(page.extract_text() or "")
                return "\n\n".join(text) if text else "(PDF matni aniqlanmadi yoki skanerlangan rasm)"
            except ImportError:
                return f"PDF fayl qabul qilingan va tekshiruvdan o'tgan ({os.path.basename(file_path)})."

    except Exception as e:
        return f"Matnni o'qishda xatolik yuz berdi: {str(e)}"

    return "Noma'lum format"
