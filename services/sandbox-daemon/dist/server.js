"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const crypto_1 = __importDefault(require("crypto"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const DAEMON_PORT = parseInt(process.env.SANDBOX_DAEMON_PORT || process.env.DAEMON_PORT || "5055", 10);
const DAEMON_SECRET = process.env.DAEMON_SECRET || process.env.SIDECAR_SECRET || "cyberedu_daemon_internal_secret_2026";
const MAX_TERMINALS = parseInt(process.env.MAX_TERMINALS || "15", 10);
const MAX_WEB_LABS = parseInt(process.env.MAX_WEB_LABS || "4", 10);
const TERMINAL_IMAGE = "cyberedu-terminal-sandbox:latest";
const WEBLAB_IMAGE = "cyberedu-weblab:latest";
const ISOLATED_NETWORK = "cyberedu-lab-net";
const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KB
const DEFAULT_TIMEOUT_MS = 8000; // 8 soniya
const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]{4,48}$/;
const INSTANCE_ID_REGEX = /^[a-zA-Z0-9_-]{4,48}$/;
const LAB_SLUG_REGEX = /^[a-zA-Z0-9_-]{3,32}$/;
const WEBLAB_SLUGS = new Set([
    "web-xss",
    "web-sqli",
    "web-idor",
    "web-exposed-files",
]);
const activeTerminals = new Map();
const activeWebLabs = new Map();
let nextWebLabPort = 6001;
function allocateWebPort() {
    const port = nextWebLabPort;
    nextWebLabPort += 1;
    if (nextWebLabPort > 6100) {
        nextWebLabPort = 6001;
    }
    return port;
}
// ── Yordamchi Docker Funksiyalari ──────────────────────────────────────────
async function cleanOrphanContainers() {
    try {
        const { stdout: sandboxList } = await execFileAsync("docker", [
            "ps",
            "-aq",
            "--filter",
            "label=io.cyberedu.sandbox=true",
        ]);
        const sandboxIds = sandboxList.trim().split(/\s+/).filter(Boolean);
        if (sandboxIds.length > 0) {
            await execFileAsync("docker", ["rm", "-f", ...sandboxIds]).catch(() => { });
            console.log(`[DAEMON] ${sandboxIds.length} ta yetim sandbox konteyner tozalandi.`);
        }
        const { stdout: weblabList } = await execFileAsync("docker", [
            "ps",
            "-aq",
            "--filter",
            "label=io.cyberedu.weblab=true",
        ]);
        const weblabIds = weblabList.trim().split(/\s+/).filter(Boolean);
        if (weblabIds.length > 0) {
            await execFileAsync("docker", ["rm", "-f", ...weblabIds]).catch(() => { });
            console.log(`[DAEMON] ${weblabIds.length} ta yetim weblab konteyner tozalandi.`);
        }
    }
    catch (err) {
        console.error("[DAEMON WARNING] Orphan konteynerlarni tozalashda xato:", err);
    }
}
async function createTerminalSandbox(sessionId, files = []) {
    if (activeTerminals.size >= MAX_TERMINALS) {
        console.warn(`[DAEMON] Terminal limiti yetildi (${activeTerminals.size}/${MAX_TERMINALS})`);
        return false;
    }
    const containerName = `cyberedu-term-${sessionId}`;
    await removeTerminalSandbox(sessionId).catch(() => { });
    const args = [
        "run",
        "-d",
        "--name",
        containerName,
        "--network",
        "none",
        "--read-only",
        "--tmpfs",
        "/home/student:rw,noexec,nosuid,size=32m,uid=10001,gid=10001,mode=0750",
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,size=16m,mode=1777",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--pids-limit",
        "64",
        "--memory",
        "128m",
        "--memory-swap",
        "128m",
        "--cpus",
        "0.50",
        "--init",
        "--label",
        "io.cyberedu.sandbox=true",
        "--ulimit",
        "nofile=256:256",
        "--ulimit",
        "nproc=64:64",
        "--user",
        "10001:10001",
        TERMINAL_IMAGE,
        "sleep",
        "infinity",
    ];
    await execFileAsync("docker", args);
    // Fayllarni joylashtirish (shell chaqiruvisiz, to'g'ridan-to'g'ri python drayveri orqali)
    const pyWriter = "import sys,os; p=sys.argv[1]; os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'wb').write(sys.stdin.buffer.read())";
    for (const f of files) {
        const cleanPath = f.path.replace(/^\/+/, "");
        const targetFile = `/home/student/${cleanPath}`;
        await new Promise((resolve, reject) => {
            const child = (0, child_process_1.spawn)("docker", [
                "exec",
                "-i",
                "--user",
                "10001:10001",
                containerName,
                "python3",
                "-c",
                pyWriter,
                targetFile,
            ]);
            child.stdin.write(f.content);
            child.stdin.end();
            child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
            child.on("error", reject);
        });
    }
    const now = Date.now();
    activeTerminals.set(sessionId, {
        sessionId,
        containerName,
        createdAt: now,
        lastActiveAt: now,
    });
    return true;
}
async function execTerminalCommand(sessionId, cmd, cwd = "/home/student", timeoutMs = DEFAULT_TIMEOUT_MS) {
    const containerName = `cyberedu-term-${sessionId}`;
    const meta = activeTerminals.get(sessionId);
    if (meta) {
        meta.lastActiveAt = Date.now();
    }
    const safeCwd = cwd && cwd.startsWith("/home/student") ? cwd : "/home/student";
    const wrappedScript = `${cmd}\n__CYBEREDU_STATUS__=$?\necho "__CYBEREDU_CWD__"\npwd\nexit $__CYBEREDU_STATUS__`;
    return new Promise((resolve) => {
        const child = (0, child_process_1.spawn)("docker", [
            "exec",
            "-i",
            "--user",
            "10001:10001",
            "--workdir",
            safeCwd,
            containerName,
            "bash",
        ]);
        let stdout = "";
        let stderr = "";
        let isTimedOut = false;
        let isTruncated = false;
        const timer = setTimeout(() => {
            isTimedOut = true;
            child.kill("SIGKILL");
        }, timeoutMs);
        child.stdout.on("data", (data) => {
            if (!isTruncated) {
                stdout += data.toString("utf-8");
                if (stdout.length >= MAX_OUTPUT_BYTES) {
                    isTruncated = true;
                    stdout =
                        stdout.slice(0, MAX_OUTPUT_BYTES) +
                            "\n[... Chiqish hajmi 64KB dan oshgani sababli qisqartirildi ...]";
                }
            }
        });
        child.stderr.on("data", (data) => {
            if (stderr.length < MAX_OUTPUT_BYTES) {
                stderr += data.toString("utf-8");
            }
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            if (isTimedOut) {
                resolve({
                    stdout: "",
                    stderr: `Xavfsizlik chegarasi: Buyruq ${timeoutMs / 1000} soniya ichida tugallanmadi (Timeout).`,
                    exitCode: 124,
                    newCwd: safeCwd,
                });
                return;
            }
            const cwdMarker = "__CYBEREDU_CWD__";
            const markerIndex = stdout.lastIndexOf(cwdMarker);
            let cleanStdout = stdout;
            let newCwd = safeCwd;
            if (markerIndex !== -1) {
                cleanStdout = stdout.slice(0, markerIndex).replace(/\n$/, "");
                const cwdPart = stdout.slice(markerIndex + cwdMarker.length).trim();
                const lines = cwdPart.split("\n");
                if (lines.length > 0 && lines[0].startsWith("/")) {
                    newCwd = lines[0].trim();
                }
            }
            resolve({
                stdout: cleanStdout,
                stderr: stderr.trim(),
                exitCode: code ?? 0,
                newCwd,
            });
        });
        child.on("error", (err) => {
            clearTimeout(timer);
            resolve({
                stdout: "",
                stderr: `Jarayon xatosi: ${err.message}`,
                exitCode: 1,
                newCwd: safeCwd,
            });
        });
        child.stdin.write(wrappedScript);
        child.stdin.end();
    });
}
async function removeTerminalSandbox(sessionId) {
    const containerName = `cyberedu-term-${sessionId}`;
    activeTerminals.delete(sessionId);
    try {
        await execFileAsync("docker", ["rm", "-f", containerName]);
        return true;
    }
    catch {
        return false;
    }
}
async function startWebLabInstance(instanceId, labSlug, dynamicFlag, userId) {
    if (!WEBLAB_SLUGS.has(labSlug)) {
        return { success: false, error: `Noma'lum labSlug: ${labSlug}` };
    }
    if (activeWebLabs.size >= MAX_WEB_LABS) {
        return {
            success: false,
            error: `Hozirda barcha laboratoriya serverlari band (maksimal limitga yetildi: ${MAX_WEB_LABS} ta). Iltimos, bir necha daqiqadan so'ng qayta urinib ko'ring yoki faol instansiyangizni yakunlang.`,
        };
    }
    const containerName = `cyberedu-weblab-${instanceId}`;
    await stopWebLabInstance(instanceId).catch(() => { });
    const allocatedPort = allocateWebPort();
    const args = [
        "run",
        "-d",
        "--name",
        containerName,
        "--network",
        ISOLATED_NETWORK,
        "-p",
        `127.0.0.1:${allocatedPort}:8080`,
        "--memory",
        "128m",
        "--memory-swap",
        "128m",
        "--cpus",
        "0.50",
        "--pids-limit",
        "64",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--label",
        "io.cyberedu.weblab=true",
        "-e",
        `LAB_TYPE=${labSlug}`,
        "-e",
        `FLAG=${dynamicFlag}`,
        "-e",
        "PORT=8080",
        WEBLAB_IMAGE,
    ];
    try {
        await execFileAsync("docker", args);
        const now = Date.now();
        activeWebLabs.set(instanceId, {
            instanceId,
            containerName,
            labSlug,
            port: allocatedPort,
            createdAt: now,
            expiresAt: now + 30 * 60 * 1000, // 30 daqiqa
            userId,
        });
        return { success: true, port: allocatedPort };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[DAEMON] Weblab start xatosi (${instanceId}):`, msg);
        return { success: false, error: msg };
    }
}
async function stopWebLabInstance(instanceId) {
    const containerName = `cyberedu-weblab-${instanceId}`;
    activeWebLabs.delete(instanceId);
    try {
        await execFileAsync("docker", ["rm", "-f", containerName]);
        return true;
    }
    catch {
        return false;
    }
}
// ── Avtomatik Tozalagich (Reaper) ──────────────────────────────────────────
setInterval(async () => {
    const now = Date.now();
    // 10 daqiqa harakatsiz terminal sandbox'lar
    for (const [sId, meta] of activeTerminals.entries()) {
        if (now - meta.lastActiveAt > 10 * 60 * 1000) {
            console.log(`[REAPER] Terminal sandbox vaqti tugadi: ${sId}`);
            await removeTerminalSandbox(sId);
        }
    }
    // 30 daqiqa muddati o'tgan weblab instansiyalar
    for (const [instId, meta] of activeWebLabs.entries()) {
        if (now > meta.expiresAt) {
            console.log(`[REAPER] Weblab instansiya vaqti tugadi: ${instId}`);
            await stopWebLabInstance(instId);
        }
    }
}, 60 * 1000);
function parseAndVerifyRequest(req) {
    return new Promise((resolve) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => {
            const timestampStr = req.headers["x-daemon-timestamp"];
            const signature = req.headers["x-daemon-signature"];
            if (!timestampStr || !signature) {
                return resolve({
                    valid: false,
                    error: "Xavfsizlik xatosi: Imzosiz so'rov rad etildi (HMAC signature talab qilinadi)",
                    body: {},
                });
            }
            const timestamp = parseInt(timestampStr, 10);
            if (isNaN(timestamp) || Math.abs(Date.now() - timestamp) > 60000) {
                return resolve({
                    valid: false,
                    error: "Xavfsizlik xatosi: Imzo muddati o'tgan (Timestamp expired)",
                    body: {},
                });
            }
            const expectedSignature = crypto_1.default
                .createHmac("sha256", DAEMON_SECRET)
                .update(`${timestampStr}.${data}`)
                .digest("hex");
            let valid = false;
            try {
                valid = crypto_1.default.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"));
            }
            catch {
                valid = false;
            }
            if (!valid) {
                return resolve({
                    valid: false,
                    error: "Xavfsizlik xatosi: Noto'g'ri HMAC imzosi",
                    body: {},
                });
            }
            try {
                const body = data ? JSON.parse(data) : {};
                resolve({ valid: true, body });
            }
            catch {
                resolve({ valid: false, error: "Noto'g'ri JSON format", body: {} });
            }
        });
    });
}
function sendJson(res, code, payload) {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
}
const server = http_1.default.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method?.toUpperCase();
    // Health check - ochiq, monitoring uchun
    if (path === "/health" && method === "GET") {
        return sendJson(res, 200, {
            status: "ok",
            activeTerminals: activeTerminals.size,
            activeWebLabs: activeWebLabs.size,
        });
    }
    // Barcha boshqa chaqiruvlar HMAC imzo orqali autentifikatsiya qilinadi
    const verified = await parseAndVerifyRequest(req);
    if (!verified.valid) {
        return sendJson(res, 403, { error: verified.error || "Xavfsizlik xatosi" });
    }
    const body = verified.body;
    try {
        // 1. TERMINAL SANDBOX
        if (path === "/api/terminal/create" && method === "POST") {
            const { sessionId, files } = body;
            if (!sessionId || !SESSION_ID_REGEX.test(sessionId)) {
                return sendJson(res, 400, { error: "Noto'g'ri sessionId formati" });
            }
            const ok = await createTerminalSandbox(sessionId, files || []);
            return sendJson(res, ok ? 200 : 500, { success: ok });
        }
        if (path === "/api/terminal/exec" && method === "POST") {
            const { sessionId, command, cwd, timeoutMs } = body;
            if (!sessionId || !SESSION_ID_REGEX.test(sessionId)) {
                return sendJson(res, 400, { error: "Noto'g'ri sessionId" });
            }
            const result = await execTerminalCommand(sessionId, command || "", cwd, timeoutMs);
            return sendJson(res, 200, result);
        }
        if (path === "/api/terminal/destroy" && method === "POST") {
            const { sessionId } = body;
            if (!sessionId || !SESSION_ID_REGEX.test(sessionId)) {
                return sendJson(res, 400, { error: "Noto'g'ri sessionId" });
            }
            const ok = await removeTerminalSandbox(sessionId);
            return sendJson(res, 200, { success: ok });
        }
        // 2. WEB LAB INSTANCES
        if (path === "/api/weblab/start" && method === "POST") {
            const { instanceId, labSlug, dynamicFlag, userId } = body;
            if (!instanceId ||
                !INSTANCE_ID_REGEX.test(instanceId) ||
                !labSlug ||
                !LAB_SLUG_REGEX.test(labSlug) ||
                !dynamicFlag) {
                return sendJson(res, 400, { error: "Noto'g'ri instanceId, labSlug yoki dynamicFlag parametri" });
            }
            const resData = await startWebLabInstance(instanceId, labSlug, dynamicFlag, userId || "anonymous");
            return sendJson(res, resData.success ? 200 : 500, resData);
        }
        if (path === "/api/weblab/stop" && method === "POST") {
            const { instanceId } = body;
            if (!instanceId || !INSTANCE_ID_REGEX.test(instanceId)) {
                return sendJson(res, 400, { error: "Noto'g'ri instanceId" });
            }
            const ok = await stopWebLabInstance(instanceId);
            return sendJson(res, 200, { success: ok });
        }
        if (path.startsWith("/api/weblab/status/") && (method === "GET" || method === "POST")) {
            const instanceId = path.replace("/api/weblab/status/", "");
            if (!INSTANCE_ID_REGEX.test(instanceId)) {
                return sendJson(res, 400, { error: "Noto'g'ri instanceId" });
            }
            const meta = activeWebLabs.get(instanceId);
            if (!meta) {
                return sendJson(res, 404, { running: false, error: "Instansiya topilmadi" });
            }
            const remainingSeconds = Math.max(0, Math.floor((meta.expiresAt - Date.now()) / 1000));
            return sendJson(res, 200, {
                running: true,
                instanceId,
                port: meta.port,
                remainingSeconds,
            });
        }
        return sendJson(res, 404, { error: "Endpoint topilmadi" });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return sendJson(res, 500, { error: msg });
    }
});
async function main() {
    await cleanOrphanContainers();
    server.listen(DAEMON_PORT, "127.0.0.1", () => {
        console.log(`[CYBEREDU DAEMON] Sandbox sidecar demon 127.0.0.1:${DAEMON_PORT} portda ishga tushdi.`);
    });
}
main().catch(console.error);
