"use client";

import { useState, useEffect, useCallback } from "react";

interface EntitlementItem {
  id: string;
  type: "SUBSCRIPTION" | "COURSE" | "GROUP" | "GRANT";
  source: "MANUAL" | "GROUP" | "PAYMENT";
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
  reason: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  course?: {
    id: number;
    title: string;
    accessType: string;
    priceUzs: number;
  } | null;
  plan?: {
    id: string;
    name: string;
    code: string;
    interval: string;
    priceUzs: number;
  } | null;
  group?: {
    id: string;
    name: string;
  } | null;
}

interface PlanOption {
  id: string;
  name: string;
  code: string;
  interval: string;
  priceUzs: number;
}

interface CourseOption {
  id: number;
  title: string;
  accessType: string;
  priceUzs: number;
}

interface GroupOption {
  id: string;
  name: string;
}

export default function AdminEntitlementsTab() {
  const [entitlements, setEntitlements] = useState<EntitlementItem[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  // Grant Modal State
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantEmailOrId, setGrantEmailOrId] = useState("");
  const [grantType, setGrantType] = useState<"SUBSCRIPTION" | "COURSE" | "GRANT">("SUBSCRIPTION");
  const [grantCourseId, setGrantCourseId] = useState<number | "">("");
  const [grantPlanId, setGrantPlanId] = useState<string>("");
  const [grantDays, setGrantDays] = useState<number | "">(30);
  const [grantReason, setGrantReason] = useState("");
  const [granting, setGranting] = useState(false);

  // Group Grant Modal State
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupCourseId, setGroupCourseId] = useState<number | "">("");
  const [groupDays, setGroupDays] = useState<number | "">(90);
  const [groupReason, setGroupReason] = useState("");
  const [grantingGroup, setGrantingGroup] = useState(false);

  // Revoke state
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchEntitlements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/entitlements?status=${statusFilter}`);
      const data = await res.json();
      if (data.success) {
        setEntitlements(data.entitlements || []);
        setPlans(data.plans || []);
        setCourses(data.courses || []);
      }
    } catch {
      setError("Huquqlarni yuklab bo'lmadi.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/groups");
      const data = await res.json();
      if (data.success && Array.isArray(data.groups)) {
        setGroups(data.groups.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEntitlements();
    fetchGroups();
  }, [fetchEntitlements, fetchGroups]);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setGranting(true);
    setMsg("");
    setError("");

    try {
      // Find userId if email entered
      let targetUserId = grantEmailOrId.trim();
      if (targetUserId.includes("@")) {
        const usersRes = await fetch(`/api/admin/users?q=${encodeURIComponent(targetUserId)}`);
        const usersData = await usersRes.json();
        if (usersData.success && usersData.users.length > 0) {
          targetUserId = usersData.users[0].id;
        } else {
          setError("Ko'rsatilgan email bo'yicha talaba topilmadi.");
          setGranting(false);
          return;
        }
      }

      const res = await fetch("/api/admin/entitlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "grant",
          userId: targetUserId,
          type: grantType,
          courseId: grantType === "COURSE" ? grantCourseId : undefined,
          planId: grantType === "SUBSCRIPTION" ? grantPlanId : undefined,
          durationDays: grantDays ? Number(grantDays) : undefined,
          reason: grantReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMsg(data.message || "Huquq muvaffaqiyatli berildi!");
        setShowGrantModal(false);
        setGrantEmailOrId("");
        setGrantReason("");
        fetchEntitlements();
      } else {
        setError(data.error || "Xatolik yuz berdi.");
      }
    } catch {
      setError("Server bilan aloqa xatosi.");
    } finally {
      setGranting(false);
    }
  };

  const handleGroupGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setGrantingGroup(true);
    setMsg("");
    setError("");

    try {
      const res = await fetch("/api/admin/entitlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "grant_group",
          groupId: selectedGroupId,
          type: "GROUP",
          courseId: groupCourseId ? Number(groupCourseId) : undefined,
          durationDays: groupDays ? Number(groupDays) : undefined,
          reason: groupReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMsg(data.message || "Guruh talabalariga huquq berildi!");
        setShowGroupModal(false);
        fetchEntitlements();
      } else {
        setError(data.error || "Xatolik yuz berdi.");
      }
    } catch {
      setError("Server bilan aloqa xatosi.");
    } finally {
      setGrantingGroup(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Haqiqatan ham ushbu kirish huquqini bekor qilmoqchimisiz?")) return;
    setRevokingId(id);
    setMsg("");
    setError("");

    try {
      const res = await fetch("/api/admin/entitlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revoke",
          entitlementId: id,
          reason: "Administrator tomonidan bekor qilindi",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg("Kirish huquqi bekor qilindi.");
        fetchEntitlements();
      } else {
        setError(data.error || "Bekor qilishda xatolik.");
      }
    } catch {
      setError("Server xatosi.");
    } finally {
      setRevokingId(null);
    }
  };

  const now = new Date();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Yuqori Panel va Tugmalar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f8fafc" }}>
            🔑 Kirish Huquqlari va Obunalarni Boshqarish
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
            Talabalar va guruhlarga Premium obuna yoki maxsus kurs huquqlarini berish va bekor qilish
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowGrantModal(true)}
          >
            + Talabaga Huquq Berish
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowGroupModal(true)}
          >
            👥 Guruhga Ommaviy Berish
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: "10px 14px", background: "rgba(34, 197, 94, 0.15)", border: "1px solid #22c55e", borderRadius: 8, color: "#4ade80", fontSize: "0.85rem" }}>
          {msg}
        </div>
      )}
      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: 8, color: "#f87171", fontSize: "0.85rem" }}>
          {error}
        </div>
      )}

      {/* Filtrlar */}
      <div className="card" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Holat bo&apos;yicha:</span>
        {(["all", "active", "expired", "revoked"] as const).map((st) => (
          <button
            key={st}
            type="button"
            className={`btn ${statusFilter === st ? "btn-primary" : "btn-ghost"}`}
            style={{ padding: "4px 12px", fontSize: "0.8rem" }}
            onClick={() => setStatusFilter(st)}
          >
            {st === "all" ? "Barchasi" : st === "active" ? "Faol (Active)" : st === "expired" ? "Muddati o'tgan" : "Bekor qilingan"}
          </button>
        ))}
      </div>

      {/* Huquqlar Jadvali */}
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left", color: "#94a3b8" }}>
              <th style={{ padding: "12px 14px" }}>Talaba</th>
              <th style={{ padding: "12px 14px" }}>Huquq Turi</th>
              <th style={{ padding: "12px 14px" }}>Resurs / Reja</th>
              <th style={{ padding: "12px 14px" }}>Amal Qilish Muddati</th>
              <th style={{ padding: "12px 14px" }}>Holat</th>
              <th style={{ padding: "12px 14px" }}>Sabab</th>
              <th style={{ padding: "12px 14px", textAlign: "right" }}>Amallar</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                  Yuklanmoqda...
                </td>
              </tr>
            ) : entitlements.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                  Kirish huquqlari topilmadi.
                </td>
              </tr>
            ) : (
              entitlements.map((ent) => {
                const isRevoked = !!ent.revokedAt;
                const isExpired = ent.endsAt && new Date(ent.endsAt) < now;
                const isActive = !isRevoked && !isExpired;

                return (
                  <tr key={ent.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, color: "#f8fafc" }}>{ent.user?.name || "Noma'lum"}</div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{ent.user?.email}</div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span className={`badge ${ent.type === "SUBSCRIPTION" ? "badge-amber" : ent.type === "COURSE" ? "badge-blue" : "badge-green"}`}>
                        {ent.type === "SUBSCRIPTION" ? "⭐ Obuna" : ent.type === "COURSE" ? "📚 Kurs" : ent.type === "GROUP" ? "👥 Guruh" : "🛡️ Grant"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {ent.course && <div>{ent.course.title}</div>}
                      {ent.plan && <div>{ent.plan.name}</div>}
                      {ent.group && <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>Guruh: {ent.group.name}</div>}
                      {!ent.course && !ent.plan && !ent.group && <span>To&apos;liq kirish</span>}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div>{new Date(ent.startsAt).toLocaleDateString()} &rarr; {ent.endsAt ? new Date(ent.endsAt).toLocaleDateString() : "Cheksiz"}</div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {isActive ? (
                        <span className="badge badge-green">Faol</span>
                      ) : isRevoked ? (
                        <span className="badge badge-red" style={{ backgroundColor: "rgba(239,68,68,0.2)", color: "#f87171" }}>Bekor qilingan</span>
                      ) : (
                        <span className="badge" style={{ backgroundColor: "rgba(148,163,184,0.2)", color: "#94a3b8" }}>Muddati o&apos;tgan</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#94a3b8", fontSize: "0.75rem", maxWidth: 180 }}>
                      {ent.reason || "—"}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      {isActive && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ color: "#f87171", fontSize: "0.75rem", padding: "4px 8px" }}
                          disabled={revokingId === ent.id}
                          onClick={() => handleRevoke(ent.id)}
                        >
                          {revokingId === ent.id ? "Bekor qilinmoqda..." : "Bekor qilish"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Grant Modal */}
      {showGrantModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ maxWidth: 500, width: "100%", padding: 24, background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 16 }}>Talabaga Kirish Huquqi Berish</h3>
            <form onSubmit={handleGrant} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Talaba Emaili yoki ID:</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="masalan, talaba@cyberedu.uz"
                  value={grantEmailOrId}
                  onChange={(e) => setGrantEmailOrId(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Huquq Turi:</label>
                <select
                  className="input"
                  value={grantType}
                  onChange={(e) => setGrantType(e.target.value as "SUBSCRIPTION" | "COURSE" | "GRANT")}
                >
                  <option value="SUBSCRIPTION">⭐ Premium Obuna (Barcha premium kurs va lablar)</option>
                  <option value="COURSE">📚 Aniq Kursga Kirish</option>
                  <option value="GRANT">🛡️ Maxsus Grant (To&apos;liq kirish)</option>
                </select>
              </div>

              {grantType === "COURSE" && (
                <div>
                  <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Kursni Tanlang:</label>
                  <select
                    required
                    className="input"
                    value={grantCourseId}
                    onChange={(e) => setGrantCourseId(Number(e.target.value))}
                  >
                    <option value="">-- Kursni tanlang --</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title} ({c.accessType})</option>
                    ))}
                  </select>
                </div>
              )}

              {grantType === "SUBSCRIPTION" && plans.length > 0 && (
                <div>
                  <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Obuna Rejasi:</label>
                  <select
                    className="input"
                    value={grantPlanId}
                    onChange={(e) => setGrantPlanId(e.target.value)}
                  >
                    <option value="">-- Standart --</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.interval})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Muddat (kunlarda, bo&apos;sh qoldirilsa cheksiz):</label>
                <input
                  type="number"
                  className="input"
                  placeholder="30"
                  value={grantDays}
                  onChange={(e) => setGrantDays(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Sabab (Izoh):</label>
                <input
                  type="text"
                  className="input"
                  placeholder="masalan, Grant yutug'i, olimpiada g'olibi"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowGrantModal(false)}>Bekor qilish</button>
                <button type="submit" className="btn btn-primary" disabled={granting}>
                  {granting ? "Berilmoqda..." : "Huquqni Berish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Grant Modal */}
      {showGroupModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ maxWidth: 500, width: "100%", padding: 24, background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 16 }}>Guruhga Ommaviy Kirish Huquqi Berish</h3>
            <form onSubmit={handleGroupGrant} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Guruhni Tanlang:</label>
                <select
                  required
                  className="input"
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                >
                  <option value="">-- Guruhni tanlang --</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Kursni Tanlang:</label>
                <select
                  required
                  className="input"
                  value={groupCourseId}
                  onChange={(e) => setGroupCourseId(Number(e.target.value))}
                >
                  <option value="">-- Kursni tanlang --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Muddat (kunlarda, bo&apos;sh qoldirilsa cheksiz):</label>
                <input
                  type="number"
                  className="input"
                  placeholder="90"
                  value={groupDays}
                  onChange={(e) => setGroupDays(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Sabab (Izoh):</label>
                <input
                  type="text"
                  className="input"
                  placeholder="masalan, Bahorgi semestr dasturi"
                  value={groupReason}
                  onChange={(e) => setGroupReason(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowGroupModal(false)}>Bekor qilish</button>
                <button type="submit" className="btn btn-primary" disabled={grantingGroup}>
                  {grantingGroup ? "Berilmoqda..." : "Guruhga Berish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
