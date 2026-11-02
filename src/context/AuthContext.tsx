"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "teacher" | "instructor" | "admin" | "accountant";
  avatar?: string;
  enrolledCourseIds: number[];
  phone?: string;
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, role?: string, name?: string) => Promise<boolean>;
  loginWithCredentials: (emailOrUsername: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerUser: (name: string, email: string, password: string, inviteCode?: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  loginWithUser: (userData: User) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => Promise<void>;
  enrollCourse: (courseId: number) => Promise<void>;
  isEnrolled: (courseId: number) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Bazadan joriy sessiyani yuklash
  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth");
      const data = await res.json();

      if (data.authenticated && data.user) {
        // Enrolled kurslarni olish
        const enrollRes = await fetch("/api/enroll").catch(() => null);
        const enrollData = enrollRes ? await enrollRes.json().catch(() => null) : null;
        const enrolledIds: number[] = enrollData?.enrolledCourseIds || [1, 2];

        const role = data.user.role || "student";

        setUser({
          id: data.user.userId || data.user.id,
          name: data.user.name,
          email: data.user.email,
          role,
          avatar: data.user.avatar || (role === "admin" ? "🛡️" : role === "instructor" || role === "teacher" ? "👨‍🏫" : "👨‍🎓"),
          phone: data.user.phone,
          mustChangePassword: data.user.mustChangePassword,
          enrolledCourseIds: enrolledIds,
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadUser() {
      try {
        const res = await fetch("/api/auth");
        const data = await res.json();
        if (ignore) return;

        if (data.authenticated && data.user) {
          const enrollRes = await fetch("/api/enroll").catch(() => null);
          const enrollData = enrollRes ? await enrollRes.json().catch(() => null) : null;
          const enrolledIds: number[] = enrollData?.enrolledCourseIds || [1, 2];

          const role = data.user.role || "student";

          if (!ignore) {
            setUser({
              id: data.user.userId || data.user.id,
              name: data.user.name,
              email: data.user.email,
              role,
              avatar: data.user.avatar || (role === "admin" ? "🛡️" : role === "instructor" || role === "teacher" ? "👨‍🏫" : "👨‍🎓"),
              phone: data.user.phone,
              mustChangePassword: data.user.mustChangePassword,
              enrolledCourseIds: enrolledIds,
            });
          }
        } else if (!ignore) {
          setUser(null);
        }
      } catch {
        if (!ignore) setUser(null);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadUser();
    return () => {
      ignore = true;
    };
  }, []);

  // Login
  const loginWithCredentials = async (emailOrUsername: string, password: string) => {
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", emailOrUsername, password }),
      });
      const data = await res.json();

      if (data.success && data.user) {
        await refreshUser();
        return { success: true };
      }
      return { success: false, error: data.error || "Login muvaffaqiyatsiz bo'ldi." };
    } catch {
      return { success: false, error: "Server bilan aloqa xatosi." };
    }
  };

  // Eski interfeys bilan moslik (legacy login)
  const login = async (email: string): Promise<boolean> => {
    return (await loginWithCredentials(email, "Student#2026!Pass")).success;
  };

  // Ro'yxatdan o'tish
  const registerUser = async (name: string, email: string, password: string, inviteCode?: string) => {
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", name, email, password, inviteCode }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshUser();
        return { success: true, message: data.message };
      }
      return { success: false, error: data.error || "Ro'yxatdan o'tishda xatolik." };
    } catch {
      return { success: false, error: "Server bilan aloqa xatosi." };
    }
  };

  const loginWithUser = (userData: User) => {
    setUser(userData);
  };

  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    setUser({ ...user, ...updates });
  };

  // Chiqish
  const logout = async () => {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } finally {
      setUser(null);
    }
  };

  // Kursga yozilish
  const enrollCourse = async (courseId: number) => {
    if (!user) return;
    try {
      await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      setUser((prev) => {
        if (!prev) return null;
        if (prev.enrolledCourseIds.includes(courseId)) return prev;
        return { ...prev, enrolledCourseIds: [...prev.enrolledCourseIds, courseId] };
      });
    } catch {
      // Offline fallback
      setUser((prev) => {
        if (!prev) return null;
        if (prev.enrolledCourseIds.includes(courseId)) return prev;
        return { ...prev, enrolledCourseIds: [...prev.enrolledCourseIds, courseId] };
      });
    }
  };

  const isEnrolled = (courseId: number) => {
    return !!user?.enrolledCourseIds?.includes(courseId);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithCredentials,
        registerUser,
        loginWithUser,
        updateUser,
        logout,
        enrollCourse,
        isEnrolled,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth AuthProvider ichida ishlatilishi kerak");
  return ctx;
}
