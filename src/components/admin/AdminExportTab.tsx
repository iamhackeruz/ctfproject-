"use client";

import { useState } from "react";

export default function AdminExportTab() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (type: "students" | "quizzes" | "labs" | "certificates") => {
    setDownloading(type);
    try {
      const res = await fetch(`/api/admin/export?type=${type}`);
      if (!res.ok) throw new Error("Yuklab olishda xatolik");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cyberedu_${type}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Faylni yuklab olishda xatolik yuz berdi: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>📥 Ma&apos;lumotlarni CSV Formatida Eksport Qilish</h2>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
          Platformadagi barcha akademik ko&apos;rsatkichlarni Excel va tahliliy dasturlar uchun xavfsiz (Formula Injection himoyalangan) CSV formatida yuklab oling
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {/* 1. Talabalar Progressi */}
        <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "2rem" }}>👨‍🎓</div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "10px 0 6px", color: "#38bdf8" }}>
              Talabalar va Progress
            </h3>
            <p style={{ fontSize: "0.84rem", color: "#94a3b8", lineHeight: 1.5 }}>
              Barcha talabalar ro&apos;yxati, ularning guruhlari, yozilgan kurslari, yakunlagan darslari va sertifikatlari soni.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 18 }}
            disabled={downloading === "students"}
            onClick={() => handleDownload("students")}
          >
            {downloading === "students" ? "Tayyorlanmoqda..." : "📥 CSV Yuklab Olish"}
          </button>
        </div>

        {/* 2. Laboratoriya Natijalari */}
        <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "2rem" }}>🧪</div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "10px 0 6px", color: "#34d399" }}>
              Laboratoriya Natijalari
            </h3>
            <p style={{ fontSize: "0.84rem", color: "#94a3b8", lineHeight: 1.5 }}>
              Talabalarning barcha flag topshirishlari jurnali, ballar, to&apos;g&apos;ri/xato urinishlar va First Blood natijalari.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-green"
            style={{ marginTop: 18 }}
            disabled={downloading === "labs"}
            onClick={() => handleDownload("labs")}
          >
            {downloading === "labs" ? "Tayyorlanmoqda..." : "📥 CSV Yuklab Olish"}
          </button>
        </div>

        {/* 3. Quiz Ballari */}
        <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "2rem" }}>📝</div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "10px 0 6px", color: "#f59e0b" }}>
              Test (Quiz) Ballari
            </h3>
            <p style={{ fontSize: "0.84rem", color: "#94a3b8", lineHeight: 1.5 }}>
              Darslar bo&apos;yicha oraliq test natijalari, talabalarning o&apos;rtacha bali, o&apos;tish ko&apos;rsatkichlari va urinishlar soni.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            style={{ marginTop: 18 }}
            disabled={downloading === "quizzes"}
            onClick={() => handleDownload("quizzes")}
          >
            {downloading === "quizzes" ? "Tayyorlanmoqda..." : "📥 CSV Yuklab Olish"}
          </button>
        </div>

        {/* 4. Sertifikatlar */}
        <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "2rem" }}>🎓</div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "10px 0 6px", color: "#a855f7" }}>
              Berilgan Sertifikatlar
            </h3>
            <p style={{ fontSize: "0.84rem", color: "#94a3b8", lineHeight: 1.5 }}>
              Barcha tasdiqlangan va rasmiy berilgan sertifikatlar ro&apos;yxati, unikal tekshirish kodlari va baholari.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            style={{ marginTop: 18 }}
            disabled={downloading === "certificates"}
            onClick={() => handleDownload("certificates")}
          >
            {downloading === "certificates" ? "Tayyorlanmoqda..." : "📥 CSV Yuklab Olish"}
          </button>
        </div>
      </div>
    </div>
  );
}
