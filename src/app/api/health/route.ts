import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs";

export const dynamic = "force-dynamic";

const DAEMON_URL = process.env.SANDBOX_DAEMON_URL || "http://127.0.0.1:5055";

export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();
  let dbStatus = "down";
  let dbLatencyMs = 0;
  let daemonStatus = "down";
  let daemonLatencyMs = 0;
  let diskStatus = "ok";
  let freeBytes = 0;
  let totalBytes = 0;
  let freePercent = 0;

  // 1. Ma'lumotlar bazasi tekshiruvi
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
    dbStatus = "up";
  } catch {
    dbStatus = "down";
  }

  // 2. Sandbox Daemon tekshiruvi
  try {
    const daemonStart = Date.now();
    const daemonRes = await fetch(`${DAEMON_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    if (daemonRes.ok) {
      daemonStatus = "up";
      daemonLatencyMs = Date.now() - daemonStart;
    }
  } catch {
    daemonStatus = "down";
  }

  // 3. Disk xotirasi tekshiruvi
  try {
    const stats = await fs.promises.statfs("/");
    totalBytes = stats.blocks * stats.bsize;
    freeBytes = stats.bavail * stats.bsize;
    freePercent = totalBytes > 0 ? Math.round((freeBytes / totalBytes) * 1000) / 10 : 0;
    // Agar bo'sh joy 500 MB dan kam qolgan bo'lsa
    if (freeBytes < 500 * 1024 * 1024) {
      diskStatus = "critical_low";
    } else if (freeBytes < 2 * 1024 * 1024 * 1024) {
      diskStatus = "low";
    }
  } catch {
    diskStatus = "unknown";
  }

  const isHealthy = dbStatus === "up";
  const overallStatus = isHealthy && daemonStatus === "up" && diskStatus !== "critical_low"
    ? "ok"
    : isHealthy
    ? "degraded"
    : "unhealthy";

  const responseBody = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    services: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      sandboxDaemon: {
        status: daemonStatus,
        latencyMs: daemonLatencyMs,
      },
      storage: {
        status: diskStatus,
        freeBytes,
        totalBytes,
        freePercent,
      },
    },
  };

  return NextResponse.json(responseBody, {
    status: isHealthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
