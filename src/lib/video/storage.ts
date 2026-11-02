import fs from "fs";
import path from "path";
import { Readable } from "stream";

export interface StorageStats {
  usedBytes: number;
  freeBytes: number;
  totalBytes: number;
  videoCount: number;
}

export interface StreamRangeInfo {
  stream: fs.ReadStream;
  totalBytes: number;
  start: number;
  end: number;
  chunkSize: number;
}

export interface VideoStorage {
  put(
    fileKey: string,
    readable: NodeJS.ReadableStream | ReadableStream<Uint8Array>,
    maxBytes?: number
  ): Promise<{ sizeBytes: number }>;
  putBuffer(fileKey: string, buffer: Buffer): Promise<{ sizeBytes: number }>;
  openStream(fileKey: string, range?: { start: number; end?: number }): Promise<StreamRangeInfo>;
  delete(fileKey: string): Promise<boolean>;
  exists(fileKey: string): Promise<boolean>;
  getSize(fileKey: string): Promise<number>;
  getStats(): Promise<StorageStats>;
}

/**
 * MP4 faylining birinchi baytlarini (Magic Bytes) tekshirish:
 * ISO Base Media File Format (ISOBMFF): 4-7 baytlar 'ftyp' bo'lishi shart.
 */
export function validateMp4MagicBytes(headerChunk: Buffer): { valid: boolean; reason?: string } {
  if (!headerChunk || headerChunk.length < 8) {
    return { valid: false, reason: "Fayl hajmi juda kichik yoki ma'lumot yetarli emas." };
  }

  // 4-7 baytlar: ftyp (0x66, 0x74, 0x79, 0x70)
  const isFtyp =
    headerChunk[4] === 0x66 &&
    headerChunk[5] === 0x74 &&
    headerChunk[6] === 0x79 &&
    headerChunk[7] === 0x70;

  if (!isFtyp) {
    // Mashhur noto'g'ri turlarni aniqlash
    if (headerChunk[0] === 0x4d && headerChunk[1] === 0x5a) {
      return { valid: false, reason: "Xavfsizlik xatosi: Ijro etiluvchi dastur (.exe) aniqlandi. Faqat haqiqiy MP4 ruxsat etiladi." };
    }
    if (headerChunk.toString("utf8", 0, Math.min(headerChunk.length, 15)).toLowerCase().includes("<html") ||
        headerChunk.toString("utf8", 0, Math.min(headerChunk.length, 15)).toLowerCase().includes("<!doc")) {
      return { valid: false, reason: "Xavfsizlik xatosi: HTML/Web sahifa aniqlandi. Faqat haqiqiy MP4 ruxsat etiladi." };
    }
    return { valid: false, reason: "Fayl haqiqiy MP4 (H.264/AAC) formatida emas (ftyp imzosi topilmadi)." };
  }

  return { valid: true };
}

/**
 * Fayl kaliti (fileKey) orqali Path Traversal hujumlarini bloklash
 * Faqat 32-64 belgili o'n oltilik (hex) satr + .mp4 kengaytmasi ruxsat etiladi.
 */
const FILE_KEY_REGEX = /^[a-f0-9]{32,64}\.mp4$/;

export class LocalDiskStorage implements VideoStorage {
  private baseDir: string;

  constructor(customDir?: string) {
    const configured = customDir || process.env.VIDEO_DIR || "data/videos";
    this.baseDir = path.isAbsolute(configured)
      ? path.normalize(configured)
      : path.resolve(/*turbopackIgnore: true*/ process.cwd(), configured);

    this.ensureDirectory();
  }

    private ensureDirectory(): void {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true, mode: 0o750 });
      }
    } catch {
      // Build vaqtida yoki ruxsat yo'q muhitda xatoni e'tiborsiz qoldirish
    }
  }

  private resolvePath(fileKey: string): string {
    if (!fileKey || !FILE_KEY_REGEX.test(fileKey)) {
      throw new Error(`Xavfsizlik xatosi: Noto'g'ri yoki xavfli video fileKey formati ('${fileKey}').`);
    }

    const resolved = path.normalize(path.join(this.baseDir, fileKey));
    if (!resolved.startsWith(this.baseDir)) {
      throw new Error("Xavfsizlik xatosi: Path traversal aniqlandi.");
    }
    return resolved;
  }

  public async put(
    fileKey: string,
    source: NodeJS.ReadableStream | ReadableStream<Uint8Array>,
    maxBytes: number = 1.5 * 1024 * 1024 * 1024
  ): Promise<{ sizeBytes: number }> {
    const filePath = this.resolvePath(fileKey);
    const tempPath = `${filePath}.tmp_${Date.now()}`;

    // Diskda yetarli joy borligini tekshirish
    await this.checkFreeDiskSpace(maxBytes);

    let nodeStream: NodeJS.ReadableStream;
    if ("getReader" in source) {
      nodeStream = Readable.fromWeb(source as unknown as Parameters<typeof Readable.fromWeb>[0]);
    } else {
      nodeStream = source as NodeJS.ReadableStream;
    }

    const writeStream = fs.createWriteStream(tempPath, { mode: 0o640 });
    let bytesWritten = 0;
    let headerChecked = false;
    let headerBuffer = Buffer.alloc(0);

    try {
      await new Promise<void>((resolve, reject) => {
        nodeStream.on("data", (chunk: Buffer) => {
          bytesWritten += chunk.length;

          // 1. Magic bytes tekshiruvi (faylning boshlang'ich 16 baytida)
          if (!headerChecked) {
            headerBuffer = Buffer.concat([headerBuffer, chunk]);
            if (headerBuffer.length >= 8) {
              const validation = validateMp4MagicBytes(headerBuffer);
              if (!validation.valid) {
                const err = new Error(validation.reason || "Fayl formati noto'g'ri.");
                nodeStream.emit("error", err);
                return;
              }
              headerChecked = true;
            }
          }

          // 2. Maksimal hajm tekshiruvi
          if (bytesWritten > maxBytes) {
            const err = new Error(`Fayl hajmi belgilangan limitdan (${Math.round(maxBytes / (1024 * 1024))} MB) oshib ketdi.`);
            nodeStream.emit("error", err);
            return;
          }

          if (!writeStream.write(chunk)) {
            nodeStream.pause();
            writeStream.once("drain", () => nodeStream.resume());
          }
        });

        nodeStream.on("end", () => {
          writeStream.end();
        });

        writeStream.on("finish", () => {
          if (!headerChecked && bytesWritten < 8) {
            reject(new Error("Yuklangan fayl juda qisqa yoki bo'sh."));
          } else {
            resolve();
          }
        });

        nodeStream.on("error", (err) => {
          writeStream.destroy();
          reject(err);
        });

        writeStream.on("error", (err) => {
          reject(err);
        });
      });

      // Muvaffaqiyatli tugagach temp faylni asosiy nomga almashtirish (Atomar)
      await fs.promises.rename(tempPath, filePath);
      return { sizeBytes: bytesWritten };
    } catch (err) {
      if (fs.existsSync(tempPath)) {
        await fs.promises.unlink(tempPath).catch(() => {});
      }
      throw err;
    }
  }

  public async putBuffer(fileKey: string, buffer: Buffer): Promise<{ sizeBytes: number }> {
    const validation = validateMp4MagicBytes(buffer);
    if (!validation.valid) {
      throw new Error(validation.reason || "Fayl MP4 formatida emas.");
    }

    const filePath = this.resolvePath(fileKey);
    await fs.promises.writeFile(filePath, buffer, { mode: 0o640 });
    return { sizeBytes: buffer.length };
  }

  public async openStream(
    fileKey: string,
    range?: { start: number; end?: number }
  ): Promise<StreamRangeInfo> {
    const filePath = this.resolvePath(fileKey);
    const stats = await fs.promises.stat(filePath);
    const totalBytes = stats.size;

    let start = 0;
    let end = totalBytes - 1;

    if (range) {
      start = Math.max(0, range.start);
      if (typeof range.end === "number" && range.end >= start && range.end < totalBytes) {
        end = range.end;
      }
    }

    // Default chunk hajmi: 2 MB (silliq buferlash va server resursini tejash uchun)
    const MAX_CHUNK = 2 * 1024 * 1024;
    if (end - start + 1 > MAX_CHUNK) {
      end = start + MAX_CHUNK - 1;
    }

    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });

    return { stream, totalBytes, start, end, chunkSize };
  }

  public async delete(fileKey: string): Promise<boolean> {
    try {
      const filePath = this.resolvePath(fileKey);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async exists(fileKey: string): Promise<boolean> {
    try {
      const filePath = this.resolvePath(fileKey);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  public async getSize(fileKey: string): Promise<number> {
    const filePath = this.resolvePath(fileKey);
    const stats = await fs.promises.stat(filePath);
    return stats.size;
  }

  private async checkFreeDiskSpace(requiredBytes: number): Promise<void> {
    try {
      if (typeof fs.promises.statfs === "function") {
        const stat = await fs.promises.statfs(this.baseDir);
        const freeBytes = Number(stat.bavail) * Number(stat.bsize);
        const minBuffer = 200 * 1024 * 1024; // 200 MB xavfsizlik buferi

        if (freeBytes < requiredBytes + minBuffer) {
          throw new Error("Server diskida videoni saqlash uchun yetarli bo'sh joy mavjud emas.");
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Server diskida")) {
        throw err;
      }
    }
  }

  public async getStats(): Promise<StorageStats> {
    this.ensureDirectory();
    const files = await fs.promises.readdir(this.baseDir);
    let usedBytes = 0;
    let videoCount = 0;

    for (const f of files) {
      if (f.endsWith(".mp4")) {
        try {
          const s = await fs.promises.stat(path.join(this.baseDir, f));
          usedBytes += s.size;
          videoCount++;
        } catch {}
      }
    }

    let freeBytes = 10 * 1024 * 1024 * 1024; // 10 GB default
    let totalBytes = 50 * 1024 * 1024 * 1024;

    try {
      if (typeof fs.promises.statfs === "function") {
        const stat = await fs.promises.statfs(this.baseDir);
        freeBytes = Number(stat.bavail) * Number(stat.bsize);
        totalBytes = Number(stat.blocks) * Number(stat.bsize);
      }
    } catch {}

    return { usedBytes, freeBytes, totalBytes, videoCount };
  }
}

// Yagona asosiy storage instansiyasi (Singleton)
export const videoStorage: VideoStorage = new LocalDiskStorage();
