"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Course, coursesData as initialCoursesData } from "@/data/courses";

interface CourseContextType {
  courses: Course[];
  loading: boolean;
  addCourse: (courseData: Partial<Course>) => Promise<Course>;
  deleteCourse: (courseId: number) => Promise<boolean>;
  completedLessons: Record<number, number[]>;
  markLessonComplete: (courseId: number, lessonIndex: number) => Promise<void>;
  isLessonCompleted: (courseId: number, lessonIndex: number) => boolean;
  getCourseProgress: (courseId: number) => number;
  refreshCourses: () => Promise<void>;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

interface DbCourseResponse {
  id: number;
  icon: string;
  title: string;
  desc: string;
  fullDesc: string;
  duration: string;
  level: Course["level"];
  levelColor: string;
  color: Course["color"];
  accent: string;
  badge: string;
  bLabel: string;
  tags: string[];
  instructorName: string;
  instructorRole: string;
  instructorAvatar: string;
  instructorExp: string;
  whatYouWillLearn: string[];
  prerequisites: string[];
  accessType?: string;
  priceUzs?: number;
  modules: Array<{
    title: string;
    duration: string;
    lessons: Array<{
      id?: number;
      title: string;
      duration: string;
      isFree?: boolean;
      accessType?: string;
      isLocked?: boolean;
      lockedMessage?: string;
      content?: string;
      labSlug?: string;
    }>;
  }>;
  _count?: { enrollments: number };
}

export function CourseProvider({ children }: { children: React.ReactNode }) {
  const [courses, setCourses] = useState<Course[]>(initialCoursesData);
  const [completedLessons, setCompletedLessons] = useState<Record<number, number[]>>({ 1: [0, 1], 2: [0] });
  const [loading, setLoading] = useState(true);

  // Bazadan kurslarni yuklash
  const refreshCourses = useCallback(async () => {
    try {
      const res = await fetch("/api/courses");
      const data = await res.json();
      if (data.success && Array.isArray(data.courses) && data.courses.length > 0) {
        // DB formatini Course interfeysiga moslash
        const mapped: Course[] = data.courses.map((c: DbCourseResponse) => ({
          id: c.id,
          icon: c.icon || "💻",
          title: c.title,
          desc: c.desc,
          fullDesc: c.fullDesc,
          lessons: c.modules?.reduce((acc: number, m) => acc + (m.lessons?.length || 0), 0) || 12,
          students: c._count?.enrollments || 1,
          duration: c.duration,
          level: c.level,
          levelColor: c.levelColor,
          color: c.color || "blue",
          accent: c.accent || "#38bdf8",
          badge: c.badge || "badge-green",
          bLabel: c.bLabel || "Mashhur",
          tags: c.tags || [],
          instructor: {
            name: c.instructorName,
            role: c.instructorRole,
            avatar: c.instructorAvatar,
            experience: c.instructorExp,
          },
          whatYouWillLearn: c.whatYouWillLearn || [],
          prerequisites: c.prerequisites || [],
          accessType: c.accessType,
          priceUzs: c.priceUzs,
          modules: c.modules || [],
        }));
        setCourses(mapped);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const [cRes, pRes] = await Promise.all([
          fetch("/api/courses").catch(() => null),
          fetch("/api/progress").catch(() => null),
        ]);
        if (ignore) return;

        if (cRes) {
          const cData = await cRes.json().catch(() => null);
          if (!ignore && cData?.success && Array.isArray(cData.courses) && cData.courses.length > 0) {
            const mapped: Course[] = cData.courses.map((c: DbCourseResponse) => ({
              id: c.id,
              icon: c.icon || "💻",
              title: c.title,
              desc: c.desc,
              fullDesc: c.fullDesc,
              lessons: c.modules?.reduce((acc: number, m) => acc + (m.lessons?.length || 0), 0) || 12,
              students: c._count?.enrollments || 1,
              duration: c.duration,
              level: c.level,
              levelColor: c.levelColor,
              color: c.color || "blue",
              accent: c.accent || "#38bdf8",
              badge: c.badge || "badge-green",
              bLabel: c.bLabel || "Mashhur",
              tags: c.tags || [],
              instructor: {
                name: c.instructorName,
                role: c.instructorRole,
                avatar: c.instructorAvatar,
                experience: c.instructorExp,
              },
              whatYouWillLearn: c.whatYouWillLearn || [],
              prerequisites: c.prerequisites || [],
              accessType: c.accessType,
              priceUzs: c.priceUzs,
              modules: c.modules || [],
            }));
            setCourses(mapped);
          }
        }

        if (pRes) {
          const pData = await pRes.json().catch(() => null);
          if (!ignore && pData?.success && pData.completedLessons) {
            setCompletedLessons(pData.completedLessons);
          }
        }
      } catch {
        // Fallback
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, []);

  // Yangi kurs qo'shish (Ustoz / Admin)
  const addCourse = async (data: Partial<Course>): Promise<Course> => {
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (resData.success && resData.course) {
        await refreshCourses();
        return resData.course;
      }
    } catch {
      // Local fallback
    }

    const fallback: Course = {
      id: Date.now(),
      icon: data.icon || "💻",
      title: data.title || "Yangi Kiberxavfsizlik Kursi",
      desc: data.desc || "Kurs bo'yicha amaliy bilimlar",
      fullDesc: data.fullDesc || data.desc || "Batafsil darsliklar to'plami.",
      lessons: data.modules?.reduce((acc, m) => acc + m.lessons.length, 0) || 12,
      students: 1,
      duration: data.duration || "8 soat",
      level: data.level || "Boshlang'ich",
      levelColor: data.level === "Ilg'or" ? "badge-orange" : data.level === "O'rta" ? "badge-blue" : "badge-green",
      color: "blue",
      accent: "#38bdf8",
      badge: "badge-green",
      bLabel: data.level || "Boshlang'ich",
      tags: data.tags || ["Kiberxavfsizlik"],
      instructor: data.instructor || {
        name: "Bosh Ustoz",
        role: "Kiberxavfsizlik Mutaxassisi",
        avatar: "👨‍🏫",
        experience: "5+ yil",
      },
      whatYouWillLearn: data.whatYouWillLearn || ["Fundamental kiberxavfsizlik bilimlari"],
      prerequisites: data.prerequisites || ["Kompyuter savodxonligi"],
      modules: data.modules || [],
    };

    setCourses((prev) => [fallback, ...prev]);
    return fallback;
  };

  // Kursni o'chirish
  const deleteCourse = async (courseId: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setCourses((prev) => prev.filter((c) => c.id !== courseId));
        return true;
      }
    } catch {
      // Local fallback
    }
    setCourses((prev) => prev.filter((c) => c.id !== courseId));
    return true;
  };

  // Darsni tugatilgan deb belgilash
  const markLessonComplete = async (courseId: number, lessonIndex: number) => {
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, lessonId: lessonIndex }),
      });
    } catch {
      // Ignore
    }

    setCompletedLessons((prev) => {
      const current = prev[courseId] || [];
      if (current.includes(lessonIndex)) return prev;
      return {
        ...prev,
        [courseId]: [...current, lessonIndex],
      };
    });
  };

  const isLessonCompleted = (courseId: number, lessonIndex: number): boolean => {
    return !!completedLessons[courseId]?.includes(lessonIndex);
  };

  const getCourseProgress = (courseId: number): number => {
    const course = courses.find((c) => c.id === courseId);
    if (!course) return 0;
    const total = course.modules?.reduce((acc, m) => acc + m.lessons.length, 0) || course.lessons || 1;
    const completed = completedLessons[courseId]?.length || 0;
    return Math.min(100, Math.round((completed / total) * 100));
  };

  return (
    <CourseContext.Provider
      value={{
        courses,
        loading,
        addCourse,
        deleteCourse,
        completedLessons,
        markLessonComplete,
        isLessonCompleted,
        getCourseProgress,
        refreshCourses,
      }}
    >
      {children}
    </CourseContext.Provider>
  );
}

export function useCourses() {
  const ctx = useContext(CourseContext);
  if (!ctx) throw new Error("useCourses CourseProvider ichida ishlatilishi kerak");
  return ctx;
}
