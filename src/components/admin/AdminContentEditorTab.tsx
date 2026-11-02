"use client";

import { useState, useEffect, useCallback } from "react";
import { MarkdownView } from "@/components/MarkdownView";

interface QuizQuestionItem {
  id?: number;
  question: string;
  options: string[];
  correctOption: number;
  explanation?: string;
  order?: number;
}

interface LessonItem {
  id: number;
  moduleId: number;
  title: string;
  duration: string;
  isFree: boolean;
  accessType?: "FREE" | "PREMIUM" | "PAID_COURSE";
  isPublished: boolean;
  content: string | null;
  labSlug: string | null;
  order: number;
}

interface ModuleItem {
  id: number;
  courseId: number;
  title: string;
  duration: string;
  order: number;
  lessons: LessonItem[];
}

interface CourseItem {
  id: number;
  slug: string;
  title: string;
  icon: string;
  desc: string;
  fullDesc: string;
  level: string;
  duration: string;
  isPublished: boolean;
  modules: ModuleItem[];
}

export default function AdminContentEditorTab() {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  // Active lesson being edited in the Markdown/Lesson editor
  const [editingLesson, setEditingLesson] = useState<LessonItem | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDuration, setLessonDuration] = useState("");
  const [lessonIsFree, setLessonIsFree] = useState(false);
  const [lessonAccessType, setLessonAccessType] = useState<"FREE" | "PREMIUM" | "PAID_COURSE">("FREE");
  const [lessonIsPublished, setLessonIsPublished] = useState(true);
  const [lessonContent, setLessonContent] = useState("");
  const [lessonLabSlug, setLessonLabSlug] = useState("");
  const [previewTab, setPreviewTab] = useState<"edit" | "preview" | "split">("split");
  const [savingLesson, setSavingLesson] = useState(false);

  // Add Module Modal
  const [showAddModule, setShowAddModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModuleDuration, setNewModuleDuration] = useState("1 soat");

  // Add Lesson Modal
  const [targetModuleId, setTargetModuleId] = useState<number | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonDuration, setNewLessonDuration] = useState("15 daqiqa");
  const [newLessonIsFree, setNewLessonIsFree] = useState(false);

  // Quiz Editor Modal
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizLessonId, setQuizLessonId] = useState<number | null>(null);
  const [quizTitle, setQuizTitle] = useState("Dars bo'yicha oraliq test");
  const [quizPassingScore, setQuizPassingScore] = useState(70);
  const [quizMaxAttempts, setQuizMaxAttempts] = useState(3);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionItem[]>([]);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [savingQuiz, setSavingQuiz] = useState(false);

  // Video Management State
  interface LessonVideoItem {
    id: string;
    lessonId: number;
    fileKey: string;
    originalName: string;
    sizeBytes: number;
    durationSec: number;
    createdAt: string;
  }
  const [lessonVideo, setLessonVideo] = useState<LessonVideoItem | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoMsg, setVideoMsg] = useState("");
  const [videoError, setVideoError] = useState("");
  const [previewVideo, setPreviewVideo] = useState(false);

  // Storage stats
  interface StorageStatsData {
    usedFormatted: string;
    freeFormatted: string;
    totalFormatted: string;
    videoCount: number;
  }
  const [storageStats, setStorageStats] = useState<StorageStatsData | null>(null);

  const fetchStorageStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/videos/storage-stats");
      const data = await res.json();
      if (data.success && data.stats) {
        setStorageStats(data.stats);
      }
    } catch {}
  }, []);

  const fetchLessonVideo = useCallback(async (lessonId: number) => {
    setLoadingVideo(true);
    setLessonVideo(null);
    setVideoMsg("");
    setVideoError("");
    setPreviewVideo(false);
    try {
      const res = await fetch(`/api/admin/videos/${lessonId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.video) {
          setLessonVideo(data.video);
        }
      }
    } catch {}
    finally {
      setLoadingVideo(false);
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/courses");
      const data = await res.json();
      if (data.success && Array.isArray(data.courses)) {
        setCourses(data.courses);
        if (data.courses.length > 0 && selectedCourseId === null) {
          setSelectedCourseId(data.courses[0].id);
        }
      }
    } catch {
      setError("Kurslarni yuklashda xatolik.");
    } finally {
      setLoading(false);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCourses();
    fetchStorageStats();
  }, [fetchCourses, fetchStorageStats]);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) || null;

  // Toggle Course Published / Draft
  const handleToggleCoursePublish = async (courseId: number) => {
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_publish" }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(data.message || "Kurs holati o'zgartirildi.");
        fetchCourses();
      } else {
        setError(data.error || "Xatolik yuz berdi.");
      }
    } catch {
      setError("Server xatosi.");
    }
  };

  // Delete Course
  const handleDeleteCourse = async (courseId: number, title: string) => {
    if (!confirm(`DIQQAT: '${title}' kursi va uning barcha darslari butunlay o'chiriladi!\nTasdiqlaysizmi?`)) return;

    try {
      const res = await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setMsg("Kurs muvaffaqiyatli o'chirildi.");
        setSelectedCourseId(null);
        fetchCourses();
      } else {
        setError(data.error || "O'chirishda xatolik.");
      }
    } catch {
      setError("Server xatosi.");
    }
  };

  // Add Module
  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !newModuleTitle.trim()) return;

    try {
      const res = await fetch(`/api/courses/${selectedCourseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_module",
          title: newModuleTitle.trim(),
          duration: newModuleDuration.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg("Yangi modul qo'shildi.");
        setShowAddModule(false);
        setNewModuleTitle("");
        fetchCourses();
      } else {
        setError(data.error || "Xatolik.");
      }
    } catch {
      setError("Server xatosi.");
    }
  };

  // Delete Module
  const handleDeleteModule = async (moduleId: number) => {
    if (!selectedCourseId || !confirm("Modulni o'chirishni tasdiqlaysizmi?")) return;

    try {
      const res = await fetch(`/api/courses/${selectedCourseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_module", moduleId }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg("Modul o'chirildi.");
        fetchCourses();
      }
    } catch {
      setError("Server xatosi.");
    }
  };

  // Add Lesson
  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !targetModuleId || !newLessonTitle.trim()) return;

    try {
      const res = await fetch(`/api/courses/${selectedCourseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_lesson",
          moduleId: targetModuleId,
          title: newLessonTitle.trim(),
          duration: newLessonDuration.trim(),
          isFree: newLessonIsFree,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg("Yangi dars qo'shildi.");
        setTargetModuleId(null);
        setNewLessonTitle("");
        fetchCourses();
      } else {
        setError(data.error || "Xatolik.");
      }
    } catch {
      setError("Server xatosi.");
    }
  };

  // Delete Lesson
  const handleDeleteLesson = async (lessonId: number) => {
    if (!selectedCourseId || !confirm("Darsni o'chirishni tasdiqlaysizmi?")) return;

    try {
      const res = await fetch(`/api/courses/${selectedCourseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_lesson", lessonId }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg("Dars o'chirildi.");
        if (editingLesson?.id === lessonId) setEditingLesson(null);
        fetchCourses();
      }
    } catch {
      setError("Server xatosi.");
    }
  };

  // Open Lesson in Editor
  const handleStartEditLesson = (lesson: LessonItem) => {
    setEditingLesson(lesson);
    setLessonTitle(lesson.title);
    setLessonDuration(lesson.duration);
    setLessonIsFree(lesson.isFree);
    setLessonAccessType((lesson.accessType as "FREE" | "PREMIUM" | "PAID_COURSE") || "FREE");
    setLessonIsPublished(lesson.isPublished);
    setLessonContent(lesson.content || "");
    setLessonLabSlug(lesson.labSlug || "");
    fetchLessonVideo(lesson.id);
  };

  const handleUploadVideo = (file: File) => {
    if (!editingLesson || !file) return;
    setVideoUploading(true);
    setVideoProgress(0);
    setVideoMsg("");
    setVideoError("");

    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `/api/admin/videos/upload?lessonId=${editingLesson.id}&originalName=${encodeURIComponent(file.name)}`
    );
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.setRequestHeader("x-file-name", file.name);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        setVideoProgress(pct);
      }
    };

    xhr.onload = () => {
      setVideoUploading(false);
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.success) {
          setVideoMsg("Video muvaffaqiyatli yuklandi!");
          setLessonVideo(data.video);
          fetchStorageStats();
        } else {
          setVideoError(data.error || "Video yuklashda xatolik.");
        }
      } catch {
        setVideoError("Serverdan noto'g'ri javob qaytdi.");
      }
    };

    xhr.onerror = () => {
      setVideoUploading(false);
      setVideoError("Tarmoq yoki yuklash xatosi yuz berdi.");
    };

    xhr.send(file);
  };

  const handleDeleteVideo = async () => {
    if (!editingLesson || !window.confirm("Ushbu dars videosini o'chirishni tasdiqlaysizmi?")) return;
    setVideoUploading(true);
    setVideoError("");
    setVideoMsg("");
    try {
      const res = await fetch(`/api/admin/videos/${editingLesson.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setVideoMsg("Video muvaffaqiyatli o'chirildi.");
        setLessonVideo(null);
        setPreviewVideo(false);
        fetchStorageStats();
      } else {
        setVideoError(data.error || "Videoni o'chirishda xatolik.");
      }
    } catch {
      setVideoError("Server xatosi.");
    } finally {
      setVideoUploading(false);
    }
  };

  // Save Lesson changes
  const handleSaveLesson = async () => {
    if (!selectedCourseId || !editingLesson) return;
    setSavingLesson(true);
    setMsg("");
    setError("");

    try {
      const res = await fetch(`/api/courses/${selectedCourseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_lesson",
          lessonId: editingLesson.id,
          title: lessonTitle.trim(),
          duration: lessonDuration.trim(),
          isFree: lessonIsFree,
          accessType: lessonAccessType,
          isPublished: lessonIsPublished,
          content: lessonContent,
          labSlug: lessonLabSlug.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg("Dars o'zgarishlari muvaffaqiyatli saqlandi!");
        fetchCourses();
      } else {
        setError(data.error || "Saqlashda xatolik.");
      }
    } catch {
      setError("Server xatosi.");
    } finally {
      setSavingLesson(false);
    }
  };

  // Open Quiz Modal
  const handleOpenQuizModal = async (lessonId: number) => {
    setQuizLessonId(lessonId);
    setShowQuizModal(true);
    setLoadingQuiz(true);
    setError("");

    try {
      const res = await fetch(`/api/quizzes/${lessonId}?adminView=true`);
      const data = await res.json();
      if (data.success && data.quiz) {
        setQuizTitle(data.quiz.title || "Dars bo'yicha oraliq test");
        setQuizPassingScore(data.quiz.passingScore || 70);
        setQuizMaxAttempts(data.quiz.maxAttempts || 3);
        setQuizQuestions(data.quiz.questions || []);
      } else {
        // Yangi test
        setQuizTitle("Dars bo'yicha oraliq test");
        setQuizPassingScore(70);
        setQuizMaxAttempts(3);
        setQuizQuestions([
          {
            question: "1-savol matni...",
            options: ["1-variant", "2-variant", "3-variant", "4-variant"],
            correctOption: 0,
            explanation: "To'g'ri javob izohi...",
          },
        ]);
      }
    } catch {
      setError("Testni yuklashda xatolik.");
    } finally {
      setLoadingQuiz(false);
    }
  };

  // Save Quiz
  const handleSaveQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizLessonId) return;
    setSavingQuiz(true);
    setError("");

    try {
      const res = await fetch(`/api/quizzes/${quizLessonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quizTitle.trim(),
          passingScore: Number(quizPassingScore),
          maxAttempts: Number(quizMaxAttempts),
          questions: quizQuestions,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg("Test muvaffaqiyatli saqlandi!");
        setShowQuizModal(false);
      } else {
        setError(data.error || "Testni saqlashda xatolik.");
      }
    } catch {
      setError("Server xatosi.");
    } finally {
      setSavingQuiz(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header & Course Switcher */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>📚 Kurslar, Modullar va Kontent Redaktori</h2>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
            Barcha kurslar, modullar, darslar konspekti (Markdown) va testlarni boshqarish
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {storageStats && (
            <div
              data-testid="video-storage-widget"
              style={{
                background: "rgba(15, 23, 42, 0.9)",
                border: "1px solid #334155",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: "0.8rem",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#94a3b8",
              }}
            >
              <span>💾 Video Xotirasi:</span>
              <strong style={{ color: "#38bdf8" }}>{storageStats.usedFormatted} band</strong>
              <span>/</span>
              <span style={{ color: "#34d399" }}>{storageStats.freeFormatted} bo&apos;sh</span>
              <span style={{ background: "#1e293b", padding: "2px 6px", borderRadius: 4, fontSize: "0.75rem" }}>
                {storageStats.videoCount} ta video
              </span>
            </div>
          )}

          {selectedCourse && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                className={selectedCourse.isPublished ? "btn btn-outline" : "btn btn-green"}
                onClick={() => handleToggleCoursePublish(selectedCourse.id)}
              >
                {selectedCourse.isPublished ? "🔒 Qoralamaga O'tkazish" : "🚀 E'lon Qilish (Publish)"}
              </button>
              <button
                type="button"
                style={{ background: "#7f1d1d", color: "#fca5a5", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: "0.85rem" }}
                onClick={() => handleDeleteCourse(selectedCourse.id, selectedCourse.title)}
              >
                🗑️ Kursni O&apos;chirish
              </button>
            </div>
          )}
        </div>
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

      {/* Course Selector Tabs */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
        {courses.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setSelectedCourseId(c.id);
              setEditingLesson(null);
            }}
            style={{
              background: selectedCourseId === c.id ? "rgba(56, 189, 248, 0.15)" : "#0f172a",
              color: selectedCourseId === c.id ? "#38bdf8" : "#94a3b8",
              border: selectedCourseId === c.id ? "1px solid #38bdf8" : "1px solid #334155",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            <span>{c.icon}</span>
            <span>{c.title}</span>
            {!c.isPublished && (
              <span style={{ fontSize: "0.7rem", background: "#f59e0b", color: "#000", padding: "1px 5px", borderRadius: 4, fontWeight: "bold" }}>
                Draft
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main Layout: Left = Modules & Lessons Tree; Right = Markdown Lesson Editor */}
      <div style={{ display: "grid", gridTemplateColumns: editingLesson ? "340px 1fr" : "1fr", gap: 20 }}>
        {/* Left: Modules Tree */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
              Modullar ({selectedCourse?.modules?.length || 0})
            </h3>
            <button
              type="button"
              className="btn btn-outline"
              style={{ padding: "4px 10px", fontSize: "0.8rem" }}
              onClick={() => setShowAddModule(true)}
            >
              + Modul
            </button>
          </div>

          {loading ? (
            <div style={{ color: "#38bdf8", fontSize: "0.85rem" }}>Yuklanmoqda...</div>
          ) : selectedCourse?.modules && selectedCourse.modules.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {selectedCourse.modules.map((m) => (
                <div key={m.id} style={{ background: "#0b1120", border: "1px solid #1e293b", borderRadius: 8, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong style={{ fontSize: "0.9rem", color: "#38bdf8" }}>{m.title}</strong>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        style={{ background: "#1e293b", color: "#34d399", border: "none", padding: "2px 6px", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}
                        onClick={() => {
                          setTargetModuleId(m.id);
                          setNewLessonTitle("");
                        }}
                        title="Dars qo'shish"
                      >
                        + Dars
                      </button>
                      <button
                        type="button"
                        style={{ background: "#3b0764", color: "#fca5a5", border: "none", padding: "2px 6px", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}
                        onClick={() => handleDeleteModule(m.id)}
                        title="Modulni o'chirish"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Lessons list in module */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 6 }}>
                    {m.lessons.map((les) => (
                      <div
                        key={les.id}
                        onClick={() => handleStartEditLesson(les)}
                        style={{
                          background: editingLesson?.id === les.id ? "rgba(56, 189, 248, 0.18)" : "#0f172a",
                          border: editingLesson?.id === les.id ? "1px solid #38bdf8" : "1px solid #1e293b",
                          padding: "6px 10px",
                          borderRadius: 6,
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "0.82rem",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{les.isFree ? "🎁" : "📖"}</span>
                          <span style={{ color: les.isPublished ? "#f8fafc" : "#94a3b8" }}>{les.title}</span>
                          {!les.isPublished && (
                            <span style={{ fontSize: "0.65rem", color: "#f59e0b" }}>(qoralama)</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLesson(les.id);
                          }}
                          style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.75rem" }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#64748b", fontSize: "0.85rem" }}>Bu kursda hali modullar yo&apos;q.</div>
          )}
        </div>

        {/* Right: Lesson Editor & Markdown Live Preview */}
        {editingLesson ? (
          <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#38bdf8" }}>
                  ✏️ Darsni Tahrirlash: {lessonTitle}
                </h3>
                <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>ID: {editingLesson.id}</span>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => handleOpenQuizModal(editingLesson.id)}
                  style={{ padding: "6px 12px", fontSize: "0.82rem" }}
                >
                  📝 Oraliq Testni Tahrirlash
                </button>
                <button
                  type="button"
                  disabled={savingLesson}
                  className="btn btn-primary"
                  onClick={handleSaveLesson}
                  style={{ padding: "6px 16px", fontSize: "0.85rem" }}
                >
                  {savingLesson ? "Saqlanmoqda..." : "💾 Saqlash"}
                </button>
              </div>
            </div>

            {/* Lesson Metadata inputs */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Dars Nomi</label>
                <input type="text" className="input" value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Davomiyligi</label>
                <input type="text" className="input" value={lessonDuration} onChange={(e) => setLessonDuration(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Bog&apos;liq Lab Slug</label>
                <input type="text" className="input" placeholder="masalan: lab-linux-1" value={lessonLabSlug} onChange={(e) => setLessonLabSlug(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", cursor: "pointer" }}>
                <input type="checkbox" checked={lessonIsFree} onChange={(e) => setLessonIsFree(e.target.checked)} />
                <span>🎁 Bepul namuna (isFree)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", cursor: "pointer" }}>
                <input type="checkbox" checked={lessonIsPublished} onChange={(e) => setLessonIsPublished(e.target.checked)} />
                <span>📢 Talabalarga ko&apos;rinsin (Published)</span>
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
                <span style={{ color: "#94a3b8" }}>Kirish turi:</span>
                <select
                  className="input"
                  style={{ padding: "4px 8px", fontSize: "0.82rem" }}
                  value={lessonAccessType}
                  onChange={(e) => setLessonAccessType(e.target.value as "FREE" | "PREMIUM" | "PAID_COURSE")}
                >
                  <option value="FREE">FREE (Standart)</option>
                  <option value="PREMIUM">PREMIUM (Obuna kerak)</option>
                  <option value="PAID_COURSE">PAID_COURSE (Pullik)</option>
                </select>
              </div>
            </div>

            {/* Video Darslik Paneli (Oqimli yuklash, almashtirish, o'chirish) */}
            <div
              data-testid="admin-lesson-video-panel"
              style={{
                background: "#0b1120",
                border: "1px solid #1e293b",
                borderRadius: 8,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#38bdf8", display: "flex", alignItems: "center", gap: 6 }}>
                    🎬 Video Darslik (H.264 / AAC MP4)
                  </h4>
                  <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                    Faqat MP4 formati, max 1.5 GB. Serverda magic-bytes va disk bo&apos;sh joyi tekshiriladi.
                  </span>
                </div>
                {lessonVideo && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setPreviewVideo(!previewVideo)}
                      style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                    >
                      {previewVideo ? "Yopish" : "▶ Ko'rish"}
                    </button>
                    <button
                      type="button"
                      disabled={videoUploading}
                      onClick={handleDeleteVideo}
                      style={{ background: "#7f1d1d", color: "#fca5a5", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: "0.78rem", cursor: "pointer" }}
                    >
                      🗑️ Videoni O&apos;chirish
                    </button>
                  </div>
                )}
              </div>

              {videoMsg && (
                <div style={{ background: "rgba(52, 211, 153, 0.12)", border: "1px solid rgba(52, 211, 153, 0.3)", color: "#34d399", padding: "6px 12px", borderRadius: 6, fontSize: "0.82rem" }}>
                  ✅ {videoMsg}
                </div>
              )}
              {videoError && (
                <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", padding: "6px 12px", borderRadius: 6, fontSize: "0.82rem" }}>
                  ⚠️ {videoError}
                </div>
              )}

              {loadingVideo ? (
                <div style={{ color: "#94a3b8", fontSize: "0.82rem" }}>Video ma&apos;lumotlari tekshirilmoqda...</div>
              ) : lessonVideo ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0f172a", padding: "8px 12px", borderRadius: 6, border: "1px solid #1e293b", fontSize: "0.85rem" }}>
                    <div>
                      <strong style={{ color: "#f8fafc" }}>📁 {lessonVideo.originalName || "video.mp4"}</strong>
                      <span style={{ color: "#94a3b8", marginLeft: 8, fontSize: "0.8rem" }}>
                        ({(lessonVideo.sizeBytes / (1024 * 1024)).toFixed(1)} MB)
                      </span>
                    </div>
                    <span style={{ color: "#34d399", fontSize: "0.8rem", fontWeight: 600 }}>● Joylangan</span>
                  </div>

                  {previewVideo && (
                    <div style={{ marginTop: 8 }}>
                      <video
                        controls
                        style={{ width: "100%", maxHeight: 320, borderRadius: 8, background: "#000" }}
                        src={`/api/videos/${editingLesson.id}/stream`}
                      />
                    </div>
                  )}

                  <div style={{ marginTop: 4 }}>
                    <label style={{ fontSize: "0.78rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                      Videoni almashtirish (Yangi MP4 yuklash):
                    </label>
                    <input
                      type="file"
                      accept="video/mp4"
                      disabled={videoUploading}
                      data-testid="video-replace-input"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadVideo(file);
                      }}
                      style={{ fontSize: "0.82rem", color: "#cbd5e1" }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input
                      type="file"
                      accept="video/mp4"
                      disabled={videoUploading}
                      data-testid="video-upload-input"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadVideo(file);
                      }}
                      style={{ fontSize: "0.85rem", color: "#cbd5e1" }}
                    />
                    <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                      Hozircha video biriktirilmagan.
                    </span>
                  </div>
                </div>
              )}

              {videoUploading && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#38bdf8", marginBottom: 4 }}>
                    <span>Video yuklanmoqda va tekshirilmoqda...</span>
                    <span>{videoProgress}%</span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
                    <div
                      data-testid="video-upload-progress"
                      style={{ width: `${videoProgress}%`, height: "100%", background: "#38bdf8", transition: "width 0.2s" }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Markdown View Toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #1e293b", paddingTop: 12 }}>
              <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>Dars Konspekti (Markdown):</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setPreviewTab("edit")}
                  style={{ background: previewTab === "edit" ? "#38bdf8" : "#1e293b", color: previewTab === "edit" ? "#000" : "#fff", border: "none", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: "0.78rem" }}
                >
                  Faqat Kod
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("preview")}
                  style={{ background: previewTab === "preview" ? "#38bdf8" : "#1e293b", color: previewTab === "preview" ? "#000" : "#fff", border: "none", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: "0.78rem" }}
                >
                  Faqat Ko&apos;rinish
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("split")}
                  style={{ background: previewTab === "split" ? "#38bdf8" : "#1e293b", color: previewTab === "split" ? "#000" : "#fff", border: "none", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: "0.78rem" }}
                >
                  Yonma-yon (Split)
                </button>
              </div>
            </div>

            {/* Editor Area */}
            <div style={{ display: "grid", gridTemplateColumns: previewTab === "split" ? "1fr 1fr" : "1fr", gap: 16 }}>
              {(previewTab === "edit" || previewTab === "split") && (
                <textarea
                  className="input"
                  style={{ minHeight: 400, fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: "0.88rem", lineHeight: 1.5, resize: "vertical" }}
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                  placeholder="Markdown matnini yozing..."
                />
              )}

              {(previewTab === "preview" || previewTab === "split") && (
                <div style={{ minHeight: 400, background: "#0b1120", border: "1px solid #1e293b", borderRadius: 8, padding: 18, overflowY: "auto", maxHeight: 500 }}>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: 8, textTransform: "uppercase" }}>Oldindan Ko&apos;rish (MarkdownView)</div>
                  <MarkdownView content={lessonContent} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
            Tahrirlash uchun chapdagi ro&apos;yxatdan birorta darsni tanlang.
          </div>
        )}
      </div>

      {/* Add Module Modal */}
      {showAddModule && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ maxWidth: 440, width: "100%", padding: 24 }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 14 }}>➕ Yangi Modul Qo&apos;shish</h3>
            <form onSubmit={handleAddModule} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Modul Nomi *</label>
                <input type="text" className="input" placeholder="1-Modul: Kiberxavfsizlikka Kirish" value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Taxminiy Davomiyligi</label>
                <input type="text" className="input" value={newModuleDuration} onChange={(e) => setNewModuleDuration(e.target.value)} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModule(false)}>Bekor qilish</button>
                <button type="submit" className="btn btn-primary">Qo&apos;shish</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Lesson Modal */}
      {targetModuleId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ maxWidth: 440, width: "100%", padding: 24 }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 14 }}>➕ Yangi Dars Qo&apos;shish</h3>
            <form onSubmit={handleAddLesson} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Dars Nomi *</label>
                <input type="text" className="input" placeholder="1-Dars: Axborot xavfsizligi asoslari" value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Davomiyligi</label>
                <input type="text" className="input" value={newLessonDuration} onChange={(e) => setNewLessonDuration(e.target.value)} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", cursor: "pointer" }}>
                <input type="checkbox" checked={newLessonIsFree} onChange={(e) => setNewLessonIsFree(e.target.checked)} />
                <span>🎁 Bepul kirish (isFree)</span>
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setTargetModuleId(null)}>Bekor qilish</button>
                <button type="submit" className="btn btn-primary">Qo&apos;shish</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quiz Editor Modal */}
      {showQuizModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ maxWidth: 760, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#38bdf8" }}>📝 Oraliq Test (Quiz) Redaktori</h3>
              <button type="button" onClick={() => setShowQuizModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.2rem" }}>
                ✕
              </button>
            </div>

            {loadingQuiz ? (
              <div style={{ textAlign: "center", padding: 40, color: "#38bdf8" }}>Test yuklanmoqda...</div>
            ) : (
              <form onSubmit={handleSaveQuiz} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Test Sarlavhasi</label>
                    <input type="text" className="input" value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>O&apos;tish Bali (%)</label>
                    <input type="number" min="1" max="100" className="input" value={quizPassingScore} onChange={(e) => setQuizPassingScore(Number(e.target.value))} required />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Max Urinishlar</label>
                    <input type="number" min="1" max="10" className="input" value={quizMaxAttempts} onChange={(e) => setQuizMaxAttempts(Number(e.target.value))} required />
                  </div>
                </div>

                {/* Questions List */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <h4 style={{ fontSize: "1rem", color: "#f8fafc" }}>Savollar ({quizQuestions.length} ta)</h4>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                    onClick={() => {
                      setQuizQuestions((prev) => [
                        ...prev,
                        {
                          question: `${prev.length + 1}-savol matni...`,
                          options: ["A variant", "B variant", "C variant", "D variant"],
                          correctOption: 0,
                          explanation: "Izoh...",
                        },
                      ]);
                    }}
                  >
                    + Savol Qo&apos;shish
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {quizQuestions.map((q, qIdx) => (
                    <div key={qIdx} style={{ background: "#0b1120", border: "1px solid #1e293b", padding: 14, borderRadius: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, color: "#38bdf8", fontSize: "0.88rem" }}>{qIdx + 1}-savol</span>
                        <button
                          type="button"
                          onClick={() => {
                            setQuizQuestions((prev) => prev.filter((_, idx) => idx !== qIdx));
                          }}
                          style={{ background: "#7f1d1d", color: "#fca5a5", border: "none", padding: "2px 6px", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}
                        >
                          Savolni o&apos;chirish
                        </button>
                      </div>

                      <input
                        type="text"
                        className="input"
                        placeholder="Savol matnini kiriting..."
                        value={q.question}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuizQuestions((prev) => prev.map((item, idx) => (idx === qIdx ? { ...item, question: val } : item)));
                        }}
                        style={{ marginBottom: 10 }}
                        required
                      />

                      {/* 4 Options */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="radio"
                              name={`correct_${qIdx}`}
                              checked={q.correctOption === oIdx}
                              onChange={() => {
                                setQuizQuestions((prev) =>
                                  prev.map((item, idx) => (idx === qIdx ? { ...item, correctOption: oIdx } : item))
                                );
                              }}
                              style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#34d399" }}
                              title="To'g'ri javob deb belgilash"
                            />
                            <input
                              type="text"
                              className="input"
                              placeholder={`${oIdx + 1}-variant...`}
                              value={opt}
                              onChange={(e) => {
                                const val = e.target.value;
                                setQuizQuestions((prev) =>
                                  prev.map((item, idx) => {
                                    if (idx !== qIdx) return item;
                                    const nextOpts = [...item.options];
                                    nextOpts[oIdx] = val;
                                    return { ...item, options: nextOpts };
                                  })
                                );
                              }}
                              required
                            />
                            {q.correctOption === oIdx && (
                              <span style={{ fontSize: "0.78rem", color: "#34d399", fontWeight: "bold" }}>✓ To&apos;g&apos;ri</span>
                            )}
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: 8 }}>
                        <input
                          type="text"
                          className="input"
                          placeholder="To'g'ri javob izohi (ixtiyoriy)..."
                          value={q.explanation || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuizQuestions((prev) => prev.map((item, idx) => (idx === qIdx ? { ...item, explanation: val } : item)));
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowQuizModal(false)}>
                    Bekor qilish
                  </button>
                  <button type="submit" disabled={savingQuiz} className="btn btn-primary">
                    {savingQuiz ? "Saqlanmoqda..." : "💾 Testni Saqlash"}
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
