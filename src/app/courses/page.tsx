"use client";

import { useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import styles from "./courses.module.css";
import Link from "next/link";
import { useCourses } from "@/context/CourseContext";

const levels = ["Barchasi", "Boshlang'ich", "O'rta", "Ilg'or"] as const;

export default function CoursesPage() {
  const { courses } = useCourses();
  const [search, setSearch] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("Barchasi");

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchesSearch =
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.desc.toLowerCase().includes(search.toLowerCase()) ||
        c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

      const matchesLevel =
        selectedLevel === "Barchasi" ||
        c.level === selectedLevel ||
        c.level === "Barcha daraja";

      return matchesSearch && matchesLevel;
    });
  }, [courses, search, selectedLevel]);

  return (
    <div className={styles.page}>
      <Navbar />

      {/* Header */}
      <section className={`${styles.header} cyber-grid`}>
        <div className={styles.orb} />
        <div className={`wrap ${styles.headerInner}`}>
          <div className="badge badge-blue">📚 Kurslar kutubxonasi</div>
          <h1 className={styles.title}>
            Barcha <span className="gradient-text">Kurslar</span>
          </h1>
          <p className={styles.desc}>
            Kiberxavfsizlik sohasida professional bo&apos;lish uchun zarur barcha amaliy va nazariy bilimlar
          </p>
        </div>
      </section>

      {/* Courses grid */}
      <section className={styles.main}>
        <div className="wrap">
          {/* Controls: Search and Filter */}
          <div className={styles.controls}>
            <div className={styles.searchBox}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                type="text"
                className={`input ${styles.searchInput}`}
                placeholder="Kurs nomi yoki texnologiya bo'yicha qidirish..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className={styles.filterTabs}>
              {levels.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  className={`${styles.filterBtn} ${selectedLevel === lvl ? styles.filterBtnActive : ""}`}
                  onClick={() => setSelectedLevel(lvl)}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {filteredCourses.length === 0 ? (
            <div className={`card ${styles.emptyState}`}>
              <div className={styles.emptyIcon}>🔍</div>
              <h3>Mos keluvchi kurs topilmadi</h3>
              <p style={{ marginTop: 8, fontSize: "0.9rem" }}>
                Boshqa kalit so&apos;z yoki filtrni tanlab ko&apos;ring.
              </p>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: 16 }}
                onClick={() => {
                  setSearch("");
                  setSelectedLevel("Barchasi");
                }}
              >
                Filtrni tozalash
              </button>
            </div>
          ) : (
            <div className={styles.grid}>
              {filteredCourses.map((c) => (
                <Link
                  key={c.id}
                  href={`/courses/${c.id}`}
                  className={`card ${styles.card} ${styles[`card--${c.color}`]}`}
                >
                  {/* Top */}
                  <div className={styles.cardTop}>
                    <span className={styles.icon}>{c.icon}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      {c.accessType === "PREMIUM" ? (
                        <span className="badge" style={{ backgroundColor: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", border: "1px solid #f59e0b" }}>
                          ⭐ Premium
                        </span>
                      ) : c.accessType === "PAID_COURSE" ? (
                        <span className="badge badge-blue">
                          {c.priceUzs ? `${c.priceUzs.toLocaleString()} so'm` : "Pullik"}
                        </span>
                      ) : (
                        <span className="badge badge-green">Bepul</span>
                      )}
                      <span className={`badge ${c.levelColor}`}>{c.level}</span>
                    </div>
                  </div>

                  <h2 className={styles.cardTitle}>{c.title}</h2>
                  <p className={styles.cardDesc}>{c.desc}</p>

                  {/* Tags */}
                  <div className={styles.tags}>
                    {c.tags.map((t) => (
                      <span key={t} className={styles.tag}>
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className={styles.cardFooter}>
                    <div className={styles.meta}>
                      <span className={styles.metaItem}>
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M10 8l6 4-6 4V8z" fill="currentColor" />
                        </svg>
                        {c.lessons} dars
                      </span>
                      <span className={styles.metaItem}>
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                          <path
                            d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                        {c.students} o&apos;quvchi
                      </span>
                    </div>
                    <span className={styles.arrow}>→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
