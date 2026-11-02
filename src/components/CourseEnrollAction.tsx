"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import styles from "../app/courses/[id]/course-detail.module.css";

interface Props {
  courseId: number;
  courseTitle: string;
}

export default function CourseEnrollAction({ courseId, courseTitle }: Props) {
  const { user, enrollCourse, isEnrolled } = useAuth();
  const alreadyEnrolled = isEnrolled(courseId);
  const [justEnrolled, setJustEnrolled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleEnroll = () => {
    setIsLoading(true);
    setTimeout(() => {
      enrollCourse(courseId);
      setIsLoading(false);
      setJustEnrolled(true);
    }, 500);
  };

  const isMember = alreadyEnrolled || justEnrolled;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {isMember ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className={styles.alertSuccess}>
            <span>🎉</span>
            <div>
              <strong>A&apos;zolik faol!</strong>
              <div>Siz &quot;{courseTitle}&quot; kursiga a&apos;zo bo&apos;lgansiz.</div>
            </div>
          </div>
          <Link
            href={`/courses/${courseId}/learn`}
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: "0.95rem" }}
          >
            ▶ Darslarni boshlash (Klassxona)
          </Link>
          <Link
            href="/dashboard"
            className="btn btn-ghost"
            style={{ width: "100%", justifyContent: "center", padding: "10px", fontSize: "0.85rem" }}
          >
            Shaxsiy kabinetda ko&apos;rish →
          </Link>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleEnroll}
          disabled={isLoading}
          className={`btn btn-primary ${styles.enrollBtn}`}
        >
          {isLoading ? (
            "Yuklanmoqda..."
          ) : (
            <>
              Kursga a&apos;zo bo&apos;lish — Bepul
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path
                  d="M5 12h14M12 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </>
          )}
        </button>
      )}

      {!user && (
        <div style={{ textAlign: "center", fontSize: "0.82rem", color: "#64748b" }}>
          <span>Progressovni saqlash uchun </span>
          <Link href="/login" style={{ color: "#38bdf8", textDecoration: "underline" }}>
            Tizimga kiring
          </Link>
        </div>
      )}
    </div>
  );
}
