"use client";

import { useState, useEffect, useCallback } from "react";

interface InstanceItem {
  id: string;
  type: string;
  labId: string;
  labTitle: string;
  category: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  hostPort: number;
  createdAt: string;
  expiresAt: string;
  remainingMinutes: number;
  containerId: string;
}

interface SidecarStats {
  status: string;
  activeTerminals: number;
  activeWebLabs: number;
  globalLimit: number;
}

export default function AdminInstancesTab() {
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [stats, setStats] = useState<SidecarStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/instances");
      const data = await res.json();
      if (data.success) {
        setInstances(data.instances || []);
        setStats(data.stats || null);
      } else {
        setError(data.error || "Instansiyalarni yuklashda xatolik.");
      }
    } catch {
      setError("Server bilan aloqada xatolik.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInstances();
    const interval = setInterval(fetchInstances, 10000); // 10 soniyada yangilash
    return () => clearInterval(interval);
  }, [fetchInstances]);

  const handleForceStop = async (inst: InstanceItem) => {
    if (!confirm(`'${inst.labTitle}' instansiyasini (${inst.user.name}) majburan to'xtatmoqchimisiz?`)) return;

    try {
      const res = await fetch(`/api/admin/instances?id=${inst.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setMsg("Instansiya majburan to'xtatildi.");
        fetchInstances();
      } else {
        setError(data.error || "To'xtatishda xatolik.");
      }
    } catch {
      setError("Server xatosi.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>⚡ Faol Konteynerlar va Instansiyalar</h2>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
            Real vaqtda ishlab turgan Docker terminal va izolyatsiyalangan veb-laboratoriyalar monitoringi
          </p>
        </div>

        <button type="button" className="btn btn-outline" onClick={fetchInstances}>
          🔄 Yangilash
        </button>
      </div>

      {msg && (
        <div style={{ background: "rgba(52, 211, 153, 0.12)", border: "1px solid rgba(52, 211, 153, 0.3)", color: "#34d399", padding: "10px 14px", borderRadius: 8, fontSize: "0.88rem" }}>
          ✅ {msg}
        </div>
      )}

      {error && (
        <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", padding: "10px 14px", borderRadius: 8, fontSize: "0.88rem" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Global Limit & Resource Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Faol Veb Laboratoriyalar</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#38bdf8", marginTop: 4 }}>
            {stats?.activeWebLabs ?? instances.length} ta
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4 }}>
            Global Limit: {stats?.globalLimit ?? 20} ta
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Faol Terminal Sandboxlari</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#34d399", marginTop: 4 }}>
            {stats?.activeTerminals ?? 0} ta
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4 }}>
            Docker sidecar daemon orqali
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Daemon Statusi</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: stats?.status === "ok" ? "#34d399" : "#f87171", marginTop: 4 }}>
            {stats?.status === "ok" ? "🟢 Normal" : "🔴 Aloqasiz"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4 }}>
            Port: 5055 (Izolyatsiya qilingan)
          </div>
        </div>
      </div>

      {/* Running Instances Table */}
      <div className="card" style={{ padding: 20, overflowX: "auto" }}>
        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 14 }}>Faol Veb Konteynerlar Jadvali</h3>
        {loading && instances.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#38bdf8" }}>Instansiyalar tekshirilmoqda...</div>
        ) : instances.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>Hozirda birorta ham faol web-lab instansiyasi yo&apos;q.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155", textAlign: "left", color: "#94a3b8" }}>
                <th style={{ padding: "10px 8px" }}>Talaba</th>
                <th style={{ padding: "10px 8px" }}>Laboratoriya</th>
                <th style={{ padding: "10px 8px" }}>Host Port</th>
                <th style={{ padding: "10px 8px" }}>Boshlangan Vaqt</th>
                <th style={{ padding: "10px 8px" }}>Qolgan Vaqt</th>
                <th style={{ padding: "10px 8px", textAlign: "right" }}>Amal</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((inst) => (
                <tr key={inst.id} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "12px 8px" }}>
                    <div style={{ fontWeight: 600, color: "#f8fafc" }}>{inst.user.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{inst.user.email}</div>
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    <div style={{ fontWeight: 600, color: "#38bdf8" }}>{inst.labTitle}</div>
                    <span className="badge badge-blue" style={{ fontSize: "0.72rem" }}>{inst.category}</span>
                  </td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#f59e0b" }}>
                    :{inst.hostPort}
                  </td>
                  <td style={{ padding: "12px 8px", fontSize: "0.82rem", color: "#94a3b8" }}>
                    {new Date(inst.createdAt).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    <span className="badge" style={{ background: inst.remainingMinutes < 10 ? "rgba(239, 68, 68, 0.2)" : "rgba(52, 211, 153, 0.2)", color: inst.remainingMinutes < 10 ? "#f87171" : "#34d399" }}>
                      ⏱️ {inst.remainingMinutes} daqiqa
                    </span>
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "right" }}>
                    <button
                      type="button"
                      style={{ background: "#7f1d1d", color: "#fca5a5", border: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: "0.78rem" }}
                      onClick={() => handleForceStop(inst)}
                    >
                      Majburan To&apos;xtatish
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
