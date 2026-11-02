"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import styles from "./labs.module.css";

interface LabItem {
  id: string;
  slug: string;
  title: string;
  category: "Linux" | "Kriptografiya" | "Web" | "Tarmoq";
  difficulty: "Oson" | "O'rta" | "Qiyin";
  points: number;
  type: "terminal" | "static" | "web-instance";
  description: string;
  courseId?: number;
  solvedCount: number;
  isSolved: boolean;
  unlockedHints: number[];
  hint1?: string | null;
  hint2?: string | null;
  hint3?: string | null;
  guide?: string | null;
}

interface LeaderboardUser {
  rank: number;
  displayName: string;
  avatar: string;
  totalScore: number;
  solvedCount: number;
  firstBloodCount: number;
  lastSolvedAt: string;
}

interface FirstBloodItem {
  labTitle: string;
  labCategory: string;
  displayName: string;
  avatar: string;
  solvedAt: string;
}

export default function LabsPage() {
  const [activeTab, setActiveTab] = useState<"labs" | "scoreboard">("labs");
  const [selectedCategory, setSelectedCategory] = useState<string>("Barchasi");
  const [labs, setLabs] = useState<LabItem[]>([]);
  const [loadingLabs, setLoadingLabs] = useState(true);

  // Flag topshirish holatlari
  const [flagInputs, setFlagInputs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, { type: "success" | "error"; text: string }>>({});

  // Web lab instansiyalari holati
  const [instances, setInstances] = useState<
    Record<string, { running: boolean; instanceId?: string; proxyUrl?: string; remainingSeconds?: number }>
  >({});
  const [instanceLoading, setInstanceLoading] = useState<Record<string, boolean>>({});

  // Scoreboard holati
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [firstBloods, setFirstBloods] = useState<FirstBloodItem[]>([]);
  const [loadingScoreboard, setLoadingScoreboard] = useState(false);

  // Laboratoriyalarni yuklash
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/labs");
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.labs)) {
          setLabs(data.labs);
        }
      } catch (err) {
        console.error("Labs yuklash xatosi:", err);
      } finally {
        if (isMounted) setLoadingLabs(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  // Scoreboard ma'lumotlarini yuklash
  useEffect(() => {
    let isMounted = true;
    if (activeTab === "scoreboard") {
      const loadScore = async () => {
        try {
          const res = await fetch(
            `/api/scoreboard?category=${encodeURIComponent(selectedCategory)}`
          );
          const data = await res.json();
          if (isMounted && data.success) {
            setLeaderboard(data.leaderboard || []);
            setFirstBloods(data.firstBloods || []);
          }
        } catch (err) {
          console.error("Scoreboard yuklash xatosi:", err);
        } finally {
          if (isMounted) setLoadingScoreboard(false);
        }
      };
      loadScore();
    }
    return () => {
      isMounted = false;
    };
  }, [activeTab, selectedCategory]);

  // Hisoblangan umumiy ball
  const solvedCount = labs.filter((l) => l.isSolved).length;
  const totalUserScore = labs
    .filter((l) => l.isSolved)
    .reduce((sum, l) => sum + l.points, 0);

  // Kategoriya bo'yicha filtrlangan laboratoriyalar
  const filteredLabs =
    selectedCategory === "Barchasi"
      ? labs
      : labs.filter((l) => l.category === selectedCategory);

  // Flag topshirish
  const handleSubmitFlag = async (e: React.FormEvent, lab: LabItem) => {
    e.preventDefault();
    const flagVal = (flagInputs[lab.id] || "").trim();
    if (!flagVal) return;

    setSubmitting((prev) => ({ ...prev, [lab.id]: true }));
    setMessages((prev) => ({ ...prev, [lab.id]: { type: "error", text: "" } }));

    try {
      const res = await fetch("/api/labs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_flag",
          labId: lab.id,
          flag: flagVal,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessages((prev) => ({
          ...prev,
          [lab.id]: { type: "success", text: data.message },
        }));
        // Lab holatini yangilash
        setLabs((prev) =>
          prev.map((l) => (l.id === lab.id ? { ...l, isSolved: true } : l))
        );
      } else {
        setMessages((prev) => ({
          ...prev,
          [lab.id]: { type: "error", text: data.error || "Noto'g'ri flag!" },
        }));
      }
    } catch {
      setMessages((prev) => ({
        ...prev,
        [lab.id]: { type: "error", text: "Server bilan aloqada xatolik yuz berdi." },
      }));
    } finally {
      setSubmitting((prev) => ({ ...prev, [lab.id]: false }));
    }
  };

  // Hint ochish
  const handleUnlockHint = async (lab: LabItem, level: number) => {
    const penalty = level === 1 ? "10%" : level === 2 ? "20%" : "30%";
    const confirmed = window.confirm(
      `Diqqat! ${level}-darajadagi maslahatni ochsangiz, yakuniy balldan -${penalty} jarima ayiriladi. Davom etasizmi?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/labs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlock_hint",
          labId: lab.id,
          hintLevel: level,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setLabs((prev) =>
          prev.map((l) => {
            if (l.id === lab.id) {
              const updatedUnlocks = Array.from(new Set([...l.unlockedHints, level]));
              return {
                ...l,
                unlockedHints: updatedUnlocks,
                ...(level === 1 ? { hint1: data.hintText } : {}),
                ...(level === 2 ? { hint2: data.hintText } : {}),
                ...(level === 3 ? { hint3: data.hintText } : {}),
              };
            }
            return l;
          })
        );
      } else {
        alert(data.error || "Hint ochishda xatolik yuz berdi.");
      }
    } catch {
      alert("Server bilan aloqada xatolik.");
    }
  };

  // Web lab instansiyasini ishga tushirish
  const handleStartInstance = async (lab: LabItem) => {
    setInstanceLoading((prev) => ({ ...prev, [lab.id]: true }));
    try {
      const res = await fetch("/api/labs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_instance",
          labId: lab.id,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setInstances((prev) => ({
          ...prev,
          [lab.id]: {
            running: true,
            instanceId: data.instanceId,
            proxyUrl: data.proxyUrl,
            remainingSeconds: data.remainingSeconds || 1800,
          },
        }));
      } else {
        alert(data.error || "Instansiyani ishga tushirishda xatolik.");
      }
    } catch {
      alert("Server bilan aloqa uzildi.");
    } finally {
      setInstanceLoading((prev) => ({ ...prev, [lab.id]: false }));
    }
  };

  // Web lab instansiyasini to'xtatish
  const handleStopInstance = async (lab: LabItem) => {
    const inst = instances[lab.id];
    if (!inst?.instanceId) return;

    try {
      await fetch("/api/labs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stop_instance",
          instanceId: inst.instanceId,
        }),
      });
      setInstances((prev) => ({
        ...prev,
        [lab.id]: { running: false },
      }));
    } catch {
      // Ignored
    }
  };

  const categories = ["Barchasi", "Linux", "Kriptografiya", "Web", "Tarmoq"];

  return (
    <div className={styles.page}>
      <Navbar />

      {/* Header */}
      <section className={`${styles.header} cyber-grid`}>
        <div className={`wrap ${styles.headerInner}`}>
          <span className="badge badge-purple">⚡ Amaliy laboratoriyalar &amp; CTF</span>
          <h1 className={styles.title}>
            Kiber-Xavfsizlik <span className="gradient-text">Laboratoriyalari</span>
          </h1>
          <p className={styles.desc}>
            Xavfsiz va to&apos;liq izolyatsiyalangan Docker muhitida real kiberxavfsizlik vazifalarini bajaring.
            Har bir topshiriq siz uchun individual dinamik bayroq (HMAC Flag) yaratadi.
          </p>
        </div>
      </section>

      {/* Asosiy qism */}
      <main className={`wrap ${styles.main}`}>
        {/* Yuqori Tab Switcher */}
        <div className={styles.topTabs}>
          <button
            className={`${styles.topTabBtn} ${activeTab === "labs" ? styles.topTabBtnActive : ""}`}
            onClick={() => setActiveTab("labs")}
          >
            📋 Laboratoriyalar ({labs.length})
          </button>
          <button
            className={`${styles.topTabBtn} ${activeTab === "scoreboard" ? styles.topTabBtnActive : ""}`}
            onClick={() => setActiveTab("scoreboard")}
          >
            🏆 Scoreboard &amp; Reyting
          </button>
        </div>

        {/* 1. LABORATORIYALAR BO'LIMI */}
        {activeTab === "labs" && (
          <>
            {/* Statistika paneli */}
            <div className={`card ${styles.scoreBanner}`}>
              <div>
                <div className={styles.scoreTitle}>Sizning Progressingiz:</div>
                <div style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: 4 }}>
                  {solvedCount} / {labs.length} ta laboratoriya muvaffaqiyatli topshirildi
                </div>
              </div>
              <div className={styles.scoreValue}>{totalUserScore} Ball</div>
            </div>

            {/* Kategoriya filterlari */}
            <div className={styles.filterBar}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`${styles.filterBtn} ${selectedCategory === cat ? styles.filterBtnActive : ""}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {loadingLabs ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
                Laboratoriyalar yuklanmoqda...
              </div>
            ) : (
              <div className={styles.labGrid}>
                {filteredLabs.map((lab) => {
                  const isSolved = lab.isSolved;
                  const msg = messages[lab.id];
                  const isSubmitting = submitting[lab.id];
                  const instance = instances[lab.id];
                  const isInstLoading = instanceLoading[lab.id];

                  const diffBadge =
                    lab.difficulty === "Oson"
                      ? "badge-green"
                      : lab.difficulty === "O'rta"
                      ? "badge-blue"
                      : "badge-purple";

                  const typeIcon =
                    lab.type === "terminal" ? "💻" : lab.type === "web-instance" ? "🌐" : "🔐";

                  return (
                    <div key={lab.id} className={`card ${styles.labCard}`}>
                      <div className={styles.labTop}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: "1.4rem" }}>{typeIcon}</span>
                          <span className="badge badge-blue">{lab.category}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span className={`badge ${diffBadge}`}>{lab.difficulty}</span>
                          <span className="badge badge-purple">+{lab.points} ball</span>
                        </div>
                      </div>

                      <h3 className={styles.labTitle}>{lab.title}</h3>
                      <p className={styles.labDesc}>{lab.description}</p>

                      {/* Lab turi bo'yicha interaktiv boshqaruv */}
                      {lab.type === "terminal" && (
                        <div className={styles.actionRow}>
                          <Link
                            href={`/terminal?lab=${encodeURIComponent(lab.slug)}`}
                            className="btn btn-secondary"
                            style={{ fontSize: "0.85rem", padding: "6px 14px" }}
                          >
                            🖥️ Sandbox Terminalda Ochish
                          </Link>
                        </div>
                      )}

                      {lab.type === "web-instance" && (
                        <div className={styles.instanceBox}>
                          <div className={styles.instanceTop}>
                            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#38bdf8" }}>
                              🌐 Izolyatsiyalangan Veb Konteyner
                            </span>
                            {instance?.running ? (
                              <span className="badge badge-green">Faol (30 daqiqa)</span>
                            ) : (
                              <span className="badge badge-blue">To&apos;xtatilgan</span>
                            )}
                          </div>

                          {instance?.running ? (
                            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                              <a
                                href={instance.proxyUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-primary"
                                style={{ fontSize: "0.82rem", padding: "6px 12px" }}
                              >
                                🔗 Lab Saytiga Kirish
                              </a>
                              <button
                                type="button"
                                onClick={() => handleStopInstance(lab)}
                                className="btn btn-secondary"
                                style={{ fontSize: "0.82rem", padding: "6px 12px" }}
                              >
                                🛑 To&apos;xtatish
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartInstance(lab)}
                              disabled={isInstLoading}
                              className="btn btn-primary"
                              style={{ fontSize: "0.82rem", padding: "6px 14px", alignSelf: "flex-start" }}
                            >
                              {isInstLoading ? "Konteyner ishga tushirilmoqda..." : "🚀 Instansiyani Ishga Tushirish"}
                            </button>
                          )}
                        </div>
                      )}

                      {/* 3 Darajali Hint Tizimi */}
                      <div className={styles.hintContainer}>
                        <div style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 700 }}>
                          💡 Maslahatlar va Yordam (Ball jarimasi bilan):
                        </div>

                        {/* Hint 1 */}
                        <div className={styles.hintRow}>
                          <div className={styles.hintHeader}>
                            <span>1-daraja (-10% ball)</span>
                            {lab.unlockedHints?.includes(1) ? (
                              <span style={{ color: "#34d399", fontSize: "0.75rem" }}>Ochilgan ✓</span>
                            ) : (
                              <button
                                type="button"
                                className={styles.hintBtn}
                                onClick={() => handleUnlockHint(lab, 1)}
                              >
                                Ochish
                              </button>
                            )}
                          </div>
                          {lab.hint1 && <div className={styles.hintText}>{lab.hint1}</div>}
                        </div>

                        {/* Hint 2 */}
                        <div className={styles.hintRow}>
                          <div className={styles.hintHeader}>
                            <span>2-daraja (-20% ball)</span>
                            {lab.unlockedHints?.includes(2) ? (
                              <span style={{ color: "#34d399", fontSize: "0.75rem" }}>Ochilgan ✓</span>
                            ) : (
                              <button
                                type="button"
                                className={styles.hintBtn}
                                onClick={() => handleUnlockHint(lab, 2)}
                              >
                                Ochish
                              </button>
                            )}
                          </div>
                          {lab.hint2 && <div className={styles.hintText}>{lab.hint2}</div>}
                        </div>

                        {/* Hint 3 */}
                        <div className={styles.hintRow}>
                          <div className={styles.hintHeader}>
                            <span>3-daraja (-30% ball)</span>
                            {lab.unlockedHints?.includes(3) ? (
                              <span style={{ color: "#34d399", fontSize: "0.75rem" }}>Ochilgan ✓</span>
                            ) : (
                              <button
                                type="button"
                                className={styles.hintBtn}
                                onClick={() => handleUnlockHint(lab, 3)}
                              >
                                Ochish
                              </button>
                            )}
                          </div>
                          {lab.hint3 && <div className={styles.hintText}>{lab.hint3}</div>}
                        </div>
                      </div>

                      {/* Ustoz uchun qo'llanma (Faqat ustoz/adminlarga ko'rinadi) */}
                      {lab.guide && (
                        <div style={{ padding: 10, background: "rgba(168, 85, 247, 0.1)", border: "1px dashed #a855f7", borderRadius: 6, fontSize: "0.8rem", color: "#c084fc" }}>
                          <strong>👨‍🏫 Ustoz Yechim Yo&apos;riqnomasi:</strong>
                          <pre style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{lab.guide}</pre>
                        </div>
                      )}

                      {/* Flag topshirish formasi */}
                      {isSolved ? (
                        <div className={styles.successNotice}>
                          <span>✓</span>
                          <span>Topshiriq muvaffaqiyatli bajarildi!</span>
                        </div>
                      ) : (
                        <form onSubmit={(e) => handleSubmitFlag(e, lab)} className={styles.flagForm}>
                          <input
                            type="text"
                            className={styles.flagInput}
                            placeholder="flag{...}"
                            value={flagInputs[lab.id] || ""}
                            onChange={(e) =>
                              setFlagInputs({ ...flagInputs, [lab.id]: e.target.value })
                            }
                            required
                          />
                          <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ padding: "8px 16px" }}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? "..." : "Yuborish"}
                          </button>
                        </form>
                      )}

                      {/* Xatolik / Muvaffaqiyat xabari */}
                      {msg && msg.text && (
                        <div
                          style={{
                            color: msg.type === "success" ? "#34d399" : "#f87171",
                            fontSize: "0.82rem",
                            marginTop: -6,
                          }}
                        >
                          {msg.text}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* 2. SCOREBOARD BO'LIMI */}
        {activeTab === "scoreboard" && (
          <div className={styles.scoreboardCard}>
            <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>
                🏆 Talabalar Reytingi (Scoreboard)
              </h2>
              <div className={styles.filterBar} style={{ margin: 0 }}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={`${styles.filterBtn} ${selectedCategory === cat ? styles.filterBtnActive : ""}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* First Blood Faxriy Ro'yxati */}
            {firstBloods.length > 0 && (
              <div style={{ marginBottom: 28, padding: 16, background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: 10 }}>
                <div style={{ color: "#f87171", fontWeight: 800, fontSize: "0.95rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🩸</span> FIRST BLOOD SOVRINDORLARI (Birinchi Bo&apos;lib Yechganlar):
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {firstBloods.map((fb, idx) => (
                    <div key={idx} style={{ background: "#1f2937", padding: "6px 12px", borderRadius: 6, fontSize: "0.82rem" }}>
                      <span style={{ color: "#38bdf8", fontWeight: "bold" }}>{fb.labTitle}:</span>{" "}
                      <span style={{ color: "#fff" }}>{fb.displayName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loadingScoreboard ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                Reyting ma&apos;lumotlari yuklanmoqda...
              </div>
            ) : leaderboard.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                Ushbu bo&apos;lim bo&apos;yicha hali hech kim topshiriq yechmagan. Birinchi bo&apos;ling!
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>O&apos;rin</th>
                    <th>Talaba (DisplayName)</th>
                    <th>Yechilgan Lablar</th>
                    <th>First Blood (🩸)</th>
                    <th>Umumiy Ball</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((user) => {
                    const rankClass =
                      user.rank === 1
                        ? styles.rank1
                        : user.rank === 2
                        ? styles.rank2
                        : user.rank === 3
                        ? styles.rank3
                        : styles.rankOther;

                    return (
                      <tr key={user.displayName}>
                        <td>
                          <span className={`${styles.rankBadge} ${rankClass}`}>{user.rank}</span>
                        </td>
                        <td style={{ fontWeight: 600, color: "#fff" }}>
                          <span style={{ marginRight: 8 }}>{user.avatar}</span>
                          {user.displayName}
                        </td>
                        <td>{user.solvedCount} ta</td>
                        <td style={{ color: user.firstBloodCount > 0 ? "#f87171" : "#94a3b8", fontWeight: 700 }}>
                          {user.firstBloodCount > 0 ? `🩸 ${user.firstBloodCount}` : "—"}
                        </td>
                        <td style={{ fontWeight: 900, color: "#38bdf8", fontSize: "1.1rem" }}>
                          {user.totalScore}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
