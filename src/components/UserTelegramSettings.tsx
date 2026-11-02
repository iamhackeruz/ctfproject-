"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface TelegramStatus {
  isConnected: boolean;
  username: string | null;
  connectedAt: string | null;
}

interface NotificationPrefs {
  notifyAssignmentNew: boolean;
  notifyDueSoon: boolean;
  notifyGraded: boolean;
  notifyLessonPublished: boolean;
  notifyExpiring: boolean;
  notifyPasswordReset: boolean;
  notifySubmissionNew: boolean;
}

export default function UserTelegramSettings() {
  const router = useRouter();
  const [telegram, setTelegram] = useState<TelegramStatus>({
    isConnected: false,
    username: null,
    connectedAt: null,
  });
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    notifyAssignmentNew: true,
    notifyDueSoon: true,
    notifyGraded: true,
    notifyLessonPublished: true,
    notifyExpiring: true,
    notifyPasswordReset: true,
    notifySubmissionNew: true,
  });

  const [loading, setLoading] = useState(true);
  const [connectCode, setConnectCode] = useState<string | null>(null);
  const [botUrl, setBotUrl] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 2FA holati
  const [currentUserRole, setCurrentUserRole] = useState("student");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // 2FA Setup Modal
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupQrSvg, setSetupQrSvg] = useState("");
  const [setupSecret, setSetupSecret] = useState("");
  const [setupTotpCode, setSetupTotpCode] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");

  // 2FA Backup Codes Modal
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // 2FA Disable Modal
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableTotpCode, setDisableTotpCode] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState("");

  // 2FA Regenerate Modal
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenTotpCode, setRegenTotpCode] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState("");

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const [prefRes, authRes] = await Promise.all([
        fetch("/api/user/notifications/preferences"),
        fetch("/api/auth"),
      ]);

      if (prefRes.ok) {
        const data = await prefRes.json();
        if (data.success) {
          setTelegram(data.telegram);
          if (data.preferences) {
            setPrefs(data.preferences);
          }
        }
      }

      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.authenticated && authData.user) {
          setCurrentUserRole(authData.user.role || "student");
          setTwoFactorEnabled(Boolean(authData.user.twoFactorEnabled));
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSettings();
  }, []);

  const handleGenerateCode = async () => {
    try {
      setGeneratingCode(true);
      setStatusMsg(null);
      const res = await fetch("/api/user/telegram/connect-code", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setConnectCode(data.code);
        setBotUrl(data.botUrl);
      } else {
        setStatusMsg({ type: "error", text: data.error || "Kod olishda xatolik" });
      }
    } catch (err: unknown) {
      setStatusMsg({ type: "error", text: err instanceof Error ? err.message : "Xatolik" });
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Haqiqatan ham Telegram hisobingizni uzmoqchimisiz?")) return;
    try {
      setDisconnecting(true);
      setStatusMsg(null);
      const res = await fetch("/api/user/telegram/disconnect", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setTelegram({ isConnected: false, username: null, connectedAt: null });
        setConnectCode(null);
        setStatusMsg({ type: "success", text: "Telegram hisob muvaffaqiyatli uzildi." });
      } else {
        setStatusMsg({ type: "error", text: data.error || "Uzishda xatolik" });
      }
    } catch (err: unknown) {
      setStatusMsg({ type: "error", text: err instanceof Error ? err.message : "Xatolik" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleTogglePref = async (key: keyof NotificationPrefs) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);

    try {
      setSavingPrefs(true);
      await fetch("/api/user/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch {
      // rollback if needed
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleStart2FaSetup = async () => {
    setSetupError("");
    setSetupTotpCode("");
    setSetupLoading(true);
    setShowSetupModal(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "2fa_setup_init" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSetupQrSvg(data.qrSvg);
        setSetupSecret(data.secret);
      } else {
        setSetupError(data.error || "2FA sozlashda xatolik yuz berdi.");
      }
    } catch {
      setSetupError("Server bilan aloqada xatolik.");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleConfirm2FaSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupTotpCode || setupTotpCode.length !== 6) {
      setSetupError("Iltimos, ilovangizdagi 6 xonali kodni kiriting.");
      return;
    }
    setSetupError("");
    setSetupLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "2fa_setup_confirm",
          totpCode: setupTotpCode.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowSetupModal(false);
        setTwoFactorEnabled(true);
        setBackupCodes(data.backupCodes || []);
        setShowBackupModal(true);
        setStatusMsg({ type: "success", text: "2FA muvaffaqiyatli faollashtirildi!" });
      } else {
        setSetupError(data.error || "Kodni tasdiqlashda xatolik.");
      }
    } catch {
      setSetupError("Server bilan aloqada xatolik.");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleDisable2Fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePassword || !disableTotpCode) {
      setDisableError("Joriy parol va 6 xonali 2FA kod kiritilishi shart.");
      return;
    }
    setDisableError("");
    setDisableLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "2fa_disable",
          currentPassword: disablePassword,
          totpCode: disableTotpCode.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowDisableModal(false);
        setTwoFactorEnabled(false);
        alert("2FA o'chirildi! Xavfsizlik yuzasidan barcha faol sessiyalar bekor qilindi. Qaytadan kiring.");
        router.push("/login");
      } else {
        setDisableError(data.error || "2FA ni o'chirishda xatolik.");
      }
    } catch {
      setDisableError("Server bilan aloqada xatolik.");
    } finally {
      setDisableLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regenTotpCode) {
      setRegenError("Tasdiqlash uchun 6 xonali 2FA kodini kiriting.");
      return;
    }
    setRegenError("");
    setRegenLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "2fa_regenerate_backup_codes",
          totpCode: regenTotpCode.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowRegenModal(false);
        setBackupCodes(data.backupCodes || []);
        setShowBackupModal(true);
        setStatusMsg({ type: "success", text: "Yangi 10 ta zaxira kod yaratildi!" });
      } else {
        setRegenError(data.error || "Zaxira kodlarini yangilashda xatolik.");
      }
    } catch {
      setRegenError("Server bilan aloqada xatolik.");
    } finally {
      setRegenLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 20, color: "#94a3b8" }}>Sozlamalar yuklanmoqda...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {statusMsg && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            fontSize: "0.85rem",
            backgroundColor: statusMsg.type === "success" ? "#22c55e22" : "#ef444422",
            color: statusMsg.type === "success" ? "#4ade80" : "#f87171",
          }}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Telegram Integratsiya Bloki */}
      <div
        style={{
          backgroundColor: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "#f8fafc", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <span>✈️</span> Telegram Bildirishnomalari
            </h3>
            <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: 4 }}>
              Yangi vazifalar, darslar va baholar haqida tezkor bildirishnomalarni Telegram bot orqali oling.
            </p>
          </div>

          {telegram.isConnected ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "0.82rem", color: "#4ade80", backgroundColor: "#22c55e22", padding: "4px 10px", borderRadius: 6, border: "1px solid #22c55e" }}>
                Ulangan: {telegram.username || "Faol"}
              </span>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="btn btn-ghost"
                style={{ padding: "6px 12px", fontSize: "0.8rem", color: "#f87171" }}
              >
                {disconnecting ? "Uzilmoqda..." : "Uzish"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGenerateCode}
              disabled={generatingCode}
              className="btn btn-primary"
              style={{ padding: "7px 16px", fontSize: "0.85rem" }}
            >
              {generatingCode ? "Tayyorlanmoqda..." : "Telegram'ni ulash"}
            </button>
          )}
        </div>

        {/* Ulanish kodi ko'rsatkichi */}
        {connectCode && !telegram.isConnected && (
          <div
            style={{
              marginTop: 16,
              padding: 16,
              backgroundColor: "#1e293b55",
              border: "1px solid #38bdf855",
              borderRadius: 10,
            }}
          >
            <div style={{ fontSize: "0.85rem", color: "#f8fafc", fontWeight: 600 }}>
              Telegram hisobingizni ulash uchun quyidagi 2 ta usuldan birini tanlang:
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {botUrl && (
                  <a
                    href={botUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ padding: "8px 18px", fontSize: "0.85rem", textDecoration: "none" }}
                  >
                    1-usul: Botni Telegramda ochish va ulash 🚀
                  </a>
                )}
              </div>

              <div style={{ fontSize: "0.82rem", color: "#cbd5e1" }}>
                <b>2-usul:</b> Botga o&apos;ting va quyidagi kodni yuboring (10 daqiqa yashaydi):
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                  <code
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: 700,
                      backgroundColor: "#0f172a",
                      border: "1px solid #334155",
                      padding: "4px 12px",
                      borderRadius: 6,
                      color: "#38bdf8",
                      letterSpacing: 2,
                    }}
                  >
                    /start {connectCode}
                  </code>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bildirishnoma turlari sozlamalari */}
      <div
        style={{
          backgroundColor: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "#f8fafc", margin: "0 0 16px 0" }}>
          Bildirishnoma Turlari {savingPrefs && <span style={{ fontSize: "0.75rem", color: "#38bdf8" }}>(Saqlanmoqda...)</span>}
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { key: "notifyAssignmentNew", label: "Yangi uy vazifasi e'lon qilinganda", desc: "Sizning guruhingiz yoki kursingizga vazifa qo'shilganda" },
            { key: "notifyDueSoon", label: "Topshirish muddati yaqinlashganda", desc: "Vazifa muddati tugashiga 24 soat qolganda eslatma" },
            { key: "notifyGraded", label: "Topshiriq baholanganda yoki qaytarilganda", desc: "Ustoz topshirig'ingizni tekshirib ball qo'yganda" },
            { key: "notifyLessonPublished", label: "Yangi dars e'lon qilinganda", desc: "Kursingizga yangi dars moduli qo'shilganda" },
            { key: "notifyExpiring", label: "Guruh / Obuna muddati tugashida", desc: "Huquq muddati tugashiga 3 kun qolganda" },
            { key: "notifyPasswordReset", label: "Xavfsizlik: Parol o'zgarishi", desc: "Profilingiz paroli yangilanganda ogohlantirish" },
          ].map((item) => (
            <label
              key={item.key}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                cursor: "pointer",
                padding: "8px 0",
                borderBottom: "1px solid #1e293b",
              }}
            >
              <input
                type="checkbox"
                checked={prefs[item.key as keyof NotificationPrefs]}
                onChange={() => handleTogglePref(item.key as keyof NotificationPrefs)}
                style={{ width: 18, height: 18, marginTop: 2, accentColor: "#38bdf8", cursor: "pointer" }}
              />
              <div>
                <div style={{ fontSize: "0.88rem", fontWeight: 500, color: "#f8fafc" }}>{item.label}</div>
                <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 2 }}>{item.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 2FA Xavfsizlik Bloki */}
      <div
        style={{
          backgroundColor: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "#f8fafc", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <span>🛡️</span> Ikki Bosqichli Autentifikatsiya (2FA TOTP)
            </h3>
            <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: 4 }}>
              Google Authenticator yoki Authy orqali hisobingizga kirishni ikki bosqichli kod bilan himoyalang.
            </p>
          </div>

          <div>
            {twoFactorEnabled ? (
              <span style={{ fontSize: "0.82rem", color: "#4ade80", backgroundColor: "#22c55e22", padding: "4px 10px", borderRadius: 6, border: "1px solid #22c55e", fontWeight: 600 }}>
                🛡️ Faol
              </span>
            ) : (
              <span style={{ fontSize: "0.82rem", color: "#94a3b8", backgroundColor: "#33415555", padding: "4px 10px", borderRadius: 6, border: "1px solid #475569" }}>
                O&apos;chiq
              </span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          {twoFactorEnabled ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setRegenError("");
                  setRegenTotpCode("");
                  setShowRegenModal(true);
                }}
                className="btn btn-outline"
                style={{ fontSize: "0.84rem", padding: "6px 14px" }}
              >
                🔑 Yangi zaxira kodlar olish
              </button>

              {currentUserRole === "student" ? (
                <button
                  type="button"
                  onClick={() => {
                    setDisableError("");
                    setDisablePassword("");
                    setDisableTotpCode("");
                    setShowDisableModal(true);
                  }}
                  className="btn btn-ghost"
                  style={{ fontSize: "0.84rem", padding: "6px 14px", color: "#f87171" }}
                >
                  2FA ni o&apos;chirish
                </button>
              ) : (
                <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  (Sizning rolingiz uchun 2FA majburiy va uni o&apos;chirib bo&apos;lmaydi)
                </span>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={handleStart2FaSetup}
              disabled={setupLoading}
              className="btn btn-primary"
              style={{ fontSize: "0.84rem", padding: "7px 18px" }}
            >
              {setupLoading ? "Yuklanmoqda..." : "2FA ni yoqish"}
            </button>
          )}
        </div>
      </div>

      {/* 2FA SETUP MODAL */}
      {showSetupModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
          padding: 16,
        }}>
          <div className="card" style={{ maxWidth: 480, width: "100%", padding: 24, maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 8px 0", color: "#f8fafc" }}>
              🛡️ 2FA ni Faollashtirish
            </h3>
            <p style={{ fontSize: "0.84rem", color: "#94a3b8", marginBottom: 16 }}>
              Google Authenticator yoki Authy ilovasini ochib, quyidagi QR-kodni skanerlang:
            </p>

            {setupError && (
              <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#fca5a5", padding: "8px 12px", borderRadius: 8, fontSize: "0.84rem", marginBottom: 14 }}>
                ⚠️ {setupError}
              </div>
            )}

            {setupQrSvg && (
              <div style={{ display: "flex", justifyContent: "center", padding: 14, background: "#ffffff", borderRadius: 10, marginBottom: 14 }}
                   dangerouslySetInnerHTML={{ __html: setupQrSvg }} />
            )}

            {setupSecret && (
              <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: "0.8rem" }}>
                <span style={{ color: "#94a3b8", display: "block" }}>Qo&apos;lda kiritish kaliti:</span>
                <code style={{ color: "#38bdf8", fontWeight: 700, letterSpacing: 1 }}>{setupSecret}</code>
              </div>
            )}

            <form onSubmit={handleConfirm2FaSetup}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6 }}>
                  Ilovadagi 6 xonali tasdiqlash kodi
                </label>
                <input
                  type="text"
                  maxLength={6}
                  className="input"
                  placeholder="123456"
                  value={setupTotpCode}
                  onChange={(e) => setSetupTotpCode(e.target.value.replace(/\D/g, ""))}
                  required
                  style={{ textAlign: "center", fontSize: "1.25rem", letterSpacing: 6, fontWeight: 700 }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowSetupModal(false)}
                  className="btn btn-ghost"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={setupLoading}
                  className="btn btn-green"
                >
                  {setupLoading ? "Tekshirilmoqda..." : "Tasdiqlash va Yoqish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2FA BACKUP CODES MODAL */}
      {showBackupModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
          padding: 16,
        }}>
          <div className="card" style={{ maxWidth: 480, width: "100%", padding: 24 }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 8px 0", color: "#f8fafc" }}>
              🔑 Zaxira Kodlaringiz
            </h3>
            <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginBottom: 14 }}>
              Ushbu 10 ta kodni xavfsiz joyga nusxalab oling. Har bir kod faqat bir marta ishlatiladi va qayta ko&apos;rsatilmaydi!
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              {backupCodes.map((code, idx) => (
                <div key={idx} style={{ padding: "4px 8px", background: "#1e293b", borderRadius: 4, textAlign: "center", fontSize: "0.85rem", fontFamily: "monospace", color: "#38bdf8", fontWeight: 600 }}>
                  {code}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(backupCodes.join("\n"));
                  setCopiedCodes(true);
                  setTimeout(() => setCopiedCodes(false), 2000);
                }}
                className="btn btn-ghost"
                style={{ flex: 1 }}
              >
                {copiedCodes ? "✓ Nusxalandi" : "Nusxa olish"}
              </button>
              <button
                type="button"
                onClick={() => setShowBackupModal(false)}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Tushundim, Saqladim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA DISABLE MODAL */}
      {showDisableModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
          padding: 16,
        }}>
          <div className="card" style={{ maxWidth: 440, width: "100%", padding: 24 }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 8px 0", color: "#f87171" }}>
              ⚠️ 2FA ni O&apos;chirish
            </h3>
            <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginBottom: 14 }}>
              2FA ni o&apos;chirish hisobingiz xavfsizligini pasaytiradi. Amalni tasdiqlash uchun parolingiz va joriy 2FA kodini kiriting:
            </p>

            {disableError && (
              <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#fca5a5", padding: "8px 12px", borderRadius: 8, fontSize: "0.84rem", marginBottom: 14 }}>
                ⚠️ {disableError}
              </div>
            )}

            <form onSubmit={handleDisable2Fa}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 4 }}>
                  Joriy Parolingiz
                </label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 4 }}>
                  6 xonali 2FA kod
                </label>
                <input
                  type="text"
                  maxLength={6}
                  className="input"
                  placeholder="123456"
                  value={disableTotpCode}
                  onChange={(e) => setDisableTotpCode(e.target.value.replace(/\D/g, ""))}
                  required
                  style={{ textAlign: "center", fontSize: "1.2rem", letterSpacing: 4, fontWeight: 700 }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowDisableModal(false)}
                  className="btn btn-ghost"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={disableLoading}
                  className="btn btn-danger"
                  style={{ background: "#dc2626", color: "#ffffff", border: "none" }}
                >
                  {disableLoading ? "O'chirilmoqda..." : "2FA ni O'chirish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2FA REGENERATE BACKUP CODES MODAL */}
      {showRegenModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
          padding: 16,
        }}>
          <div className="card" style={{ maxWidth: 440, width: "100%", padding: 24 }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 8px 0", color: "#f8fafc" }}>
              🔑 Zaxira Kodlarni Yangilash
            </h3>
            <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginBottom: 14 }}>
              Eski zaxira kodlaringiz bekor qilinadi va 10 ta yangi bir martalik kod beriladi. Tasdiqlash uchun 6 xonali 2FA kodingizni kiriting:
            </p>

            {regenError && (
              <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#fca5a5", padding: "8px 12px", borderRadius: 8, fontSize: "0.84rem", marginBottom: 14 }}>
                ⚠️ {regenError}
              </div>
            )}

            <form onSubmit={handleRegenerateBackupCodes}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 4 }}>
                  6 xonali 2FA kod
                </label>
                <input
                  type="text"
                  maxLength={6}
                  className="input"
                  placeholder="123456"
                  value={regenTotpCode}
                  onChange={(e) => setRegenTotpCode(e.target.value.replace(/\D/g, ""))}
                  required
                  style={{ textAlign: "center", fontSize: "1.2rem", letterSpacing: 4, fontWeight: 700 }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowRegenModal(false)}
                  className="btn btn-ghost"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={regenLoading}
                  className="btn btn-primary"
                >
                  {regenLoading ? "Yaratilmoqda..." : "Yangi Kodlar Olish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
