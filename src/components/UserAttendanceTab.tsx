"use client";

import { useState, useEffect } from "react";

interface AttendanceStats {
  totalSessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  percentage: number;
  isAtRisk: boolean;
}

interface AttendanceSessionItem {
  sessionId: string;
  sessionDate: string;
  topic: string;
  groupName: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  note: string | null;
  markedAt: string | null;
  markedBy: string | null;
}

export default function UserAttendanceTab() {
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [sessions, setSessions] = useState<AttendanceSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/user/attendance");
        if (!res.ok) throw new Error("Davomat ma'lumotlarini yuklab bo'lmadi");
        const data = await res.json();
        if (data.success) {
          setStats(data.stats);
          setSessions(data.sessions || []);
        } else {
          setError(data.error);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Xatolik");
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PRESENT":
        return <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: "0.75rem", backgroundColor: "#22c55e22", color: "#4ade80", border: "1px solid #22c55e" }}>Qatnashdi</span>;
      case "ABSENT":
        return <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: "0.75rem", backgroundColor: "#ef444422", color: "#f87171", border: "1px solid #ef4444" }}>Qoldirdi</span>;
      case "LATE":
        return <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: "0.75rem", backgroundColor: "#eab30822", color: "#facc15", border: "1px solid #eab308" }}>Kechikdi</span>;
      case "EXCUSED":
        return <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: "0.75rem", backgroundColor: "#38bdf822", color: "#38bdf8", border: "1px solid #38bdf8" }}>Sababli</span>;
      default:
        return <span>{status}</span>;
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Davomat yuklanmoqda...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 20, backgroundColor: "#ef444422", color: "#f87171", borderRadius: 8, margin: "20px 0" }}>
        Xatolik: {error}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f8fafc" }}>Mening davomatim</h2>
        <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: 4 }}>
          Guruh mashg&apos;ulotlarida ishtirokingiz va darslar tarixi
        </p>
      </div>

      {/* Statistika Kartalari */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 24 }}>
          <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: stats.percentage >= 80 ? "#4ade80" : stats.percentage >= 60 ? "#facc15" : "#f87171" }}>
              {stats.percentage}%
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>Davomat ko&apos;rsatkichi</div>
          </div>

          <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f8fafc" }}>{stats.totalSessions}</div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>Jami mashg&apos;ulotlar</div>
          </div>

          <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#4ade80" }}>{stats.present}</div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>Qatnashgan</div>
          </div>

          <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f87171" }}>{stats.absent}</div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>Qoldirilgan</div>
          </div>

          <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#facc15" }}>{stats.late}</div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>Kechikkan</div>
          </div>
        </div>
      )}

      {stats?.isAtRisk && (
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            backgroundColor: "#ef44441a",
            border: "1px solid #ef444455",
            color: "#f87171",
            marginBottom: 20,
            fontSize: "0.88rem",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span>⚠️</span>
          <span>
            <b>Ogohlantirish:</b> Siz 3 yoki undan ortiq mashg&apos;ulotni sababsiz qoldirgansiz. Iltimos, ustozingiz bilan bog&apos;laning.
          </span>
        </div>
      )}

      {/* Darslar Jadvali */}
      {sessions.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", backgroundColor: "#0f172a", borderRadius: 12, border: "1px solid #1e293b", color: "#64748b" }}>
          Hozircha guruh mashg&apos;ulotlari qayd etilmagan.
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #1e293b", borderRadius: 12, backgroundColor: "#0f172a" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e293b", color: "#94a3b8" }}>
                <th style={{ padding: "12px 16px" }}>Sana va vaqt</th>
                <th style={{ padding: "12px 16px" }}>Guruh</th>
                <th style={{ padding: "12px 16px" }}>Mashg&apos;ulot mavzusi</th>
                <th style={{ padding: "12px 16px" }}>Holat</th>
                <th style={{ padding: "12px 16px" }}>Izoh</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.sessionId} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "12px 16px", color: "#cbd5e1" }}>
                    {new Date(s.sessionDate).toLocaleString("uz-UZ")}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#94a3b8" }}>{s.groupName}</td>
                  <td style={{ padding: "12px 16px", color: "#f8fafc", fontWeight: 500 }}>{s.topic}</td>
                  <td style={{ padding: "12px 16px" }}>{getStatusBadge(s.status)}</td>
                  <td style={{ padding: "12px 16px", color: "#94a3b8" }}>{s.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
