import Link from "next/link";
import s from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={s.footer}>
      <div className={`wrap ${s.inner}`}>
        <div className={s.left}>
          <Link href="/" className={s.logo}>
            <span>🛡️</span>
            <span>Cyber<span className="g-blue">Edu</span></span>
          </Link>
          <p className={s.copy}>
            © 2026 CyberEdu — O&apos;zbekistonda kiberxavfsizlik va axloqiy xakerlik bo&apos;yicha yetakchi ta&apos;lim platformasi.
          </p>
        </div>

        <div className={s.navLinks}>
          <Link href="/" className={s.link}>Bosh sahifa</Link>
          <Link href="/courses" className={s.link}>Kurslar</Link>
          <Link href="/labs" className={s.link}>Laboratoriya (CTF)</Link>
          <Link href="/terminal" className={s.link}>Terminal</Link>
          <Link href="/dashboard" className={s.link}>Kabinet</Link>
          <Link href="/terms" className={s.link}>Foydalanish shartlari</Link>
          <Link href="/privacy" className={s.link}>Maxfiylik siyosati</Link>
          <Link href="/contact" className={s.link}>Aloqa</Link>
        </div>

        <div className={s.topics}>
          <span>Kali Linux</span>
          <span className={s.dot} />
          <span>Wireshark</span>
          <span className={s.dot} />
          <span>OWASP Top 10</span>
          <span className={s.dot} />
          <span>Pentesting</span>
        </div>
      </div>
    </footer>
  );
}
