import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import s from "./page.module.css";
import { coursesData } from "@/data/courses";

const stats = [
  { v: "500+", l: "O'quvchilar", icon: "👨‍🎓" },
  { v: "24", l: "Kurslar", icon: "📚" },
  { v: "180+", l: "Darslar", icon: "🎬" },
  { v: "98%", l: "Muvaffaqiyat", icon: "⭐" },
];

const featuredCourses = coursesData.slice(0, 4);

const audience = [
  {
    icon: "🎓",
    title: "Talabalar va Boshlovchilar",
    desc: "Linux buyruqlari, kompyuter tarmoqlari va kiberxavfsizlik asoslarini brauzerdan chiqmasdan, xavfsiz mashq qiling.",
    tag: "Boshlang'ich",
  },
  {
    icon: "🛡️",
    title: "Amaliyotchi Mutaxassislar",
    desc: "Web zaifliklar (OWASP Top 10), SQL Injection, XSS va IDOR larni jonli laboratoriyalarda tahlil qiling va bayroqlarni yeching.",
    tag: "O'rta & Yuqori",
  },
  {
    icon: "🏫",
    title: "O'quv Markazlari va Universitetlar",
    desc: "O'qituvchilar uchun guruhlar, uy vazifalarini baholash, talabalar davomati va avtomatik sertifikatlash tizimi.",
    tag: "Tashkiliy",
  },
];

const steps = [
  {
    step: "01",
    title: "Taklif Kodi Oling",
    desc: "O'qituvchingizdan bir martalik taklif kodini oling yoki kursga yoziling.",
  },
  {
    step: "02",
    title: "Sillabusni Ko'ring",
    desc: "Kurs dasturi, modullar va laboratoriyalar ro'yxati bilan tanishing.",
  },
  {
    step: "03",
    title: "Amaliyot Qiling",
    desc: "Izolyatsiyalangan Linux terminal va veb-lablarda vazifalarni bajaring.",
  },
  {
    step: "04",
    title: "Sertifikat Oling",
    desc: "Testlarni topshiring, flaglarni kiriting va rasmiy QR-kodli sertifikatga ega bo'ling.",
  },
];

const features = [
  { icon: "💻", title: "Interaktiv Terminal Sandbox", desc: "Hech qanday dastur o'rnatmasdan, to'g'ridan-to'g'ri brauzeringizda haqiqiy Linux terminali" },
  { icon: "🎯", title: "Haqiqiy Veb-Laboratoriyalar", desc: "XSS, SQLi, IDOR kabi xavfsizlik zaifliklarini o'rganish uchun alohida izolyatsiyalangan muhit" },
  { icon: "🚩", title: "Dinamik Flag Tizimi", desc: "Har bir foydalanuvchi uchun unikal kriptografik flaglar va timing-attack hujumlaridan himoyalangan tekshiruv" },
  { icon: "📊", title: "Ustoz & Admin Paneli", desc: "Guruhlar, talabalar davomati, uy vazifalarini tekshirish va CSV eksport qilish imkoniyati" },
  { icon: "🔐", title: "2FA va Kiberxavfsizlik", desc: "Argon2id parol xeshlash, Google Authenticator (TOTP), zaxira kodlar va CSP qat'iy himoyasi" },
  { icon: "📜", title: "Rasmiy Sertifikatlar", desc: "Kursni muvaffaqiyatli tamomlagan talabalarga unikal kod va verifikatsiya havolasiga ega sertifikatlar" },
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
          <div className={`badge badge-blue ${s.heroPill}`}>
            🔐 O&apos;zbekistonda Birinchi Kiberxavfsizlik Ta&apos;lim Platformasi
          </div>

          <h1 className={s.heroH1}>
            Amaliy Bilim Bilan<br />
            <span className="g-blue">Kiberxavfsizlikni</span><br />
            Noldan O&apos;rganing
          </h1>

          <p className={s.heroSub}>
            Brauzeringizda to&apos;g&apos;ridan-to&apos;g&apos;ri ishlaydigan xavfsiz Linux terminal va veb-laboratoriyalar.
            O&apos;qituvchilar, talabalar va tashkilotlar uchun yagona zamonaviy ekotizim.
          </p>

          <div className={s.heroBtns}>
            <Link href="/register" className="btn btn-primary" style={{ padding: "14px 30px", fontSize: "1rem" }}>
              Boshlash — Ro&apos;yxatdan O&apos;tish
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link href="/courses" className="btn btn-outline" style={{ padding: "14px 30px", fontSize: "1rem" }}>
              Kurslar Dasturi (Sillabus)
            </Link>
          </div>

          {/* Stats */}
          <div className={s.stats}>
            {stats.map((st) => (
              <div key={st.l} className={`card ${s.statCard}`}>
                <span className={s.statEmoji}>{st.icon}</span>
                <strong className={s.statVal}>{st.v}</strong>
                <span className={s.statLbl}>{st.l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LOYIHA NIMA? (ABOUT SECTION) ────────────────── */}
      <section className={s.section}>
        <div className="wrap">
          <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center", marginBottom: "3rem" }}>
            <span className="badge badge-purple" style={{ marginBottom: "0.75rem" }}>🛡️ Loyiha Haqida</span>
            <h2 className={s.secTitle}>CyberEdu nima va qanday ishlaydi?</h2>
            <p className={s.secSub} style={{ fontSize: "1.05rem", lineHeight: 1.7 }}>
              CyberEdu — bu shunchaki video ko&apos;rish sayti emas, balki <strong>amaliy mashg&apos;ulot maydoni</strong>. Har bir nazariy mavzu ortidan talaba izolyatsiyalangan xavfsiz Docker sandbox konteynerlarida Linux buyruqlarini teradi, tarmoq paketlarini tahlil qiladi va xavfsiz tarzda veb-zaifliklarni aniqlab, bayroqlarni (flag) topshiradi.
            </p>
          </div>

          <div className={s.grid3}>
            {audience.map((a) => (
              <div key={a.title} className={`card ${s.featCard}`} style={{ borderTop: "3px solid var(--accent, #38bdf8)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <span style={{ fontSize: "2rem" }}>{a.icon}</span>
                  <span className="badge badge-blue" style={{ fontSize: "0.75rem" }}>{a.tag}</span>
                </div>
                <h3 className={s.featTitle} style={{ fontSize: "1.15rem" }}>{a.title}</h3>
                <p className={s.featDesc}>{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COURSES (SYLLABUS PREVIEW) ─────────────────── */}
      <section className={`${s.section} ${s.sectionAlt}`}>
        <div className="wrap">
          <div className={s.secHead}>
            <span className="badge badge-blue">📚 O&apos;quv Kurslari</span>
            <h2 className={s.secTitle}>Mashhur <span className="g-blue">O&apos;quv Dasturlari</span></h2>
            <p className={s.secSub}>Har bir kursning to&apos;liq sillabusi, modullari va laboratoriyalari ochiq ko&apos;rinadi</p>
          </div>

          <div className={s.grid4}>
            {featuredCourses.map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.id}`}
                className={`card ${s.courseCard}`}
                style={{ "--accent": c.accent } as React.CSSProperties}
              >
                <div className={s.courseTop}>
                  <span className={s.courseEmoji}>{c.icon}</span>
                  <span className={`badge ${c.badge}`}>{c.bLabel}</span>
                </div>
                <h3 className={s.courseTitle}>{c.title}</h3>
                <p className={s.courseDesc}>{c.desc}</p>
                <div className={s.courseFoot}>
                  <span className={s.courseLessons}>▶ {c.lessons} ta dars sillabusi</span>
                  <span className={s.courseArrow}>Dastur →</span>
                </div>
              </Link>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 36 }}>
            <Link href="/courses" className="btn btn-ghost" style={{ fontSize: "1rem" }}>
              Barcha kurslar sillabusini ko&apos;rish →
            </Link>
          </div>
        </div>
      </section>

      {/* ── HOW TO START (QANDAY BOSHLASH KERAK) ──────── */}
      <section className={s.section}>
        <div className="wrap">
          <div className={s.secHead}>
            <span className="badge badge-green">🚀 Tezkor Qo&apos;llanma</span>
            <h2 className={s.secTitle}>Qanday qilib <span className="g-green">Boshlash</span> mumkin?</h2>
            <p className={s.secSub}>Ta&apos;lim olish jarayoni 4 oddiy bosqichdan iborat</p>
          </div>

          <div className={s.grid4}>
            {steps.map((st) => (
              <div key={st.step} className={`card ${s.featCard}`} style={{ position: "relative", overflow: "hidden" }}>
                <div
                  style={{
                    fontSize: "2.5rem",
                    fontWeight: 900,
                    color: "rgba(56, 189, 248, 0.15)",
                    position: "absolute",
                    top: "10px",
                    right: "15px",
                    userSelect: "none",
                  }}
                >
                  {st.step}
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f9fafb", margin: "0.5rem 0" }}>
                  {st.title}
                </h3>
                <p className={s.featDesc} style={{ margin: 0 }}>{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES (AFZALLIKLARI) ──────────────────── */}
      <section className={`${s.section} ${s.sectionAlt}`}>
        <div className="wrap">
          <div className={s.secHead}>
            <span className="badge badge-green">⚡ Afzalliklari</span>
            <h2 className={s.secTitle}>Nega <span className="g-green">CyberEdu</span>?</h2>
            <p className={s.secSub}>Professional kiberxavfsizlik ta&apos;limi uchun barcha texnik qulayliklar</p>
          </div>

          <div className={s.grid3}>
            {features.map((f) => (
              <div key={f.title} className={`card ${s.featCard}`}>
                <div className={s.featIcon}>{f.icon}</div>
                <h3 className={s.featTitle}>{f.title}</h3>
                <p className={s.featDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ALOQA VA SAVOLLAR BLOKI ───────────────────── */}
      <section className={s.section}>
        <div className="wrap">
          <div
            style={{
              background: "#111827",
              border: "1px solid #1f2937",
              borderRadius: "1rem",
              padding: "3rem 2rem",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <span className="badge badge-blue">💬 Aloqa & Yordam</span>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#f9fafb", margin: 0 }}>
              Savolingiz bormi yoki tashkilotingiz uchun platforma kerakmi?
            </h2>
            <p style={{ maxWidth: "600px", color: "#9ca3af", margin: 0, fontSize: "1rem" }}>
              Biz bilan bog&apos;laning. Kiberxavfsizlik darslari, guruhlar tashkil qilish va hamkorlik masalalarida yordam berishga tayyormiz.
            </p>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center", marginTop: "0.5rem" }}>
              <Link href="/contact" className="btn btn-primary" style={{ padding: "12px 28px" }}>
                Aloqa Sahifasi ✉️
              </Link>
              <a
                href="https://t.me/cyberedu_uz"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
                style={{ padding: "12px 28px" }}
              >
                Telegram Orqali Bog&apos;lanish ✈️
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────── */}
      <section className={s.cta}>
        <div className={s.ctaGlow} />
        <div className={`wrap ${s.ctaBody}`}>
          <span className="badge badge-purple" style={{ marginBottom: 20 }}>🚀 Hoziroq boshlang</span>
          <h2 className={s.ctaTitle}>Kiberxavfsizlikni o&apos;rganishga tayyormisiz?</h2>
          <p className={s.ctaSub}>
            Platformaga kiring, laboratoriyalarni bajaring va professional bilimga ega bo&apos;ling
          </p>
          <div className={s.ctaBtns}>
            <Link href="/register" className="btn btn-primary" style={{ padding: "14px 32px" }}>
              Ro&apos;yxatdan o&apos;tish
            </Link>
            <Link href="/courses" className="btn btn-outline" style={{ padding: "14px 32px" }}>
              Kurslar sillabusi
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
