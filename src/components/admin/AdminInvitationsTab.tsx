"use client";

import { useState, useEffect, useCallback } from "react";

interface InvitationItem {
  id: string;
  code: string;
  createdBy: string;
  usedCount: number;
  maxUses: number;
  expiresAt: string;
  isExpired: boolean;
  isFullyUsed: boolean;
  createdAt: string;
  group: { id: string; name: string } | null;
}

interface GroupOption {
  id: string;
  name: string;
}

export default function AdminInvitationsTab() {
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [maxUses, setMaxUses] = useState("1");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [creating, setCreating] = useState(false);

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invitations");
      const data = await res.json();
      if (data.success) {
        setInvitations(data.invitations || []);
      }
    } catch {
      setError("Taklif kodlarini yuklashda xatolik.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInvitations();
    // Load groups
    fetch("/api/admin/groups")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.groups)) {
          setGroups(data.groups.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })));
        }
      })
      .catch(() => {});
  }, [fetchInvitations]);

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMsg("");
    setError("");

    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customCode: customCode.trim() || undefined,
          expiresInDays,
          maxUses,
          groupId: selectedGroupId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(`Taklif kodi yaratildi: ${data.invitation.code}`);
        setShowCreateModal(false);
        setCustomCode("");
        fetchInvitations();
      } else {
        setError(data.error || "Yaratishda xatolik.");
      }
    } catch {
      setError("Server xatosi.");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (item: InvitationItem) => {
    if (!confirm(`'${item.code}' taklif kodini bekor qilishni tasdiqlaysizmi?`)) return;

    try {
      const res = await fetch(`/api/admin/invitations?id=${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setMsg("Taklif kodi bekor qilindi.");
        fetchInvitations();
      } else {
        setError(data.error || "Bekor qilishda xatolik.");
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
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>🎫 Taklif Kodlari (Invitation Codes)</h2>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
            Ochiq ro&apos;yxatdan o&apos;tish yopiqligida yangi talabalarga bir martalik yoki guruhli taklif kodlari berish
          </p>
        </div>

        <button type="button" className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          ➕ Yangi Kod Yaratish
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

      {/* Invitations Table */}
      <div className="card" style={{ padding: 20, overflowX: "auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#38bdf8" }}>Kodlar yuklanmoqda...</div>
        ) : invitations.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>Hozircha faol taklif kodlari yo&apos;q.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155", textAlign: "left", color: "#94a3b8" }}>
                <th style={{ padding: "10px 8px" }}>Taklif Kodi</th>
                <th style={{ padding: "10px 8px" }}>Guruh</th>
                <th style={{ padding: "10px 8px" }}>Foydalanish</th>
                <th style={{ padding: "10px 8px" }}>Amal Qilish Muddati</th>
                <th style={{ padding: "10px 8px" }}>Holat</th>
                <th style={{ padding: "10px 8px", textAlign: "right" }}>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "12px 8px" }}>
                    <code style={{ background: "#0f172a", border: "1px solid #334155", padding: "4px 8px", borderRadius: 6, color: "#38bdf8", fontWeight: "bold" }}>
                      {inv.code}
                    </code>
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    {inv.group ? (
                      <span className="badge badge-green">{inv.group.name}</span>
                    ) : (
                      <span style={{ color: "#64748b", fontSize: "0.8rem" }}>Guruhsiz</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    <span style={{ fontWeight: 600 }}>{inv.usedCount}</span> / {inv.maxUses} marta
                  </td>
                  <td style={{ padding: "12px 8px", fontSize: "0.82rem", color: "#94a3b8" }}>
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    {inv.isFullyUsed ? (
                      <span className="badge" style={{ background: "rgba(100, 116, 139, 0.2)", color: "#94a3b8" }}>
                        Ishlatilgan
                      </span>
                    ) : inv.isExpired ? (
                      <span className="badge" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171" }}>
                        Muddati o&apos;tgan
                      </span>
                    ) : (
                      <span className="badge badge-green">✓ Faol</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "right" }}>
                    <button
                      type="button"
                      style={{ background: "#7f1d1d", color: "#fca5a5", border: "none", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: "0.78rem" }}
                      onClick={() => handleRevoke(inv)}
                    >
                      Bekor qilish
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ maxWidth: 480, width: "100%", padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>➕ Yangi Taklif Kodi Yaratish</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.2rem" }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInvitation} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                  Maxsus Kod Matni (Bo&apos;sh qoldirilsa, avtomatik generatsiya qilinadi)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Masalan: CYBER-GURUH-2026"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    Amal qilish muddati (kun)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    className="input"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    Maksimal ishlatish limiti
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    className="input"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                  Guruhga avtomatik biriktirish (Ixtiyoriy)
                </label>
                <select className="input" value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
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
          </div>
        </div>
      )}
    </div>
  );
}
