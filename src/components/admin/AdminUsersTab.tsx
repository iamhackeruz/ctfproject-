"use client";

import { useState, useEffect, useCallback } from "react";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: "student" | "instructor" | "accountant" | "admin";
  phone: string | null;
  avatar: string | null;
  isBlocked: boolean;
  mustChangePassword: boolean;
  twoFactorEnabled?: boolean;
  telegramUsername?: string | null;
  telegramConnectedAt?: string | null;
  createdAt: string;
  enrollmentsCount: number;
  solvedLabsCount: number;
  certificatesCount: number;
  groups: Array<{ id: string; name: string }>;
}

interface GroupOption {
  id: string;
  name: string;
}

export default function AdminUsersTab({ currentUserRole }: { currentUserRole: string }) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("");
  const [groups, setGroups] = useState<GroupOption[]>([]);

  // Feedback messages
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");

  // Create User Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState("student");
  const [newGroupId, setNewGroupId] = useState("");
  const [createdTempPass, setCreatedTempPass] = useState("");
  const [creating, setCreating] = useState(false);

  // CSV Import Modal
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvGroupId, setCsvGroupId] = useState("");
  const [csvReport, setCsvReport] = useState<{ importedCount: number; errors: Array<{ row: number; email?: string; error: string }> } | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);

  // Load groups for filter & creation
  useEffect(() => {
    fetch("/api/admin/groups")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.groups)) {
          setGroups(data.groups.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })));
        }
      })
      .catch(() => {});
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setActionError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
      });
      if (q) params.set("q", q);
      if (roleFilter) params.set("role", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (groupFilter) params.set("groupId", groupFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        setActionError(data.error || "Foydalanuvchilarni yuklab bo'lmadi.");
      }
    } catch {
      setActionError("Server bilan aloqada xatolik.");
    } finally {
      setLoading(false);
    }
  }, [page, q, roleFilter, statusFilter, groupFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newName.trim()) return;
    setCreating(true);
    setActionMsg("");
    setActionError("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          phone: newPhone.trim() || undefined,
          role: newRole,
          groupId: newGroupId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreatedTempPass(data.tempPassword);
        setActionMsg("Foydalanuvchi muvaffaqiyatli yaratildi!");
        fetchUsers();
      } else {
        setActionError(data.error || "Yaratishda xatolik.");
      }
    } catch {
      setActionError("Server bilan aloqada xatolik.");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleBlock = async (user: UserItem) => {
    const actionName = user.isBlocked ? "blokdan chiqarishni" : "bloklashni";
    if (!confirm(`Haqiqatan ham ${user.name} (${user.email}) ni ${actionName} xohlaysizmi?`)) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_block",
          userId: user.id,
          isBlocked: !user.isBlocked,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(data.message || "Holat yangilandi.");
        fetchUsers();
      } else {
        setActionError(data.error || "Xatolik yuz berdi.");
      }
    } catch {
      setActionError("Server bilan aloqada xatolik.");
    }
  };

  const handleResetPassword = async (user: UserItem) => {
    if (!confirm(`${user.name} uchun yangi vaqtinchalik parol yaratilsinmi?`)) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          userId: user.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Yangi vaqtinchalik parol: ${data.tempPassword}\n\nUshbu parolni talabaga bering.`);
        setActionMsg("Vaqtinchalik parol yaratildi.");
        fetchUsers();
      } else {
        setActionError(data.error || "Xatolik yuz berdi.");
      }
    } catch {
      setActionError("Server bilan aloqada xatolik.");
    }
  };

  const handleRevokeSessions = async (user: UserItem) => {
    if (!confirm(`${user.name} ning barcha faol sessiyalari to'xtatilsinmi?`)) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revoke_sessions",
          userId: user.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(data.message || "Sessiyalar bekor qilindi.");
      } else {
        setActionError(data.error || "Xatolik yuz berdi.");
      }
    } catch {
      setActionError("Server bilan aloqada xatolik.");
    }
  };

  const handleChangeRole = async (user: UserItem, targetRole: string) => {
    if (user.role === targetRole) return;
    if (!confirm(`${user.name} ning rolini '${targetRole}' ga o'zgartirishni tasdiqlaysizmi?`)) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_role",
          userId: user.id,
          newRole: targetRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg("Foydalanuvchi roli muvaffaqiyatli yangilandi.");
        fetchUsers();
      } else {
        setActionError(data.error || "Rolni o'zgartirishda xatolik.");
      }
    } catch {
      setActionError("Server bilan aloqada xatolik.");
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (!confirm(`DIQQAT: ${user.name} (${user.email}) hisobi BUTUNLAY O'CHIRILADI!\nBu amalni qaytarib bo'lmaydi. Tasdiqlaysizmi?`)) return;

    try {
      const res = await fetch(`/api/admin/users?id=${user.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg("Foydalanuvchi muvaffaqiyatli o'chirildi.");
        fetchUsers();
      } else {
        setActionError(data.error || "O'chirishda xatolik.");
      }
    } catch {
      setActionError("Server bilan aloqada xatolik.");
    }
  };

  const handleReset2Fa = async (user: UserItem) => {
    if (!confirm(`${user.name} (${user.email}) uchun 2FA himoyasini bekor qilasizmi?\nFoydalanuvchining barcha faol sessiyalari bekor qilinadi va u qaytadan 2FA sozlaydi.`)) return;

    setActionError("");
    setActionMsg("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "2fa_admin_reset",
          targetUserId: user.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionMsg(`${user.name} uchun 2FA muvaffaqiyatli bekor qilindi.`);
        fetchUsers();
      } else {
        setActionError(data.error || "2FA ni bekor qilishda xatolik.");
      }
    } catch {
      setActionError("Server bilan aloqada xatolik.");
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;
    setCsvImporting(true);
    setCsvReport(null);
    setActionError("");

    try {
      const res = await fetch("/api/admin/users/csv-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvContent: csvText,
          defaultGroupId: csvGroupId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCsvReport({
          importedCount: data.importedCount,
          errors: data.errors || [],
        });
        fetchUsers();
      } else {
        setActionError(data.error || "CSV importda xatolik.");
      }
    } catch {
      setActionError("Server bilan aloqada xatolik.");
    } finally {
      setCsvImporting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top action bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>👥 Foydalanuvchilar Boshqaruvi</h2>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
            Jami: {total} nafar foydalanuvchi ro&apos;yxatga olingan
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setShowCreateModal(true);
              setCreatedTempPass("");
            }}
          >
            ➕ Yangi Talaba / Xodim
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setShowCsvModal(true);
              setCsvReport(null);
            }}
          >
            📥 CSV Import
          </button>
        </div>
      </div>

      {actionMsg && (
        <div style={{ background: "rgba(52, 211, 153, 0.12)", border: "1px solid rgba(52, 211, 153, 0.3)", color: "#34d399", padding: "10px 14px", borderRadius: 8, fontSize: "0.88rem" }}>
          ✅ {actionMsg}
        </div>
      )}

      {actionError && (
        <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", padding: "10px 14px", borderRadius: 8, fontSize: "0.88rem" }}>
          ⚠️ {actionError}
        </div>
      )}

      {/* Filter and Search Box */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div>
            <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Qidiruv</label>
            <input
              type="text"
              className="input"
              placeholder="Ism, email yoki telefon..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {currentUserRole === "admin" && (
            <div>
              <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Rol bo&apos;yicha</label>
              <select
                className="input"
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Barcha rollar</option>
                <option value="student">Talaba</option>
                <option value="instructor">Instruktor</option>
                <option value="accountant">Hisobchi</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Holat bo&apos;yicha</label>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Barchasi</option>
              <option value="active">Faol</option>
              <option value="blocked">Bloklangan</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Guruh bo&apos;yicha</label>
            <select
              className="input"
              value={groupFilter}
              onChange={(e) => {
                setGroupFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Barcha guruhlar</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card" style={{ padding: 20, overflowX: "auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#38bdf8" }}>Yuklanmoqda...</div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>Mos foydalanuvchilar topilmadi.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155", textAlign: "left", color: "#94a3b8" }}>
                <th style={{ padding: "10px 8px" }}>Foydalanuvchi</th>
                <th style={{ padding: "10px 8px" }}>Rol</th>
                <th style={{ padding: "10px 8px" }}>Guruh</th>
                <th style={{ padding: "10px 8px" }}>Natijalar</th>
                <th style={{ padding: "10px 8px" }}>2FA</th>
                <th style={{ padding: "10px 8px" }}>Holat</th>
                <th style={{ padding: "10px 8px", textAlign: "right" }}>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "12px 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: "1.4rem" }}>{u.avatar || "👤"}</span>
                      <div>
                        <div style={{ fontWeight: 700, color: "#f8fafc" }}>{u.name}</div>
                        <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{u.email}</div>
                        {u.phone && <div style={{ fontSize: "0.75rem", color: "#64748b" }}>📞 {u.phone}</div>}
                        {u.telegramUsername ? (
                          <div style={{ fontSize: "0.75rem", color: "#38bdf8", marginTop: 2 }}>✈️ {u.telegramUsername}</div>
                        ) : u.telegramConnectedAt ? (
                          <div style={{ fontSize: "0.75rem", color: "#38bdf8", marginTop: 2 }}>✈️ Bot ulangan</div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    {currentUserRole === "admin" ? (
                      <select
                        value={u.role}
                        onChange={(e) => handleChangeRole(u, e.target.value)}
                        style={{
                          background: "#0f172a",
                          color: u.role === "admin" ? "#f59e0b" : u.role === "instructor" ? "#34d399" : u.role === "accountant" ? "#a855f7" : "#38bdf8",
                          border: "1px solid #334155",
                          borderRadius: 6,
                          padding: "4px 8px",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                        }}
                      >
                        <option value="student">Talaba</option>
                        <option value="instructor">Instruktor</option>
                        <option value="accountant">Hisobchi</option>
                        <option value="admin">Administrator</option>
                      </select>
                    ) : (
                      <span className="badge badge-blue">{u.role}</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    {u.groups && u.groups.length > 0 ? (
                      u.groups.map((g) => (
                        <span key={g.id} className="badge badge-green" style={{ marginRight: 4 }}>
                          {g.name}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: "#64748b", fontSize: "0.8rem" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 8px", fontSize: "0.82rem", color: "#cbd5e1" }}>
                    <div>📚 {u.enrollmentsCount} kurs</div>
                    <div>🧪 {u.solvedLabsCount} ta lab</div>
                    <div>🎓 {u.certificatesCount} sertifikat</div>
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    {u.twoFactorEnabled ? (
                      <span className="badge badge-green" style={{ fontSize: "0.75rem" }}>
                        🛡️ Faol
                      </span>
                    ) : (
                      <span style={{ color: "#64748b", fontSize: "0.78rem" }}>
                        O&apos;chiq
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    {u.isBlocked ? (
                      <span className="badge" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171" }}>
                        🚫 Bloklangan
                      </span>
                    ) : (
                      <span className="badge badge-green">✓ Faol</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => handleResetPassword(u)}
                        style={{ background: "#1e293b", color: "#38bdf8", border: "1px solid #334155", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}
                        title="Vaqtinchalik yangi parol berish"
                      >
                        🔑 Parol
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevokeSessions(u)}
                        style={{ background: "#1e293b", color: "#f59e0b", border: "1px solid #334155", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}
                        title="Faol sessiyalarni o'chirish"
                      >
                        🚪 Chiqarish
                      </button>
                      {currentUserRole === "admin" && (
                        <>
                          {u.twoFactorEnabled && (
                            <button
                              type="button"
                              onClick={() => handleReset2Fa(u)}
                              style={{
                                background: "rgba(239, 68, 68, 0.15)",
                                color: "#f87171",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                padding: "4px 8px",
                                borderRadius: 4,
                                cursor: "pointer",
                                fontSize: "0.75rem",
                              }}
                              title="2FA ni tiklash (Reset)"
                            >
                              🛡️ 2FA Reset
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleBlock(u)}
                            style={{
                              background: u.isBlocked ? "rgba(52, 211, 153, 0.15)" : "rgba(239, 68, 68, 0.15)",
                              color: u.isBlocked ? "#34d399" : "#f87171",
                              border: "none",
                              padding: "4px 8px",
                              borderRadius: 4,
                              cursor: "pointer",
                              fontSize: "0.75rem",
                            }}
                          >
                            {u.isBlocked ? "Ochish" : "Bloklash"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            style={{ background: "#7f1d1d", color: "#fca5a5", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}
                          >
                            O&apos;chirish
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination controls */}
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

      {/* Create User Modal */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ maxWidth: 500, width: "100%", padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>➕ Yangi Foydalanuvchi Yaratish</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.2rem" }}>
                ✕
              </button>
            </div>

            {createdTempPass ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <span style={{ fontSize: "2.5rem" }}>🎉</span>
                <h4 style={{ color: "#34d399", marginTop: 8 }}>Foydalanuvchi yaratildi!</h4>
                <div style={{ background: "#0f172a", border: "1px dashed #38bdf8", padding: 14, borderRadius: 8, margin: "14px 0", fontSize: "1rem", fontFamily: "monospace", color: "#38bdf8" }}>
                  {createdTempPass}
                </div>
                <p style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                  Ushbu parolni talabaga bering. Talaba birinchi kirishida parolni o&apos;zgartirishi majburiy qilingan.
                </p>
                <button type="button" className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setShowCreateModal(false)}>
                  Tushundim
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Ism-Sharif *</label>
                  <input type="text" className="input" placeholder="Ali Valiyev" value={newName} onChange={(e) => setNewName(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Elektron Pochta (Email) *</label>
                  <input type="email" className="input" placeholder="ali@cyberedu.uz" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Telefon Raqam (Ixtiyoriy)</label>
                  <input type="text" className="input" placeholder="+998 90 123 45 67" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                </div>

                {currentUserRole === "admin" && (
                  <div>
                    <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Roli</label>
                    <select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                      <option value="student">Talaba</option>
                      <option value="instructor">Instruktor</option>
                      <option value="accountant">Hisobchi</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Guruhga biriktirish (Ixtiyoriy)</label>
                  <select className="input" value={newGroupId} onChange={(e) => setNewGroupId(e.target.value)}>
                    <option value="">Guruhsiz</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>
                    Bekor qilish
                  </button>
                  <button type="submit" disabled={creating} className="btn btn-primary">
                    {creating ? "Yaratilmoqda..." : "Yaratish"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ maxWidth: 600, width: "100%", padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>📥 Talabalarni CSV Orqali Ommaviy Import Qilish</h3>
              <button type="button" onClick={() => setShowCsvModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.2rem" }}>
                ✕
              </button>
            </div>

            {csvReport ? (
              <div style={{ padding: 10 }}>
                <h4 style={{ color: "#34d399" }}>✅ {csvReport.importedCount} ta talaba muvaffaqiyatli import qilindi!</h4>
                {csvReport.errors.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <h5 style={{ color: "#f87171" }}>⚠️ O&apos;tkazib yuborilgan xatolar ({csvReport.errors.length} ta):</h5>
                    <div style={{ maxHeight: 160, overflowY: "auto", background: "#0f172a", padding: 10, borderRadius: 6, fontSize: "0.8rem", color: "#fca5a5" }}>
                      {csvReport.errors.map((err, i) => (
                        <div key={i}>
                          Qator {err.row}: {err.email ? `(${err.email}) ` : ""}
                          {err.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCsvModal(false)}>
                  Yopish
                </button>
              </div>
            ) : (
              <form onSubmit={handleCsvImport} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>
                  Format: <code>Ism, Email, Telefon</code> (har bir qatorda 1 tadan talaba, maksimal 500 qator). Formula injection avtomatik neytrallanadi.
                </p>

                <textarea
                  className="input"
                  style={{ minHeight: 140, fontFamily: "monospace", fontSize: "0.85rem" }}
                  placeholder={"Ism, Email, Telefon\nAli Valiyev, ali@cyberedu.uz, +998901234567\nVali Aliyev, vali@cyberedu.uz, +998907654321"}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  required
                />

                <div>
                  <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Barchasini ma&apos;lum guruhga biriktirish (Ixtiyoriy)</label>
                  <select className="input" value={csvGroupId} onChange={(e) => setCsvGroupId(e.target.value)}>
                    <option value="">Guruhsiz</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowCsvModal(false)}>
                    Bekor qilish
                  </button>
                  <button type="submit" disabled={csvImporting} className="btn btn-primary">
                    {csvImporting ? "Import qilinmoqda..." : "🚀 Importni Boshlash"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
