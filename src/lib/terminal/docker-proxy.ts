import { spawn } from "child_process";
import crypto from "crypto";
import path from "path";
import { LabFileItem, TerminalExecutionResult } from "./types";

const DAEMON_URL = process.env.SANDBOX_DAEMON_URL || "http://127.0.0.1:5055";
const DAEMON_SECRET =
  process.env.DAEMON_SECRET || process.env.SIDECAR_SECRET || "cyberedu_daemon_internal_secret_2026";
const CONTAINER_NAME_REGEX = /^cyberedu-term-[a-zA-Z0-9_-]{4,48}$/;

/**
 * Cheklangan Docker Proxy (Sidecar Daemon orqali).
 * Next.js ilovasi docker.sock'ga to'g'ridan-to'g'ri bog'lanmaydi.
 * Barcha konteyner amallari izolyatsiyalangan Sandbox Sidecar Demon (127.0.0.1:5055)
 * orqali qat'iy cheklovlar bilan bajariladi.
 */
export class RestrictedDockerProxy {
  private static daemonStarting = false;

  /**
   * Sidecar demon bilan HMAC imzolangan xavfsiz sarlavhalarni hosil qiladi.
   */
  private static makeAuthHeaders(bodyString = ""): Record<string, string> {
    const timestamp = Date.now().toString();
    const signature = crypto
      .createHmac("sha256", DAEMON_SECRET)
      .update(`${timestamp}.${bodyString}`)
      .digest("hex");

    return {
      "Content-Type": "application/json",
      "x-daemon-timestamp": timestamp,
      "x-daemon-signature": signature,
      "x-daemon-token": DAEMON_SECRET,
    };
  }

  /**
   * Sidecar demon ishlayotganini ta'minlaydi.
   * Agar ishga tushmagan bo'lsa, uni avtomatik orqa fonda (daemon) ishga tushiradi.
   */
  private static async ensureDaemon(): Promise<boolean> {
    try {
      const res = await fetch(`${DAEMON_URL}/health`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return true;
    } catch {
      // Demon hali ishlamayapti
    }

    if (this.daemonStarting) {
      await new Promise((r) => setTimeout(r, 600));
      return this.checkHealth();
    }

    this.daemonStarting = true;
    try {
      const daemonScript = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "services", "sandbox-daemon", "dist", "server.js");
      const child = spawn("node", [daemonScript], {
        detached: true,
        stdio: "ignore",
        env: { ...process.env, DAEMON_SECRET },
      });
      child.unref();

      // Demon ishga tushishini kutish
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 200));
        if (await this.checkHealth()) {
          this.daemonStarting = false;
          return true;
        }
      }
    } catch (err) {
      console.error("[DOCKER PROXY] Demonni ishga tushirishda xatolik:", err);
    } finally {
      this.daemonStarting = false;
    }

    return false;
  }

  private static async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${DAEMON_URL}/health`, { signal: AbortSignal.timeout(1000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Docker xizmati va Sidecar demon mavjudligini tekshiradi.
   */
  static async isAvailable(): Promise<boolean> {
    return await this.ensureDaemon();
  }

  /**
   * Konteyner nomidan sessionId ni ajratib oladi.
   */
  private static extractSessionId(containerName: string): string {
    return containerName.replace(/^cyberedu-term-/, "");
  }

  /**
   * Yangi to'liq izolyatsiyalangan sandbox konteyner yaratadi (Daemon orqali).
   */
  static async createSandbox(
    containerName: string,
    files: LabFileItem[] = []
  ): Promise<boolean> {
    if (
      containerName.startsWith("cyberedu-term-") &&
      !CONTAINER_NAME_REGEX.test(containerName)
    ) {
      throw new Error(`Xato konteyner nomi: ${containerName}`);
    }

    const ok = await this.ensureDaemon();
    if (!ok) return false;

    const sessionId = this.extractSessionId(containerName);
    const bodyStr = JSON.stringify({ sessionId, files });

    try {
      const res = await fetch(`${DAEMON_URL}/api/terminal/create`, {
        method: "POST",
        headers: this.makeAuthHeaders(bodyStr),
        body: bodyStr,
        signal: AbortSignal.timeout(15000),
      });

      const data = await res.json().catch(() => ({}));
      return res.ok && data.success === true;
    } catch (err) {
      console.error(`[DOCKER PROXY] Konteyner yaratish xatosi (${sessionId}):`, err);
      return false;
    }
  }

  /**
   * Konteyner ichida buyruq bajarish (Daemon orqali).
   */
  static async execCommand(
    containerName: string,
    cmd: string,
    cwd = "/home/student",
    timeoutMs = 8000
  ): Promise<TerminalExecutionResult> {
    const ok = await this.ensureDaemon();
    const sessionId = this.extractSessionId(containerName);

    if (!ok) {
      return {
        stdout: "",
        stderr: "Sandbox demon bilan aloqa o'rnatib bo'lmadi.",
        cwd: cwd || "/home/student",
        exitCode: 1,
        isVirtual: false,
      };
    }

    const bodyStr = JSON.stringify({ sessionId, command: cmd, cwd, timeoutMs });

    try {
      const res = await fetch(`${DAEMON_URL}/api/terminal/exec`, {
        method: "POST",
        headers: this.makeAuthHeaders(bodyStr),
        body: bodyStr,
        signal: AbortSignal.timeout(timeoutMs + 4000),
      });

      const data = await res.json();
      return {
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        cwd: data.newCwd || cwd,
        exitCode: data.exitCode ?? 0,
        isVirtual: false,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        stdout: "",
        stderr: `Xatolik yuz berdi: ${msg}`,
        cwd,
        exitCode: 1,
        isVirtual: false,
      };
    }
  }

  /**
   * Konteynerni to'xtatish va o'chirish.
   */
  static async removeSandbox(containerName: string): Promise<void> {
    const sessionId = this.extractSessionId(containerName);
    const bodyStr = JSON.stringify({ sessionId });
    try {
      await fetch(`${DAEMON_URL}/api/terminal/destroy`, {
        method: "POST",
        headers: this.makeAuthHeaders(bodyStr),
        body: bodyStr,
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Ignored
    }
  }

  /**
   * Yetim konteynerlarni tozalash (Daemon ishga tushganda o'zi avtomatik bajaradi).
   */
  static async cleanupOrphans(): Promise<number> {
    await this.ensureDaemon();
    return 0;
  }

  /**
   * Faol sandbox konteynerlar soni.
   */
  static async listActiveSandboxes(): Promise<string[]> {
    try {
      const res = await fetch(`${DAEMON_URL}/health`);
      if (res.ok) {
        return ["daemon-managed"];
      }
    } catch {}
    return [];
  }

  // ── WEBLAB METODLARI ──────────────────────────────────────────────────

  /**
   * Izolyatsiyalangan zaif veb-laboratoriya instansiyasini ishga tushirish.
   */
  static async startWebLab(
    instanceId: string,
    labSlug: string,
    dynamicFlag: string,
    userId: string
  ): Promise<{ success: boolean; port?: number; error?: string }> {
    const ok = await this.ensureDaemon();
    if (!ok) {
      return { success: false, error: "Sandbox demon bilan aloqa yo'q." };
    }

    const bodyStr = JSON.stringify({ instanceId, labSlug, dynamicFlag, userId });
    try {
      const res = await fetch(`${DAEMON_URL}/api/weblab/start`, {
        method: "POST",
        headers: this.makeAuthHeaders(bodyStr),
        body: bodyStr,
        signal: AbortSignal.timeout(10000),
      });
      return await res.json();
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Veb-laboratoriya instansiyasini to'xtatish.
   */
  static async stopWebLab(instanceId: string): Promise<boolean> {
    const bodyStr = JSON.stringify({ instanceId });
    try {
      const res = await fetch(`${DAEMON_URL}/api/weblab/stop`, {
        method: "POST",
        headers: this.makeAuthHeaders(bodyStr),
        body: bodyStr,
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      return !!data.success;
    } catch {
      return false;
    }
  }

  /**
   * Veb-laboratoriya instansiyasi holatini olish.
   */
  static async getWebLabStatus(instanceId: string): Promise<{
    running: boolean;
    port?: number;
    remainingSeconds?: number;
    error?: string;
  }> {
    try {
      const res = await fetch(`${DAEMON_URL}/api/weblab/status/${instanceId}`, {
        method: "POST",
        headers: this.makeAuthHeaders(""),
        signal: AbortSignal.timeout(3000),
      });
      return await res.json();
    } catch (err: unknown) {
      return { running: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
