"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { use } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CourseEnrollAction from "@/components/CourseEnrollAction";
import { useCourses } from "@/context/CourseContext";
import styles from "./course-detail.module.css";

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { courses } = useCourses();

  const course = courses.find((c) => c.id === Number(id));

  if (!course) {
    notFound();
  }

  return (
    <div className={styles.page}>
      <Navbar />

      {/* Hero section */}
      <section className={`${styles.hero} cyber-bg`}>
        <div className={`wrap ${styles.heroInner}`}>
          <div className={styles.breadcrumb}>
            <Link href="/">Bosh sahifa</Link>
            <span className={styles.breadcrumbSep}>/</span>
            <Link href="/courses">Kurslar</Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span>{course.title}</span>
          </div>

          <div className={styles.heroTop}>
            <span className={styles.courseEmoji}>{course.icon}</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {course.accessType === "PREMIUM" ? (
                <span className="badge" style={{ backgroundColor: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", border: "1px solid #f59e0b" }}>
                  ⭐ Premium Obuna
                </span>
              ) : course.accessType === "PAID_COURSE" ? (
                <span className="badge badge-blue">
                  {course.priceUzs ? `${course.priceUzs.toLocaleString()} so'm` : "Pullik"}
                </span>
              ) : (
                <span className="badge badge-green">Bepul</span>
              )}
              <span className={`badge ${course.levelColor}`}>{course.level}</span>
            </div>
          </div>

          <h1 className={styles.title}>{course.title}</h1>
          <p className={styles.desc}>{course.fullDesc}</p>

          <div className={styles.metaRow}>
            <div className={styles.metaItem}>
              <span>👨‍🏫 O&apos;qituvchi:</span>
              <strong style={{ color: "#f1f5f9" }}>{course.instructor.name}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>⏱ Davomiyligi:</span>
              <strong style={{ color: "#f1f5f9" }}>{course.duration}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>🎬 Darslar:</span>
              <strong style={{ color: "#f1f5f9" }}>{course.lessons} ta dars</strong>
            </div>
            <div className={styles.metaItem}>
              <span>👨‍🎓 O&apos;quvchilar:</span>
              <strong style={{ color: "#f1f5f9" }}>{course.students} nafar</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className={styles.contentSection}>
        <div className={`wrap ${styles.layout}`}>
          {/* Left Column */}
          <div className={styles.leftCol}>
            {/* What you'll learn */}
            <div className={`card ${styles.sectionBox}`}>
              <h2 className={styles.sectionBoxTitle}>
                <span>🎯</span> Kursda nimalarni o&apos;rganasiz?
              </h2>
              <div className={styles.learnGrid}>
                {course.whatYouWillLearn.map((item, idx) => (
                  <div key={idx} className={styles.learnItem}>
                    <span className={styles.checkIcon}>✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Curriculum / Modules */}
            <div className={`card ${styles.sectionBox}`}>
              <h2 className={styles.sectionBoxTitle}>
                <span>📚</span> Darslar Dasturi (Sillabus)
              </h2>
              <div className={styles.moduleList}>
                {course.modules.map((module, mIdx) => (
                  <div key={mIdx} className={styles.moduleCard}>
                    <div className={styles.moduleHeader}>
                      <span className={styles.moduleTitle}>{module.title}</span>
                      <span className={styles.moduleDuration}>{module.duration}</span>
                    </div>
                    <ul className={styles.lessonList}>
                      {module.lessons.map((lesson, lIdx) => (
                        <li key={lIdx} className={styles.lessonItem}>
                          <Link
                            href={`/courses/${course.id}/learn`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              width: "100%",
                              textDecoration: "none",
                              color: "inherit",
                            }}
                          >
                            <div className={styles.lessonLeft}>
                              <span className={styles.lessonPlay}>▶</span>
                              <span style={{ fontWeight: 500 }}>{lesson.title}</span>
                              {lesson.isFree && (
                                <span
                                  className="badge badge-green"
                                  style={{ fontSize: "0.65rem", padding: "2px 8px" }}
                                >
                                  Bepul ko&apos;rish
                                </span>
                              )}
                            </div>
                            <div className={styles.lessonRight}>
                              <span className={styles.lessonDuration}>{lesson.duration}</span>
                              <span style={{ color: "#38bdf8", fontSize: "0.85rem" }}>
                                Kirish →
                              </span>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Prerequisites */}
            <div className={`card ${styles.sectionBox}`}>
              <h2 className={styles.sectionBoxTitle}>
                <span>⚙️</span> Talab qilinadigan bilimlar
              </h2>
              <ul style={{ listStyle: "inside disc", color: "#cbd5e1", lineHeight: 1.8 }}>
                {course.prerequisites.map((req, rIdx) => (
                  <li key={rIdx}>{req}</li>
                ))}
              </ul>
            </div>

            {/* Instructor */}
            <div className={`card ${styles.sectionBox}`}>
              <h2 className={styles.sectionBoxTitle}>
                <span>👨‍🏫</span> Kurs O&apos;qituvchisi
              </h2>
              <div className={styles.instructorCard}>
                <div className={styles.instructorAvatar}>
                  {course.instructor.avatar}
                </div>
                <div>
                  <div className={styles.instructorName}>{course.instructor.name}</div>
                  <div className={styles.instructorRole}>{course.instructor.role}</div>
                  <div className={styles.instructorExp}>{course.instructor.experience}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar Column */}
          <aside className={styles.sidebar}>
            <div className={`card ${styles.sidebarCard}`}>
              <div className={styles.priceBox}>
                <span className={styles.price}>
                  {course.accessType === "PREMIUM"
                    ? "Premium"
                    : course.accessType === "PAID_COURSE"
                    ? (course.priceUzs ? `${course.priceUzs.toLocaleString()} so'm` : "Pullik")
                    : "Bepul"}
                </span>
                <span className={styles.priceLabel}>
                  {course.accessType === "PREMIUM"
                    ? "Premium obuna talab etiladi"
                    : course.accessType === "PAID_COURSE"
                    ? "Bir martalik to'lov / kirish huquqi"
                    : "Platforma a'zolari uchun"}
                </span>
              </div>

              <CourseEnrollAction courseId={course.id} courseTitle={course.title} />

              <ul className={styles.perksList}>
                <li className={styles.perkItem}>
                  <span>🎬</span> {course.lessons} ta sifatli video dars
                </li>
                <li className={styles.perkItem}>
                  <span>⏱</span> {course.duration} to&apos;liq amaliy material
                </li>
                <li className={styles.perkItem}>
                  <span>💻</span> Amaliy laboratoriya topshiriqlari
                </li>
                <li className={styles.perkItem}>
                  <span>📜</span> Kurs yakunida maxsus sertifikat
                </li>
                <li className={styles.perkItem}>
                  <span>♾️</span> Materiallarga umrbod kirish
                </li>
              </ul>

              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: "0.8rem", color: "#64748b", display: "block", marginBottom: 8 }}>
                  Teglar:
                </span>
                <div className={styles.tagsBox}>
                  {course.tags.map((tag) => (
                    <span key={tag} className={styles.tag}>
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
