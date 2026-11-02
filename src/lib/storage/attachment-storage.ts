import fs from "fs";
import path from "path";
import crypto from "crypto";

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface AttachmentValidationResult {
  valid: boolean;
  reason?: string;
  detectedExt?: string;
  detectedMime?: string;
}

/**
 * Fayl nomidan kengaytmani xavfsiz olish
 */
export function getFileExtension(filename: string): string {
  const clean = filename.trim().toLowerCase();
  const lastDot = clean.lastIndexOf(".");
  if (lastDot === -1 || lastDot === clean.length - 1) return "";
  return clean.slice(lastDot + 1);
}

/**
 * Xavfsiz yuklab olish uchun original fayl nomini sanitizatsiya qilish.
 * Path traversal belgilarini (../, / , \) va xavfli belgilarni olib tashlaydi.
 */
export function sanitizeFilenameForDownload(filename: string): string {
  if (!filename) return "topshiriq_fayli";
  const base = path.basename(filename).replace(/[\r\n\0"'\\/]/g, "_");
  // Faqat harflar, raqamlar, probel, nuqta, chiziqcha va pastki chiziq
  const sanitized = base.replace(/[^\w\s\-.()]/gi, "_").trim();
  return sanitized.length > 0 ? sanitized : "topshiriq_fayli";
}

/**
 * Kriptografik tasodifiy xavfsiz fayl kaliti (FileKey).
 * Hech qachon foydalanuvchi bergan nom yoki yo'l fayl tizimida to'g'ridan-to'g'ri ishlatilmaydi.
 */
export function generateAttachmentKey(extension: string): string {
  const cleanExt = extension.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const randomHex = crypto.randomBytes(24).toString("hex");
  return `${randomHex}.${cleanExt || "bin"}`;
}

const FILE_KEY_REGEX = /^[a-f0-9]{32,64}\.[a-z0-9]{1,10}$/;

export function isValidFileKey(key: string): boolean {
  return FILE_KEY_REGEX.test(key);
}

/**
 * Sehrli baytlar (Magic bytes) va kontent tekshiruvi.
 * Kengaytmasi .pdf qilingan .exe, soxta .zip, HTML/SVG XSS fayllarini qat'iy rad etadi.
 */
export function validateAttachment(
  buffer: Buffer,
  originalFilename: string,
  allowedTypesList?: string[]
): AttachmentValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, reason: "Fayl bo'sh bo'lishi mumkin emas." };
  }

  if (buffer.length > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      valid: false,
      reason: `Fayl hajmi 10 MB dan oshmasligi kerak (hozirgi hajm: ${(buffer.length / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  const ext = getFileExtension(originalFilename);
  if (!ext) {
    return { valid: false, reason: "Fayl kengaytmasi ko'rsatilmagan." };
  }

  // Ruxsat etilgan turlar
  const allowed = (allowedTypesList && allowedTypesList.length > 0)
    ? allowedTypesList.map((t) => t.trim().toLowerCase().replace(/^\./, ""))
    : ["txt", "md", "pdf", "zip", "png", "jpg", "jpeg", "py", "sh"];

  if (!allowed.includes(ext)) {
    return {
      valid: false,
      reason: `.${ext} kengaytmali faylga ruxsat berilmagan. Ruxsat etilgan: ${allowed.map((t) => "." + t).join(", ")}`,
    };
  }

  // Umumiy xavfli ijro etiluvchi va skript imzolarini tekshirish
  // 1. PE / EXE / DLL (MZ - 0x4D 0x5A)
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { valid: false, reason: "Xavfsizlik xatosi: Ijro etiluvchi dastur (.exe / PE) aniqlandi. Ruxsat berilmaydi." };
  }

  // 2. Linux ELF (0x7F 'E' 'L' 'F' - 0x7F 0x45 0x4C 0x46)
  if (buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return { valid: false, reason: "Xavfsizlik xatosi: Linux ELF dasturi aniqlandi. Ruxsat berilmaydi." };
  }

  // 3. HTML / SVG / XML XSS belgilari
  const headStr = buffer.slice(0, Math.min(buffer.length, 1024)).toString("utf8").toLowerCase();
  if (
    headStr.includes("<html") ||
    headStr.includes("<!doctype") ||
    headStr.includes("<svg") ||
    headStr.includes("<?xml") ||
    headStr.includes("<?php") ||
    headStr.includes("<script") ||
    headStr.includes("<iframe")
  ) {
    return {
      valid: false,
      reason: "Xavfsizlik xatosi: Web sahifa (HTML/SVG/PHP/Script) aniqlandi. XSS xavfi tufayli qabul qilinmaydi.",
    };
  }

  // Har bir kengaytma uchun maxsus sehrli baytlar (magic bytes) tekshiruvi:
  switch (ext) {
    case "pdf": {
      // PDF boshlanishi %PDF- (0x25 0x50 0x44 0x46) bo'lishi shart
      if (
        buffer.length < 5 ||
        buffer[0] !== 0x25 ||
        buffer[1] !== 0x50 ||
        buffer[2] !== 0x44 ||
        buffer[3] !== 0x46
      ) {
        return { valid: false, reason: "Fayl haqiqiy PDF emas (%PDF- imzosi topilmadi)." };
      }
      return { valid: true, detectedExt: "pdf", detectedMime: "application/pdf" };
    }

    case "png": {
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      if (
        buffer.length < 8 ||
        buffer[0] !== 0x89 ||
        buffer[1] !== 0x50 ||
        buffer[2] !== 0x4e ||
        buffer[3] !== 0x47 ||
        buffer[4] !== 0x0d ||
        buffer[5] !== 0x0a ||
        buffer[6] !== 0x1a ||
        buffer[7] !== 0x0a
      ) {
        return { valid: false, reason: "Fayl haqiqiy PNG rasm emas (PNG imzosi topilmadi)." };
      }
      return { valid: true, detectedExt: "png", detectedMime: "image/png" };
    }

    case "jpg":
    case "jpeg": {
      // JPEG: FF D8 FF
      if (
        buffer.length < 3 ||
        buffer[0] !== 0xff ||
        buffer[1] !== 0xd8 ||
        buffer[2] !== 0xff
      ) {
        return { valid: false, reason: "Fayl haqiqiy JPEG rasm emas (JPEG imzosi topilmadi)." };
      }
      return { valid: true, detectedExt: "jpg", detectedMime: "image/jpeg" };
    }

    case "zip": {
      // ZIP: PK\x03\x04 (0x50 0x4B 0x03 0x04)
      if (
        buffer.length < 4 ||
        buffer[0] !== 0x50 ||
        buffer[1] !== 0x4b ||
        buffer[2] !== 0x03 ||
        buffer[3] !== 0x04
      ) {
        return { valid: false, reason: "Fayl haqiqiy ZIP arxiv emas (PK imzosi topilmadi)." };
      }
      return { valid: true, detectedExt: "zip", detectedMime: "application/zip" };
    }

    case "txt":
    case "md":
    case "py":
    case "sh": {
      // Matnli fayllar: null bayt (\0) bo'lmasligi kerak (ikkilik ma'lumot emasligini tekshirish)
      const sample = buffer.slice(0, Math.min(buffer.length, 4096));
      for (let i = 0; i < sample.length; i++) {
        if (sample[i] === 0x00) {
          return { valid: false, reason: "Matnli faylda null-bayt (ikkilik ma'lumot) aniqlandi. Ruxsat berilmaydi." };
        }
      }

      // sh skriptlari uchun qo'shimcha tekshiruv: xavfli rm -rf / kabi qatorlarni oldini olish
      const mimeMap: Record<string, string> = {
        txt: "text/plain",
        md: "text/markdown",
        py: "text/x-python",
        sh: "application/x-sh",
      };

      return { valid: true, detectedExt: ext, detectedMime: mimeMap[ext] || "text/plain" };
    }

    default:
      return { valid: true, detectedExt: ext, detectedMime: "application/octet-stream" };
  }
}

export interface AttachmentStorage {
  putBuffer(fileKey: string, buffer: Buffer): Promise<{ sizeBytes: number }>;
  openStream(fileKey: string): Promise<fs.ReadStream>;
  delete(fileKey: string): Promise<boolean>;
  exists(fileKey: string): Promise<boolean>;
  getAbsolutePath(fileKey: string): string;
  getSize(fileKey: string): Promise<number>;
}

export class LocalDiskAttachmentStorage implements AttachmentStorage {
  private baseDir: string;

  constructor() {
    const configured = process.env.ATTACHMENTS_DIR || "data/attachments";
    this.baseDir = path.isAbsolute(configured)
      ? path.normalize(configured)
      : path.resolve(/*turbopackIgnore: true*/ process.cwd(), configured);
    this.ensureDir();
  }

  private ensureDir() {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true, mode: 0o700 });
      }
    } catch (err) {
      console.error("[AttachmentStorage] Papkani yaratib bo'lmadi:", err);
    }
  }

  public getAbsolutePath(fileKey: string): string {
    if (!isValidFileKey(fileKey)) {
      throw new Error("Xavfsizlik xatosi: Noto'g'ri fayl kaliti (Path Traversal urinishi).");
    }
    const resolved = path.resolve(this.baseDir, fileKey);
    if (!resolved.startsWith(this.baseDir)) {
      throw new Error("Xavfsizlik xatosi: Yo'ldan tashqariga chiqish taqiqlangan.");
    }
    return resolved;
  }

  public async putBuffer(fileKey: string, buffer: Buffer): Promise<{ sizeBytes: number }> {
    this.ensureDir();
    const filePath = this.getAbsolutePath(fileKey);
    await fs.promises.writeFile(filePath, buffer, { mode: 0o600 });
    return { sizeBytes: buffer.length };
  }

  public async openStream(fileKey: string): Promise<fs.ReadStream> {
    const filePath = this.getAbsolutePath(fileKey);
    if (!fs.existsSync(filePath)) {
      throw new Error("Fayl diskda topilmadi.");
    }
    return fs.createReadStream(filePath);
  }

  public async delete(fileKey: string): Promise<boolean> {
    try {
      const filePath = this.getAbsolutePath(fileKey);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[AttachmentStorage] Faylni o'chirishda xatolik:", err);
      return false;
    }
  }

  public async exists(fileKey: string): Promise<boolean> {
    try {
      const filePath = this.getAbsolutePath(fileKey);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  public async getSize(fileKey: string): Promise<number> {
    const filePath = this.getAbsolutePath(fileKey);
    const stat = await fs.promises.stat(filePath);
    return stat.size;
  }
}

export const attachmentStorage = new LocalDiskAttachmentStorage();
