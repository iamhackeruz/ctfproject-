"use client";

import { useState, useEffect } from "react";

interface GroupItem {
  id: string;
  name: string;
}

interface ClassSessionItem {
  id: string;
  sessionDate: string;
  topic: string;
  _count?: { records: number };
}

interface StudentStatItem {
  user: { id: string; name: string; email: string; phone?: string | null };
  present: number;
  absent: number;
  late: number;
  excused: number;
  totalSessions: number;
  percentage: number;
  isAtRisk: boolean;
}

interface GroupStats {
  totalSessions: number;
  groupAveragePercentage: number;
  atRiskCount: number;
  students: StudentStatItem[];
}

interface SessionRecordRow {
  userId: string;
  name: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  note: string;
}

export default function AdminAttendanceTab() {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [sessions, setSessions] = useState<ClassSessionItem[]>([]);
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Yangi mashg'ulot modali
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [sessionTopic, setSessionTopic] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [creatingSession, setCreatingSession] = useState(false);

  // Davomat belgilash modali
  const [markingSession, setMarkingSession] = useState<ClassSessionItem | null>(null);
  const [sessionRecords, setSessionRecords] = useState<SessionRecordRow[]>([]);
  const [savingRecords, setSavingRecords] = useState(false);
  const [loadingSessionDetails, setLoadingSessionDetails] = useState(false);

  // Guruhlarni yuklash
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await fetch("/api/admin/groups");
        if (res.ok) {
          const d = await res.json();
          const grps = d.groups || [];
          setGroups(grps);
          if (grps.length > 0) {
            setSelectedGroupId(grps[0].id);
          }
        }
      } catch {
        // ignore
      }
    };
    fetchGroups();
  }, []);

  // Tanlangan guruh ma'lumotlarini yuklash
  const fetchGroupData = async (groupId: string) => {
    if (!groupId) return;
    try {
      const [resSessions, resStats] = await Promise.all([
        fetch(`/api/attendance/sessions?groupId=${groupId}`),
        fetch(`/api/attendance/stats?groupId=${groupId}`),
      ]);

      if (resSessions.ok) {
        const d = await resSessions.json();
        setSessions(d.sessions || []);
      }
      if (resStats.ok) {
        const d = await resStats.json();
        setStats(d);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedGroupId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchGroupData(selectedGroupId);
    }
  }, [selectedGroupId]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !sessionTopic.trim() || !sessionDate) return;

    try {
      setCreatingSession(true);
      const res = await fetch("/api/attendance/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: selectedGroupId,
          topic: sessionTopic.trim(),
          sessionDate,
        }),
      });

      const d = await res.json();
      if (res.ok && d.success) {
        setIsNewSessionOpen(false);
        setSessionTopic("");
        setSessionDate("");
        fetchGroupData(selectedGroupId);
      } else {
        alert(d.error || "Mashg'ulot yaratishda xatolik");
      }
    } finally {
      setCreatingSession(false);
    }
  };

  const openMarkingModal = async (session: ClassSessionItem) => {
    setMarkingSession(session);
    try {
      setLoadingSessionDetails(true);
      const res = await fetch(`/api/attendance/sessions/${session.id}`);
      if (res.ok) {
        const d = await res.json();
        const groupMembers = d.session.group?.members || [];
        const existingRecords = d.session.records || [];

        // Guruh talabalari bilan mavjud yozuvlarni birlashtirish
        const rows: SessionRecordRow[] = groupMembers.map((m: { user: { id: string; name: string } }) => {
          const rec = existingRecords.find((r: { userId: string }) => r.userId === m.user.id);
          return {
            userId: m.user.id,
            name: m.user.name,
            status: rec ? rec.status : "PRESENT",
            note: rec?.note || "",
          };
        });

        setSessionRecords(rows);
      }
    } finally {
      setLoadingSessionDetails(false);
    }
  };

  const handleMarkAllPresent = () => {
    setSessionRecords((prev) =>
      prev.map((r) => ({ ...r, status: "PRESENT" }))
    );
  };

  const handleStatusChange = (userId: string, newStatus: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED") => {
    setSessionRecords((prev) =>
      prev.map((r) => (r.userId === userId ? { ...r, status: newStatus } : r))
    );
  };

  const handleNoteChange = (userId: string, note: string) => {
    setSessionRecords((prev) =>
      prev.map((r) => (r.userId === userId ? { ...r, note } : r))
    );
  };

  const handleSaveAttendance = async () => {
    if (!markingSession) return;
    try {
      setSavingRecords(true);
      const res = await fetch(`/api/attendance/sessions/${markingSession.id}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: sessionRecords.map((r) => ({
            userId: r.userId,
            status: r.status,
            note: r.note,
          })),
        }),
      });

      const d = await res.json();
      if (res.ok && d.success) {
        setMarkingSession(null);
        fetchGroupData(selectedGroupId);
      } else {
        alert(d.error || "Davomatni saqlashda xatolik");
      }
    } finally {
      setSavingRecords(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f8fafc" }}>Davomat boshqaruvi</h2>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: 4 }}>
            Mashg&apos;ulotlar yaratish, tezkor davomat belgilash va qatnashish tahlili
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <select
            id="attendance-group-select"
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              backgroundColor: "#0f172a",
              border: "1px solid #1e293b",
              color: "#f8fafc",
              fontSize: "0.88rem",
            }}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          {selectedGroupId && (
            <>
              <button
                type="button"
                onClick={() => {
                  setSessionDate(new Date().toISOString().slice(0, 16));
                  setIsNewSessionOpen(true);
                }}
                className="btn btn-primary"
                style={{ padding: "8px 16px", fontSize: "0.85rem" }}
              >
                + Yangi mashg&apos;ulot
              </button>
              <a
                href={`/api/attendance/export?groupId=${selectedGroupId}`}
                className="btn btn-outline"
                style={{ padding: "8px 14px", fontSize: "0.85rem" }}
              >
                📥 CSV Eksport
              </a>
            </>
          )}
        </div>
      </div>

      {/* Statistika ko'rsatkichlari */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
          <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: stats.groupAveragePercentage >= 80 ? "#4ade80" : "#facc15" }}>
              {stats.groupAveragePercentage}%
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>Guruh o&apos;rtacha davomati</div>
          </div>

          <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f8fafc" }}>{stats.totalSessions}</div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>Jami mashg&apos;ulotlar soni</div>
          </div>

          <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: stats.atRiskCount > 0 ? "#f87171" : "#4ade80" }}>
              {stats.atRiskCount}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>Xavf ostida (3+ dars qoldirgan)</div>
          </div>
        </div>
      )}

      {/* Mashg'ulotlar ro'yxati */}
      <div style={{ marginBottom: 30 }}>
        <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "#f8fafc", marginBottom: 12 }}>
          Dars mashg&apos;ulotlari
        </h3>

        {loading ? (
          <div style={{ padding: 20, color: "#94a3b8" }}>Yuklanmoqda...</div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", backgroundColor: "#0f172a", borderRadius: 10, border: "1px solid #1e293b", color: "#64748b" }}>
            Ushbu guruh uchun hali dars mashg&apos;ulotlari qayd etilmagan.
          </div>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid #1e293b", borderRadius: 10, backgroundColor: "#0f172a" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e293b", color: "#94a3b8" }}>
                  <th style={{ padding: "10px 14px" }}>Sana va vaqt</th>
                  <th style={{ padding: "10px 14px" }}>Mavzu</th>
                  <th style={{ padding: "10px 14px" }}>Belgilangan yozuvlar</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid #1e293b" }}>
                    <td style={{ padding: "10px 14px", color: "#cbd5e1" }}>
                      {new Date(s.sessionDate).toLocaleString("uz-UZ")}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#f8fafc", fontWeight: 500 }}>{s.topic}</td>
                    <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{s._count?.records || 0} ta talaba</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => openMarkingModal(s)}
                        className="btn btn-primary"
                        style={{ padding: "5px 12px", fontSize: "0.8rem" }}
                      >
                        Davomat belgilash
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Guruh talabalari davomat jadvali */}
      {stats && stats.students.length > 0 && (
        <div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "#f8fafc", marginBottom: 12 }}>
            Guruh talabalari davomat ko&apos;rsatkichlari
          </h3>
          <div style={{ overflowX: "auto", border: "1px solid #1e293b", borderRadius: 10, backgroundColor: "#0f172a" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e293b", color: "#94a3b8" }}>
                  <th style={{ padding: "10px 14px" }}>Talaba</th>
                  <th style={{ padding: "10px 14px" }}>Email</th>
                  <th style={{ padding: "10px 14px" }}>Qatnashgan</th>
                  <th style={{ padding: "10px 14px" }}>Qoldirgan</th>
                  <th style={{ padding: "10px 14px" }}>Kechikkan</th>
                  <th style={{ padding: "10px 14px" }}>Sababli</th>
                  <th style={{ padding: "10px 14px" }}>Foiz</th>
                  <th style={{ padding: "10px 14px" }}>Holat</th>
                </tr>
              </thead>
              <tbody>
                {stats.students.map((st) => (
                  <tr key={st.user.id} style={{ borderBottom: "1px solid #1e293b" }}>
                    <td style={{ padding: "10px 14px", color: "#f8fafc", fontWeight: 500 }}>{st.user.name}</td>
                    <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{st.user.email}</td>
                    <td style={{ padding: "10px 14px", color: "#4ade80" }}>{st.present}</td>
                    <td style={{ padding: "10px 14px", color: st.absent >= 3 ? "#f87171" : "#cbd5e1" }}>{st.absent}</td>
                    <td style={{ padding: "10px 14px", color: "#facc15" }}>{st.late}</td>
                    <td style={{ padding: "10px 14px", color: "#38bdf8" }}>{st.excused}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: st.percentage >= 80 ? "#4ade80" : "#f87171" }}>
                      {st.percentage}%
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {st.isAtRisk ? (
                        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.72rem", backgroundColor: "#ef444422", color: "#f87171", border: "1px solid #ef4444" }}>
                          ⚠️ Xavf ostida (3+)
                        </span>
                      ) : (
                        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.72rem", backgroundColor: "#22c55e22", color: "#4ade80" }}>
                          Qoniqarli
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Yangi mashg'ulot modali */}
      {isNewSessionOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 12,
              maxWidth: 480,
              width: "100%",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
              Yangi mashg&apos;ulot qo&apos;shish
            </h3>

            <form onSubmit={handleCreateSession} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6 }}>
                  Mavzu *
                </label>
                <input
                  type="text"
                  required
                  value={sessionTopic}
                  onChange={(e) => setSessionTopic(e.target.value)}
                  placeholder="Masalan: Web xavfsizligi va SQL Injection"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    color: "#f8fafc",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6 }}>
                  Sana va vaqt *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    color: "#f8fafc",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsNewSessionOpen(false)}
                  className="btn btn-ghost"
                  style={{ padding: "8px 14px" }}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={creatingSession}
                  className="btn btn-primary"
                  style={{ padding: "8px 18px" }}
                >
                  {creatingSession ? "Yaratilmoqda..." : "Yaratish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Davomat belgilash modali */}
      {markingSession && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 14,
              maxWidth: 750,
              width: "100%",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                  Davomat: {markingSession.topic}
                </h3>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: 2 }}>
                  {new Date(markingSession.sessionDate).toLocaleString("uz-UZ")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={handleMarkAllPresent}
                  className="btn btn-outline"
                  style={{ padding: "5px 12px", fontSize: "0.8rem" }}
                >
                  Hammasini &quot;Qatnashdi&quot; qilish
                </button>
                <button
                  type="button"
                  onClick={() => setMarkingSession(null)}
                  style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.2rem" }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ padding: 20, flex: 1, overflowY: "auto" }}>
              {loadingSessionDetails ? (
                <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>Yuklanmoqda...</div>
              ) : sessionRecords.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>Guruhda talabalar topilmadi.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {sessionRecords.map((r) => (
                    <div
                      key={r.userId}
                      style={{
                        padding: "10px 14px",
                        backgroundColor: "#1e293b33",
                        border: "1px solid #334155",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      <span style={{ fontWeight: 500, color: "#f8fafc", minWidth: 160 }}>{r.name}</span>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleStatusChange(r.userId, st)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              fontSize: "0.75rem",
                              cursor: "pointer",
                              border: r.status === st ? "1px solid transparent" : "1px solid #334155",
                              backgroundColor:
                                r.status === st
                                  ? st === "PRESENT"
                                    ? "#22c55e"
                                    : st === "ABSENT"
                                    ? "#ef4444"
                                    : st === "LATE"
                                    ? "#eab308"
                                    : "#38bdf8"
                                  : "transparent",
                              color: r.status === st ? "#0f172a" : "#cbd5e1",
                              fontWeight: r.status === st ? 700 : 400,
                            }}
                          >
                            {st === "PRESENT" ? "Qatnashdi" : st === "ABSENT" ? "Qoldirdi" : st === "LATE" ? "Kechikdi" : "Sababli"}
                          </button>
                        ))}
                      </div>

                      <input
                        type="text"
                        value={r.note}
                        onChange={(e) => handleNoteChange(r.userId, e.target.value)}
                        placeholder="Izoh (ixtiyoriy)..."
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          backgroundColor: "#0f172a",
                          border: "1px solid #334155",
                          color: "#cbd5e1",
                          fontSize: "0.78rem",
                          width: 140,
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: "14px 20px", borderTop: "1px solid #1e293b", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setMarkingSession(null)}
                className="btn btn-ghost"
                style={{ padding: "8px 16px" }}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={savingRecords}
                className="btn btn-primary"
                style={{ padding: "8px 20px" }}
              >
                {savingRecords ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
