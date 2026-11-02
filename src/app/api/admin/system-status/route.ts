import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security/session";
import { Role } from "@prisma/client";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DAEMON_URL = process.env.SANDBOX_DAEMON_URL || "http://127.0.0.1:5055";
const VIDEO_DIR = process.env.VIDEO_DIR || path.resolve(process.cwd(), "data/videos");
const ATTACHMENTS_DIR = process.env.ATTACHMENTS_DIR || path.resolve(process.cwd(), "data/attachments");

async function getDirectoryStats(dirPath: string): Promise<{ count: number; totalBytes: number }> {
  try {
    if (!fs.existsSync(dirPath)) return { count: 0, totalBytes: 0 };
    const files = await fs.promises.readdir(dirPath);
    let totalBytes = 0;
    let count = 0;
    for (const f of files) {
      const fullPath = path.join(dirPath, f);
      const st = await fs.promises.stat(fullPath);
      if (st.isFile()) {
        count++;
        totalBytes += st.size;
      }
    }
    return { count, totalBytes };
  } catch {
    return { count: 0, totalBytes: 0 };
  }
}

async function getLatestBackupInfo(): Promise<{ timestamp: string | null; filename: string | null; sizeBytes: number | null }> {
  const possibleDirs = [
    "/var/backups/cyberedu",
    path.resolve(process.cwd(), "backups/db"),
    path.resolve(process.cwd(), "backups"),
  ];

  for (const dir of possibleDirs) {
    try {
      if (fs.existsSync(dir)) {
        const files = await fs.promises.readdir(dir);
        const backupFiles = files.filter((f) => f.endsWith(".sql.gz") || f.endsWith(".tar.gz"));
        if (backupFiles.length > 0) {
          backupFiles.sort((a, b) => b.localeCompare(a));
          const latestFile = backupFiles[0];
          const st = await fs.promises.stat(path.join(dir, latestFile));
          return {
            timestamp: st.mtime.toISOString(),
            filename: latestFile,
            sizeBytes: st.size,
          };
        }
      }
    } catch {}
  }
  return { timestamp: null, filename: null, sizeBytes: null };
}

// GET /api/admin/system-status — Tizim holati, disk va xizmatlar statistikasi (Faqat ADMIN / INSTRUCTOR)
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req, [Role.admin, Role.instructor]);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const startTime = Date.now();

    // 1. Database
    let dbStatus = "up";
    let dbLatencyMs = 0;
    let totalUsers = 0;
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStart;
      totalUsers = await prisma.user.count();
    } catch {
      dbStatus = "down";
    }

    // 2. Sandbox Daemon
    let daemonStatus = "down";
    let daemonLatencyMs = 0;
    let activeTerminals = 0;
    let activeWebLabs = 0;
    try {
      const daemonStart = Date.now();
      const daemonRes = await fetch(`${DAEMON_URL}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      if (daemonRes.ok) {
        daemonStatus = "up";
        daemonLatencyMs = Date.now() - daemonStart;
        const dData = (await daemonRes.json()) as { activeTerminals?: number; activeWebLabs?: number };
        activeTerminals = dData.activeTerminals || 0;
        activeWebLabs = dData.activeWebLabs || 0;
      }
    } catch {
      daemonStatus = "down";
    }

    // 3. Disk xotirasi
    let totalDiskBytes = 0;
    let freeDiskBytes = 0;
    let freeDiskPercent = 0;
    try {
      const stats = await fs.promises.statfs("/");
      totalDiskBytes = stats.blocks * stats.bsize;
      freeDiskBytes = stats.bavail * stats.bsize;
      freeDiskPercent = totalDiskBytes > 0 ? Math.round((freeDiskBytes / totalDiskBytes) * 1000) / 10 : 0;
    } catch {}

    // 4. Video va birikmalar statistikasi
    const [videoStats, attachmentStats] = await Promise.all([
      getDirectoryStats(VIDEO_DIR),
      getDirectoryStats(ATTACHMENTS_DIR),
    ]);

    // 5. Oxirgi zaxira va cron ma'lumotlari
    const [latestBackup, lastCronLog] = await Promise.all([
      getLatestBackupInfo(),
      prisma.auditLog.findFirst({
        where: { action: { startsWith: "CRON_" } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, action: true, details: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      queryLatencyMs: Date.now() - startTime,
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        totalUsers,
      },
      sandboxDaemon: {
        status: daemonStatus,
        latencyMs: daemonLatencyMs,
        activeTerminals,
        maxTerminals: parseInt(process.env.MAX_TERMINALS || "15", 10),
        activeWebLabs,
        maxWebLabs: parseInt(process.env.MAX_WEB_LABS || "4", 10),
      },
      disk: {
        totalBytes: totalDiskBytes,
        freeBytes: freeDiskBytes,
        usedBytes: totalDiskBytes - freeDiskBytes,
        freePercent: freeDiskPercent,
      },
      storage: {
        videos: {
          count: videoStats.count,
          sizeBytes: videoStats.totalBytes,
        },
        attachments: {
          count: attachmentStats.count,
          sizeBytes: attachmentStats.totalBytes,
        },
      },
      latestBackup,
      latestCron: lastCronLog
        ? {
            timestamp: lastCronLog.createdAt.toISOString(),
            action: lastCronLog.action,
            details: lastCronLog.details,
          }
        : null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Tizim holatini yuklashda kutilmagan xato";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
