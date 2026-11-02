"use client";

import { useState, useEffect } from "react";

interface AssignmentItem {
  id: string;
  title: string;
  description: string;
  dueAt: string;
  effectiveDueAt: string;
  hasExtension: boolean;
  extensionReason: string | null;
  maxScore: number;
  allowFileUpload: boolean;
  allowedFileTypes: string;
  allowLateSubmission: boolean;
  latePenaltyPercent: number;
  course?: { id: number; title: string };
  group?: { id: string; name: string };
  lesson?: { id: number; title: string };
  mySubmission?: {
    id: string;
    status: "DRAFT" | "SUBMITTED" | "GRADED" | "RETURNED";
    score: number | null;
    isLate: boolean;
    submittedAt: string;
    gradedAt: string | null;
    instructorFeedback: string | null;
    version: number;
    fileName: string | null;
  } | null;
}

export default function UserAssignmentsTab() {
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Submit modal state
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentItem | null>(null);
  const [textContent, setTextContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/assignments");
      if (!res.ok) throw new Error("Vazifalarni yuklab bo'lmadi");
      const data = await res.json();
      if (data.success) {
        setAssignments(data.assignments || []);
      } else {
        setError(data.error);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAssignments();
  }, []);

  const openSubmitModal = (assignment: AssignmentItem) => {
    setSelectedAssignment(assignment);
    setTextContent("");
    setSelectedFile(null);
    setSubmitMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;

    if (!textContent.trim() && !selectedFile) {
      setSubmitMsg({ type: "error", text: "Matnli javob yoki fayl kiritilishi shart." });
      return;
    }

    try {
      setSubmitting(true);
      setSubmitMsg(null);

      const formData = new FormData();
      if (textContent.trim()) {
        formData.append("textContent", textContent.trim());
      }
      if (selectedFile) {
        formData.append("file", selectedFile);
      }

      const res = await fetch(`/api/assignments/${selectedAssignment.id}/submit`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitMsg({ type: "error", text: data.error || "Topshirishda xatolik yuz berdi" });
        return;
      }

      setSubmitMsg({ type: "success", text: "Vazifangiz muvaffaqiyatli topshirildi!" });
      fetchAssignments();
      setTimeout(() => {
        setSelectedAssignment(null);
      }, 1500);
    } catch (err: unknown) {
      setSubmitMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Topshirishda xatolik",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (a: AssignmentItem) => {
    const sub = a.mySubmission;
    if (!sub) {
      const isPast = new Date() > new Date(a.effectiveDueAt);
      if (isPast) {
        return <span style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "0.75rem", backgroundColor: "#ef444422", color: "#f87171", border: "1px solid #ef4444" }}>Muddati o&apos;tgan</span>;
      }
      return <span style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "0.75rem", backgroundColor: "#38bdf822", color: "#38bdf8", border: "1px solid #38bdf8" }}>Topshirilmagan</span>;
    }

    if (sub.status === "GRADED") {
      return <span style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "0.75rem", backgroundColor: "#22c55e22", color: "#4ade80", border: "1px solid #22c55e" }}>Baholangan: {sub.score} / {a.maxScore}</span>;
    }

    if (sub.status === "RETURNED") {
      return <span style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "0.75rem", backgroundColor: "#eab30822", color: "#facc15", border: "1px solid #eab308" }}>Qaytarilgan (Qayta topshiring)</span>;
    }

    return <span style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "0.75rem", backgroundColor: "#6366f122", color: "#818cf8", border: "1px solid #6366f1" }}>Tekshirilmoqda</span>;
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Uy vazifalari yuklanmoqda...</div>;
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f8fafc" }}>Uy vazifalari</h2>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: 4 }}>
            Guruhingiz va kurslaringiz bo&apos;yicha biriktirilgan amaliy vazifalar
          </p>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", backgroundColor: "#0f172a", borderRadius: 12, border: "1px solid #1e293b", color: "#64748b" }}>
          Hozircha sizga biriktirilgan faol vazifalar yo&apos;q.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {assignments.map((a) => {
            const isPastDue = new Date() > new Date(a.effectiveDueAt);
            const canSubmit = !a.mySubmission || a.mySubmission.status === "RETURNED" || (a.allowLateSubmission || !isPastDue);

            return (
              <div
                key={a.id}
                style={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: 12,
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "#f8fafc", margin: 0 }}>
                        {a.title}
                      </h3>
                      {getStatusBadge(a)}
                      {a.hasExtension && (
                        <span style={{ fontSize: "0.72rem", padding: "2px 6px", borderRadius: 4, backgroundColor: "#8b5cf622", color: "#a78bfa", border: "1px solid #8b5cf6" }}>
                          Muddat uzaytirilgan
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap" }}>
                      {a.group && <span>Guruh: <b>{a.group.name}</b></span>}
                      {a.course && <span>Kurs: <b>{a.course.title}</b></span>}
                      <span>Maksimal ball: <b>{a.maxScore}</b></span>
                      <span>
                        Muddat: <b>{new Date(a.effectiveDueAt).toLocaleString("uz-UZ")}</b>
                      </span>
                    </div>
                  </div>

                  {canSubmit && (
                    <button
                      type="button"
                      onClick={() => openSubmitModal(a)}
                      className="btn btn-primary"
                      style={{ padding: "7px 16px", fontSize: "0.85rem" }}
                    >
                      {a.mySubmission ? "Qayta topshirish" : "Topshirish"}
                    </button>
                  )}
                </div>

                <div style={{ fontSize: "0.88rem", color: "#cbd5e1", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {a.description}
                </div>

                {/* Talabaning mavjud topshirishi holati */}
                {a.mySubmission && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 12,
                      backgroundColor: "#1e293b55",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      fontSize: "0.82rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <span style={{ color: "#94a3b8" }}>
                        Topshirilgan vaqt: <b>{new Date(a.mySubmission.submittedAt).toLocaleString("uz-UZ")}</b> (v{a.mySubmission.version})
                        {a.mySubmission.isLate && <span style={{ color: "#f87171", marginLeft: 6 }}>(Kechikkan)</span>}
                      </span>
                      {a.mySubmission.fileName && (
                        <a
                          href={`/api/assignments/submissions/${a.mySubmission.id}/download`}
                          className="btn btn-ghost"
                          style={{ padding: "3px 8px", fontSize: "0.75rem", color: "#38bdf8" }}
                          download
                        >
                          📎 Yuklangan fayl ({a.mySubmission.fileName})
                        </a>
                      )}
                    </div>

                    {a.mySubmission.instructorFeedback && (
                      <div style={{ marginTop: 8, padding: "8px 10px", backgroundColor: "#0f172a", borderRadius: 6, borderLeft: "3px solid #38bdf8" }}>
                        <div style={{ fontWeight: 600, color: "#38bdf8", fontSize: "0.78rem" }}>Ustoz izohi:</div>
                        <div style={{ color: "#e2e8f0", marginTop: 2 }}>{a.mySubmission.instructorFeedback}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Topshirish Modali */}
      {selectedAssignment && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.75)",
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
              maxWidth: 600,
              width: "100%",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f8fafc" }}>
                Topshirish: {selectedAssignment.title}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedAssignment(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.2rem" }}
              >
                ✕
              </button>
            </div>

            {submitMsg && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  fontSize: "0.85rem",
                  backgroundColor: submitMsg.type === "success" ? "#22c55e22" : "#ef444422",
                  color: submitMsg.type === "success" ? "#4ade80" : "#f87171",
                }}
              >
                {submitMsg.text}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6 }}>
                  Javob matni (ixtiyoriy yoki yechim izohi)
                </label>
                <textarea
                  rows={5}
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Yechim tafsilotlarini yoki havolalarni yozing..."
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    color: "#f8fafc",
                    fontSize: "0.88rem",
                    outline: "none",
                  }}
                />
              </div>

              {selectedAssignment.allowFileUpload && (
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6 }}>
                    Fayl biriktirish (Maks 10 MB. Ruxsat etilgan: {selectedAssignment.allowedFileTypes})
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 8,
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      color: "#94a3b8",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setSelectedAssignment(null)}
                  className="btn btn-ghost"
                  style={{ padding: "8px 16px" }}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ padding: "8px 20px" }}
                >
                  {submitting ? "Yuborilmoqda..." : "Yuborish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
