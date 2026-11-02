"use client";

import { useState, useEffect } from "react";

interface GroupItem {
  id: string;
  name: string;
}

interface CourseItem {
  id: number;
  title: string;
}

interface AssignmentItem {
  id: string;
  title: string;
  description: string;
  dueAt: string;
  maxScore: number;
  allowFileUpload: boolean;
  allowedFileTypes: string;
  isPublished: boolean;
  allowLateSubmission: boolean;
  latePenaltyPercent: number;
  groupId: string | null;
  courseId: number | null;
  group?: { id: string; name: string };
  course?: { id: number; title: string };
  _count?: { submissions: number };
}

interface SubmissionItem {
  id: string;
  userId: string;
  status: "DRAFT" | "SUBMITTED" | "GRADED" | "RETURNED";
  score: number | null;
  isLate: boolean;
  submittedAt: string;
  fileName: string | null;
  textContent: string | null;
  instructorFeedback: string | null;
  version: number;
  user: {
    id: string;
    name: string;
    email: string;
    groupMemberships?: Array<{ group: { name: string } }>;
  };
  grader?: { name: string } | null;
}

export default function AdminAssignmentsTab() {
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modallar
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewingAssignment, setViewingAssignment] = useState<AssignmentItem | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Baholash modali
  const [gradingSubmission, setGradingSubmission] = useState<SubmissionItem | null>(null);
  const [scoreInput, setScoreInput] = useState<number | string>("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [gradingStatus, setGradingStatus] = useState<"GRADED" | "RETURNED">("GRADED");
  const [submittingGrade, setSubmittingGrade] = useState(false);

  // Muddat uzaytirish modali
  const [extensionTarget, setExtensionTarget] = useState<SubmissionItem | null>(null);
  const [extendedDate, setExtendedDate] = useState("");
  const [extensionReason, setExtensionReason] = useState("");
  const [savingExtension, setSavingExtension] = useState(false);

  // Yangi vazifa formasi
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    groupId: "",
    courseId: "",
    dueAt: "",
    maxScore: 100,
    allowFileUpload: true,
    allowedFileTypes: "txt,md,pdf,zip,png,jpg,py,sh",
    isPublished: true,
    allowLateSubmission: false,
    latePenaltyPercent: 0,
  });
  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    try {
      const [resAss, resGrp, resCrs] = await Promise.all([
        fetch("/api/assignments"),
        fetch("/api/admin/groups"),
        fetch("/api/courses"),
      ]);

      if (resAss.ok) {
        const d = await resAss.json();
        setAssignments(d.assignments || []);
      }
      if (resGrp.ok) {
        const d = await resGrp.json();
        setGroups(d.groups || []);
      }
      if (resCrs.ok) {
        const d = await resCrs.json();
        setCourses(d.courses || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      setFormMsg(null);

      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          groupId: formData.groupId || null,
          courseId: formData.courseId ? Number(formData.courseId) : null,
          dueAt: formData.dueAt,
          maxScore: Number(formData.maxScore),
          allowFileUpload: formData.allowFileUpload,
          allowedFileTypes: formData.allowedFileTypes,
          isPublished: formData.isPublished,
          allowLateSubmission: formData.allowLateSubmission,
          latePenaltyPercent: Number(formData.latePenaltyPercent),
        }),
      });

      const d = await res.json();
      if (!res.ok || !d.success) {
        setFormMsg({ type: "error", text: d.error || "Vazifa yaratishda xatolik" });
        return;
      }

      setFormMsg({ type: "success", text: "Vazifa muvaffaqiyatli yaratildi!" });
      fetchData();
      setTimeout(() => {
        setIsCreateOpen(false);
        setFormMsg(null);
      }, 1000);
    } catch (err: unknown) {
      setFormMsg({ type: "error", text: err instanceof Error ? err.message : "Xatolik" });
    } finally {
      setCreating(false);
    }
  };

  const openSubmissionsView = async (assignment: AssignmentItem) => {
    setViewingAssignment(assignment);
    try {
      setLoadingSubmissions(true);
      const res = await fetch(`/api/assignments/${assignment.id}/submissions`);
      if (res.ok) {
        const d = await res.json();
        setSubmissions(d.submissions || []);
      }
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission) return;

    try {
      setSubmittingGrade(true);
      const res = await fetch(`/api/assignments/submissions/${gradingSubmission.id}/grade`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: gradingStatus === "GRADED" ? Number(scoreInput) : null,
          instructorFeedback: feedbackInput,
          status: gradingStatus,
        }),
      });

      const d = await res.json();
      if (res.ok && d.success) {
        setGradingSubmission(null);
        if (viewingAssignment) openSubmissionsView(viewingAssignment);
      } else {
        alert(d.error || "Baholashda xatolik");
      }
    } finally {
      setSubmittingGrade(false);
    }
  };

  const handleExtensionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extensionTarget || !viewingAssignment) return;

    try {
      setSavingExtension(true);
      const res = await fetch(`/api/assignments/${viewingAssignment.id}/extensions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: extensionTarget.userId,
          extendedDueAt: extendedDate,
          reason: extensionReason,
        }),
      });

      const d = await res.json();
      if (res.ok && d.success) {
        alert("Muddat uzaytirildi va talabaga bildirishnoma yuborildi.");
        setExtensionTarget(null);
      } else {
        alert(d.error || "Muddatni uzaytirishda xatolik");
      }
    } finally {
      setSavingExtension(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm("Haqiqatan ham ushbu vazifani o'chirmoqchimisiz?")) return;
    try {
      const res = await fetch(`/api/assignments/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchData();
        if (viewingAssignment?.id === id) setViewingAssignment(null);
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Yuklanmoqda...</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f8fafc" }}>Uy vazifalarini boshqarish</h2>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: 4 }}>
            Guruh va kurslar uchun vazifalar yaratish, tekshirish va baholash
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="btn btn-primary"
          style={{ padding: "8px 18px", fontSize: "0.88rem" }}
        >
          + Yangi vazifa yaratish
        </button>
      </div>

      {assignments.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", backgroundColor: "#0f172a", borderRadius: 12, border: "1px solid #1e293b", color: "#64748b" }}>
          Hozircha hech qanday vazifa yaratilmagan.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {assignments.map((a) => (
            <div
              key={a.id}
              style={{
                backgroundColor: "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: 12,
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "#f8fafc", margin: 0 }}>
                    {a.title}
                  </h3>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: "0.72rem",
                      backgroundColor: a.isPublished ? "#22c55e22" : "#94a3b822",
                      color: a.isPublished ? "#4ade80" : "#94a3b8",
                      border: `1px solid ${a.isPublished ? "#22c55e" : "#475569"}`,
                    }}
                  >
                    {a.isPublished ? "E'lon qilingan" : "Qoralama"}
                  </span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {a.group && <span>Guruh: <b>{a.group.name}</b></span>}
                  {a.course && <span>Kurs: <b>{a.course.title}</b></span>}
                  <span>Maksimal ball: <b>{a.maxScore}</b></span>
                  <span>Muddat: <b>{new Date(a.dueAt).toLocaleString("uz-UZ")}</b></span>
                  <span>Topshiriqlar soni: <b>{a._count?.submissions || 0}</b></span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => openSubmissionsView(a)}
                  className="btn btn-outline"
                  style={{ padding: "6px 14px", fontSize: "0.82rem" }}
                >
                  Topshiriqlarni ko&apos;rish ({a._count?.submissions || 0})
                </button>
                <a
                  href={`/api/assignments/${a.id}/submissions/export`}
                  className="btn btn-ghost"
                  style={{ padding: "6px 10px", fontSize: "0.82rem", color: "#38bdf8" }}
                  title="CSV yuklab olish"
                >
                  📥 CSV
                </a>
                <button
                  type="button"
                  onClick={() => handleDeleteAssignment(a.id)}
                  className="btn btn-ghost"
                  style={{ padding: "6px 10px", fontSize: "0.82rem", color: "#f87171" }}
                  title="O'chirish"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Topshiriqlar ro'yxati modali / oynasi */}
      {viewingAssignment && (
        <div
          onClick={() => setViewingAssignment(null)}
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
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 14,
              maxWidth: 900,
              width: "100%",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                  Topshiriqlar: {viewingAssignment.title}
                </h3>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: 2 }}>
                  Maksimal ball: {viewingAssignment.maxScore} | Muddat: {new Date(viewingAssignment.dueAt).toLocaleString("uz-UZ")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <a
                  href={`/api/assignments/${viewingAssignment.id}/submissions/export`}
                  className="btn btn-primary"
                  style={{ padding: "5px 12px", fontSize: "0.8rem" }}
                >
                  CSV Eksport
                </a>
                <button
                  type="button"
                  onClick={() => setViewingAssignment(null)}
                  style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.2rem" }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ padding: 20, flex: 1, overflowY: "auto" }}>
              {loadingSubmissions ? (
                <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>Yuklanmoqda...</div>
              ) : submissions.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>Ushbu vazifaga hali hech kim topshiriq yubormagan.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {submissions.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        backgroundColor: "#1e293b33",
                        border: "1px solid #334155",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontWeight: 600, color: "#f8fafc", fontSize: "0.95rem" }}>{s.user.name}</span>
                          <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>({s.user.email})</span>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontSize: "0.72rem",
                              backgroundColor: s.status === "GRADED" ? "#22c55e22" : s.status === "RETURNED" ? "#eab30822" : "#38bdf822",
                              color: s.status === "GRADED" ? "#4ade80" : s.status === "RETURNED" ? "#facc15" : "#38bdf8",
                            }}
                          >
                            {s.status}
                          </span>
                          {s.isLate && <span style={{ color: "#f87171", fontSize: "0.75rem" }}>⚠️ Kechikkan</span>}
                        </div>

                        <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: 4 }}>
                          Topshirilgan: {new Date(s.submittedAt).toLocaleString("uz-UZ")} | Versiya: v{s.version}
                        </div>

                        {s.textContent && (
                          <div style={{ marginTop: 8, padding: "8px 10px", backgroundColor: "#0f172a", borderRadius: 6, fontSize: "0.82rem", color: "#cbd5e1" }}>
                            {s.textContent}
                          </div>
                        )}

                        <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                          {s.fileName && (
                            <a
                              href={`/api/assignments/submissions/${s.id}/download`}
                              className="btn btn-outline"
                              style={{ padding: "4px 10px", fontSize: "0.75rem", color: "#38bdf8" }}
                              download
                            >
                              📎 {s.fileName} yuklab olish
                            </a>
                          )}

                          {s.score !== null && (
                            <span style={{ fontSize: "0.82rem", color: "#4ade80", fontWeight: 600 }}>
                              Baho: {s.score} / {viewingAssignment.maxScore}
                            </span>
                          )}

                          {s.instructorFeedback && (
                            <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                              Izoh: {s.instructorFeedback}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setGradingSubmission(s);
                            setScoreInput(s.score !== null ? s.score : "");
                            setFeedbackInput(s.instructorFeedback || "");
                            setGradingStatus(s.status === "RETURNED" ? "RETURNED" : "GRADED");
                          }}
                          className="btn btn-primary"
                          style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                        >
                          Baholash
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExtensionTarget(s);
                            setExtendedDate(new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 16));
                            setExtensionReason("");
                          }}
                          className="btn btn-ghost"
                          style={{ padding: "6px 12px", fontSize: "0.8rem", color: "#a78bfa" }}
                        >
                          Muddat uzaytirish
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Baholash Modali */}
      {gradingSubmission && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 12,
              maxWidth: 500,
              width: "100%",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
              Baholash: {gradingSubmission.user.name}
            </h3>

            <form onSubmit={handleGradeSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6 }}>
                  Qaror
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", color: "#f8fafc", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="gradingStatus"
                      checked={gradingStatus === "GRADED"}
                      onChange={() => setGradingStatus("GRADED")}
                    />
                    Baholash (Ball qo&apos;yish)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", color: "#facc15", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="gradingStatus"
                      checked={gradingStatus === "RETURNED"}
                      onChange={() => setGradingStatus("RETURNED")}
                    />
                    Qayta topshirish uchun qaytarish
                  </label>
                </div>
              </div>

              {gradingStatus === "GRADED" && (
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6 }}>
                    Ball (0 dan {viewingAssignment?.maxScore || 100} gacha)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={viewingAssignment?.maxScore || 100}
                    value={scoreInput}
                    onChange={(e) => setScoreInput(e.target.value)}
                    required
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
              )}

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6 }}>
                  Ustoz izohi / fikr-mulohazasi
                </label>
                <textarea
                  rows={3}
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  placeholder="Xatoliklar yoki tavsiyalar..."
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

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setGradingSubmission(null)}
                  className="btn btn-ghost"
                  style={{ padding: "8px 14px" }}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={submittingGrade}
                  className="btn btn-primary"
                  style={{ padding: "8px 18px" }}
                >
                  {submittingGrade ? "Saqlanmoqda..." : "Saqlash va bildirish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Muddat uzaytirish modali */}
      {extensionTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
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
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
              Muddat uzaytirish: {extensionTarget.user.name}
            </h3>

            <form onSubmit={handleExtensionSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6 }}>
                  Yangi muddat (Sana va vaqt)
                </label>
                <input
                  type="datetime-local"
                  value={extendedDate}
                  onChange={(e) => setExtendedDate(e.target.value)}
                  required
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
                  Sabab (ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  placeholder="Masalan: Kasallik tufayli"
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

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setExtensionTarget(null)}
                  className="btn btn-ghost"
                  style={{ padding: "8px 14px" }}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={savingExtension}
                  className="btn btn-primary"
                  style={{ padding: "8px 18px" }}
                >
                  {savingExtension ? "Saqlanmoqda..." : "Uzaytirish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Yangi vazifa yaratish modali */}
      {isCreateOpen && (
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
              maxWidth: 650,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                Yangi uy vazifasi yaratish
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.2rem" }}
              >
                ✕
              </button>
            </div>

            {formMsg && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  fontSize: "0.85rem",
                  backgroundColor: formMsg.type === "success" ? "#22c55e22" : "#ef444422",
                  color: formMsg.type === "success" ? "#4ade80" : "#f87171",
                }}
              >
                {formMsg.text}
              </div>
            )}

            <form onSubmit={handleCreateAssignment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6 }}>
                  Vazifa sarlavhasi *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Masalan: SQL Injection amaliy topshirig'i"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    color: "#f8fafc",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6 }}>
                  Tavsif va ko&apos;rsatmalar (Markdown qo&apos;llab-quvvatlaydi) *
                </label>
                <textarea
                  rows={5}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Vazifa shartlarini va talablarini yozing..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    color: "#f8fafc",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6 }}>
                    Guruhga biriktirish (ixtiyoriy)
                  </label>
                  <select
                    id="assignment-create-group"
                    value={formData.groupId}
                    onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      color: "#f8fafc",
                    }}
                  >
                    <option value="">-- Guruhni tanlang --</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6 }}>
                    Kursga biriktirish (ixtiyoriy)
                  </label>
                  <select
                    value={formData.courseId}
                    onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      color: "#f8fafc",
                    }}
                  >
                    <option value="">-- Kursni tanlang --</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6 }}>
                    Topshirish muddati *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.dueAt}
                    onChange={(e) => setFormData({ ...formData, dueAt: e.target.value })}
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
                    Maksimal ball
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={formData.maxScore}
                    onChange={(e) => setFormData({ ...formData, maxScore: Number(e.target.value) })}
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
              </div>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "10px 0" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "#f8fafc", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={formData.allowFileUpload}
                    onChange={(e) => setFormData({ ...formData, allowFileUpload: e.target.checked })}
                  />
                  Fayl yuklashga ruxsat
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "#f8fafc", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={formData.isPublished}
                    onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                  />
                  Darhol e&apos;lon qilish
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "#f8fafc", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={formData.allowLateSubmission}
                    onChange={(e) => setFormData({ ...formData, allowLateSubmission: e.target.checked })}
                  />
                  Kech topshirishga ruxsat
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="btn btn-ghost"
                  style={{ padding: "8px 16px" }}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn btn-primary"
                  style={{ padding: "8px 20px" }}
                >
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
