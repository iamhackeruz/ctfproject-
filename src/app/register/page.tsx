"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import styles from "./register.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const { registerUser } = useAuth();

  const [showPass, setShowPass] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!firstName.trim() || !lastName.trim()) {
      setError("Iltimos, ism va familiyangizni kiriting.");
      return;
    }
    if (!email || !email.includes("@")) {
      setError("Iltimos, to'g'ri elektron pochta manzilini kiriting.");
      return;
    }
    if (password.length < 10) {
      setError("Xavfsizlik talabi: Parol kamida 10 ta belgidan iborat bo'lishi kerak.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    const res = await registerUser(
      `${firstName.trim()} ${lastName.trim()}`,
      email.trim(),
      password,
      inviteCode.trim() || undefined
    );

    setIsSubmitting(false);

    if (res.success) {
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 800);
    } else {
      setError(res.error || "Ro'yxatdan o'tishda xatolik yuz berdi.");
    }
  };

  return (
    <div className={`${styles.page} cyber-grid`}>
      <div className={styles.orb} />

      <div className={styles.card}>
        <Link href="/" className={styles.logo}>
          <span>🛡️</span>
          <span>Cyber<span className="gradient-text">Edu</span></span>
        </Link>

        <h1 className={styles.title}>Hisob yarating</h1>
        <p className={styles.subtitle}>Kiberxavfsizlik o&apos;quv platformasiga xush kelibsiz!</p>

        {isSuccess ? (
          <div style={{
            textAlign: "center",
            padding: "24px 0",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center"
          }}>
            <span style={{ fontSize: "2.5rem" }}>🎉</span>
            <h2 style={{ fontSize: "1.2rem", color: "#34d399" }}>Ro&apos;yxatdan muvaffaqiyatli o&apos;tdingiz!</h2>
            <p style={{ fontSize: "0.88rem", color: "#94a3b8" }}>
              Shaxsiy kabinetingizga yo&apos;naltirilmoqdasiz...
            </p>
          </div>
        ) : (
          <form method="post" action="#" className={styles.form} onSubmit={handleSubmit}>
            {error && (
              <div
                role="alert"
                id="register-error-alert"
                style={{
                  background: "rgba(239, 68, 68, 0.16)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  color: "#fca5a5",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  fontSize: "0.86rem",
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}
              >
                ⚠️ {error}
              </div>
            )}

            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="reg-firstname">Ism</label>
                <input
                  id="reg-firstname"
                  type="text"
                  className="input"
                  placeholder="Abdulloh"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="reg-lastname">Familiya</label>
                <input
                  id="reg-lastname"
                  type="text"
                  className="input"
                  placeholder="Karimov"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                type="email"
                className="input"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="reg-invite">
                Taklif Kodi (Invite Code)
                <span style={{ fontSize: "0.78rem", color: "#94a3b8", marginLeft: 6 }}>
                  (O&apos;quv markaz ustozidan olinadi)
                </span>
              </label>
              <input
                id="reg-invite"
                type="text"
                className="input"
                placeholder="Masalan: CYBER-INV-8F9E2A"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                autoComplete="off"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="reg-password">Parol (kamida 10 ta belgi)</label>
              <div className={styles.passWrapper}>
                <input
                  id="reg-password"
                  type={showPass ? "text" : "password"}
                  className={`input ${styles.passInput}`}
                  placeholder="Kamida 10 ta murakkab belgi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  id="toggle-reg-password"
                  className={styles.eyeBtn}
                  onClick={() => setShowPass(!showPass)}
                  aria-label="Parolni ko'rsatish"
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button
              id="btn-register"
              type="submit"
              disabled={isSubmitting}
              className={`btn btn-primary ${styles.submitBtn}`}
            >
              {isSubmitting ? (
                "Ro'yxatdan o'tkazilmoqda..."
              ) : (
                <>
                  Ro&apos;yxatdan O&apos;tish
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                    <path
                      d="M5 12h14M12 5l7 7-7 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </>
              )}
            </button>
          </form>
        )}

        <p className={styles.loginLink}>
          Hisobingiz bormi?{" "}
          <Link href="/login" className="gradient-text" style={{ fontWeight: 600 }}>
            Kirish
          </Link>
        </p>
      </div>
    </div>
  );
}
