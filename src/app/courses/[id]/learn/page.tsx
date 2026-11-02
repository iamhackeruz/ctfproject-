"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCourses } from "@/context/CourseContext";
import CyberTerminal from "@/components/CyberTerminal";
import { MarkdownView } from "@/components/MarkdownView";
import VideoPlayer from "@/components/video/VideoPlayer";
import styles from "./learn.module.css";

interface FlatLesson {
  id?: number;
  moduleIndex: number;
  lessonIndex: number;
  globalIndex: number;
  moduleTitle: string;
  title: string;
  duration: string;
  isFree?: boolean;
  isLocked?: boolean;
  lockedMessage?: string;
  content?: string;
  labSlug?: string;
}

interface QuizState {
  id: number;
  lessonId: number;
  title: string;
  passingScore: number;
  maxAttempts: number;
  questions: Array<{
    id: number;
    question: string;
    options: string[];
    order: number;
  }>;
}

function LearnContent() {
  const params = useParams();
  const courseId = Number(params?.id) || 1;

  const { courses, markLessonComplete, isLessonCompleted, getCourseProgress } = useCourses();
  const course = courses.find((c) => c.id === courseId) || courses[0];

  // Flatten lessons for seamless linear navigation
  const flatLessons: FlatLesson[] = useMemo(() => {
    if (!course?.modules) return [];
    let count = 0;
    const list: FlatLesson[] = [];
    course.modules.forEach((mod, mIdx) => {
      mod.lessons.forEach((les, lIdx) => {
        list.push({
          id: les.id,
          moduleIndex: mIdx,
          lessonIndex: lIdx,
          globalIndex: count++,
          moduleTitle: mod.title,
          title: les.title,
          duration: les.duration,
          isFree: les.isFree,
          isLocked: les.isLocked,
          lockedMessage: les.lockedMessage,
          content: les.content || undefined,
          labSlug: les.labSlug || undefined,
        });
      });
    });
    return list;
  }, [course]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<"notes" | "terminal" | "quiz" | "qa">("notes");

  // Server Quiz State
  const [quizData, setQuizData] = useState<QuizState | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number | string>>({});
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<{
    score: number;
    passed: boolean;
    passingScore: number;
    attemptsUsed: number;
    maxAttempts: number;
    message: string;
  } | null>(null);

  // Certificate State
  const [certCode, setCertCode] = useState<string | null>(null);
  const [certMsg, setCertMsg] = useState<string | null>(null);
  const [certLoading, setCertLoading] = useState(false);

  // Q&A state
  interface LessonCommentItem {
    id: number;
    authorName: string;
    content: string;
    instructorReply: string | null;
    createdAt: string;
  }
  const [qaList, setQaList] = useState<LessonCommentItem[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState("");

  const currentLesson = flatLessons[currentIdx] || flatLessons[0];
  const progressPercent = getCourseProgress(courseId);
  const isCurrentCompleted = isLessonCompleted(courseId, currentIdx);

  // Dars o'zgarganda serverdan testni yuklash va izohlarni olish
  useEffect(() => {
    const lessonId = currentLesson?.id || currentLesson?.globalIndex + 1;
    if (!lessonId) return;

    let isMounted = true;

    fetch(`/api/quizzes/${lessonId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        setSelectedAnswers({});
        setQuizLoading(false);
        if (data.success && data.quiz) {
          setQuizData(data.quiz);
          if (data.isPassed) {
            setQuizResult({
              score: data.bestScore || 100,
              passed: true,
              passingScore: data.quiz.passingScore,
              attemptsUsed: data.attemptsCount,
              maxAttempts: data.quiz.maxAttempts,
              message: "🎉 Siz ushbu testni muvaffaqiyatli topshirgansiz!",
            });
          } else {
            setQuizResult(null);
          }
        } else {
          setQuizData(null);
          setQuizResult(null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setQuizData(null);
          setQuizResult(null);
          setQuizLoading(false);
        }
      });

    // Savol-javoblarni serverdan yuklash
    fetch(`/api/comments?lessonId=${lessonId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && Array.isArray(data.comments)) {
          setQaList(data.comments);
        } else {
          setQaList([]);
        }
      })
      .catch(() => {
        if (isMounted) setQaList([]);
      });

    return () => {
      isMounted = false;
    };
  }, [currentLesson?.id, currentLesson?.globalIndex]);

  const handleNextLesson = () => {
    if (currentIdx < flatLessons.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const handlePrevLesson = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  const handleAnswerSelect = (questionId: number, answerValue: number | string) => {
    if (quizResult?.passed) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: answerValue,
    }));
  };

  const handleSubmitQuiz = async () => {
    const lessonId = currentLesson?.id || currentLesson?.globalIndex + 1;
    if (!lessonId || !quizData) return;

    setQuizSubmitting(true);
    setQuizResult(null);

    try {
      const res = await fetch(`/api/quizzes/${lessonId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: selectedAnswers }),
      });

      const data = await res.json();
      if (data.success) {
        setQuizResult({
          score: data.score,
          passed: data.passed,
          passingScore: data.passingScore,
          attemptsUsed: data.attemptsUsed,
          maxAttempts: data.maxAttempts,
          message: data.message,
        });

        if (data.passed) {
          await markLessonComplete(courseId, currentIdx);
        }
      } else {
        alert(data.error || "Testni topshirishda xatolik yuz berdi.");
      }
    } catch {
      alert("Server bilan aloqa uzildi.");
    } finally {
      setQuizSubmitting(false);
    }
  };

  const handleClaimCertificate = async () => {
    setCertLoading(true);
    setCertMsg(null);
    try {
      const res = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const data = await res.json();
      if (data.success && data.certificate) {
        setCertCode(data.certificate.certificateCode);
        setCertMsg("🎉 Tabriklaymiz! Rasmiy sertifikatingiz muvaffaqiyatli tayyorlandi!");
      } else {
        setCertMsg(data.error || "Sertifikat olish shartlari bajarilmadi.");
      }
    } catch {
      setCertMsg("Server bilan bog'lanishda xatolik.");
    } finally {
      setCertLoading(false);
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || commentSubmitting) return;
    const lessonId = currentLesson?.id || currentLesson?.globalIndex + 1;
    if (!lessonId) return;

    setCommentSubmitting(true);
    setCommentError("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, content: newQuestion.trim() }),
      });
      const data = await res.json();
      if (data.success && data.comment) {
        setQaList((prev) => [data.comment, ...prev]);
        setNewQuestion("");
      } else {
        setCommentError(data.error || "Savol yuborishda xatolik yuz berdi");
      }
    } catch {
      setCommentError("Server bilan bog'lanishda xatolik yuz berdi");
    } finally {
      setCommentSubmitting(false);
    }
  };

  if (!course) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#f1f5f9" }}>
        <h2>Kurs topilmadi</h2>
        <Link href="/courses" className="btn btn-primary" style={{ marginTop: 20 }}>
          Kurslar ro&apos;yxatiga qaytish
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Topbar */}
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <Link href={`/courses/${course.id}`} className={styles.backBtn}>
            ← Kursga qaytish
          </Link>
          <span className={styles.courseHeaderTitle}>
            {course.icon} {course.title}
          </span>
        </div>

        <div className={styles.topbarRight}>
          <div className={styles.progressMini}>
            <span>
              {currentIdx + 1} / {flatLessons.length} dars
            </span>
            <div className={styles.progressMiniBar}>
              <div className={styles.progressMiniFill} style={{ width: `${progressPercent}%` }} />
            </div>
            <strong style={{ color: "#38bdf8" }}>{progressPercent}%</strong>
          </div>

          {progressPercent === 100 && (
            <button
              type="button"
              onClick={handleClaimCertificate}
              disabled={certLoading}
              className="btn btn-green"
              style={{ padding: "6px 12px", fontSize: "0.8rem" }}
            >
              {certLoading ? "Tayyorlanmoqda..." : "🎓 Sertifikat Olish"}
            </button>
          )}

          <Link href="/dashboard" className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
            Kabinet
          </Link>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className={styles.layout}>
        {/* Left / Center Video & Notes area */}
        <main className={styles.contentArea}>
          {certMsg && (
            <div
              style={{
                marginBottom: 16,
                padding: "14px 18px",
                borderRadius: 8,
                background: certCode ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                border: `1px solid ${certCode ? "#10b981" : "#ef4444"}`,
                color: "#fff",
              }}
            >
              <div>{certMsg}</div>
              {certCode && (
                <div style={{ marginTop: 8 }}>
                  Sertifikat kodi: <strong style={{ color: "#34d399" }}>{certCode}</strong>{" "}
                  <Link
                    href={`/certificate/verify/${certCode}`}
                    className="btn btn-primary"
                    style={{ marginLeft: 12, padding: "4px 10px", fontSize: "0.75rem" }}
                  >
                    Tekshirish sahifasi
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Real Video Player with Range streaming, speed, watermark, progress */}
          <div style={{ marginBottom: 20 }}>
            <VideoPlayer
              lessonId={currentLesson?.id || currentLesson?.globalIndex + 1 || 1}
              lessonTitle={currentLesson?.title || "Dars"}
              onCompleted={() => markLessonComplete(courseId, currentIdx)}
            />
          </div>

          {/* Action Bar */}
          <div className={styles.actionBar}>
            <div>
              <h2 className={styles.lessonInfoTitle}>{currentLesson?.title}</h2>
              <div className={styles.lessonInfoSub}>
                Modul: {currentLesson?.moduleTitle}
              </div>
            </div>

            <div className={styles.actionBtns}>
              <button
                type="button"
                onClick={handlePrevLesson}
                disabled={currentIdx === 0}
                className="btn btn-ghost"
                style={{ opacity: currentIdx === 0 ? 0.4 : 1 }}
              >
                ← Oldingi dars
              </button>

              <button
                type="button"
                onClick={() => markLessonComplete(courseId, currentIdx)}
                className={`btn ${isCurrentCompleted ? "btn-green" : "btn-primary"}`}
              >
                {isCurrentCompleted ? "✓ Tugatildi" : "Tugatdim deb belgilash"}
              </button>

              <button
                type="button"
                onClick={handleNextLesson}
                disabled={currentIdx === flatLessons.length - 1}
                className="btn btn-ghost"
                style={{ opacity: currentIdx === flatLessons.length - 1 ? 0.4 : 1 }}
              >
                Keyingi dars →
              </button>
            </div>
          </div>

          {/* Tabs underneath player */}
          <div>
            {currentLesson?.isLocked ? (
              <div
                className="card"
                style={{
                  padding: "48px 24px",
                  textAlign: "center",
                  background: "rgba(239, 68, 68, 0.05)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: 12,
                  margin: "20px 0",
                }}
              >
                <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔒</div>
                <h3 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f87171", marginBottom: 8 }}>
                  Dars Qulflangan
                </h3>
                <p style={{ color: "#cbd5e1", maxWidth: 520, margin: "0 auto 20px", fontSize: "0.95rem" }}>
                  {currentLesson.lockedMessage || "Ushbu darsni ko'rish uchun Premium obuna talab etiladi."}
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <Link href="/dashboard" className="btn btn-primary">
                    🔑 Kirish huquqlarimni tekshirish
                  </Link>
                  <Link href="/courses" className="btn btn-ghost">
                    📚 Boshqa kurslar
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.tabsRow}>
                  <button
                    type="button"
                    className={`${styles.tabBtn} ${activeTab === "notes" ? styles.tabBtnActive : ""}`}
                    onClick={() => setActiveTab("notes")}
                  >
                    📝 Dars Konspekti
                  </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "terminal" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("terminal")}
              >
                💻 Interaktiv Terminal
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "quiz" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("quiz")}
              >
                ❓ Dars Testi {quizData ? `(${quizData.questions.length} savol)` : ""}
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "qa" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("qa")}
              >
                💬 Savol-Javoblar ({qaList.length})
              </button>
            </div>

            <div className={`card ${styles.tabPanel}`}>
              {/* Tab 1: Notes (Xavfsiz Markdown Renderer) */}
              {activeTab === "notes" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {currentLesson?.content ? (
                    <MarkdownView content={currentLesson.content} />
                  ) : (
                    <div>
                      <h3 style={{ fontSize: "1.2rem", color: "#38bdf8" }}>
                        📌 &quot;{currentLesson?.title}&quot; mavzusi bo&apos;yicha xulosalar
                      </h3>
                      <p style={{ color: "#cbd5e1", lineHeight: 1.7, fontSize: "0.92rem" }}>
                        Ushbu dars kiberxavfsizlik amaliyotining eng muhim qismlarini o&apos;z ichiga oladi.
                      </p>
                    </div>
                  )}

                  {/* Mavzuga oid amaliy laboratoriya havolasi (Requirement 3) */}
                  {currentLesson?.labSlug && (
                    <div
                      style={{
                        marginTop: 20,
                        padding: "16px 20px",
                        background: "rgba(56, 189, 248, 0.08)",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        borderRadius: 10,
                      }}
                    >
                      <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: "0.95rem", marginBottom: 6 }}>
                        🧪 Ushbu Darsga Oid Amaliy Laboratoriya: {currentLesson.labSlug}
                      </div>
                      <p style={{ color: "#cbd5e1", fontSize: "0.88rem", margin: "0 0 12px 0" }}>
                        Nazariyani real amaliyotda mustahkamlang va maxsus dinamik bayroqni (flag) qo&apos;lga kiriting!
                      </p>
                      <div style={{ display: "flex", gap: 12 }}>
                        <Link href="/labs" className="btn btn-primary" style={{ fontSize: "0.82rem" }}>
                          🚀 Laboratoriyani Boshlash
                        </Link>
                        <button
                          type="button"
                          onClick={() => setActiveTab("terminal")}
                          className="btn btn-ghost"
                          style={{ fontSize: "0.82rem" }}
                        >
                          💻 Shu yerda Terminalda Sinash
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Terminal */}
              {activeTab === "terminal" && (
                <CyberTerminal
                  sessionId={`course-${courseId}`}
                  courseId={courseId}
                  labSlug={currentLesson?.labSlug}
                />
              )}

              {/* Tab 3: Server-side Quiz (Requirement 4) */}
              {activeTab === "quiz" && (
                <div className={styles.quizCard}>
                  {quizLoading ? (
                    <div style={{ color: "#94a3b8", padding: 20 }}>Test savollari yuklanmoqda...</div>
                  ) : !quizData || quizData.questions.length === 0 ? (
                    <div style={{ color: "#94a3b8", padding: 20 }}>
                      Ushbu dars uchun mini-test hali biriktirilmagan.
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <span className="badge badge-blue">
                          O&apos;tish bali: {quizData.passingScore}% • Maksimal urinishlar: {quizData.maxAttempts} ta
                        </span>
                        {quizResult?.passed && (
                          <span className="badge badge-green">✓ Test muvaffaqiyatli topshirilgan</span>
                        )}
                      </div>

                      {quizResult && (
                        <div
                          style={{
                            padding: "12px 16px",
                            borderRadius: 8,
                            marginBottom: 16,
                            background: quizResult.passed ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                            border: `1px solid ${quizResult.passed ? "#10b981" : "#ef4444"}`,
                            color: "#fff",
                            fontWeight: 600,
                          }}
                        >
                          {quizResult.message} (To&apos;plangan ball: {quizResult.score}%)
                        </div>
                      )}

                      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        {quizData.questions.map((q, qIndex) => (
                          <div
                            key={q.id}
                            style={{
                              background: "rgba(15, 23, 42, 0.6)",
                              padding: 16,
                              borderRadius: 10,
                              border: "1px solid #1e293b",
                            }}
                          >
                            <div style={{ color: "#f1f5f9", fontWeight: 700, marginBottom: 12, fontSize: "0.95rem" }}>
                              {qIndex + 1}. {q.question}
                            </div>

                            <div className={styles.quizOptions}>
                              {q.options.map((optText, optIdx) => {
                                const isSelected =
                                  selectedAnswers[q.id] === optText || selectedAnswers[q.id] === optIdx;
                                let btnClass = styles.quizOption;
                                if (isSelected) btnClass += ` ${styles.quizOptionSelected}`;

                                return (
                                  <button
                                    key={optIdx}
                                    type="button"
                                    className={btnClass}
                                    disabled={quizResult?.passed}
                                    onClick={() => handleAnswerSelect(q.id, optText)}
                                  >
                                    <span style={{ color: "#38bdf8", marginRight: 8, fontWeight: 700 }}>
                                      {String.fromCharCode(65 + optIdx)})
                                    </span>
                                    {optText}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {!quizResult?.passed && (
                        <div style={{ marginTop: 20 }}>
                          <button
                            type="button"
                            disabled={
                              quizSubmitting ||
                              Object.keys(selectedAnswers).length < quizData.questions.length
                            }
                            onClick={handleSubmitQuiz}
                            className="btn btn-primary"
                          >
                            {quizSubmitting ? "Tekshirilmoqda..." : "Testni Yakunlash va Tekshirish"}
                          </button>
                          {Object.keys(selectedAnswers).length < quizData.questions.length && (
                            <span style={{ marginLeft: 12, color: "#94a3b8", fontSize: "0.85rem" }}>
                              Barcha savollarga javob belgilang ({Object.keys(selectedAnswers).length}/{quizData.questions.length})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Q&A */}
              {activeTab === "qa" && (
                <div>
                  <form onSubmit={handleAddQuestion} style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="Dars bo'yicha savolingiz bormi? Bu yerga yozing..."
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                        disabled={commentSubmitting}
                      />
                      <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }} disabled={commentSubmitting}>
                        {commentSubmitting ? "Yuborilmoqda..." : "Yuborish"}
                      </button>
                    </div>
                    {commentError && (
                      <div style={{ color: "#ef4444", fontSize: "0.85rem" }}>
                        ⚠️ {commentError}
                      </div>
                    )}
                  </form>

                  <div className={styles.forumList}>
                    {qaList.length === 0 ? (
                      <div style={{ color: "#94a3b8", fontSize: "0.9rem", textAlign: "center", padding: "20px 0" }}>
                        Ushbu dars bo&apos;yicha hali savollar yo&apos;q. Birinchi bo&apos;lib savol qoldiring!
                      </div>
                    ) : (
                      qaList.map((item) => (
                        <div key={item.id} className={styles.forumItem}>
                          <div className={styles.forumHeader}>
                            <span style={{ fontSize: "1.2rem" }}>👨‍🎓</span>
                            <span className={styles.forumAuthor}>{item.authorName}</span>
                            <span className={styles.forumDate}>• {new Date(item.createdAt).toLocaleDateString("uz-UZ")}</span>
                          </div>
                          <div className={styles.forumBody}>
                            <strong>Savol: </strong> {item.content}
                          </div>
                          {item.instructorReply && (
                            <div
                              style={{
                                marginTop: 10,
                                padding: "10px 14px",
                                borderRadius: 8,
                                background: "rgba(56, 189, 248, 0.08)",
                                borderLeft: "3px solid #38bdf8",
                                fontSize: "0.85rem",
                                color: "#cbd5e1",
                              }}
                            >
                              <span style={{ color: "#38bdf8", fontWeight: 700, display: "block", marginBottom: 2 }}>
                                👨‍🏫 Instruktor javobi:
                              </span>
                              {item.instructorReply}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            </>
          )}
          </div>
        </main>

        {/* Right Sidebar Syllabus */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>📚 Darslar Sillabusi</span>
            <span style={{ fontSize: "0.8rem", color: "#34d399" }}>{progressPercent}% tayyor</span>
          </div>

          <div className={styles.sidebarBody}>
            {course.modules.map((mod, mIdx) => (
              <div key={mIdx} className={styles.moduleSection}>
                <div className={styles.moduleSectionTitle}>{mod.title}</div>
                <ul className={styles.sidebarLessonList}>
                  {mod.lessons.map((les, lIdx) => {
                    const globalItem = flatLessons.find(
                      (fl) => fl.moduleIndex === mIdx && fl.lessonIndex === lIdx
                    );
                    const isCompleted = globalItem
                      ? isLessonCompleted(courseId, globalItem.globalIndex)
                      : false;
                    const isActive = globalItem?.globalIndex === currentIdx;

                    return (
                      <li
                        key={lIdx}
                        onClick={() => globalItem && setCurrentIdx(globalItem.globalIndex)}
                        className={`${styles.sidebarLessonItem} ${isActive ? styles.sidebarLessonActive : ""}`}
                      >
                        <div className={styles.sidebarLessonLeft}>
                          <span
                            className={`${styles.sidebarLessonStatus} ${
                              isCompleted ? styles.statusDone : styles.statusPending
                            }`}
                          >
                            {isCompleted ? "✓" : "○"}
                          </span>
                          <span className={styles.sidebarLessonName}>{les.title}</span>
                        </div>
                        <span className={styles.sidebarLessonDuration}>{les.duration}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function CourseLearnPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#fff", textAlign: "center" }}>Dars yuklanmoqda...</div>}>
      <LearnContent />
    </Suspense>
  );
}
