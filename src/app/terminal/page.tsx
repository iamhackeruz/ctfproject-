"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CyberTerminal from "@/components/CyberTerminal";

function TerminalContent() {
  const searchParams = useSearchParams();
  const labSlug = searchParams.get("lab") || undefined;
  const courseIdParam = searchParams.get("course");
  const courseId = courseIdParam ? parseInt(courseIdParam, 10) : undefined;

  const sessionId = labSlug ? `lab-${labSlug}` : courseId ? `course-${courseId}` : "global-terminal";

  return (
    <main className="wrap" style={{ flex: 1, padding: "40px 20px 80px" }}>
      <div style={{ marginBottom: 28, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="badge badge-green">🐧 Real Linux Terminal Sandbox</div>
          {labSlug && <div className="badge badge-blue">🎯 Faol Lab: {labSlug}</div>}
        </div>
        <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 900 }}>
          Online <span className="gradient-text">Linux Sandbox</span>
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "0.95rem", maxWidth: 650 }}>
          Izolyatsiyalangan Docker muhiti. Barcha Linux buyruqlaridan foydalaning, fayllarni tahlil qiling va
          vazifa bayrog&apos;ini (flag) toping.
        </p>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <CyberTerminal
          sessionId={sessionId}
          courseId={courseId}
          labSlug={labSlug}
          initialMessage={`CyberEdu Linux Sandbox v6.5.0-kali (x86_64)
Fayl tizimi faol: /home/student
Vazifa bo'yicha ko'rsatmalarni ko'rish uchun: cat README.txt yoki ls -la`}
        />

        <div
          className="card"
          style={{
            marginTop: 28,
            padding: 24,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <strong style={{ color: "#38bdf8", fontSize: "0.9rem" }}>📁 Fayllar bilan ishlash:</strong>
            <div style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: 6, lineHeight: 1.6 }}>
              <code>ls -la</code> — yashirin fayllar ro&apos;yxati<br />
              <code>cat README.txt</code> — vazifani o&apos;qish<br />
              <code>chmod 644 fayl</code> — huquqlarni ochish<br />
              <code>find . -name &quot;*flag*&quot;</code>
            </div>
          </div>

          <div>
            <strong style={{ color: "#34d399", fontSize: "0.9rem" }}>🔍 Qidiruv va Filtrlash:</strong>
            <div style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: 6, lineHeight: 1.6 }}>
              <code>grep -r &quot;flag&#123;&quot; .</code><br />
              <code>cat fayl | base64 -d</code><br />
              <code>head -n 20 fayl</code><br />
              <code>pwd &amp;&amp; whoami</code>
            </div>
          </div>

          <div>
            <strong style={{ color: "#fbbf24", fontSize: "0.9rem" }}>🌐 Tarmoq va Jurnallar:</strong>
            <div style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: 6, lineHeight: 1.6 }}>
              <code>cat logs/auth.log</code><br />
              <code>cat network/nmap_scan.txt</code><br />
              <code>grep -i &quot;accepted&quot; logs/auth.log</code><br />
              <code>clear</code> — ekranni tozalash
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function TerminalPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />
      <Suspense fallback={<div className="wrap" style={{ padding: 40, color: "#94a3b8" }}>Terminal yuklanmoqda...</div>}>
        <TerminalContent />
      </Suspense>
      <Footer />
    </div>
  );
}
