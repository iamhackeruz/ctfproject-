"use client";

import { useState, useEffect, useCallback } from "react";

interface GroupItem {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  membersCount: number;
  coursesCount: number;
  assignedCourses: Array<{ id: number; title: string; icon: string }>;
  sampleMembers: Array<{ id: string; name: string; avatar: string | null }>;
}

interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  courses: Array<{ id: number; title: string; icon: string; duration: string }>;
  scoreboard: Array<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    avatar: string | null;
    isBlocked: boolean;
    totalPoints: number;
    completedLessons: number;
  }>;
  stats: {
    totalMembers: number;
    totalGroupPoints: number;
    avgGroupPoints: number;
  };
}

interface CourseOption {
  id: number;
  title: string;
  icon: string;
}

export default function AdminGroupsTab() {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  // Create Group Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Group Detail & Scoreboard Modal
  const [selectedGroup, setSelectedGroup] = useState<GroupDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Assign Course Modal
  const [assignGroupId, setAssignGroupId] = useState<string | null>(null);
  const [allCourses, setAllCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [assignDurationDays, setAssignDurationDays] = useState<number | "">("");
  const [assigning, setAssigning] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/groups");
      const data = await res.json();
      if (data.success) {
        setGroups(data.groups || []);
      }
    } catch {
      setError("Guruhlarni yuklashda xatolik.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchGroups();
    // Load courses for assignment
    fetch("/api/courses")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.courses)) {
          setAllCourses(data.courses.map((c: { id: number; title: string; icon: string }) => ({ id: c.id, title: c.title, icon: c.icon })));
        }
      })
      .catch(() => {});
  }, [fetchGroups]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreating(true);
    setMsg("");
    setError("");

    try {
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDesc.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg("Yangi guruh muvaffaqiyatli yaratildi!");
        setShowCreateModal(false);
        setNewGroupName("");
        setNewGroupDesc("");
        fetchGroups();
      } else {
        setError(data.error || "Guruh yaratishda xatolik.");
      }
    } catch {
      setError("Server bilan aloqada xatolik.");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenDetail = async (groupId: string) => {
    setLoadingDetail(true);
    setSelectedGroup(null);
    try {
      const res = await fetch(`/api/admin/groups?id=${groupId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedGroup(data.group);
      } else {
        setError(data.error || "Guruh tafsilotlarini yuklab bo'lmadi.");
      }
    } catch {
      setError("Guruh tafsilotlarini yuklashda xatolik.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAssignCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignGroupId || !selectedCourseId) return;
    setAssigning(true);
    setMsg("");
    setError("");

    try {
      const res = await fetch("/api/admin/groups", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_course",
          groupId: assignGroupId,
          courseId: selectedCourseId,
          durationDays: assignDurationDays ? Number(assignDurationDays) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(data.message || "Kurs guruhga muvaffaqiyatli biriktirildi!");
        setAssignGroupId(null);
        setAssignDurationDays("");
        fetchGroups();
      } else {
        setError(data.error || "Kurs biriktirishda xatolik.");
      }
    } catch {
      setError("Server bilan aloqada xatolik.");
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveCourse = async (groupId: string, courseId: number, courseTitle: string) => {
    if (!confirm(`Haqiqatan ham '${courseTitle}' kursini guruhdan olib tashlamoqchimisiz? Guruh talabalarining ushbu kursga bo'lgan guruh huquqlari bekor qilinadi.`)) return;
    setMsg("");
    setError("");
    try {
      const res = await fetch("/api/admin/groups", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_course",
          groupId,
          courseId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(data.message || "Kurs guruhdan olib tashlandi.");
        fetchGroups();
      } else {
        setError(data.error || "Kursni olib tashlashda xatolik.");
      }
    } catch {
      setError("Server xatosi.");
    }
  };

  const handleDeleteGroup = async (group: GroupItem) => {
    if (!confirm(`'${group.name}' guruhini o'chirishni tasdiqlaysizmi? (Guruh a'zolari saqlanib qoladi)`)) return;

    try {
      const res = await fetch(`/api/admin/groups?id=${group.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setMsg("Guruh muvaffaqiyatli o'chirildi.");
        fetchGroups();
      } else {
        setError(data.error || "Guruhni o'chirishda xatolik.");
      }
    } catch {
      setError("Server xatosi.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>🏷️ O&apos;quv Guruhlari Boshqaruvi</h2>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
            Talabalarni guruhlarga ajratish, kurslarga ommaviy yozish va guruh reytingi
          </p>
        </div>

        <button type="button" className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          ➕ Yangi Guruh Yaratish
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

      {/* Groups Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 30, color: "#38bdf8" }}>Guruhlar yuklanmoqda...</div>
      ) : groups.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
          Hozircha birorta guruh yaratilmagan. Yuqoridagi &apos;+ Yangi Guruh Yaratish&apos; tugmasi orqali boshlang.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          {groups.map((g) => (
            <div key={g.id} className="card" style={{ padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#38bdf8" }}>{g.name}</h3>
                  <span className="badge badge-blue">👥 {g.membersCount} talaba</span>
                </div>

                <p style={{ fontSize: "0.84rem", color: "#94a3b8", lineHeight: 1.5, minHeight: 40 }}>
                  {g.description || "Guruh tavsifi belgilanmagan."}
                </p>

                <div style={{ margin: "14px 0", borderTop: "1px solid #1e293b", paddingTop: 10 }}>
                  <div style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: 6 }}>Biriktirilgan kurslar:</div>
                  {g.assignedCourses.length > 0 ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {g.assignedCourses.map((c) => (
                        <span
                          key={c.id}
                          className="badge badge-green"
                          style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <span>{c.icon} {c.title}</span>
                          <button
                            type="button"
                            title="Kursni guruhdan olib tashlash"
                            onClick={() => handleRemoveCourse(g.id, c.id, c.title)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#fca5a5",
                              cursor: "pointer",
                              padding: "0 2px",
                              fontWeight: "bold",
                              fontSize: "0.8rem",
                              lineHeight: 1,
                            }}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.78rem", color: "#64748b" }}>Kurslar biriktirilmagan</span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12, borderTop: "1px solid #1e293b", paddingTop: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: "6px 12px", fontSize: "0.8rem", flex: 1 }}
                  onClick={() => handleOpenDetail(g.id)}
                >
                  📊 Scoreboard
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: "6px 12px", fontSize: "0.8rem", flex: 1 }}
                  onClick={() => {
                    setAssignGroupId(g.id);
                    setSelectedCourseId(allCourses[0]?.id ? String(allCourses[0].id) : "");
                  }}
                >
                  📚 Kursga Yozish
                </button>
                <button
                  type="button"
                  style={{ background: "#7f1d1d", color: "#fca5a5", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem" }}
                  onClick={() => handleDeleteGroup(g)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ maxWidth: 480, width: "100%", padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>➕ Yangi Guruh Yaratish</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.2rem" }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGroup} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Guruh Nomi *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Masalan: Kiberxavfsizlik 2026 - A Guruh"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Qisqacha Tavsif</label>
                <textarea
                  className="input"
                  style={{ minHeight: 80, resize: "vertical" }}
                  placeholder="Dushanba-Chorshanba-Juma 18:00 darslari talabalari..."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>
                  Bekor qilish
                </button>
                <button type="submit" disabled={creating} className="btn btn-primary">
                  {creating ? "Yaratilmoqda..." : "Guruhni Yaratish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Course Modal */}
      {assignGroupId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ maxWidth: 480, width: "100%", padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>📚 Guruhni Kursga Ommaviy Yozish</h3>
              <button type="button" onClick={() => setAssignGroupId(null)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.2rem" }}>
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: 16 }}>
              Ushbu kurs guruhga bog&apos;lanadi va guruhdagi barcha talabalar avtomatik ravishda ushbu kursga yoziladi.
            </p>

            <form onSubmit={handleAssignCourse} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Kursni tanlang</label>
                <select className="input" value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} required>
                  {allCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                  Amal qilish muddati (kunlarda, ixtiyoriy)
                </label>
                <input
                  type="number"
                  className="input"
                  placeholder="Cheksiz (bo'sh qoldiring) yoki masalan: 30"
                  value={assignDurationDays}
                  onChange={(e) => setAssignDurationDays(e.target.value === "" ? "" : Number(e.target.value))}
                  min={1}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setAssignGroupId(null)}>
                  Bekor qilish
                </button>
                <button type="submit" disabled={assigning} className="btn btn-primary">
                  {assigning ? "Yozilmoqda..." : "Ommaviy Yozish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scoreboard Detail Modal */}
      {(selectedGroup || loadingDetail) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ maxWidth: 760, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#38bdf8" }}>
                  🏆 Guruh Reytingi: {selectedGroup?.name}
                </h3>
                <p style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                  A&apos;zolar: {selectedGroup?.stats.totalMembers} | Jami ball: {selectedGroup?.stats.totalGroupPoints} | O&apos;rtacha: {selectedGroup?.stats.avgGroupPoints} ball
                </p>
              </div>
              <button type="button" onClick={() => setSelectedGroup(null)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.2rem" }}>
                ✕
              </button>
            </div>

            {loadingDetail ? (
              <div style={{ textAlign: "center", padding: 40, color: "#38bdf8" }}>Reyting yuklanmoqda...</div>
            ) : selectedGroup && selectedGroup.scoreboard.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Ushbu guruhda hali talabalar yo&apos;q.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155", textAlign: "left", color: "#94a3b8" }}>
                    <th style={{ padding: "8px 6px" }}>O&apos;rin</th>
                    <th style={{ padding: "8px 6px" }}>Talaba</th>
                    <th style={{ padding: "8px 6px" }}>Darslar</th>
                    <th style={{ padding: "8px 6px", textAlign: "right" }}>To&apos;plangan Ball</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedGroup?.scoreboard.map((m, idx) => (
                    <tr key={m.id} style={{ borderBottom: "1px solid #1e293b" }}>
                      <td style={{ padding: "10px 6px", fontWeight: "bold" }}>
                        {idx === 0 ? "🥇 1" : idx === 1 ? "🥈 2" : idx === 2 ? "🥉 3" : `${idx + 1}`}
                      </td>
                      <td style={{ padding: "10px 6px" }}>
                        <div style={{ fontWeight: 600, color: "#f8fafc" }}>{m.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{m.email}</div>
                      </td>
                      <td style={{ padding: "10px 6px", color: "#cbd5e1" }}>
                        ✅ {m.completedLessons} dars
                      </td>
                      <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: "bold", color: "#34d399", fontSize: "1rem" }}>
                        {m.totalPoints} ball
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button type="button" className="btn btn-outline" onClick={() => setSelectedGroup(null)}>
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
