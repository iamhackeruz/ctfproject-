import { RestrictedDockerProxy } from "./docker-proxy";
import { VirtualTerminalDriver } from "./virtual-terminal";
import { generateUserFlag } from "./flags";
import { courseLabEnvironments } from "../../data/labEnvironments";
import { buildLabFiles } from "../labs/lab-files-builder";
import { LabFileItem, SandboxSessionState, TerminalExecutionResult } from "./types";

const MAX_CONCURRENT_CONTAINERS = parseInt(process.env.MAX_TERMINALS || "15", 10);
const SESSION_INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 daqiqa

interface ActiveSessionEntry {
  state: SandboxSessionState;
  virtualDriver?: VirtualTerminalDriver;
}

// In-memory sessiyalar registri
const sessions = new Map<string, ActiveSessionEntry>();
// Foydalanuvchi -> sessionId indeksi (1 foydalanuvchiga 1 ta faol konteyner ta'minlash uchun)
const userSessionIndex = new Map<string, string>();

let isReaperStarted = false;

function startReaper() {
  if (isReaperStarted) return;
  isReaperStarted = true;

  // Ishga tushishda yetim (orphan) qolgan konteynerlarni tozalash
  RestrictedDockerProxy.cleanupOrphans().catch(() => {});

  if (typeof setInterval !== "undefined") {
    setInterval(() => {
      TerminalSessionManager.cleanupInactiveSessions().catch((err) => {
        console.error("Reaper xatoligi:", err);
      });
    }, 60 * 1000).unref?.();
  }
}

export class TerminalSessionManager {
  /**
   * Foydalanuvchi va kurs uchun fayllar to'plamini tayyorlaydi (dinamik flag bilan).
   */
  public static prepareLabFiles(
    courseId: number | string | undefined,
    userId: string
  ): LabFileItem[] {
    if (typeof courseId === "string" && isNaN(Number(courseId))) {
      return buildLabFiles(courseId, userId);
    }

    const labId = Number(courseId) || 1;
    const dynamicFlag = generateUserFlag(labId, userId);

    const baseFiles: LabFileItem[] = [];
    const numId = typeof courseId === "number" ? courseId : Number(courseId);
    const courseConfig = !isNaN(numId) ? courseLabEnvironments[numId] : null;

    if (courseConfig) {
      for (const f of courseConfig.files) {
        if (f.path === "flag.txt") {
          baseFiles.push({ path: "flag.txt", content: `${dynamicFlag}\n` });
        } else {
          baseFiles.push({ ...f });
        }
      }
    }

    // Agar flag.txt qo'shilmagan bo'lsa
    if (!baseFiles.some((f) => f.path === "flag.txt")) {
      baseFiles.push({ path: "flag.txt", content: `${dynamicFlag}\n` });
    }

    if (!baseFiles.some((f) => f.path === "VAZIFA.txt")) {
      baseFiles.push({
        path: "VAZIFA.txt",
        content: `=== CYBEREDU AMALIY LABORATORIYA MASHG'ULOTI ===
Foydalanuvchi: ${userId}
Vazifa: Tizim xavfsizligini tekshiring va flag.txt faylidagi bayroqni toping.
Buyruqlar: ls -la, cat flag.txt, pwd, whoami
`,
      });
    }

    if (!baseFiles.some((f) => f.path === "notes.txt")) {
      baseFiles.push({
        path: "notes.txt",
        content: `=== QAYDLAR ===
1. 'cat flag.txt' orqali o'zingizga xos bayroqni oling.
2. 'python3 audit.py' orqali tizim tekshiruvini bajaring.
`,
      });
    }

    if (!baseFiles.some((f) => f.path === "audit.py")) {
      baseFiles.push({
        path: "audit.py",
        content: `#!/usr/bin/env python3
import sys

print("[+] CyberEdu Izolyatsiyalangan Sandbox Muhiti")
print("[+] Foydalanuvchi UID:", 10001, "(student)")
print("[*] Xavfsizlik darajasi: Yuqori (tarmoqsiz, cheklangan xotira)")
`,
        isExecutable: true,
      });
    }

    return baseFiles;
  }

  /**
   * Sessiya bo'yicha konteyner nomini aniqlaydi.
   */
  public static getContainerName(sessionId: string): string {
    const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
    return `cyberedu-term-${safe}`;
  }

  /**
   * Foydalanuvchi buyrug'ini bajaradi.
   */
  public static async execute(
    sessionId: string,
    userId: string,
    command: string,
    courseId?: number | string,
    currentCwd?: string
  ): Promise<TerminalExecutionResult> {
    startReaper();

    const now = Date.now();
    let entry = sessions.get(sessionId);

    // Agar foydalanuvchining boshqa faol sessiyasi bo'lsa, eskisini tozalaymiz (1 foydalanuvchi - 1 konteyner)
    const existingSessionId = userSessionIndex.get(userId);
    if (existingSessionId && existingSessionId !== sessionId) {
      const oldEntry = sessions.get(existingSessionId);
      if (oldEntry && oldEntry.state.containerId) {
        await RestrictedDockerProxy.removeSandbox(oldEntry.state.containerId).catch(() => {});
      }
      sessions.delete(existingSessionId);
      userSessionIndex.delete(userId);
    }

    // Yangi yoki mavjud sessiyani boshlash
    if (!entry) {
      // Global limitni tekshirish (maksimal 20 faol konteyner)
      const activeDockerContainers = Array.from(sessions.values()).filter(
        (s) => s.state.driver === "docker"
      ).length;

      const isDockerReady = await RestrictedDockerProxy.isAvailable();

      if (isDockerReady) {
        if (activeDockerContainers >= MAX_CONCURRENT_CONTAINERS) {
          return {
            stdout: "",
            stderr: `Hozirda barcha terminal serverlari band (maksimal limitga yetildi: ${MAX_CONCURRENT_CONTAINERS} ta). Iltimos, bir necha daqiqadan so'ng qayta urinib ko'ring yoki faol seansni yakunlang.`,
            cwd: "/home/student",
            exitCode: 503,
            isVirtual: false,
          };
        }

        const containerName = this.getContainerName(sessionId);
        const labFiles = this.prepareLabFiles(courseId, userId);

        const created = await RestrictedDockerProxy.createSandbox(
          containerName,
          labFiles
        );

        if (created) {
          entry = {
            state: {
              sessionId,
              userId,
              containerId: containerName,
              courseId,
              createdAt: now,
              lastActiveAt: now,
              cwd: "/home/student",
              driver: "docker",
            },
          };
        }
      }

      // Agar Docker yo'q bo'lsa yoki yaratish muvaffaqiyatsiz bo'lsa -> Zaxira Virtual Rejim
      if (!entry) {
        const labFiles = this.prepareLabFiles(courseId, userId);
        const virtualDriver = new VirtualTerminalDriver(labFiles);
        entry = {
          state: {
            sessionId,
            userId,
            courseId,
            createdAt: now,
            lastActiveAt: now,
            cwd: "/home/student",
            driver: "virtual",
          },
          virtualDriver,
        };
      }

      sessions.set(sessionId, entry);
      userSessionIndex.set(userId, sessionId);
    }

    entry.state.lastActiveAt = now;
    if (currentCwd && currentCwd.startsWith("/home/student")) {
      entry.state.cwd = currentCwd;
    }

    // Buyruqni tegishli driver orqali bajarish
    if (entry.state.driver === "docker" && entry.state.containerId) {
      const result = await RestrictedDockerProxy.execCommand(
        entry.state.containerId,
        command,
        entry.state.cwd
      );
      entry.state.cwd = result.cwd;
      return result;
    } else if (entry.virtualDriver) {
      const result = entry.virtualDriver.execute(command);
      entry.state.cwd = result.cwd;
      return result;
    }

    return {
      stdout: "",
      stderr: "Terminal drayveri aniqlanmadi.",
      cwd: "/home/student",
      exitCode: 1,
      isVirtual: false,
    };
  }

  /**
   * 10 daqiqa harakatsiz qolgan sessiyalarni tozalaydi.
   */
  public static async cleanupInactiveSessions(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, entry] of sessions.entries()) {
      if (now - entry.state.lastActiveAt > SESSION_INACTIVITY_TIMEOUT_MS) {
        if (entry.state.containerId) {
          await RestrictedDockerProxy.removeSandbox(entry.state.containerId).catch(() => {});
        }
        userSessionIndex.delete(entry.state.userId);
        sessions.delete(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Barcha faol sessiyalar sonini oladi.
   */
  public static getActiveSessionsCount(): { docker: number; virtual: number } {
    let docker = 0;
    let virtual = 0;
    for (const entry of sessions.values()) {
      if (entry.state.driver === "docker") docker++;
      else virtual++;
    }
    return { docker, virtual };
  }
}
