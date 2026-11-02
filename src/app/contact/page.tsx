"use client";

import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrorMessage("Iltimos, barcha majburiy maydonlarni to'ldiring.");
      setStatus("error");
      return;
    }

    try {
      setStatus("submitting");
      setErrorMessage("");

      // Xabarni yuborish (kelajakda Telegram / Email bilan integratsiya qilinadi)
      await new Promise((res) => setTimeout(res, 600));

      setStatus("success");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      setStatus("error");
      setErrorMessage("Xabar yuborishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0b0f19", color: "#f3f4f6" }}>
      <Navbar />

      <main style={{ flex: 1, padding: "3rem 1.5rem" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <span
              style={{
                display: "inline-block",
                padding: "0.35rem 0.85rem",
                borderRadius: "9999px",
                background: "rgba(56, 189, 248, 0.15)",
                color: "#38bdf8",
                fontWeight: 600,
                fontSize: "0.875rem",
                marginBottom: "0.75rem",
              }}
            >
              💬 Biz Bilan Bog&apos;lanish
            </span>
            <h1 style={{ fontSize: "2.25rem", fontWeight: 800, color: "#f9fafb", margin: "0 0 0.5rem" }}>
              Savollaringiz bormi? Yordam berishdan mamnunmiz!
            </h1>
            <p style={{ fontSize: "1rem", color: "#9ca3af", maxWidth: "600px", margin: "0 auto" }}>
              Kurslar, hamkorlik, tashkiliy masalalar yoki texnik yordam bo&apos;yicha biz bilan bog&apos;laning.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem" }}>
            {/* Aloqa Kartalari */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "0.75rem", padding: "1.5rem" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>✈️</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#f9fafb", margin: "0 0 0.25rem" }}>
                  Telegram Orqali Muloqot
                </h3>
                <p style={{ fontSize: "0.875rem", color: "#9ca3af", margin: "0 0 0.75rem" }}>
                  Tezkor savollar va texnik yordam uchun rasmiy kanal va botimiz:
                </p>
                <a
                  href="https://t.me/cyberedu_uz"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#38bdf8", fontWeight: 600, textDecoration: "none", fontSize: "0.9rem" }}
                >
                  @cyberedu_uz kanaliga o&apos;tish →
                </a>
              </div>

              <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "0.75rem", padding: "1.5rem" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📧</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#f9fafb", margin: "0 0 0.25rem" }}>
                  Elektron Pochta
                </h3>
                <p style={{ fontSize: "0.875rem", color: "#9ca3af", margin: "0 0 0.75rem" }}>
                  Rasmiy takliflar, tashkiliy masalalar va korporativ o&apos;qitish:
                </p>
                <a
                  href="mailto:contact@cyberedu.uz"
                  style={{ color: "#38bdf8", fontWeight: 600, textDecoration: "none", fontSize: "0.9rem" }}
                >
                  contact@cyberedu.uz
                </a>
              </div>

              <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "0.75rem", padding: "1.5rem" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🏢</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#f9fafb", margin: "0 0 0.25rem" }}>
                  Ish Vaqti va Manzil
                </h3>
                <p style={{ fontSize: "0.875rem", color: "#9ca3af", margin: "0 0 0.5rem" }}>
                  Dushanba — Shanba: 09:00 dan 18:00 gacha
                </p>
                <p style={{ fontSize: "0.875rem", color: "#cbd5e1", margin: 0 }}>
                  Toshkent shahri, IT Park rezidenti
                </p>
              </div>
            </div>

            {/* Xabar Yuborish Formasi */}
            <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "0.75rem", padding: "2rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f9fafb", margin: "0 0 1.25rem" }}>
                Bizga xabar qoldiring
              </h2>

              {status === "success" && (
                <div
                  style={{
                    padding: "1rem",
                    backgroundColor: "rgba(34, 197, 94, 0.15)",
                    border: "1px solid #22c55e",
                    borderRadius: "0.5rem",
                    color: "#4ade80",
                    marginBottom: "1.25rem",
                    fontSize: "0.875rem",
                  }}
                >
                  ✅ Rahmat! Xabaringiz muvaffaqiyatli qabul qilindi. Tez orada siz bilan bog&apos;lanamiz.
                </div>
              )}

              {status === "error" && (
                <div
                  style={{
                    padding: "1rem",
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid #ef4444",
                    borderRadius: "0.5rem",
                    color: "#f87171",
                    marginBottom: "1.25rem",
                    fontSize: "0.875rem",
                  }}
                >
                  ⚠️ {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", color: "#cbd5e1", marginBottom: "0.35rem" }}>
                    Ismingiz <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Masalan: Sardor Aliyev"
                    style={{
                      width: "100%",
                      padding: "0.65rem 0.85rem",
                      background: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#f9fafb",
                      fontSize: "0.875rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", color: "#cbd5e1", marginBottom: "0.35rem" }}>
                    Email manzilingiz <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="misol@cyberedu.uz"
                    style={{
                      width: "100%",
                      padding: "0.65rem 0.85rem",
                      background: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#f9fafb",
                      fontSize: "0.875rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", color: "#cbd5e1", marginBottom: "0.35rem" }}>
                    Mavzu
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Masalan: Kurslar bo'yicha savol"
                    style={{
                      width: "100%",
                      padding: "0.65rem 0.85rem",
                      background: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#f9fafb",
                      fontSize: "0.875rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", color: "#cbd5e1", marginBottom: "0.35rem" }}>
                    Xabaringiz <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Savolingiz yoki taklifingizni bu yerda batafsil yozing..."
                    style={{
                      width: "100%",
                      padding: "0.65rem 0.85rem",
                      background: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                      color: "#f9fafb",
                      fontSize: "0.875rem",
                      boxSizing: "border-box",
                      resize: "vertical",
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#2563eb",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    border: "none",
                    borderRadius: "0.5rem",
                    cursor: status === "submitting" ? "not-allowed" : "pointer",
                    opacity: status === "submitting" ? 0.7 : 1,
                    marginTop: "0.5rem",
                  }}
                >
                  {status === "submitting" ? "Yuborilmoqda..." : "Yuborish ✉️"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
