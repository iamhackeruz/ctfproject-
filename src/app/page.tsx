import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import s from "./page.module.css";
import { coursesData } from "@/data/courses";

const stats = [
  { v: "500+", l: "O'quvchilar", icon: "👨‍🎓" },
  { v: "24",   l: "Kurslar",    icon: "📚" },
  { v: "180+", l: "Darslar",    icon: "🎬" },
  { v: "98%",  l: "Muvaffaqiyat", icon: "⭐" },
];

const featuredCourses = coursesData.slice(0, 4);

const features = [
  { icon:"📁", title:"Tizimli Materiallar",   desc:"Barcha dars materiallari bir joyda, modul-modul tartibda" },
  { icon:"🎬", title:"Video Darslar",         desc:"YouTube va boshqa platformalar bilan integratsiya" },
  { icon:"✅", title:"Testlar & Quizlar",     desc:"Har moduldan keyin bilimni tekshirish imkoni" },
  { icon:"📊", title:"Progress Kuzatuv",      desc:"O'quvchi va o'qituvchi uchun real-time statistika" },
  { icon:"👨‍🏫", title:"O'qituvchi Paneli",    desc:"Kurs yaratish, material yuklash, o'quvchilarni boshqarish" },
  { icon:"🔒", title:"Xavfsiz Kirish",        desc:"Alohida role tizimi: teacher va student" },
];

export default function Home() {
  return (
    <div className={s.page}>
      <Navbar />

      {/* ── HERO ────────────────────────────────────── */}
      <section className={`${s.hero} cyber-bg`}>
        <div className={s.heroGlow1} />
        <div className={s.heroGlow2} />

        <div className={`wrap ${s.heroBody}`}>
          <div className={`badge badge-blue ${s.heroPill}`}>🔐 Kiberxavfsizlik O&apos;quv Platformasi</div>

          <h1 className={s.heroH1}>
            Bilimingizni<br />
            <span className="g-blue">Kiberxavfsizlik</span><br />
            bilan Kuchaytiring
          </h1>

          <p className={s.heroSub}>
            O&apos;qituvchi va o&apos;quvchilar uchun yagona platforma.
            Dars materiallarini yuklang, videolarni ko&apos;ring,
            bilimingizni sinab ko&apos;ring.
          </p>

          <div className={s.heroBtns}>
            <Link href="/register" className="btn btn-primary" style={{ padding:"14px 30px", fontSize:"1rem" }}>
              Boshlash — Bepul
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
            <Link href="/courses" className="btn btn-outline" style={{ padding:"14px 30px", fontSize:"1rem" }}>
              Kurslarni Ko&apos;rish
            </Link>
          </div>

          {/* Stats */}
          <div className={s.stats}>
            {stats.map(st => (
              <div key={st.l} className={`card ${s.statCard}`}>
                <span className={s.statEmoji}>{st.icon}</span>
                <strong className={s.statVal}>{st.v}</strong>
                <span className={s.statLbl}>{st.l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COURSES ─────────────────────────────────── */}
      <section className={s.section}>
        <div className="wrap">
          <div className={s.secHead}>
            <span className="badge badge-blue">📚 Kurslar</span>
            <h2 className={s.secTitle}>Mashhur <span className="g-blue">Kurslar</span></h2>
            <p className={s.secSub}>Kiberxavfsizlik sohasida eng zarur bilimlar</p>
          </div>

          <div className={s.grid4}>
            {featuredCourses.map(c => (
              <Link key={c.id} href={`/courses/${c.id}`} className={`card ${s.courseCard}`}
                style={{ "--accent": c.accent } as React.CSSProperties}>
                <div className={s.courseTop}>
                  <span className={s.courseEmoji}>{c.icon}</span>
                  <span className={`badge ${c.badge}`}>{c.bLabel}</span>
                </div>
                <h3 className={s.courseTitle}>{c.title}</h3>
                <p className={s.courseDesc}>{c.desc}</p>
                <div className={s.courseFoot}>
                  <span className={s.courseLessons}>▶ {c.lessons} dars</span>
                  <span className={s.courseArrow}>→</span>
                </div>
              </Link>
            ))}
          </div>

          <div style={{ textAlign:"center", marginTop:36 }}>
            <Link href="/courses" className="btn btn-ghost">Barcha kurslarni ko&apos;rish →</Link>
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────── */}
      <section className={`${s.section} ${s.sectionAlt}`}>
        <div className="wrap">
          <div className={s.secHead}>
            <span className="badge badge-green">⚡ Imkoniyatlar</span>
            <h2 className={s.secTitle}>Nega <span className="g-green">CyberEdu</span>?</h2>
            <p className={s.secSub}>O&apos;quv jarayonini osonlashtirish uchun zarur barcha vositalar</p>
          </div>

          <div className={s.grid3}>
            {features.map(f => (
              <div key={f.title} className={`card ${s.featCard}`}>
                <div className={s.featIcon}>{f.icon}</div>
                <h3 className={s.featTitle}>{f.title}</h3>
                <p className={s.featDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────── */}
      <section className={s.cta}>
        <div className={s.ctaGlow} />
        <div className={`wrap ${s.ctaBody}`}>
          <span className="badge badge-purple" style={{ marginBottom:20 }}>🚀 Hozir boshlang</span>
          <h2 className={s.ctaTitle}>Kiberxavfsizlikni o&apos;rganishga tayyormisiz?</h2>
          <p className={s.ctaSub}>Hoziroq ro&apos;yxatdan o&apos;ting, laboratoriyalarni bajaring va professional bilimga ega bo&apos;ling</p>
          <div className={s.ctaBtns}>
            <Link href="/register" className="btn btn-primary" style={{ padding:"14px 32px" }}>
              Boshlash — Bepul
            </Link>
            <Link href="/courses" className="btn btn-outline" style={{ padding:"14px 32px" }}>
              Kurslarni ko&apos;rish
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
