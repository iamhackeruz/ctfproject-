"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCourses } from "@/context/CourseContext";
import styles from "./certificate.module.css";

function CertificateContent() {
  const params = useParams();
  const { user } = useAuth();
  const { courses } = useCourses();

  const courseId = Number(params?.id) || 1;
  const course = courses.find((c) => c.id === courseId) || courses[0];

  const studentName = user?.name || "Jasur Aliyev";
  const certId = `CYBER-EDU-2026-${courseId * 743}-${studentName.length}92`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={styles.page}>
      <div className={styles.actionsTop}>
        <Link href="/dashboard" className="btn btn-ghost">
          ← Kabinetga qaytish
        </Link>
        <button type="button" onClick={handlePrint} className="btn btn-primary">
          🖨️ Chop etish / PDF saqlash
        </button>
      </div>

      <div className={styles.certContainer}>
        <div className={styles.watermark}>🛡️</div>

        <div className={styles.headerLogo}>
          <span>🛡️</span>
          <span>Cyber<span className="g-blue">Edu</span> Academy</span>
        </div>

        <h1 className={styles.certTitle}>Muvaffaqiyat Sertifikati</h1>
        <div className={styles.certSubtitle}>Certificate of Completion</div>

        <div className={styles.presentedTo}>Ushbu sertifikat beriladi:</div>
        <div className={styles.studentName}>{studentName}</div>

        <p className={styles.certText}>
          Kiberxavfsizlik o&apos;quv dasturi doirasida taqdim etilgan barcha nazariy va amaliy laboratoriya
          mashg&apos;ulotlarini to&apos;liq tamomlaganligi hamda <span className={styles.courseHighlight}>&quot;{course?.title}&quot;</span> kursi
          talablarini muvaffaqiyatli bajarganligi tasdiqlanadi.
        </p>

        <div className={styles.footerRow}>
          <div className={styles.signatureBox}>
            <div className={styles.signatureLine} />
            <div className={styles.signatureName}>{course?.instructor?.name || "Sardor Rahimov"}</div>
            <div className={styles.signatureTitle}>Bosh Instruktor / CISSP</div>
          </div>

          <div className={styles.seal}>
            <span>★ ★ ★</span>
            <span>CYBER</span>
            <span>VERIFIED</span>
          </div>

          <div className={styles.signatureBox}>
            <div className={styles.signatureLine} />
            <div className={styles.signatureName}>28-Oktyabr, 2026</div>
            <div className={styles.signatureTitle}>Berilgan Sana</div>
          </div>
        </div>

        <div className={styles.certId}>
          Hujjat haqiqiyligini tekshirish ID raqami: <strong>{certId}</strong>
        </div>
      </div>
    </div>
  );
}

export default function CertificatePage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Sertifikat yuklanmoqda...</div>}>
      <CertificateContent />
    </Suspense>
  );
}
