"use client";

import { useState, useEffect, useCallback } from "react";

interface AuditLogItem {
  id: string;
  userId: string | null;
  userName: string;
  userEmail: string;
  userRole: string;
  ip: string;
  action: string;
  status: string;
  details: unknown;
  createdAt: string;
}

export default function AdminAuditLogsTab() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [error, setError] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (actionFilter) params.set("action", actionFilter);
      if (userFilter) params.set("userId", userFilter);

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        setError(data.error || "Audit loglarni yuklashda xatolik.");
      }
    } catch {
      setError("Server bilan aloqada xatolik.");
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, userFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>📜 Xavfsizlik va Ma&apos;muriy Audit Loglari</h2>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
            Barcha xavfsizlik hodisalari, tizimga kirishlar, rol o&apos;zgarishlari va ma&apos;lumotlar tahrirlari (Jami: {total} ta yozuv)
          </p>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", padding: "10px 14px", borderRadius: 8, fontSize: "0.88rem" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Filter bar */}
      <div className="card" style={{ padding: "14px 18px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div>
            <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Amal Turi (Action)</label>
            <input
              type="text"
              className="input"
              placeholder="Masalan: LOGIN, USER_ROLE_CHANGE, COURSE_DELETE..."
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Foydalanuvchi ID</label>
            <input
              type="text"
              className="input"
              placeholder="Foydalanuvchi ID bo'yicha..."
              value={userFilter}
              onChange={(e) => {
                setUserFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card" style={{ padding: 20, overflowX: "auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#38bdf8" }}>Loglar yuklanmoqda...</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>Mos audit loglar topilmadi.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155", textAlign: "left", color: "#94a3b8" }}>
                <th style={{ padding: "10px 8px" }}>Vaqt</th>
                <th style={{ padding: "10px 8px" }}>Foydalanuvchi</th>
                <th style={{ padding: "10px 8px" }}>IP Manzil</th>
                <th style={{ padding: "10px 8px" }}>Amal (Action)</th>
                <th style={{ padding: "10px 8px" }}>Holat</th>
                <th style={{ padding: "10px 8px" }}>Tafsilotlar (Niqoblangan)</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "10px 8px", color: "#94a3b8", whiteSpace: "nowrap" }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    <div style={{ fontWeight: 600, color: "#f8fafc" }}>{log.userName}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{log.userEmail} ({log.userRole})</div>
                  </td>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", color: "#38bdf8" }}>
                    {log.ip}
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    <code style={{ background: "#0f172a", border: "1px solid #334155", padding: "2px 6px", borderRadius: 4, color: "#f59e0b" }}>
                      {log.action}
                    </code>
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    <span className={`badge ${log.status === "SUCCESS" ? "badge-green" : "badge-orange"}`}>
                      {log.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 8px", maxWidth: 300, wordBreak: "break-all" }}>
                    <pre style={{ margin: 0, fontSize: "0.75rem", color: "#cbd5e1", maxHeight: 60, overflowY: "auto", background: "#090d16", padding: 6, borderRadius: 4 }}>
                      {typeof log.details === "object" ? JSON.stringify(log.details, null, 2) : String(log.details || "—")}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
            <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
              Sahifa: {page} / {totalPages}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                style={{ padding: "4px 12px", fontSize: "0.8rem" }}
              >
                Oldingi
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{ padding: "4px 12px", fontSize: "0.8rem" }}
              >
                Keyingi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
