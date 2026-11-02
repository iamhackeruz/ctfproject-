"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error"
  );
  const [message, setMessage] = useState<string>(
    token ? "Elektron pochta tasdiqlanmoqda..." : "Tasdiqlash tokeni ko'rsatilmadi."
  );
  const hasRequested = useRef(false);

  useEffect(() => {
    if (!token || hasRequested.current) return;
    hasRequested.current = true;

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success) {
          setStatus("success");
          setMessage(data.message || "Pochtani tasdiqlash muvaffaqiyatli yakunlandi!");
        } else {
          setStatus("error");
          setMessage(data.error || "Tasdiqlash kodi yaroqsiz yoki muddati o'tgan.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Tasdiqlashda tarmoq xatosi yuz berdi. Iltimos, qayta urinib ko'ring.");
      });
  }, [token]);

  return (
    <div
      style={{
        maxWidth: "520px",
        margin: "4rem auto",
        background: "#111827",
        border: "1px solid #1f2937",
        borderRadius: "1rem",
        padding: "2.5rem 2rem",
        textAlign: "center",
      }}
    >
      {status === "loading" && (
        <>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f9fafb", margin: "0 0 0.5rem" }}>
            Pochta tasdiqlanmoqda...
          </h1>
          <p style={{ color: "#9ca3af", fontSize: "0.95rem" }}>{message}</p>
        </>
      )}

      {status === "success" && (
        <>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎉</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#4ade80", margin: "0 0 0.5rem" }}>
            Muvaffaqiyatli Tasdiqlandi!
          </h1>
          <p style={{ color: "#cbd5e1", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "2rem" }}>
            {message}
          </p>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              width: "100%",
              padding: "0.85rem 1.5rem",
              backgroundColor: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              fontSize: "1rem",
              borderRadius: "0.5rem",
              textDecoration: "none",
              boxSizing: "border-box",
            }}
          >
            Tizimga Kirish (Login) →
          </Link>
        </>
      )}

      {status === "error" && (
        <>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f87171", margin: "0 0 0.5rem" }}>
            Tasdiqlashda Xatolik
          </h1>
          <p style={{ color: "#cbd5e1", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "2rem" }}>
            {message}
          </p>
          <div style={{ display: "flex", gap: "1rem", flexDirection: "column" }}>
            <Link
              href="/register"
              style={{
                display: "inline-block",
                width: "100%",
                padding: "0.85rem 1.5rem",
                backgroundColor: "#374151",
                color: "#f9fafb",
                fontWeight: 600,
                fontSize: "0.95rem",
                borderRadius: "0.5rem",
                textDecoration: "none",
                boxSizing: "border-box",
              }}
            >
              Qayta Ro&apos;yxatdan O&apos;tish
            </Link>
            <Link
              href="/contact"
              style={{
                color: "#38bdf8",
                fontSize: "0.875rem",
                textDecoration: "none",
              }}
            >
              Yordam xizmati bilan bog&apos;lanish
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0b0f19", color: "#f3f4f6" }}>
      <Navbar />
      <main style={{ flex: 1, padding: "1.5rem" }}>
        <Suspense fallback={<div style={{ textAlign: "center", padding: "4rem", color: "#9ca3af" }}>Yuklanmoqda...</div>}>
          <VerifyEmailContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
