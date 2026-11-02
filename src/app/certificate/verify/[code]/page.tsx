import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { prisma } from "@/lib/db";

interface VerifyPageProps {
  params: Promise<{ code: string }>;
}

export default async function CertificateVerifyPage({ params }: VerifyPageProps) {
  const { code } = await params;
  const cleanCode = (code || "").trim().toUpperCase();

  const cert = await prisma.certificate.findUnique({
    where: { certificateCode: cleanCode },
    include: {
      course: true,
    },
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1, padding: "60px 20px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          {cert ? (
            <div
              className="card"
              style={{
                border: "1px solid rgba(52, 211, 153, 0.4)",
                background: "rgba(11, 15, 25, 0.95)",
                boxShadow: "0 0 30px rgba(52, 211, 153, 0.15)",
                padding: "40px 30px",
                borderRadius: 16,
              }}
            >
              <div
                style={{
                  width: 70,
                  height: 70,
                  margin: "0 auto 20px",
                  borderRadius: "50%",
                  background: "rgba(52, 211, 153, 0.15)",
                  color: "#34d399",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2rem",
                  border: "1px solid rgba(52, 211, 153, 0.4)",
                }}
              >
                ✓
              </div>

              <span
                className="badge badge-green"
                style={{ fontSize: "0.9rem", padding: "6px 16px", marginBottom: 15 }}
              >
                RASMIY SERTIFIKAT TASDIQLANDI
              </span>

              <h1 style={{ fontSize: "1.8rem", color: "#f8fafc", margin: "15px 0 10px" }}>
                CyberEdu Tasdiqlangan Sertifikati
              </h1>

              <p style={{ color: "#94a3b8", fontSize: "0.95rem", marginBottom: 30 }}>
                Ushbu sertifikat egasi quyidagi kiberxavfsizlik o&apos;quv dasturini to&apos;liq va
                muvaffaqiyatli tamomlagan.
              </p>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 12,
                  padding: 24,
                  textAlign: "left",
                  marginBottom: 30,
                }}
              >
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>TALABA F.I.SH.</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#38bdf8" }}>
                    {cert.userName}
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>TAMOMLANGAN KURS</div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "#f8fafc" }}>
                    {cert.courseTitle}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginTop: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b" }}>SERTIFIKAT KODI</div>
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontFamily: "monospace",
                        color: "#34d399",
                        fontWeight: 700,
                      }}
                    >
                      {cert.certificateCode}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b" }}>BERILGAN SANA</div>
                    <div style={{ fontSize: "0.95rem", color: "#e2e8f0" }}>
                      {new Date(cert.issuedAt).toLocaleDateString("uz-UZ", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <Link href={`/certificate/${cert.courseId}`} className="btn btn-primary">
                  Sertifikatni Ko&apos;rish / Yuklab Olish
                </Link>
                <Link href="/courses" className="btn btn-outline">
                  Barcha Kurslar
                </Link>
              </div>
            </div>
          ) : (
            <div
              className="card"
              style={{
                border: "1px solid rgba(248, 113, 113, 0.4)",
                background: "rgba(11, 15, 25, 0.95)",
                padding: "50px 30px",
                borderRadius: 16,
              }}
            >
              <div
                style={{
                  width: 70,
                  height: 70,
                  margin: "0 auto 20px",
                  borderRadius: "50%",
                  background: "rgba(248, 113, 113, 0.15)",
                  color: "#f87171",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2rem",
                }}
              >
                ✕
              </div>

              <h1 style={{ fontSize: "1.6rem", color: "#f87171", marginBottom: 15 }}>
                Sertifikat Topilmadi
              </h1>

              <p style={{ color: "#94a3b8", marginBottom: 25 }}>
                Kiritilgan <code>{cleanCode}</code> kodli sertifikat bazada mavjud emas yoki noto&apos;g&apos;ri
                kiritilgan.
              </p>

              <Link href="/" className="btn btn-outline">
                Bosh Sahifaga Qaytish
              </Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
