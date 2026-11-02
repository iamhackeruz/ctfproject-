"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "../login/login.module.css";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // SMS Gateway simulation data
  const [smsData, setSmsData] = useState<{
    maskedPhone: string;
    code: string;
  } | null>(null);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("Iltimos, email yoki telefon raqamingizni kiriting.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_reset_code",
          identifier: identifier.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Tasdiqlash kodini yuborishda xatolik yuz berdi.");
        setIsLoading(false);
        return;
      }

      setSmsData({
        maskedPhone: data.maskedPhone,
        code: data.code,
      });
      setStep(2);
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      setError("Server bilan aloqada xatolik yuz berdi.");
      setIsLoading(false);
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || code.trim().length !== 6) {
      setError("Iltimos, 6 xonali tasdiqlash kodini to'liq kiriting.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Parollar bir-biriga mos kelmadi!");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_reset_code",
          identifier: identifier.trim(),
          code: code.trim(),
          newPassword: newPassword.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Kodni tasdiqlashda xatolik yuz berdi.");
        setIsLoading(false);
        return;
      }

      setSuccessMsg(data.message || "Parolingiz muvaffaqiyatli yangilandi!");
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      setError("Server bilan aloqada xatolik yuz berdi.");
      setIsLoading(false);
    }
  };

  return (
    <div className={`${styles.page} cyber-grid`}>
      <div className={styles.orb} />

      <div className={styles.card} style={{ maxWidth: 480 }}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>🛡️</span>
          <span>Cyber<span className="gradient-text">Edu</span></span>
        </Link>

        <h1 className={styles.title}>Parolni tiklash</h1>
        <p className={styles.subtitle}>
          {step === 1
            ? "Bog'langan telefon raqam yoki emailingizni kiriting"
            : "SMS orqali yuborilgan tasdiqlash kodini kiriting"}
        </p>

        {successMsg ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            textAlign: "center",
            padding: "20px 0"
          }}>
            <div style={{ fontSize: "2.8rem" }}>✅</div>
            <div style={{ color: "#34d399", fontWeight: 700, fontSize: "1.1rem" }}>
              {successMsg}
            </div>
            <p style={{ fontSize: "0.88rem", color: "#94a3b8", lineHeight: 1.6 }}>
              Hisobingiz himoyasi muvaffaqiyatli yangilandi. Endi yangi maxfiy parolingiz bilan tizimga kirishingiz mumkin.
            </p>
            <Link href="/login" className="btn btn-primary" style={{ marginTop: 8, justifyContent: "center" }}>
              Kirish sahifasiga o&apos;tish →
            </Link>
          </div>
        ) : step === 1 ? (
          <form className={styles.form} onSubmit={handleRequestCode}>
            {error && (
              <div style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "0.85rem"
              }}>
                {error}
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label} htmlFor="forgot-identifier">
                Email, Telefon raqam yoki Login
              </label>
              <input
                id="forgot-identifier"
                type="text"
                className="input"
                placeholder="+998901234567 yoki nomingiz@email.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                Hisobingizga ulangan telefon raqamiga 6 xonali SMS kod yuboriladi
              </span>
            </div>

            <button
              id="btn-request-sms"
              type="submit"
              disabled={isLoading}
              className={`btn btn-primary ${styles.submitBtn}`}
            >
              {isLoading ? "Yuborilmoqda..." : "SMS tasdiqlash kodini olish"}
            </button>
          </form>
        ) : (
          <div>
            {/* Simulated SMS notification banner */}
            {smsData && (
              <div style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(52, 211, 153, 0.3)",
                borderRadius: "12px",
                padding: "14px",
                marginBottom: "20px",
                fontSize: "0.85rem",
                lineHeight: 1.5,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#34d399", fontWeight: 600, marginBottom: 4 }}>
                  <span>📱</span>
                  <span>[SMS Gateway - Kiber Xavfsizlik Xizmati]</span>
                </div>
                <div style={{ color: "#cbd5e1" }}>
                  <strong>{smsData.maskedPhone}</strong> raqamiga tasdiqlash kodi yuborildi:
                </div>
                <div style={{
                  fontSize: "1.4rem",
                  letterSpacing: "4px",
                  fontWeight: "bold",
                  color: "#38bdf8",
                  fontFamily: "monospace",
                  marginTop: 6,
                  textAlign: "center",
                  padding: "6px",
                  background: "rgba(15, 23, 42, 0.6)",
                  borderRadius: "8px",
                  border: "1px dashed rgba(56, 189, 248, 0.3)"
                }}>
                  {smsData.code}
                </div>
                <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: 4, textAlign: "center" }}>
                  Amal qilish muddati: 10 daqiqa
                </div>
              </div>
            )}

            {error && (
              <div style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "0.85rem",
                marginBottom: 16
              }}>
                {error}
              </div>
            )}

            <form className={styles.form} onSubmit={handleVerifyAndReset}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="reset-code">
                  6 xonali tasdiqlash kodi
                </label>
                <input
                  id="reset-code"
                  type="text"
                  maxLength={6}
                  className="input"
                  placeholder="Masalan: 582914"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  style={{ letterSpacing: "3px", fontSize: "1.1rem", fontFamily: "monospace", textAlign: "center" }}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="new-pass">
                  Yangi Maxfiy Parol
                </label>
                <input
                  id="new-pass"
                  type="password"
                  className="input"
                  placeholder="Kamida 6 ta belgi..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="new-pass-confirm">
                  Yangi Parolni Tasdiqlang
                </label>
                <input
                  id="new-pass-confirm"
                  type="password"
                  className="input"
                  placeholder="Parolni qayta kiriting..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button
                id="btn-confirm-reset"
                type="submit"
                disabled={isLoading}
                className={`btn btn-green ${styles.submitBtn}`}
              >
                {isLoading ? "Yangilanmoqda..." : "Parolni Yangilash va Saqlash"}
              </button>

              <div style={{ textAlign: "center", marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    textDecoration: "underline"
                  }}
                >
                  ← Qaytadan kod so&apos;rash
                </button>
              </div>
            </form>
          </div>
        )}

        <div className={styles.dividerRow}>
          <div className="divider" style={{ flex: 1 }} />
          <span className={styles.orText}>yoki</span>
          <div className="divider" style={{ flex: 1 }} />
        </div>

        <p className={styles.registerLink}>
          Parolingiz esingizdami?{" "}
          <Link href="/login" className="gradient-text" style={{ fontWeight: 600 }}>
            Kirish sahifasiga qaytish
          </Link>
        </p>
      </div>
    </div>
  );
}
