import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CourseProvider } from "@/context/CourseContext";

export const metadata: Metadata = {
  title: "CyberEdu — Kiberxavfsizlik O'quv Platformasi",
  description:
    "Kiberxavfsizlik, tarmoq va Linux bo'yicha professional o'quv platformasi. O'qituvchilar dars materiallarini yuklaydi, o'quvchilar o'rganadi.",
  keywords: "kiberxavfsizlik, tarmoq, linux, o'quv, kurs, cybersecurity",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers();

  return (
    <html lang="uz">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <CourseProvider>{children}</CourseProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
