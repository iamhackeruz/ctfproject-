"use client";

import React, { useState, useEffect, useCallback } from "react";

interface SystemStatusData {
  success: boolean;
  timestamp: string;
  queryLatencyMs: number;
  database: {
    status: string;
    latencyMs: number;
    totalUsers: number;
  };
  sandboxDaemon: {
    status: string;
    latencyMs: number;
    activeTerminals: number;
    maxTerminals: number;
    activeWebLabs: number;
    maxWebLabs: number;
  };
  disk: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    freePercent: number;
  };
  storage: {
    videos: { count: number; sizeBytes: number };
    attachments: { count: number; sizeBytes: number };
  };
  latestBackup: {
    timestamp: string | null;
    filename: string | null;
    sizeBytes: number | null;
  } | null;
  latestCron: {
    timestamp: string;
    action: string;
    details: string;
  } | null;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function AdminHealthTab() {
  const [data, setData] = useState<SystemStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/system-status");
      if (!res.ok) {
        throw new Error(`Xato: Server ${res.status} javob berdi`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Tizim holatini yuklab bo'lmadi");
      }
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStatus]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Sarlavha va boshqaruv */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          background: "var(--card-bg, #111827)",
          padding: "1.25rem 1.5rem",
          borderRadius: "0.75rem",
          border: "1px solid var(--border-color, #374151)",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "#f9fafb" }}>
            🖥️ Server va Tizim Holati Monitoringi
          </h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#9ca3af" }}>
            Real vaqt rejimida ma&apos;lumotlar bazasi, sandbox demoni, disk va xotira monitoringi
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "#d1d5db", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            Har 30s da yangilash
          </label>

          <button
            onClick={fetchStatus}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              backgroundColor: "var(--accent-color, #2563eb)",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 500,
              fontSize: "0.875rem",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Yuklanmoqda..." : "🔄 Yangilash"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "1rem", background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", borderRadius: "0.5rem", color: "#f87171" }}>
          ⚠️ {error}
        </div>
      )}

      {data && (
        <>
          {/* Asosiy 4 ta Status Kartochkalari */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
            {/* 1. Baza */}
            <div style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "0.75rem", padding: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.875rem", color: "#9ca3af", fontWeight: 600 }}>MA&apos;LUMOTLAR BAZASI</span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "0.2rem 0.5rem",
                    borderRadius: "9999px",
                    backgroundColor: data.database.status === "up" ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                    color: data.database.status === "up" ? "#4ade80" : "#f87171",
                  }}
                >
                  {data.database.status === "up" ? "FAOL (UP)" : "UZILGAN"}
                </span>
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f9fafb" }}>PostgreSQL 16</div>
              <div style={{ fontSize: "0.875rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                Kechikish: <span style={{ color: "#38bdf8" }}>{data.database.latencyMs} ms</span>
              </div>
              <div style={{ fontSize: "0.875rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                Foydalanuvchilar: <span style={{ color: "#f3f4f6" }}>{data.database.totalUsers} ta</span>
              </div>
            </div>

            {/* 2. Daemon */}
            <div style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "0.75rem", padding: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.875rem", color: "#9ca3af", fontWeight: 600 }}>SANDBOX DAEMON</span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "0.2rem 0.5rem",
                    borderRadius: "9999px",
                    backgroundColor: data.sandboxDaemon.status === "up" ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                    color: data.sandboxDaemon.status === "up" ? "#4ade80" : "#f87171",
                  }}
                >
                  {data.sandboxDaemon.status === "up" ? "ISHCHI (PORT 5055)" : "TO'XTAGAN"}
                </span>
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f9fafb" }}>
                {data.sandboxDaemon.activeTerminals + data.sandboxDaemon.activeWebLabs} ta faol
              </div>
              <div style={{ fontSize: "0.875rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                Terminallar: <span style={{ color: "#38bdf8" }}>{data.sandboxDaemon.activeTerminals} / {data.sandboxDaemon.maxTerminals}</span>
              </div>
              <div style={{ fontSize: "0.875rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                Veb-lablar: <span style={{ color: "#38bdf8" }}>{data.sandboxDaemon.activeWebLabs} / {data.sandboxDaemon.maxWebLabs}</span>
              </div>
            </div>

            {/* 3. Disk */}
            <div style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "0.75rem", padding: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.875rem", color: "#9ca3af", fontWeight: 600 }}>DISK XOTIRASI</span>
                <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#38bdf8" }}>
                  {data.disk.freePercent}% bo&apos;sh
                </span>
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f9fafb" }}>
                {formatBytes(data.disk.freeBytes)} bo&apos;sh
              </div>
              <div style={{ width: "100%", height: "8px", background: "#374151", borderRadius: "4px", marginTop: "0.5rem", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, 100 - data.disk.freePercent))}%`,
                    height: "100%",
                    background: data.disk.freePercent < 15 ? "#ef4444" : "#10b981",
                  }}
                />
              </div>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.35rem" }}>
                Jami: {formatBytes(data.disk.totalBytes)} | Band: {formatBytes(data.disk.usedBytes)}
              </div>
            </div>

            {/* 4. Fayllar hajmi */}
            <div style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "0.75rem", padding: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.875rem", color: "#9ca3af", fontWeight: 600 }}>FAYLLAR VA MEDIALAR</span>
                <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Mahalliy</span>
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f9fafb" }}>
                {formatBytes(data.storage.videos.sizeBytes + data.storage.attachments.sizeBytes)}
              </div>
              <div style={{ fontSize: "0.875rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                Videolar: <span style={{ color: "#f3f4f6" }}>{data.storage.videos.count} ta ({formatBytes(data.storage.videos.sizeBytes)})</span>
              </div>
              <div style={{ fontSize: "0.875rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                Birikmalar: <span style={{ color: "#f3f4f6" }}>{data.storage.attachments.count} ta ({formatBytes(data.storage.attachments.sizeBytes)})</span>
              </div>
            </div>
          </div>

          {/* Fon Vazifalari va Zaxiralar Bloki */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
            {/* Oxirgi Zaxira */}
            <div style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "0.75rem", padding: "1.25rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#f9fafb", margin: "0 0 0.75rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                🛡️ Ma&apos;lumotlar Bazasi Zaxirasi (Backups)
              </h3>
              {data.latestBackup?.timestamp ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.875rem", color: "#d1d5db" }}>
                  <div>
                    <span style={{ color: "#9ca3af" }}>Oxirgi zaxira vaqti:</span>{" "}
                    <strong>{new Date(data.latestBackup.timestamp).toLocaleString("uz-UZ")}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#9ca3af" }}>Fayl:</span>{" "}
                    <code style={{ background: "#111827", padding: "0.1rem 0.3rem", borderRadius: "0.25rem" }}>
                      {data.latestBackup.filename}
                    </code>
                  </div>
                  {data.latestBackup.sizeBytes && (
                    <div>
                      <span style={{ color: "#9ca3af" }}>Arxiv hajmi:</span>{" "}
                      <strong>{formatBytes(data.latestBackup.sizeBytes)}</strong>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: "0.875rem", color: "#9ca3af", margin: 0 }}>
                  Hozircha zaxira nusxasi topilmadi (Crontab jadvali bo&apos;yicha har kecha olinadi).
                </p>
              )}
            </div>

            {/* Oxirgi Cron */}
            <div style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "0.75rem", padding: "1.25rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#f9fafb", margin: "0 0 0.75rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                ⏱️ Rejali Vazifalar (Cron Reminders)
              </h3>
              {data.latestCron ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.875rem", color: "#d1d5db" }}>
                  <div>
                    <span style={{ color: "#9ca3af" }}>Oxirgi ishga tushishi:</span>{" "}
                    <strong>{new Date(data.latestCron.timestamp).toLocaleString("uz-UZ")}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#9ca3af" }}>Vazifa:</span>{" "}
                    <code style={{ background: "#111827", padding: "0.1rem 0.3rem", borderRadius: "0.25rem" }}>
                      {data.latestCron.action}
                    </code>
                  </div>
                  {data.latestCron.details && (
                    <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                      Tafsilotlar: {data.latestCron.details}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: "0.875rem", color: "#9ca3af", margin: 0 }}>
                  Rejali vazifalar (har 10 daqiqada /api/cron/reminders) hali ishga tushmagan.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
