import fs from "fs";
import path from "path";

export interface TerminalAuditRecord {
  timestamp: string;
  userId: string;
  ip: string;
  sessionId: string;
  courseId?: number;
  command: string;
  exitCode: number;
  durationMs: number;
  driver: "docker" | "virtual";
  blockedReason?: string;
  error?: string;
}

const LOGS_DIR = path.join(process.cwd(), "logs");
const AUDIT_FILE = path.join(LOGS_DIR, "terminal-audit.log");

function ensureLogsDir() {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("Audit log papkasini yaratib bo'lmadi:", err);
  }
}

export function logTerminalAudit(record: TerminalAuditRecord): void {
  try {
    ensureLogsDir();
    const line = JSON.stringify(record) + "\n";
    fs.appendFile(AUDIT_FILE, line, "utf-8", (err) => {
      if (err) {
        console.error("Audit yozishda xatolik:", err);
      }
    });
  } catch (err) {
    console.error("Audit logger xatosi:", err);
  }
}
