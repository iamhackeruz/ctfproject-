"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "./NotificationBell";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMenu = () => setMobileOpen(false);

  const navLinks = [
    { href: "/", label: "Bosh sahifa" },
    { href: "/courses", label: "Kurslar" },
    { href: "/labs", label: "Laboratoriya" },
    { href: "/terminal", label: "Terminal" },
    ...(user ? [{ href: "/dashboard", label: "Kabinet" }] : []),
  ];

  return (
    <header className={styles.header}>
      <div className={`wrap ${styles.nav}`}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoMark}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                fill="url(#ng)"
              />
              <path
                d="M9 12l2 2 4-4"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="ng" x1="3" y1="2" x2="21" y2="23" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#38bdf8" />
                  <stop offset="1" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          <span>
            Cyber<span className="g-blue">Edu</span>
          </span>
        </Link>

        {/* Desktop Links */}
        <nav className={styles.links}>
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`${styles.link} ${pathname === href ? styles.active : ""}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className={styles.actions}>
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <NotificationBell />
              <Link
                href="/dashboard"
                className="btn btn-outline"
                style={{ padding: "7px 14px", fontSize: ".85rem", display: "flex", alignItems: "center", gap: 6 }}
              >
                <span>{user.avatar || "👤"}</span>
                <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.name}
                </span>
                <span className="badge badge-blue" style={{ fontSize: "0.65rem", padding: "1px 6px" }}>
                  Kabinet
                </span>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="btn btn-ghost"
                style={{ padding: "7px 12px", fontSize: ".82rem", color: "#f87171" }}
                title="Chiqish"
              >
                Chiqish
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="btn btn-ghost"
                style={{ padding: "8px 18px", fontSize: ".85rem" }}
              >
                Kirish
              </Link>
              <Link
                href="/register"
                className="btn btn-primary"
                style={{ padding: "8px 18px", fontSize: ".85rem" }}
              >
                Ro&apos;yxatdan o&apos;tish
              </Link>
            </>
          )}
        </div>

        {/* Mobile Right Controls */}
        <div className={styles.mobileRight}>
          {user && <NotificationBell />}
          <button
            type="button"
            className={styles.mobileToggle}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menyu"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileOpen && (
        <div className={styles.mobileMenu}>
          <div className={styles.mobileLinks}>
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={closeMenu}
                className={`${styles.mobileLink} ${pathname === href ? styles.mobileActive : ""}`}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className={styles.mobileActions}>
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={closeMenu}
                  className="btn btn-outline"
                  style={{ justifyContent: "center" }}
                >
                  {user.avatar} Shaxsiy kabinet ({user.name})
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    closeMenu();
                  }}
                  className="btn btn-ghost"
                  style={{ color: "#f87171", justifyContent: "center" }}
                >
                  Chiqish
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={closeMenu} className="btn btn-ghost">
                  Kirish
                </Link>
                <Link href="/register" onClick={closeMenu} className="btn btn-primary">
                  Ro&apos;yxatdan o&apos;tish
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
