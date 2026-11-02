"use client";

import { useState, useEffect, useRef } from "react";

interface NotificationItem {
  id: string;
  type: string;
  channel: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications?limit=15");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // 30 soniyada yangilab turish
    return () => clearInterval(interval);
  }, []);

  // Tashqariga bosilganda yopish
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications/mark-all-read", { method: "POST" });
      if (res.ok) {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          borderRadius: "8px",
          color: "#94a3b8",
        }}
        title="Bildirishnomalar"
        aria-label="Bildirishnomalar"
      >
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              background: "#ef4444",
              color: "#fff",
              borderRadius: "10px",
              padding: "1px 5px",
              fontSize: "0.68rem",
              fontWeight: 700,
              minWidth: "16px",
              textAlign: "center",
              lineHeight: "14px",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: "340px",
            maxWidth: "min(340px, calc(100vw - 24px))",
            maxHeight: "440px",
            overflowY: "auto",
            backgroundColor: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: "12px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 14px",
              borderBottom: "1px solid #1e293b",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "#f8fafc" }}>
              Bildirishnomalar {unreadCount > 0 && `(${unreadCount})`}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={loading}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#38bdf8",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Barchasini o&apos;qilgan qilish
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "24px 14px", textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>
                Yangi bildirishnomalar yo&apos;q
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && handleMarkAsRead(n.id)}
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid #1e293b",
                    backgroundColor: n.isRead ? "transparent" : "rgba(56, 189, 248, 0.05)",
                    cursor: n.isRead ? "default" : "pointer",
                    transition: "background 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div
                      style={{
                        fontSize: "0.82rem",
                        fontWeight: n.isRead ? 500 : 700,
                        color: n.isRead ? "#cbd5e1" : "#38bdf8",
                      }}
                    >
                      {n.title}
                    </div>
                    {!n.isRead && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor: "#38bdf8",
                          flexShrink: 0,
                          marginTop: 4,
                        }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "#94a3b8",
                      marginTop: 4,
                      lineHeight: "1.35",
                      wordBreak: "break-word",
                    }}
                  >
                    {n.message}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: 4 }}>
                    {new Date(n.createdAt).toLocaleDateString("uz-UZ", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
