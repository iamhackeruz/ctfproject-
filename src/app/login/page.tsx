"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, User } from "@/context/AuthContext";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const { loginWithUser } = useAuth();

  const [showPass, setShowPass] = useState(false);
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // 2FA states
  const [twoFactorMode, setTwoFactorMode] = useState<"none" | "setup" | "verify" | "backup_codes">("none");
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [twoFactorQrSvg, setTwoFactorQrSvg] = useState("");
  const [twoFactorSecret, setTwoFactorSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [isBackupCodeMode, setIsBackupCodeMode] = useState(false);
  const [backupCodeInput, setBackupCodeInput] = useState("");
  const [generatedBackupCodes, setGeneratedBackupCodes] = useState<string[]>([]);
  const [twoFactorSavedUser, setTwoFactorSavedUser] = useState<User | null>(null);
  const [twoFactorError, setTwoFactorError] = useState("");
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  // First-time setup state for temporary password
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupEmail, setSetupEmail] = useState("");
  const [setupPhone, setSetupPhone] = useState("+998 ");
  const [setupPass, setSetupPass] = useState("");
  const [setupPassConfirm, setSetupPassConfirm] = useState("");
  const [setupError, setSetupError] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrUsername.trim()) {
      setError("Iltimos, elektron pochta yoki loginni kiriting.");
      return;
    }
    if (!password) {
      setError("Iltimos, parolingizni kiriting.");
      return;
    }

    setError("");
    setTwoFactorError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          emailOrUsername: emailOrUsername.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Login yoki parol noto'g'ri kiritildi.");
        setIsLoading(false);
        return;
      }

      // If 2FA is required
      if (data.requires2Fa) {
        setIsLoading(false);
        setTwoFactorToken(data.twoFactorToken);

        if (data.setupRequired) {
          // Birinchi kirishda 2FA sozlash majburiy
          setTwoFactorLoading(true);
          try {
            const initRes = await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "2fa_setup_init",
                twoFactorToken: data.twoFactorToken,
              }),
            });
            const initData = await initRes.json();
            if (initData.success) {
              setTwoFactorQrSvg(initData.qrSvg);
              setTwoFactorSecret(initData.secret);
              setTwoFactorMode("setup");
            } else {
              setError(initData.error || "2FA sozlashda xatolik.");
            }
          } catch {
            setError("2FA xizmati bilan aloqada xatolik.");
          } finally {
            setTwoFactorLoading(false);
          }
        } else {
          // Oddiy 2FA tekshiruvi
          setTwoFactorMode("verify");
        }
        return;
      }

      // If this is a first-time setup or temporary password
      if (data.user?.mustChangePassword) {
        setIsLoading(false);
        setShowSetupModal(true);
        setSetupEmail(data.user.email !== "admin@cyberedu.uz" ? data.user.email : "");
        setSetupPhone(data.user.phone || "+998 ");
        return;
      }

      // Normal login
      loginWithUser(data.user);
      setIsLoading(false);
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 700);
    } catch (err) {
      console.error(err);
      setError("Server bilan aloqada xatolik yuz berdi. Qaytadan urinib ko'ring.");
      setIsLoading(false);
    }
  };

  const handleConfirm2FaSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = totpCode.trim();
    if (!clean || clean.length !== 6) {
      setTwoFactorError("Iltimos, autentifikator ilovangizdagi 6 xonali kodni kiriting.");
      return;
    }

    setTwoFactorError("");
    setTwoFactorLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "2fa_setup_confirm",
          twoFactorToken,
          totpCode: clean,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setTwoFactorError(data.error || "2FA tasdiqlashda xatolik.");
        setTwoFactorLoading(false);
        return;
      }

      setGeneratedBackupCodes(data.backupCodes || []);
      setTwoFactorSavedUser(data.user);
      setTwoFactorMode("backup_codes");
      setTwoFactorLoading(false);
    } catch {
      setTwoFactorError("Serverda xatolik yuz berdi.");
      setTwoFactorLoading(false);
    }
  };

  const handleVerify2FaLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorError("");
    setTwoFactorLoading(true);

    try {
      const payload = isBackupCodeMode
        ? {
            action: "2fa_backup_login",
            twoFactorToken,
            backupCode: backupCodeInput.trim(),
          }
        : {
            action: "2fa_verify_login",
            twoFactorToken,
            totpCode: totpCode.trim(),
          };

      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setTwoFactorError(data.error || "2FA kodi tasdiqlanmadi.");
        setTwoFactorLoading(false);
        return;
      }

      loginWithUser(data.user);
      setTwoFactorLoading(false);
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 700);
    } catch {
      setTwoFactorError("Serverda xatolik yuz berdi.");
      setTwoFactorLoading(false);
    }
  };

  const handleFinishBackupCodes = () => {
    if (twoFactorSavedUser) {
      loginWithUser(twoFactorSavedUser);
    }
    setIsSuccess(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 600);
  };

  const handleSaveSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupEmail.trim() || !setupEmail.includes("@")) {
      setSetupError("Iltimos, to'g'ri shaxsiy elektron pochta manzilingizni kiriting.");
      return;
    }
    if (setupPass.length < 6) {
      setSetupError("Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak.");
      return;
    }
    if (setupPass !== setupPassConfirm) {
      setSetupError("Yangi parollar bir-biriga mos kelmadi!");
      return;
    }

    setSetupError("");
    setSetupLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_credentials",
          newEmail: setupEmail.trim(),
          newPhone: setupPhone.trim(),
          newPassword: setupPass.trim(),
          newName: "Bosh Ustoz",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setSetupError(data.error || "Ma'lumotlarni saqlashda xatolik.");
        setSetupLoading(false);
        return;
      }

      loginWithUser(data.user);
      setSetupLoading(false);
      setIsSuccess(true);
      setShowSetupModal(false);
      setTimeout(() => {
        router.push("/dashboard");
      }, 800);
    } catch (err) {
      console.error(err);
      setSetupError("Serverda xatolik yuz berdi.");
      setSetupLoading(false);
    }
  };

  return (
    <div className={`${styles.page} cyber-grid`}>
      <div className={styles.orb} />

      <div className={styles.card} style={{ maxWidth: (showSetupModal || twoFactorMode === "setup" || twoFactorMode === "backup_codes") ? 540 : 440 }}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>🛡️</span>
          <span>Cyber<span className="gradient-text">Edu</span></span>
        </Link>

        {showSetupModal ? (
          <div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <span style={{ fontSize: "2.2rem" }}>🔐</span>
              <h1 className={styles.title} style={{ fontSize: "1.35rem", marginTop: 8 }}>
                Boshlang&apos;ich hisobni sozlash
              </h1>
              <p className={styles.subtitle} style={{ fontSize: "0.86rem", color: "#94a3b8" }}>
                Siz bir martalik vaqtinchalik parol bilan kirdingiz. Tizim xavfsizligini ta&apos;minlash uchun o&apos;z shaxsiy emailingiz, telefon raqamingiz va doimiy parolingizni belgilang.
              </p>
            </div>

            {setupError && (
              <div style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "0.85rem",
                marginBottom: 16,
              }}>
                {setupError}
              </div>
            )}

            <form method="post" action="#" className={styles.form} onSubmit={handleSaveSetup}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="setup-email">
                  Shaxsiy Elektron Pochta (Bog&apos;lanish uchun)
                </label>
                <input
                  id="setup-email"
                  type="email"
                  className="input"
                  placeholder="masalan: sizning_pochtangiz@gmail.com"
                  value={setupEmail}
                  onChange={(e) => setSetupEmail(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="setup-phone">
                  Telefon Raqam (SMS orqali parolni qayta tiklash uchun)
                </label>
                <input
                  id="setup-phone"
                  type="text"
                  className="input"
                  placeholder="+998 90 123 45 67"
                  value={setupPhone}
                  onChange={(e) => setSetupPhone(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="setup-pass">
                  Yangi Maxfiy Parol
                </label>
                <input
                  id="setup-pass"
                  type="password"
                  className="input"
                  placeholder="Kamida 6 ta belgi..."
                  value={setupPass}
                  onChange={(e) => setSetupPass(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="setup-pass-confirm">
                  Yangi Parolni Qayta Kiriting
                </label>
                <input
                  id="setup-pass-confirm"
                  type="password"
                  className="input"
                  placeholder="Parolni tasdiqlang..."
                  value={setupPassConfirm}
                  onChange={(e) => setSetupPassConfirm(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={setupLoading}
                className={`btn btn-green ${styles.submitBtn}`}
                style={{ marginTop: 8 }}
              >
                {setupLoading ? "Saqlanmoqda..." : "Saqlash va Kabinetga Kirish"}
              </button>
            </form>
          </div>
        ) : twoFactorMode === "setup" ? (
          <div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <span style={{ fontSize: "2.2rem" }}>🛡️</span>
              <h1 className={styles.title} style={{ fontSize: "1.35rem", marginTop: 8 }}>
                2FA Sozlash (Majburiy)
              </h1>
              <p className={styles.subtitle} style={{ fontSize: "0.86rem", color: "#94a3b8" }}>
                Hisobingiz xavfsizligini ta&apos;minlash uchun Google Authenticator yoki Authy orqali QR-kodni skanerlang.
              </p>
            </div>

            {twoFactorError && (
              <div role="alert" style={{
                background: "rgba(239, 68, 68, 0.16)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#fca5a5",
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "0.85rem",
                marginBottom: 16,
              }}>
                ⚠️ {twoFactorError}
              </div>
            )}

            {twoFactorQrSvg && (
              <div style={{
                display: "flex",
                justifyContent: "center",
                padding: "16px",
                background: "#ffffff",
                borderRadius: "12px",
                marginBottom: "16px",
              }} dangerouslySetInnerHTML={{ __html: twoFactorQrSvg }} />
            )}

            <div style={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "8px",
              padding: "10px 12px",
              marginBottom: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.82rem",
            }}>
              <div>
                <span style={{ color: "#94a3b8", display: "block", fontSize: "0.74rem" }}>Qo&apos;lda kiritish kaliti (Base32):</span>
                <code style={{ color: "#38bdf8", fontWeight: 700, letterSpacing: 1 }}>{twoFactorSecret}</code>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(twoFactorSecret);
                  setCopiedSecret(true);
                  setTimeout(() => setCopiedSecret(false), 2000);
                }}
                className="btn btn-ghost"
                style={{ padding: "4px 8px", fontSize: "0.75rem" }}
              >
                {copiedSecret ? "✓ Nusxalandi" : "Nusxalash"}
              </button>
            </div>

            <form method="post" action="#" className={styles.form} onSubmit={handleConfirm2FaSetup}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="totp-code">
                  Ilovadagi 6 xonali tasdiqlash kodi
                </label>
                <input
                  id="totp-code"
                  type="text"
                  maxLength={6}
                  className="input"
                  placeholder="masalan: 123456"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  autoComplete="one-time-code"
                  required
                  style={{ textAlign: "center", fontSize: "1.25rem", letterSpacing: 6, fontWeight: 700 }}
                />
              </div>

              <button
                type="submit"
                id="btn-confirm-2fa-setup"
                disabled={twoFactorLoading}
                className={`btn btn-green ${styles.submitBtn}`}
                style={{ marginTop: 8 }}
              >
                {twoFactorLoading ? "Tekshirilmoqda..." : "Tasdiqlash va Kirish"}
              </button>
            </form>
          </div>
        ) : twoFactorMode === "backup_codes" ? (
          <div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <span style={{ fontSize: "2.2rem" }}>🔑</span>
              <h1 className={styles.title} style={{ fontSize: "1.35rem", marginTop: 8 }}>
                Zaxira Kodlaringiz
              </h1>
              <p className={styles.subtitle} style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                Ushbu kodlarni xavfsiz joyda saqlang! Telefoningiz yo&apos;qolganda yoki TOTP ilovasiga kira olmaganingizda, har bir koddan bir marta kirish uchun foydalanishingiz mumkin. Ular qayta ko&apos;rsatilmaydi!
              </p>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "10px",
              padding: 14,
              marginBottom: 16,
            }}>
              {generatedBackupCodes.map((code, idx) => (
                <div key={idx} style={{
                  padding: "6px 8px",
                  background: "#1e293b",
                  borderRadius: "6px",
                  textAlign: "center",
                  fontSize: "0.88rem",
                  fontFamily: "monospace",
                  color: "#38bdf8",
                  fontWeight: 600,
                }}>
                  {code}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generatedBackupCodes.join("\n"));
                  setCopiedBackup(true);
                  setTimeout(() => setCopiedBackup(false), 2000);
                }}
                className="btn btn-ghost"
                style={{ flex: 1, padding: "8px 12px", fontSize: "0.85rem" }}
              >
                {copiedBackup ? "✓ Barchasi nusxalandi" : "Nusxa olish"}
              </button>
              <button
                type="button"
                id="btn-finish-backup-codes"
                onClick={handleFinishBackupCodes}
                className="btn btn-green"
                style={{ flex: 1, padding: "8px 12px", fontSize: "0.85rem" }}
              >
                Saqladim, Kabinetga Kirish
              </button>
            </div>
          </div>
        ) : twoFactorMode === "verify" ? (
          <div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <span style={{ fontSize: "2.2rem" }}>🛡️</span>
              <h1 className={styles.title} style={{ fontSize: "1.35rem", marginTop: 8 }}>
                Ikki Bosqichli Kirish (2FA)
              </h1>
              <p className={styles.subtitle} style={{ fontSize: "0.86rem", color: "#94a3b8" }}>
                {isBackupCodeMode
                  ? "8 belgili bir martalik zaxira kodingizni kiriting."
                  : "Google Authenticator yoki Authy ilovasidagi 6 xonali kodni kiriting."}
              </p>
            </div>

            {twoFactorError && (
              <div role="alert" style={{
                background: "rgba(239, 68, 68, 0.16)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#fca5a5",
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "0.85rem",
                marginBottom: 16,
              }}>
                ⚠️ {twoFactorError}
              </div>
            )}

            <form method="post" action="#" className={styles.form} onSubmit={handleVerify2FaLogin}>
              {!isBackupCodeMode ? (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="totp-verify-code">
                    6 xonali TOTP kod
                  </label>
                  <input
                    id="totp-verify-code"
                    type="text"
                    maxLength={6}
                    className="input"
                    placeholder="••••••"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                    autoComplete="one-time-code"
                    required
                    style={{ textAlign: "center", fontSize: "1.35rem", letterSpacing: 8, fontWeight: 700 }}
                  />
                </div>
              ) : (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="backup-code-input">
                    Bir martalik zaxira kod (XXXX-XXXX)
                  </label>
                  <input
                    id="backup-code-input"
                    type="text"
                    maxLength={10}
                    className="input"
                    placeholder="XXXX-XXXX"
                    value={backupCodeInput}
                    onChange={(e) => setBackupCodeInput(e.target.value.toUpperCase())}
                    required
                    style={{ textAlign: "center", fontSize: "1.2rem", letterSpacing: 4, fontFamily: "monospace", fontWeight: 700 }}
                  />
                </div>
              )}

              <button
                type="submit"
                id="btn-verify-2fa-login"
                disabled={twoFactorLoading}
                className={`btn btn-primary ${styles.submitBtn}`}
                style={{ marginTop: 8 }}
              >
                {twoFactorLoading ? "Tekshirilmoqda..." : "Tasdiqlash va Kirish"}
              </button>
            </form>

            <div style={{ marginTop: 16, textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setIsBackupCodeMode(!isBackupCodeMode);
                  setTwoFactorError("");
                }}
                className="btn btn-ghost"
                style={{ fontSize: "0.82rem", color: "#38bdf8" }}
              >
                {isBackupCodeMode ? "← 6 xonali TOTP kod orqali kirish" : "🔑 Zaxira kod orqali kirish"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setTwoFactorMode("none");
                  setTwoFactorError("");
                  setTotpCode("");
                  setBackupCodeInput("");
                }}
                className="btn btn-ghost"
                style={{ fontSize: "0.8rem", color: "#94a3b8" }}
              >
                Boshqa hisobga kirish
              </button>
            </div>
          </div>
        ) : isSuccess ? (
          <div style={{
            textAlign: "center",
            padding: "24px 0",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center"
          }}>
            <span style={{ fontSize: "2.5rem" }}>👋</span>
            <h2 style={{ fontSize: "1.2rem", color: "#38bdf8" }}>Tizimga muvaffaqiyatli kirdingiz!</h2>
            <p style={{ fontSize: "0.88rem", color: "#94a3b8" }}>
              Shaxsiy kabinetga yo&apos;naltirilmoqdasiz...
            </p>
          </div>
        ) : (
          <>
            <h1 className={styles.title}>Xush kelibsiz!</h1>
            <p className={styles.subtitle}>
              Platformadagi hisobingizga kiring
            </p>

            <form method="post" action="#" className={styles.form} onSubmit={handleLogin}>
              {error && (
                <div
                  role="alert"
                  id="login-error-alert"
                  style={{
                    background: "rgba(239, 68, 68, 0.16)",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    color: "#fca5a5",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    fontSize: "0.88rem",
                    lineHeight: 1.5,
                    marginBottom: 16,
                    fontWeight: 500,
                  }}
                >
                  ⚠️ {error}
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.label} htmlFor="login-email">Email yoki Login</label>
                <input
                  id="login-email"
                  type="text"
                  className="input"
                  placeholder="nomingiz@cyberedu.uz yoki login"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="login-password">Parol</label>
                <div className={styles.passWrapper}>
                  <input
                    id="login-password"
                    type={showPass ? "text" : "password"}
                    className={`input ${styles.passInput}`}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    id="toggle-password"
                    className={styles.eyeBtn}
                    onClick={() => setShowPass(!showPass)}
                    aria-label="Parolni ko'rsatish"
                  >
                    {showPass ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <div className={styles.forgotRow}>
                <Link href="/forgot-password" className={styles.forgot}>
                  Parolni unutdingizmi? (SMS orqali tiklash)
                </Link>
              </div>

              <button
                id="btn-login"
                type="submit"
                disabled={isLoading}
                className={`btn btn-primary ${styles.submitBtn}`}
              >
                {isLoading ? (
                  "Tekshirilmoqda..."
                ) : (
                  <>
                    Kirish
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

            <div className={styles.dividerRow}>
              <div className="divider" style={{ flex: 1 }} />
              <span className={styles.orText}>yoki</span>
              <div className="divider" style={{ flex: 1 }} />
            </div>

            <p className={styles.registerLink}>
              O&apos;quvchi sifatida ro&apos;yxatdan o&apos;tish:{" "}
              <Link href="/register" className="gradient-text" style={{ fontWeight: 600 }}>
                Ro&apos;yxatdan o&apos;tish
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
