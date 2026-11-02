"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { useCourses } from "@/context/CourseContext";
import styles from "./dashboard.module.css";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminGroupsTab from "@/components/admin/AdminGroupsTab";
import AdminInvitationsTab from "@/components/admin/AdminInvitationsTab";
import AdminContentEditorTab from "@/components/admin/AdminContentEditorTab";
import AdminAuditLogsTab from "@/components/admin/AdminAuditLogsTab";
import AdminInstancesTab from "@/components/admin/AdminInstancesTab";
import AdminExportTab from "@/components/admin/AdminExportTab";
import AdminEntitlementsTab from "@/components/admin/AdminEntitlementsTab";
import UserEntitlementsTab from "@/components/UserEntitlementsTab";
import UserAssignmentsTab from "@/components/UserAssignmentsTab";
import UserAttendanceTab from "@/components/UserAttendanceTab";
import UserTelegramSettings from "@/components/UserTelegramSettings";
import AdminAssignmentsTab from "@/components/admin/AdminAssignmentsTab";
import AdminAttendanceTab from "@/components/admin/AdminAttendanceTab";
import { AdminHealthTab } from "@/components/admin/AdminHealthTab";

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();
  const { courses, addCourse, deleteCourse, getCourseProgress } = useCourses();

  const [activeTab, setActiveTab] = useState<
    | "courses"
    | "tasks"
    | "certificates"
    | "createCourse"
    | "settings"
    | "instructorLabs"
    | "adminUsers"
    | "adminGroups"
    | "adminInvitations"
    | "adminContent"
    | "adminLogs"
    | "adminInstances"
    | "adminExport"
    | "adminEntitlements"
    | "entitlements"
    | "assignments"
    | "attendance"
    | "adminAssignments"
    | "adminAttendance"
    | "adminHealth"
  >("courses");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Ustoz / Admin Laboratoriyalar & Tahlil holati
  interface AnalyticsData {
    stats: {
      totalUsers: number;
      totalEnrollments: number;
      totalSubmissions: number;
      correctSubmissions: number;
      successRate: number;
    };
    topHintLabs: Array<{
      id: string;
      slug: string;
      title: string;
      category: string;
      hintsUsedCount: number;
    }>;
    recentSubmissions: Array<{
      id: string;
      userName: string;
      userEmail: string;
      labTitle: string;
      submittedFlag: string;
      isCorrect: boolean;
      pointsEarned: number;
      isFirstBlood: boolean;
      hintsUsed: number;
      createdAt: string;
    }>;
    labAnalytics: Array<{
      id: string;
      slug: string;
      title: string;
      category: string;
      difficulty: string;
      points: number;
      totalSubmissions: number;
      hintsUsedCount: number;
    }>;
  }

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Yangi Lab yaratish formasi
  const [newLabSlug, setNewLabSlug] = useState("");
  const [newLabTitle, setNewLabTitle] = useState("");
  const [newLabCategory, setNewLabCategory] = useState<"Linux" | "Kriptografiya" | "Web" | "Tarmoq">("Linux");
  const [newLabDifficulty, setNewLabDifficulty] = useState<"Oson" | "O'rta" | "Qiyin">("Oson");
  const [newLabPoints, setNewLabPoints] = useState(50);
  const [newLabType, setNewLabType] = useState<"terminal" | "static" | "web-instance">("terminal");
  const [newLabDesc, setNewLabDesc] = useState("");
  const [newLabHint1, setNewLabHint1] = useState("");
  const [newLabHint2, setNewLabHint2] = useState("");
  const [newLabHint3, setNewLabHint3] = useState("");
  const [newLabGuide, setNewLabGuide] = useState("");
  const [labActionMsg, setLabActionMsg] = useState("");
  const [creatingLab, setCreatingLab] = useState(false);

  const fetchAnalytics = async () => {
    try {
      setLoadingAnalytics(true);
      const res = await fetch("/api/admin/analytics");
      const data = await res.json();
      if (data.success) {
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Analytics fetch xatosi:", err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleCreateLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabTitle.trim()) return;
    setCreatingLab(true);
    setLabActionMsg("");
    try {
      const res = await fetch("/api/labs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_lab",
          title: newLabTitle.trim(),
          slug: newLabSlug.trim() || `lab-${Date.now()}`,
          category: newLabCategory,
          difficulty: newLabDifficulty,
          points: newLabPoints,
          type: newLabType,
          description: newLabDesc.trim(),
          hint1: newLabHint1.trim() || null,
          hint2: newLabHint2.trim() || null,
          hint3: newLabHint3.trim() || null,
          guide: newLabGuide.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLabActionMsg("Yangi laboratoriya muvaffaqiyatli yaratildi!");
        setNewLabTitle("");
        setNewLabSlug("");
        setNewLabDesc("");
        setNewLabHint1("");
        setNewLabHint2("");
        setNewLabHint3("");
        setNewLabGuide("");
        fetchAnalytics();
      } else {
        setLabActionMsg(data.error || "Xatolik yuz berdi");
      }
    } catch {
      setLabActionMsg("Server bilan aloqada xatolik");
    } finally {
      setCreatingLab(false);
    }
  };

  const handleDeleteLab = async (labId: string) => {
    if (!confirm("Haqiqatan ham ushbu laboratoriyani o'chirmoqchimisiz?")) return;
    try {
      const res = await fetch("/api/labs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_lab", id: labId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchAnalytics();
      } else {
        alert(data.error || "O'chirishda xatolik");
      }
    } catch {
      alert("Server xatosi");
    }
  };

  // Settings tab state for teacher / profile
  const [settingsName, setSettingsName] = useState(user?.name || "Bosh Ustoz");
  const [settingsEmail, setSettingsEmail] = useState(user?.email || "");
  const [settingsPhone, setSettingsPhone] = useState(user?.phone || "+998 90 123 45 67");
  const [settingsOldPass, setSettingsOldPass] = useState("");
  const [settingsNewPass, setSettingsNewPass] = useState("");
  const [settingsConfirmPass, setSettingsConfirmPass] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Active sessions state
  interface ActiveSessionItem {
    id: string;
    createdAt: string;
    expiresAt: string;
    ip: string;
    userAgent: string;
    isCurrent: boolean;
  }
  const [mySessions, setMySessions] = useState<ActiveSessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const fetchMySessions = async () => {
    try {
      setSessionsLoading(true);
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list-sessions" }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.sessions)) {
        setMySessions(data.sessions);
      }
    } catch {
      // ignore
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRevokeMySession = async (sessionId: string) => {
    if (!confirm("Ushbu sessiyani tugatmoqchimisiz?")) return;
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke-session", sessionId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchMySessions();
      }
    } catch {
      // ignore
    }
  };

  const handleRevokeAllMySessions = async () => {
    if (!confirm("Barcha boshqa qurilmalardagi sessiyalarni bekor qilmoqchimisiz?")) return;
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke-all-sessions" }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Barcha sessiyalar muvaffaqiyatli bekor qilindi!");
        fetchMySessions();
      }
    } catch {
      // ignore
    }
  };

  // New course form state for teacher
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newLevel, setNewLevel] = useState<"Boshlang'ich" | "O'rta" | "Ilg'or">("Boshlang'ich");
  const [newIcon, setNewIcon] = useState("🛡️");
  const [newTags, setNewTags] = useState("Kiberxavfsizlik, Linux");
  const [createdSuccess, setCreatedSuccess] = useState(false);

  interface TaskItem {
    id: number;
    title: string;
    course: string;
    done: boolean;
  }

  // Tasks — localStorage'da saqlanadi
  const TASKS_KEY = "cyberedu_tasks";
  const defaultTasks: TaskItem[] = [
    { id: 1, title: "Kali Linux: Terminal buyruqlari laboratoriyasi", course: "Linux & Kali Linux", done: false },
    { id: 2, title: "Wireshark: TCP 3-way Handshake tahlil qilish", course: "Kompyuter Tarmoqlari", done: false },
    { id: 3, title: "CIA Triad bo'yicha oraliq test topshirish", course: "Kiberxavfsizlik Asoslari", done: false },
    { id: 4, title: "SQL Injection zaifliklarini laboratoriyada topish", course: "Veb Ilovalar Xavfsizligi", done: false },
  ];

  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    if (typeof window === "undefined") return defaultTasks;
    try {
      const saved = localStorage.getItem(TASKS_KEY);
      return saved ? JSON.parse(saved) : defaultTasks;
    } catch {
      return defaultTasks;
    }
  });

  const toggleTask = (id: number) => {
    setTasks((prev: TaskItem[]) => {
      const next = prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      try { localStorage.setItem(TASKS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addCourse({
      title: newTitle.trim(),
      desc: newDesc.trim() || "Kiberxavfsizlik amaliy kursi",
      level: newLevel,
      icon: newIcon,
      tags: newTags.split(",").map(t => t.trim()).filter(Boolean),
      instructor: {
        name: user?.name || "Instruktor",
        role: "Kiberxavfsizlik o'qituvchisi",
        avatar: "👨‍🏫",
        experience: "5+ yil tajriba",
      },
    });

    setCreatedSuccess(true);
    setTimeout(() => {
      setCreatedSuccess(false);
      setIsModalOpen(false);
      setNewTitle("");
      setNewDesc("");
    }, 1000);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsEmail.trim() || !settingsEmail.includes("@")) {
      setSettingsError("Iltimos, to'g'ri elektron pochta manzilini kiriting.");
      return;
    }
    if (settingsNewPass && settingsNewPass.length < 6) {
      setSettingsError("Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak.");
      return;
    }
    if (settingsNewPass && settingsNewPass !== settingsConfirmPass) {
      setSettingsError("Parollar bir-biriga mos kelmadi!");
      return;
    }
    if (settingsNewPass && !user?.mustChangePassword && !settingsOldPass) {
      setSettingsError("Parolni yangilash uchun joriy parolingizni kiritishingiz shart.");
      return;
    }

    setSettingsError("");
    setSettingsSuccess("");
    setSettingsLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_credentials",
          newName: settingsName.trim(),
          newEmail: settingsEmail.trim(),
          newPhone: settingsPhone.trim(),
          oldPassword: settingsOldPass ? settingsOldPass.trim() : undefined,
          newPassword: settingsNewPass ? settingsNewPass.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSettingsError(data.error || "Sozlamalarni saqlashda xatolik yuz berdi.");
        setSettingsLoading(false);
        return;
      }

      updateUser({
        name: settingsName.trim(),
        email: settingsEmail.trim(),
        phone: settingsPhone.trim(),
      });

      setSettingsSuccess("✅ Sozlamalar va shaxsiy ma'lumotlar serverda muvaffaqiyatli saqlandi!");
      setSettingsOldPass("");
      setSettingsNewPass("");
      setSettingsConfirmPass("");
      setSettingsLoading(false);
    } catch (err) {
      console.error(err);
      setSettingsError("Server bilan aloqada xatolik yuz berdi.");
      setSettingsLoading(false);
    }
  };

  // If not logged in
  if (!user) {
    return (
      <div className={styles.page}>
        <Navbar />
        <main className={`wrap ${styles.main}`} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className={`card ${styles.emptyState}`} style={{ maxWidth: 480, width: "100%", margin: "40px auto" }}>
            <span style={{ fontSize: "3rem" }}>🔒</span>
            <h2 style={{ fontSize: "1.5rem", marginTop: 12 }}>Shaxsiy kabinetga kirish</h2>
            <p style={{ color: "#94a3b8", fontSize: "0.95rem", margin: "12px 0 24px" }}>
              Kabinetga kirish uchun tizimga kiring yoki yangi hisob oching.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/login" className="btn btn-primary">
                Tizimga kirish
              </Link>
              <Link href="/register" className="btn btn-outline">
                Ro&apos;yxatdan o&apos;tish
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Enrolled courses for student
  const enrolledCourses = courses.filter((c) =>
    user.enrolledCourseIds?.includes(c.id)
  );

  // O'quvchi real statistikasi
  const completedLessonsCount = enrolledCourses.reduce((sum, c) => {
    const prog = getCourseProgress(c.id);
    const total = c.modules.reduce((a, m) => a + m.lessons.length, 0) || c.lessons || 1;
    return sum + Math.round((prog / 100) * total);
  }, 0);

  const avgProgress =
    enrolledCourses.length > 0
      ? Math.round(
          enrolledCourses.reduce((sum, c) => sum + getCourseProgress(c.id), 0) /
            enrolledCourses.length
        )
      : 0;

  const completedCourses = enrolledCourses.filter((c) => getCourseProgress(c.id) >= 100).length;

  // O'qituvchi statistikasi: jami o'quvchilar
  const totalStudents = courses.reduce((sum, c) => sum + (c.students || 0), 0);

  return (
    <div className={styles.page}>
      <Navbar />

      <main className={`wrap ${styles.main}`}>
        {/* Profile Header */}
        <section className={`card ${styles.profileHeader}`}>
          <div className={styles.profileLeft}>
            <div className={styles.avatar}>{user.avatar || "👤"}</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1 className={styles.userName}>{user.name}</h1>
                <span className={`badge ${user.role === "teacher" ? "badge-green" : "badge-blue"}`}>
                  {user.role === "teacher" ? "👨‍🏫 O'qituvchi / Instruktor" : "👨‍🎓 O'quvchi / Talaba"}
                </span>
              </div>
              <div className={styles.userEmail}>
                <span>📧 {user.email}</span>
                <span>•</span>
                <span>ID: {user.id}</span>
              </div>
            </div>
          </div>

          <div className={styles.profileActions}>
            {user.role === "teacher" ? (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="btn btn-green"
                style={{ padding: "8px 16px", fontSize: "0.85rem" }}
              >
                + Yangi kurs yaratish
              </button>
            ) : (
              <Link href="/courses" className="btn btn-outline" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
                + Kurs qo&apos;shish
              </Link>
            )}

            <button
              type="button"
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="btn btn-ghost"
              style={{ padding: "8px 16px", fontSize: "0.85rem", color: "#f87171" }}
            >
              Chiqish
            </button>
          </div>
        </section>

        {/* Stats Row */}
        <section className={styles.statsGrid}>
          {user.role === "student" ? (
            <>
              <div className={`card ${styles.statCard}`}>
                <div className={styles.statIcon} style={{ background: "rgba(56, 189, 248, 0.1)", color: "#38bdf8" }}>
                  📚
                </div>
                <div>
                  <div className={styles.statValue}>{enrolledCourses.length} ta</div>
                  <div className={styles.statLabel}>Yozilgan kurslar</div>
                </div>
              </div>
              <div className={`card ${styles.statCard}`}>
                <div className={styles.statIcon} style={{ background: "rgba(167, 139, 250, 0.1)", color: "#a78bfa" }}>
                  ✅
                </div>
                <div>
                  <div className={styles.statValue}>{completedLessonsCount} ta</div>
                  <div className={styles.statLabel}>Yakunlangan darslar</div>
                </div>
              </div>
              <div className={`card ${styles.statCard}`}>
                <div className={styles.statIcon} style={{ background: "rgba(52, 211, 153, 0.1)", color: "#34d399" }}>
                  🏆
                </div>
                <div>
                  <div className={styles.statValue}>{completedCourses} ta</div>
                  <div className={styles.statLabel}>Tugatilgan kurslar</div>
                </div>
              </div>
              <div className={`card ${styles.statCard}`}>
                <div className={styles.statIcon} style={{ background: "rgba(251, 146, 60, 0.1)", color: "#fb923c" }}>
                  📈
                </div>
                <div>
                  <div className={styles.statValue}>{avgProgress}%</div>
                  <div className={styles.statLabel}>O&apos;rtacha o&apos;zlashtirish</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={`card ${styles.statCard}`}>
                <div className={styles.statIcon} style={{ background: "rgba(52, 211, 153, 0.1)", color: "#34d399" }}>
                  👨‍🎓
                </div>
                <div>
                  <div className={styles.statValue}>{totalStudents} nafar</div>
                  <div className={styles.statLabel}>Jami o&apos;quvchilar</div>
                </div>
              </div>
              <div className={`card ${styles.statCard}`}>
                <div className={styles.statIcon} style={{ background: "rgba(56, 189, 248, 0.1)", color: "#38bdf8" }}>
                  📚
                </div>
                <div>
                  <div className={styles.statValue}>{courses.length} ta</div>
                  <div className={styles.statLabel}>Mavjud kurslar</div>
                </div>
              </div>
              <div className={`card ${styles.statCard}`}>
                <div className={styles.statIcon} style={{ background: "rgba(251, 146, 60, 0.1)", color: "#fb923c" }}>
                  🎓
                </div>
                <div>
                  <div className={styles.statValue}>{completedCourses} ta</div>
                  <div className={styles.statLabel}>Tugatilgan kurslar</div>
                </div>
              </div>
              <div className={`card ${styles.statCard}`}>
                <div className={styles.statIcon} style={{ background: "rgba(167, 139, 250, 0.1)", color: "#a78bfa" }}>
                  📊
                </div>
                <div>
                  <div className={styles.statValue}>{avgProgress > 0 ? avgProgress + "%" : "—"}</div>
                  <div className={styles.statLabel}>O&apos;rtacha progress</div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Tabs Bar */}
        <div className={styles.tabs} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "courses" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("courses")}
          >
            📚 {user.role === "student" ? "Mening kurslarim" : "Barcha kurslar"}
          </button>

          {user.role === "student" && (
            <>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "tasks" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("tasks")}
              >
                📝 Amaliy topshiriqlar ({tasks.filter((t) => !t.done).length})
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "certificates" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("certificates")}
              >
                🏆 Sertifikatlar (1)
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "assignments" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("assignments")}
              >
                📋 Uy vazifalari
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "attendance" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("attendance")}
              >
                📊 Mening davomatim
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "entitlements" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("entitlements")}
              >
                🔑 Mening kirish huquqlarim
              </button>
            </>
          )}

          {(user.role === "teacher" || user.role === "instructor" || user.role === "admin") && (
            <>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "adminUsers" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("adminUsers")}
              >
                👥 Foydalanuvchilar
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "adminGroups" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("adminGroups")}
              >
                🏷️ Guruhlar
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "adminInvitations" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("adminInvitations")}
              >
                🎟️ Taklif kodlari
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "adminContent" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("adminContent")}
              >
                📝 Kurs & Kontent
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "instructorLabs" ? styles.tabActive : ""}`}
                onClick={() => {
                  setActiveTab("instructorLabs");
                  fetchAnalytics();
                }}
              >
                🧪 Laboratoriyalar & Tahlil
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "adminEntitlements" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("adminEntitlements")}
              >
                🔑 Kirish Huquqlari
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "adminAssignments" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("adminAssignments")}
              >
                📋 Uy vazifalari
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "adminAttendance" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("adminAttendance")}
              >
                📊 Davomat
              </button>
            </>
          )}

          {user.role === "admin" && (
            <>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "adminLogs" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("adminLogs")}
              >
                📜 Audit Loglar
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "adminInstances" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("adminInstances")}
              >
                ⚡ Instansiyalar
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "adminExport" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("adminExport")}
              >
                📊 Eksport
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "adminHealth" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("adminHealth")}
              >
                🖥️ Server holati
              </button>
            </>
          )}

          {/* Sozlamalar — barcha rollar (talaba, o'qituvchi, admin) uchun ochiq */}
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "settings" ? styles.tabActive : ""}`}
            onClick={() => {
              setActiveTab("settings");
              if (user?.email) setSettingsEmail(user.email);
              if (user?.name) setSettingsName(user.name);
              if (user?.phone) setSettingsPhone(user.phone);
              fetchMySessions();
            }}
          >
            ⚙️ Sozlamalar & Xavfsizlik
          </button>
        </div>

        {/* Tab Content: Courses */}
        {activeTab === "courses" && (
          <div>
            {user.role === "student" ? (
              enrolledCourses.length === 0 ? (
                <div className={`card ${styles.emptyState}`}>
                  <span style={{ fontSize: "2.5rem" }}>📖</span>
                  <h3 style={{ marginTop: 10 }}>Siz hali birorta kursga a&apos;zo bo&apos;lmadingiz</h3>
                  <p style={{ marginTop: 6, fontSize: "0.9rem" }}>
                    Platformadagi qiziqarli kiberxavfsizlik kurslaridan birini tanlang.
                  </p>
                  <Link href="/courses" className="btn btn-primary" style={{ marginTop: 16 }}>
                    Kurslarni ko&apos;rish
                  </Link>
                </div>
              ) : (
                <div className={styles.courseGrid}>
                  {enrolledCourses.map((c) => {
                    const progress = getCourseProgress(c.id);
                    return (
                      <div key={c.id} className={`card ${styles.courseCard}`}>
                        <div className={styles.courseCardTop}>
                          <span className={styles.courseCardEmoji}>{c.icon}</span>
                          <span className={`badge ${c.levelColor}`}>{c.level}</span>
                        </div>
                        <h3 className={styles.courseCardTitle}>{c.title}</h3>
                        <p style={{ fontSize: "0.84rem", color: "#64748b", lineHeight: 1.5 }}>
                          {c.desc}
                        </p>

                        <div className={styles.progressContainer}>
                          <div className={styles.progressLabel}>
                            <span>O&apos;zlashtirish</span>
                            <strong style={{ color: "#38bdf8" }}>{progress}%</strong>
                          </div>
                          <div className={styles.progressBar}>
                            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                          </div>
                        </div>

                        <div className={styles.courseCardFooter}>
                          <Link
                            href={`/courses/${c.id}`}
                            style={{ fontSize: "0.8rem", color: "#64748b", textDecoration: "underline" }}
                          >
                            Tafsilotlar
                          </Link>
                          <Link
                            href={`/courses/${c.id}/learn`}
                            className="btn btn-primary"
                            style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                          >
                            ▶ Darsga kirish
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Teacher View Courses */
              <div className={`card ${styles.tableCard}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h3 style={{ fontSize: "1.1rem" }}>Barcha kurslar boshqaruvi</h3>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="btn btn-green"
                    style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                  >
                    + Yangi kurs yaratish
                  </button>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Kurs nomi</th>
                      <th>Daraja</th>
                      <th>O&apos;quvchilar</th>
                      <th>Darslar</th>
                      <th>Holat</th>
                      <th>Amallar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.icon} {c.title}</strong>
                        </td>
                        <td>
                          <span className={`badge ${c.levelColor}`}>{c.level}</span>
                        </td>
                        <td>{c.students} nafar</td>
                        <td>{c.lessons} dars</td>
                        <td>
                          <span className="badge badge-green">Faol</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <Link
                              href={`/courses/${c.id}/learn`}
                              style={{ color: "#38bdf8", textDecoration: "underline", fontSize: "0.85rem" }}
                            >
                              Darslar
                            </Link>
                            {c.id > 10 && (
                              <button
                                type="button"
                                onClick={() => deleteCourse(c.id)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#f87171",
                                  cursor: "pointer",
                                  fontSize: "0.8rem",
                                }}
                              >
                                O&apos;chirish
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Tasks (Student only) */}
        {activeTab === "tasks" && (
          <div className={styles.taskList}>
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`card ${styles.taskItem}`}
                style={{ opacity: task.done ? 0.7 : 1 }}
              >
                <div className={styles.taskLeft}>
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTask(task.id)}
                    style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#38bdf8" }}
                  />
                  <div>
                    <div className={styles.taskTitle} style={{ textDecoration: task.done ? "line-through" : "none" }}>
                      {task.title}
                    </div>
                    <div className={styles.taskCourse}>Kurs: {task.course}</div>
                  </div>
                </div>
                <div>
                  <span className={`badge ${task.done ? "badge-green" : "badge-orange"}`}>
                    {task.done ? "✓ Bajarilgan" : "⏳ Kutilmoqda"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Content: Certificates (Student only) */}
        {activeTab === "certificates" && (
          <div className="card" style={{ padding: 32, maxWidth: 640 }}>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <div style={{ fontSize: "3.5rem" }}>🎓</div>
              <div>
                <span className="badge badge-green">Rasmiy Sertifikat</span>
                <h3 style={{ fontSize: "1.3rem", margin: "6px 0" }}>Kiberxavfsizlik Asoslari kursi</h3>
                <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
                  Berilgan sana: 28-oktyabr, 2026 | Sertifikat ID: CYBER-98234-UZ
                </p>
                <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                  <Link
                    href="/certificate/1"
                    className="btn btn-primary"
                    style={{ padding: "8px 18px", fontSize: "0.85rem" }}
                  >
                    Sertifikatni ko&apos;rish va yuklab olish (PDF)
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Settings (Teacher / Profile & Security) */}
        {activeTab === "settings" && (
          <div className="card" style={{ maxWidth: 720, padding: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
              <span style={{ fontSize: "2.2rem" }}>⚙️</span>
              <div>
                <h2 style={{ fontSize: "1.3rem" }}>Profil va Xavfsizlik Sozlamalari</h2>
                <p style={{ fontSize: "0.86rem", color: "#94a3b8" }}>
                  Tizimga kirish uchun shaxsiy emailingiz va parolingizni belgilang yoki o&apos;zgartiring
                </p>
              </div>
            </div>

            {settingsSuccess && (
              <div style={{
                background: "rgba(52, 211, 153, 0.12)",
                border: "1px solid rgba(52, 211, 153, 0.3)",
                color: "#34d399",
                padding: "12px 16px",
                borderRadius: "10px",
                fontSize: "0.88rem",
                marginBottom: 20,
              }}>
                {settingsSuccess}
              </div>
            )}

            {settingsError && (
              <div style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                padding: "12px 16px",
                borderRadius: "10px",
                fontSize: "0.88rem",
                marginBottom: 20,
              }}>
                {settingsError}
              </div>
            )}

            <form onSubmit={handleSaveSettings} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{
                background: "rgba(15, 23, 42, 0.6)",
                padding: "20px",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}>
                <h3 style={{ fontSize: "1rem", color: "#38bdf8" }}>👤 Shaxsiy Ma&apos;lumotlar</h3>

                <div>
                  <label style={{ fontSize: "0.85rem", color: "#94a3b8", display: "block", marginBottom: 6 }}>
                    Ism-Sharif
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={settingsName}
                    onChange={(e) => setSettingsName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.85rem", color: "#94a3b8", display: "block", marginBottom: 6 }}>
                    Bog&apos;langan Shaxsiy Email (Tizimga kirish uchun asosiy login)
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={settingsEmail}
                    onChange={(e) => setSettingsEmail(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block", marginTop: 4 }}>
                    Tizimga kirish uchun foydalaniladi.
                  </span>
                </div>

                <div>
                  <label style={{ fontSize: "0.85rem", color: "#94a3b8", display: "block", marginBottom: 6 }}>
                    Bog&apos;langan Telefon Raqam (SMS orqali parolni qayta tiklash uchun)
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={settingsPhone}
                    onChange={(e) => setSettingsPhone(e.target.value)}
                    placeholder="+998 90 123 45 67"
                    required
                  />
                </div>
              </div>

              <div style={{
                background: "rgba(15, 23, 42, 0.6)",
                padding: "20px",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}>
                <h3 style={{ fontSize: "1rem", color: "#34d399" }}>🔐 Parolni Yangilash (Ixtiyoriy)</h3>
                <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: -8 }}>
                  Agar parolni o&apos;zgartirmoqchi bo&apos;lsangiz, joriy va yangi parolingizni kiriting.
                </p>

                <div>
                  <label style={{ fontSize: "0.85rem", color: "#94a3b8", display: "block", marginBottom: 6 }}>
                    Joriy (eski) Parol {settingsNewPass ? <span style={{ color: "#ef4444" }}>*</span> : ""}
                  </label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Joriy parolingizni kiriting"
                    value={settingsOldPass}
                    onChange={(e) => setSettingsOldPass(e.target.value)}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: "0.85rem", color: "#94a3b8", display: "block", marginBottom: 6 }}>
                      Yangi Parol
                    </label>
                    <input
                      type="password"
                      className="input"
                      placeholder="Kamida 6 ta belgi"
                      value={settingsNewPass}
                      onChange={(e) => setSettingsNewPass(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.85rem", color: "#94a3b8", display: "block", marginBottom: 6 }}>
                      Yangi Parolni Tasdiqlang
                    </label>
                    <input
                      type="password"
                      className="input"
                      placeholder="Parolni qayta tering"
                      value={settingsConfirmPass}
                      onChange={(e) => setSettingsConfirmPass(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  type="submit"
                  disabled={settingsLoading}
                  className="btn btn-green"
                  style={{ padding: "10px 24px" }}
                >
                  {settingsLoading ? "Saqlanmoqda..." : "💾 O'zgarishlarni Saqlash"}
                </button>
              </div>
            </form>

            {/* Faol Sessiyalar Bo'limi */}
            <div style={{
              marginTop: 32,
              padding: "24px",
              background: "rgba(15, 23, 42, 0.6)",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.05)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: "1.05rem", color: "#38bdf8", fontWeight: 700 }}>
                    📱 Faol Sessiyalar va Qurilmalar
                  </h3>
                  <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: 4 }}>
                    Hisobingizga ulangan barcha faol brauzer va sessiyalar ro&apos;yxati
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRevokeAllMySessions}
                  className="btn btn-outline"
                  style={{ fontSize: "0.8rem", padding: "6px 14px", borderColor: "#ef4444", color: "#ef4444" }}
                >
                  🚪 Barcha boshqa qurilmalardan chiqish
                </button>
              </div>

              {sessionsLoading ? (
                <div style={{ color: "#94a3b8", fontSize: "0.85rem", textAlign: "center", padding: "16px 0" }}>
                  Sessiyalar yuklanmoqda...
                </div>
              ) : mySessions.length === 0 ? (
                <div style={{ color: "#94a3b8", fontSize: "0.85rem", textAlign: "center", padding: "16px 0" }}>
                  Faol qo&apos;shimcha sessiyalar topilmadi.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #334155", textAlign: "left", color: "#94a3b8" }}>
                        <th style={{ padding: "8px" }}>IP Manzil</th>
                        <th style={{ padding: "8px" }}>Qurilma / Brauzer</th>
                        <th style={{ padding: "8px" }}>Kirilgan vaqt</th>
                        <th style={{ padding: "8px" }}>Holat</th>
                        <th style={{ padding: "8px", textAlign: "right" }}>Amal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mySessions.map((s) => (
                        <tr key={s.id} style={{ borderBottom: "1px solid #1e293b" }}>
                          <td style={{ padding: "10px 8px", fontFamily: "monospace" }}>{s.ip}</td>
                          <td style={{ padding: "10px 8px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.userAgent}>
                            {s.userAgent || "Noma'lum"}
                          </td>
                          <td style={{ padding: "10px 8px", color: "#94a3b8" }}>
                            {new Date(s.createdAt).toLocaleString("uz-UZ")}
                          </td>
                          <td style={{ padding: "10px 8px" }}>
                            {s.isCurrent ? (
                              <span className="badge badge-green">Ushbu qurilma</span>
                            ) : (
                              <span className="badge badge-blue">Faol</span>
                            )}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right" }}>
                            {!s.isCurrent && (
                              <button
                                type="button"
                                onClick={() => handleRevokeMySession(s.id)}
                                style={{ background: "transparent", border: "1px solid #f87171", color: "#f87171", padding: "3px 8px", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}
                              >
                                Chiqarish
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Telegram va Bildirishnoma Sozlamalari */}
            <div style={{ marginTop: 32 }}>
              <UserTelegramSettings />
            </div>
          </div>
        )}

        {/* Tab Content: Instructor Labs & Analytics */}
        {activeTab === "instructorLabs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {loadingAnalytics && (
              <div style={{ padding: 12, color: "#38bdf8", textAlign: "center" }}>
                Tahliliy ma&apos;lumotlar yuklanmoqda...
              </div>
            )}
            {/* 1. Tahlil va Statistika Kartalari */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <div className={`card ${styles.statCard}`}>
                <div className={styles.statIcon} style={{ background: "rgba(56, 189, 248, 0.1)", color: "#38bdf8" }}>
                  👥
                </div>
                <div>
                  <div className={styles.statValue}>{analytics?.stats.totalUsers || 0} nafar</div>
                  <div className={styles.statLabel}>Jami Talabalar</div>
                </div>
              </div>

              <div className={`card ${styles.statCard}`}>
                <div className={styles.statIcon} style={{ background: "rgba(168, 85, 247, 0.1)", color: "#a855f7" }}>
                  📨
                </div>
                <div>
                  <div className={styles.statValue}>{analytics?.stats.totalSubmissions || 0} ta</div>
                  <div className={styles.statLabel}>Flag Topshirishlar</div>
                </div>
              </div>

              <div className={`card ${styles.statCard}`}>
                <div className={styles.statIcon} style={{ background: "rgba(52, 211, 153, 0.1)", color: "#34d399" }}>
                  ✅
                </div>
                <div>
                  <div className={styles.statValue}>{analytics?.stats.correctSubmissions || 0} ta</div>
                  <div className={styles.statLabel}>To&apos;g&apos;ri Yechilgan</div>
                </div>
              </div>

              <div className={`card ${styles.statCard}`}>
                <div className={styles.statIcon} style={{ background: "rgba(251, 146, 60, 0.1)", color: "#fb923c" }}>
                  🎯
                </div>
                <div>
                  <div className={styles.statValue}>{analytics?.stats.successRate || 0}%</div>
                  <div className={styles.statLabel}>Muvaffaqiyat Foizi</div>
                </div>
              </div>
            </div>

            {/* 2. Eng ko'p hint ishlatilgan laboratoriyalar */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: 12, color: "#f59e0b" }}>
                💡 Eng Ko&apos;p Maslahat (Hint) Ishlatilgan Laboratoriyalar
              </h3>
              <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: 16 }}>
                Talabalar ko&apos;proq yordam so&apos;ragan vazifalar. Bu mavzular bo&apos;yicha qo&apos;shimcha darslar tavsiya etiladi.
              </p>
              {analytics?.topHintLabs && analytics.topHintLabs.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                  {analytics.topHintLabs.map((l) => (
                    <div key={l.id} style={{ background: "#0f172a", border: "1px solid #1e293b", padding: 14, borderRadius: 8 }}>
                      <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.95rem" }}>{l.title}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: "0.82rem" }}>
                        <span className="badge badge-blue">{l.category}</span>
                        <span style={{ color: "#f59e0b", fontWeight: "bold" }}>{l.hintsUsedCount} marta ochilgan</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "#94a3b8", fontSize: "0.9rem" }}>Hali hintlar ochilmagan.</div>
              )}
            </div>

            {/* 3. Yangi Laboratoriya Yaratish Formasi */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: 16, color: "#38bdf8" }}>
                ➕ Yangi Laboratoriya Qo&apos;shish
              </h3>

              {labActionMsg && (
                <div style={{ padding: 12, background: "rgba(56, 189, 248, 0.1)", border: "1px solid #38bdf8", borderRadius: 8, color: "#38bdf8", marginBottom: 16 }}>
                  {labActionMsg}
                </div>
              )}

              <form onSubmit={handleCreateLab} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: "0.85rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                      Sarlavha (Title)
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Masalan: Linux Fayl Huquqlari"
                      value={newLabTitle}
                      onChange={(e) => setNewLabTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.85rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                      Slug (Noyob identifikator)
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="linux-custom-lab"
                      value={newLabSlug}
                      onChange={(e) => setNewLabSlug(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: "0.85rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                      Kategoriya
                    </label>
                    <select
                      className="input"
                      value={newLabCategory}
                      onChange={(e) =>
                        setNewLabCategory(
                          e.target.value as "Linux" | "Kriptografiya" | "Web" | "Tarmoq"
                        )
                      }
                    >
                      <option value="Linux">Linux</option>
                      <option value="Kriptografiya">Kriptografiya</option>
                      <option value="Web">Web</option>
                      <option value="Tarmoq">Tarmoq</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.85rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                      Qiyinlik
                    </label>
                    <select
                      className="input"
                      value={newLabDifficulty}
                      onChange={(e) =>
                        setNewLabDifficulty(e.target.value as "Oson" | "O'rta" | "Qiyin")
                      }
                    >
                      <option value="Oson">Oson</option>
                      <option value="O'rta">O&apos;rta</option>
                      <option value="Qiyin">Qiyin</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.85rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                      Ball
                    </label>
                    <input
                      type="number"
                      className="input"
                      value={newLabPoints}
                      onChange={(e) => setNewLabPoints(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.85rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                      Lab Turi
                    </label>
                    <select
                      className="input"
                      value={newLabType}
                      onChange={(e) =>
                        setNewLabType(
                          e.target.value as "terminal" | "static" | "web-instance"
                        )
                      }
                    >
                      <option value="terminal">Terminal Sandbox</option>
                      <option value="web-instance">Izolyatsiyalangan Veb</option>
                      <option value="static">Statik / Kripto</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "0.85rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    Tavsif (Vazifa matni)
                  </label>
                  <textarea
                    className="input"
                    style={{ minHeight: 70, resize: "vertical" }}
                    placeholder="Talaba nima qilishi kerakligini tushuntiring..."
                    value={newLabDesc}
                    onChange={(e) => setNewLabDesc(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                      1-Maslahat (-10%)
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Boshlang'ich ishora..."
                      value={newLabHint1}
                      onChange={(e) => setNewLabHint1(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                      2-Maslahat (-20%)
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Aniqroq yo'nalish..."
                      value={newLabHint2}
                      onChange={(e) => setNewLabHint2(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                      3-Maslahat (-30%)
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Aniq sintaksis yoki buyruq..."
                      value={newLabHint3}
                      onChange={(e) => setNewLabHint3(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "0.85rem", color: "#a855f7", display: "block", marginBottom: 4, fontWeight: "bold" }}>
                    Ustoz Yechim Yo&apos;riqnomasi (Guide — faqat ustozlarga ko&apos;rinadi)
                  </label>
                  <textarea
                    className="input"
                    style={{ minHeight: 60, resize: "vertical", borderColor: "#a855f7" }}
                    placeholder="Qadam-baqadam to'liq yechim..."
                    value={newLabGuide}
                    onChange={(e) => setNewLabGuide(e.target.value)}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" disabled={creatingLab} className="btn btn-primary">
                    {creatingLab ? "Yaratilmoqda..." : "🚀 Laboratoriyani Chop Etish"}
                  </button>
                </div>
              </form>
            </div>

            {/* 4. Talabalar Topshirishi Jurnali */}
            <div className="card" style={{ padding: 24, overflowX: "auto" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: 16 }}>
                📜 So&apos;nggi Talabalar Topshirishlari
              </h3>
              {analytics?.recentSubmissions && analytics.recentSubmissions.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #334155", textAlign: "left", color: "#94a3b8" }}>
                      <th style={{ padding: "10px 8px" }}>Talaba</th>
                      <th style={{ padding: "10px 8px" }}>Laboratoriya</th>
                      <th style={{ padding: "10px 8px" }}>Natija</th>
                      <th style={{ padding: "10px 8px" }}>Ball</th>
                      <th style={{ padding: "10px 8px" }}>Vaqt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.recentSubmissions.map((sub) => (
                      <tr key={sub.id} style={{ borderBottom: "1px solid #1e293b" }}>
                        <td style={{ padding: "12px 8px", fontWeight: "bold" }}>
                          {sub.userName} <span style={{ color: "#64748b", fontWeight: "normal", fontSize: "0.78rem" }}>({sub.userEmail})</span>
                        </td>
                        <td style={{ padding: "12px 8px" }}>{sub.labTitle}</td>
                        <td style={{ padding: "12px 8px" }}>
                          {sub.isCorrect ? (
                            <span style={{ color: "#34d399", fontWeight: "bold" }}>
                              ✓ To&apos;g&apos;ri {sub.isFirstBlood && "🩸 (First Blood)"}
                            </span>
                          ) : (
                            <span style={{ color: "#f87171" }}>✕ Xato</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 8px", fontWeight: "bold", color: "#38bdf8" }}>
                          +{sub.pointsEarned}
                        </td>
                        <td style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "0.8rem" }}>
                          {new Date(sub.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: "#94a3b8" }}>Hali topshirishlar qayd etilmagan.</div>
              )}
            </div>

            {/* 5. Mavjud Laboratoriyalar Ro'yxati */}
            <div className="card" style={{ padding: 24, overflowX: "auto" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: 16 }}>
                🗂️ Barcha Laboratoriyalar Boshqaruvi
              </h3>
              {analytics?.labAnalytics && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #334155", textAlign: "left", color: "#94a3b8" }}>
                      <th style={{ padding: "10px 8px" }}>Sarlavha</th>
                      <th style={{ padding: "10px 8px" }}>Kategoriya</th>
                      <th style={{ padding: "10px 8px" }}>Qiyinlik</th>
                      <th style={{ padding: "10px 8px" }}>Ball</th>
                      <th style={{ padding: "10px 8px" }}>Topshirishlar</th>
                      <th style={{ padding: "10px 8px" }}>Amallar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.labAnalytics.map((lab) => (
                      <tr key={lab.id} style={{ borderBottom: "1px solid #1e293b" }}>
                        <td style={{ padding: "10px 8px", fontWeight: "bold" }}>{lab.title}</td>
                        <td style={{ padding: "10px 8px" }}><span className="badge badge-blue">{lab.category}</span></td>
                        <td style={{ padding: "10px 8px" }}>{lab.difficulty}</td>
                        <td style={{ padding: "10px 8px", color: "#38bdf8" }}>{lab.points}</td>
                        <td style={{ padding: "10px 8px" }}>{lab.totalSubmissions} ta</td>
                        <td style={{ padding: "10px 8px" }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteLab(lab.id)}
                            style={{ background: "#7f1d1d", color: "#fca5a5", border: "none", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: "0.8rem" }}
                          >
                            O&apos;chirish
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Admin Users */}
        {activeTab === "adminUsers" && (
          <AdminUsersTab currentUserRole={user.role} />
        )}

        {/* Tab Content: Admin Groups */}
        {activeTab === "adminGroups" && (
          <AdminGroupsTab />
        )}

        {/* Tab Content: Admin Invitations */}
        {activeTab === "adminInvitations" && (
          <AdminInvitationsTab />
        )}

        {/* Tab Content: Admin Content Editor */}
        {activeTab === "adminContent" && (
          <AdminContentEditorTab />
        )}

        {/* Tab Content: Admin Audit Logs (Admin only) */}
        {activeTab === "adminLogs" && (
          <AdminAuditLogsTab />
        )}

        {/* Tab Content: Admin Instances (Admin only) */}
        {activeTab === "adminInstances" && (
          <AdminInstancesTab />
        )}

        {/* Tab Content: Admin Export (Admin only) */}
        {activeTab === "adminExport" && (
          <AdminExportTab />
        )}

        {/* Tab Content: Admin Entitlements (Admin / Instructor) */}
        {activeTab === "adminEntitlements" && (
          <AdminEntitlementsTab />
        )}

        {/* Tab Content: Student Entitlements */}
        {activeTab === "entitlements" && (
          <UserEntitlementsTab />
        )}

        {/* Tab Content: Student Assignments */}
        {activeTab === "assignments" && (
          <UserAssignmentsTab />
        )}

        {/* Tab Content: Student Attendance */}
        {activeTab === "attendance" && (
          <UserAttendanceTab />
        )}

        {/* Tab Content: Admin Assignments */}
        {activeTab === "adminAssignments" && (
          <AdminAssignmentsTab />
        )}

        {/* Tab Content: Admin Attendance */}
        {activeTab === "adminAttendance" && (
          <AdminAttendanceTab />
        )}

        {/* Tab Content: Admin Server Health */}
        {activeTab === "adminHealth" && (
          <AdminHealthTab />
        )}

        {/* Teacher Create Course Modal */}
        {isModalOpen && (
          <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
            <div className={`card ${styles.modalContent}`} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <h3 style={{ fontSize: "1.25rem" }}>➕ Yangi Kurs Yaratish</h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "1.2rem", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              {createdSuccess ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "#34d399" }}>
                  <span style={{ fontSize: "2.5rem" }}>🎉</span>
                  <h4>Kurs muvaffaqiyatli saqlandi va saytga qo&apos;shildi!</h4>
                </div>
              ) : (
                <form onSubmit={handleCreateCourse} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                        Belgi
                      </label>
                      <input
                        type="text"
                        className="input"
                        style={{ textAlign: "center", fontSize: "1.2rem" }}
                        value={newIcon}
                        onChange={(e) => setNewIcon(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                        Kurs nomi
                      </label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Masalan: Bulutli Xavfsizlik (Cloud Security)"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                      Qisqacha tavsif
                    </label>
                    <textarea
                      className="input"
                      style={{ minHeight: 70, resize: "vertical" }}
                      placeholder="Kurs kimlar uchun va nimalar o'rgatiladi..."
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                        Qiyinlik darajasi
                      </label>
                      <select
                        className="input"
                        value={newLevel}
                        onChange={(e) => setNewLevel(e.target.value as "Boshlang'ich" | "O'rta" | "Ilg'or")}
                      >
                        <option value="Boshlang'ich">Boshlang&apos;ich</option>
                        <option value="O'rta">O&apos;rta</option>
                        <option value="Ilg'or">Ilg&apos;or</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: "0.82rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                        Teglar (vergul bilan)
                      </label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Cloud, AWS, Firewall"
                        value={newTags}
                        onChange={(e) => setNewTags(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setIsModalOpen(false)}
                    >
                      Bekor qilish
                    </button>
                    <button type="submit" className="btn btn-green">
                      Kursni chop etish
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
