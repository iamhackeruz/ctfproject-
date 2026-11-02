"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface UserEntitlementItem {
  id: string;
  type: "SUBSCRIPTION" | "COURSE" | "GROUP" | "GRANT";
  source: string;
  course?: {
    id: number;
    title: string;
    icon: string;
    accessType: string;
    duration: string;
  } | null;
  plan?: {
    id: string;
    name: string;
    interval: string;
    priceUzs: number;
  } | null;
  group?: {
    id: string;
    name: string;
  } | null;
  startsAt: string;
  endsAt: string | null;
  status: "active" | "expired" | "revoked";
  reason?: string | null;
}

export default function UserEntitlementsTab() {
  const [entitlements, setEntitlements] = useState<UserEntitlementItem[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/user/entitlements");
        const data = await res.json();
        if (data.success) {
          setEntitlements(data.entitlements || []);
          setActiveCount(data.activeCount || 0);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
        Yuklanmoqda...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f8fafc" }}>
          🔑 Mening Kirish Huquqlarim va Obunam
        </h2>
        <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
          Sizga berilgan obunalar, kurslar va guruh ruxsatnomalari holati
        </p>
      </div>

      {/* Holat Kartochkasi */}
      <div
        className="card"
        style={{
          padding: 20,
          background: activeCount > 0 ? "rgba(34, 197, 94, 0.05)" : "rgba(255, 255, 255, 0.02)",
          border: activeCount > 0 ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Faol huquqlar soni</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: activeCount > 0 ? "#4ade80" : "#f1f5f9" }}>
              {activeCount} ta
            </div>
          </div>
          <div>
            <Link href="/courses" className="btn btn-primary" style={{ fontSize: "0.85rem" }}>
              📚 Kurslar Katalogi
            </Link>
          </div>
        </div>
      </div>

      {/* Huquqlar Ro'yxati */}
      {entitlements.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🛡️</div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#f8fafc" }}>
            Hozircha sizda faol maxsus huquq yoki obuna yo&apos;q
          </h3>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", maxWidth: 450, margin: "8px auto 20px" }}>
            Platformadagi barcha bepul (FREE) kurs va laboratoriyalardan bemalol foydalanishingiz mumkin.
            Premium kurslar uchun o&apos;quv markazingiz yoki ustozingizga murojaat qiling.
          </p>
          <Link href="/courses" className="btn btn-secondary">
            Bepul darslarni boshlash
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {entitlements.map((ent) => {
            const isActive = ent.status === "active";
            const isRevoked = ent.status === "revoked";

            return (
              <div
                key={ent.id}
                className="card"
                style={{
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  border: isActive ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <span className={`badge ${ent.type === "SUBSCRIPTION" ? "badge-amber" : "badge-blue"}`}>
                      {ent.type === "SUBSCRIPTION" ? "⭐ Obuna" : ent.type === "COURSE" ? "📚 Kurs" : ent.type === "GROUP" ? "👥 Guruh" : "🛡️ Grant"}
                    </span>
                    {isActive ? (
                      <span className="badge badge-green">Faol</span>
                    ) : isRevoked ? (
                      <span className="badge badge-red" style={{ backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#f87171" }}>Bekor qilingan</span>
                    ) : (
                      <span className="badge" style={{ backgroundColor: "rgba(148, 163, 184, 0.2)", color: "#94a3b8" }}>Muddati o&apos;tgan</span>
                    )}
                  </div>

                  <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#f8fafc", marginBottom: 6 }}>
                    {ent.course?.title || ent.plan?.name || "Premium Kirish"}
                  </h3>

                  {ent.group && (
                    <div style={{ fontSize: "0.8rem", color: "#38bdf8", marginBottom: 6 }}>
                      Guruh: {ent.group.name}
                    </div>
                  )}

                  <div style={{ fontSize: "0.8rem", color: "#94a3b8", display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                    <div>Boshlandi: {new Date(ent.startsAt).toLocaleDateString()}</div>
                    <div>Tugaydi: {ent.endsAt ? new Date(ent.endsAt).toLocaleDateString() : "Cheksiz (Umrlik)"}</div>
                  </div>
                </div>

                {ent.course && isActive && (
                  <div style={{ marginTop: 16 }}>
                    <Link href={`/courses/${ent.course.id}/learn`} className="btn btn-primary" style={{ width: "100%", textAlign: "center", fontSize: "0.85rem" }}>
                      Darsga o&apos;tish &rarr;
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
