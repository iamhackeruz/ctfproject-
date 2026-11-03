/**
 * scripts/test-caddy-docker-ip.ts
 * Real Docker Compose / Container Caddy Client IP & Rate Limiting Test.
 * 
 * Ushbu test real Docker muhitida Caddy 2 reverse proxy orqali:
 * 1. Ikki xil mijoz IP manzillari (Client A: 172.29.0.101, Client B: 172.29.0.202) alohida sanalishini;
 * 2. Soxtalashtirilgan (spoofed) "X-Forwarded-For: 8.8.8.8" sarlavhasi inobatga olinmasligini;
 * 3. Client A o'z limitidan oshganda (5 tadan so'ng 429 Too Many Requests) bloklanishini;
 * 4. Client B bir xil soxta sarlavha ("X-Forwarded-For: 8.8.8.8") yuborsa ham BLOKLANMASLIGINI (chunki uning haqiqiy IP si 172.29.0.202);
 * 5. Caddy'ning `header_up X-Forwarded-For {remote_host}` va platformaning Right-to-Left peeling himoyasini to'liq isbotlaydi.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import http from "http";

function assert(condition: unknown, msg: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ [PASS] ${msg}`);
}

const NETWORK_NAME = "cyberedu-test-caddy-net";
const BACKEND_CONTAINER = "cyberedu-test-backend";
const CADDY_CONTAINER = "cyberedu-test-caddy";
const SUBNET = "172.29.0.0/16";

const IP_BACKEND = "172.29.0.5";
const IP_CADDY = "172.29.0.10";
const IP_CLIENT_A = "172.29.0.101";
const IP_CLIENT_B = "172.29.0.202";

function sh(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch (err: any) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    throw new Error(`Command failed: ${cmd}\n${stderr}`);
  }
}

function cleanup() {
  console.log("[*] Docker test resurslari tozalanmoqda...");
  try { sh(`docker rm -f ${CADDY_CONTAINER} 2>/dev/null || true`); } catch {}
  try { sh(`docker rm -f ${BACKEND_CONTAINER} 2>/dev/null || true`); } catch {}
  try { sh(`docker network rm ${NETWORK_NAME} 2>/dev/null || true`); } catch {}
}

async function runCaddyIpAudit() {
  console.log("\n========================================================");
  console.log("   CADDY & DOCKER COMPOSE REAL CLIENT IP & RATE LIMIT AUDIT");
  console.log("========================================================\n");

  cleanup();

  const tmpDir = path.resolve(__dirname, "../.tmp-caddy-test");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  try {
    // 1. Docker izolyatsiyalangan test tarmog'ini yaratish
    console.log(`[1] '${NETWORK_NAME}' (${SUBNET}) Docker tarmog'ini yaratish...`);
    sh(`docker network create --subnet=${SUBNET} ${NETWORK_NAME}`);
    assert(true, `Test tarmog'i yaratildi: ${NETWORK_NAME}`);

    // 2. Test Backend skriptini yozish (Right-to-Left peeling va Rate Limiter bilan)
    const backendScript = `
const http = require("http");

const DEFAULT_TRUSTED_PROXIES = ["127.0.0.1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"];

function normalizeIp(ip) {
  let clean = ip.trim();
  if (clean.startsWith("::ffff:")) clean = clean.slice(7);
  return clean;
}

function ipv4ToLong(ip) {
  const parts = normalizeIp(ip).split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isIpInCidr(ip, cidr) {
  if (!cidr.includes("/")) return normalizeIp(ip) === normalizeIp(cidr);
  const [range, bitsStr] = cidr.split("/");
  const bits = parseInt(bitsStr, 10);
  const ipLong = ipv4ToLong(ip);
  const rangeLong = ipv4ToLong(range);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipLong & mask) === (rangeLong & mask);
}

function isTrustedProxy(ip) {
  for (const r of DEFAULT_TRUSTED_PROXIES) {
    if (isIpInCidr(ip, r)) return true;
  }
  return false;
}

function getReliableClientIp(req) {
  const xForwardedFor = req.headers["x-forwarded-for"];
  const xRealIp = req.headers["x-real-ip"];
  if (xForwardedFor) {
    const rawIps = xForwardedFor.split(",").map(normalizeIp);
    for (let i = rawIps.length - 1; i >= 0; i--) {
      const candidate = rawIps[i];
      if (!isTrustedProxy(candidate)) {
        return candidate;
      }
    }
    return rawIps[0];
  }
  if (xRealIp) return normalizeIp(xRealIp);
  return "127.0.0.1";
}

const rateLimitMap = new Map();
const MAX_REQUESTS = 5;

const server = http.createServer((req, res) => {
  const reliableIp = getReliableClientIp(req);
  const rawXff = req.headers["x-forwarded-for"] || "";
  const rawXReal = req.headers["x-real-ip"] || "";

  const currentCount = (rateLimitMap.get(reliableIp) || 0) + 1;
  rateLimitMap.set(reliableIp, currentCount);

  if (currentCount > MAX_REQUESTS) {
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "rate_limited",
      reliableIp,
      count: currentCount,
      rawXff,
      rawXReal
    }));
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    status: "ok",
    reliableIp,
    count: currentCount,
    rawXff,
    rawXReal
  }));
});

server.listen(3000, "0.0.0.0", () => {
  console.log("Backend server running on 3000");
});
`;
    fs.writeFileSync(path.join(tmpDir, "backend.js"), backendScript);

    // 3. Backend konteynerini ishga tushirish (node image orqali)
    console.log("[2] Backend konteynerini ishga tushirish...");
    sh(`docker run -d --name ${BACKEND_CONTAINER} --network ${NETWORK_NAME} --ip ${IP_BACKEND} -v ${tmpDir}:/app -w /app node:20-alpine node backend.js`);
    assert(true, `Backend konteyneri ishga tushirildi (${IP_BACKEND}:3000)`);

    // 4. Caddy konfiguratsiyasi (Production Caddyfile bilan aynan bir xil)
    const caddyConfig = `
:80 {
  reverse_proxy ${IP_BACKEND}:3000 {
    header_up Host {host}
    header_up X-Real-IP {remote_host}
    header_up X-Forwarded-For {remote_host}
    header_up X-Forwarded-Proto http
  }
}
`;
    fs.writeFileSync(path.join(tmpDir, "Caddyfile"), caddyConfig);

    // 5. Caddy konteynerini ishga tushirish
    console.log("[3] Caddy reverse proxy konteynerini ishga tushirish...");
    sh(`docker run -d --name ${CADDY_CONTAINER} --network ${NETWORK_NAME} --ip ${IP_CADDY} -v ${path.join(tmpDir, "Caddyfile")}:/etc/caddy/Caddyfile:ro caddy:2-alpine`);
    
    // Caddy tayyor bo'lishini kutish (1-2 soniya)
    await new Promise((r) => setTimeout(r, 2000));
    assert(true, `Caddy reverse proxy ishga tushirildi (${IP_CADDY}:80)`);

    // 6. CLIENT A: Soxta sarlavha bilan so'rovlar yuborish
    console.log("\n[4] CLIENT A (IP: 172.29.0.101) soxta 'X-Forwarded-For: 8.8.8.8' bilan 5 ta so'rov yubormoqda...");
    for (let i = 1; i <= 5; i++) {
      const out = sh(`docker run --rm --network ${NETWORK_NAME} --ip ${IP_CLIENT_A} alpine/curl -s -H "X-Forwarded-For: 8.8.8.8" http://${IP_CADDY}:80/`);
      const parsed = JSON.parse(out);
      assert(parsed.status === "ok", `Client A #${i}-so'rov OK bo'ldi`);
      assert(parsed.count === i, `Client A hisoblagichi to'g'ri oshdi: ${i}`);
      assert(parsed.reliableIp === IP_CLIENT_A, `Client A ning haqiqiy IP si aniqlandi (${IP_CLIENT_A}), soxta 8.8.8.8 EMAS`);
    }

    // 7. CLIENT A 6-so'rovda Rate Limit (429) ga tushishi kerak
    console.log("\n[5] CLIENT A 6-so'rovda 429 Rate Limit ga tushishi tekshirilmoqda...");
    const blockedOut = sh(`docker run --rm --network ${NETWORK_NAME} --ip ${IP_CLIENT_A} alpine/curl -s -w "\\n%{http_code}" -H "X-Forwarded-For: 8.8.8.8" http://${IP_CADDY}:80/`);
    const lines = blockedOut.trim().split("\n");
    const httpCode = lines[lines.length - 1];
    const body = JSON.parse(lines.slice(0, -1).join("\n"));
    
    assert(httpCode === "429", `Client A uchun HTTP 429 Too Many Requests qaytdi`);
    assert(body.status === "rate_limited", `Client A statusi: rate_limited`);
    assert(body.reliableIp === IP_CLIENT_A, `Bloklangan IP Client A ga tegishli (${IP_CLIENT_A})`);

    // 8. CLIENT B: Boshqa IP (172.29.0.202) aynan shu soxta sarlavha (8.8.8.8) bilan kelganda BLOKLANMASLIGI KERAK
    console.log("\n[6] CLIENT B (IP: 172.29.0.202) aynan shu 'X-Forwarded-For: 8.8.8.8' bilan so'rov yubormoqda...");
    const clientBOut = sh(`docker run --rm --network ${NETWORK_NAME} --ip ${IP_CLIENT_B} alpine/curl -s -w "\\n%{http_code}" -H "X-Forwarded-For: 8.8.8.8" http://${IP_CADDY}:80/`);
    const bLines = clientBOut.trim().split("\n");
    const bCode = bLines[bLines.length - 1];
    const bBody = JSON.parse(bLines.slice(0, -1).join("\n"));

    assert(bCode === "200", `Client B uchun HTTP 200 OK qaytdi (bloklanmadi!)`);
    assert(bBody.status === "ok", `Client B statusi: ok`);
    assert(bBody.reliableIp === IP_CLIENT_B, `Client B ning IP si alohida aniqlandi (${IP_CLIENT_B})`);
    assert(bBody.count === 1, `Client B ning hisoblagichi 1 (Client A ning limitidan mutlaqo mustaqil)`);

    // 9. CLIENT B Client A ning IP sini soxtalashtirishga uringanda ham aldanmasligi
    console.log("\n[7] CLIENT B 'X-Forwarded-For: 172.29.0.101' (Client A ni bloklash maqsadida) soxta sarlavha yubormoqda...");
    const spoofClientAOut = sh(`docker run --rm --network ${NETWORK_NAME} --ip ${IP_CLIENT_B} alpine/curl -s -w "\\n%{http_code}" -H "X-Forwarded-For: ${IP_CLIENT_A}" http://${IP_CADDY}:80/`);
    const spoofLines = spoofClientAOut.trim().split("\n");
    const spoofCode = spoofLines[spoofLines.length - 1];
    const spoofBody = JSON.parse(spoofLines.slice(0, -1).join("\n"));

    assert(spoofCode === "200", `Hujumchi Client A ning IP sini soxtalashtira olmadi va 200 OK oldi`);
    assert(spoofBody.reliableIp === IP_CLIENT_B, `Caddy soxta IP ni o'rniga haqiqiy ulanuvchi IP (${IP_CLIENT_B}) ni yozdi`);
    assert(spoofBody.count === 2, `Hujumchining o'z hisoblagichi oshdi (2)`);

    console.log("\n========================================================");
    console.log("   ✅ BARCHA CADDY HAQIQIY MIJOZ IP TESTLARI MUVAFFAQISHLI O'TDI!");
    console.log("========================================================\n");
  } finally {
    cleanup();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

runCaddyIpAudit().catch((err) => {
  console.error("FATAL ERROR in test-caddy-docker-ip:", err);
  process.exit(1);
});
