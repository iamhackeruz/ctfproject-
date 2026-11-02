import { TerminalSessionManager } from "../../src/lib/terminal/session-manager";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import net from "net";

/**
 * Terminal laboratoriyalarida talaba sifatida buyruq bajarish.
 * Solver faqat terminal stdout va stderr ma'lumotlarini qabul qiladi.
 */
export async function executeTerminalCommand(
  labSlug: string,
  userId: string,
  command: string
): Promise<string> {
  const sessionId = `solver_${userId.slice(-6)}_${labSlug.slice(0, 10)}`;
  const res = await TerminalSessionManager.execute(
    sessionId,
    userId,
    command,
    labSlug
  );
  return `${res.stdout}\n${res.stderr}`;
}

/**
 * Matn ichidan flag{...} shablonidagi flagni ajratib olish (talaba ko'zi bilan).
 */
export function extractFlagFromText(text: string): string | null {
  const match = text.match(/flag\{[a-zA-Z0-9_-]+\}/);
  return match ? match[0] : null;
}

/**
 * Flag to'g'ri olinganligini tekshirish (FLAG_SECRET yoki bazaga kirmasdan).
 */
export function assertFlagValid(labIdOrSlug: string, flag: string | null): string {
  if (!flag) {
    throw new Error(`[SOLVER ERROR] ${labIdOrSlug}: Talaba ko'ra oladigan natijadan flag topilmadi!`);
  }
  if (!flag.startsWith("flag{") || !flag.endsWith("}")) {
    throw new Error(`[SOLVER ERROR] ${labIdOrSlug}: Noto'g'ri flag formati: ${flag}`);
  }
  return flag;
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      if (address && typeof address === "object") {
        const port = address.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("Bo'sh port topilmadi")));
      }
    });
  });
}

/**
 * Veb-laboratoriya uchun alohida HTTP xizmatini ishga tushirish va talaba sifatida tekshirish.
 * Solver faqat HTTP javoblaridan ma'lumot oladi.
 */
export async function withWebLabInstance(
  labSlug: string,
  userId: string,
  handler: (baseUrl: string) => Promise<string>
): Promise<string> {
  const port = await getFreePort();
  const scriptPath = path.resolve(process.cwd(), "labs/app.py");

  // Veb laboratoriya serverini fon rejimida ishga tushirish
  const child: ChildProcess = spawn(
    "python3",
    [scriptPath],
    {
      env: {
        ...process.env,
        LAB_TYPE: labSlug,
        PORT: String(port),
        // Talaba bu flagni bilmaydi, faqat veb-zaiflik orqali HTTP'dan oladi
        FLAG: `flag{cyber_${labSlug}_${userId.slice(-6)}_${Date.now().toString(16)}}`,
      },
      stdio: "pipe",
    }
  );

  const baseUrl = `http://127.0.0.1:${port}`;

  // Server ishga tushishini kutish
  let ready = false;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(300) });
      if (res.status >= 200) {
        ready = true;
        break;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  if (!ready) {
    child.kill("SIGKILL");
    throw new Error(`Veb lab (${labSlug}) ${baseUrl} da ishga tushmadi`);
  }

  try {
    const flag = await handler(baseUrl);
    return assertFlagValid(labSlug, flag);
  } finally {
    child.kill("SIGKILL");
  }
}
