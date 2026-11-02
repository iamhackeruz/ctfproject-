import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata = {
  title: "Maxfiylik Siyosati — CyberEdu",
  description: "CyberEdu platformasida shaxsiy ma'lumotlarni qayta ishlash va maxfiylik siyosati (Qoralama shablon).",
};

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0b0f19", color: "#f3f4f6" }}>
      <Navbar />

      <main style={{ flex: 1, padding: "3rem 1.5rem" }}>
        <div style={{ maxWidth: "860px", margin: "0 auto" }}>
          {/* OGOHLANTIRISH QALQONI */}
          <div
            style={{
              padding: "1.25rem 1.5rem",
              backgroundColor: "rgba(245, 158, 11, 0.12)",
              border: "2px dashed #f59e0b",
              borderRadius: "0.75rem",
              marginBottom: "2rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "1.5rem" }}>⚠️</span>
              <strong style={{ color: "#fbbf24", fontSize: "1.1rem" }}>
                YURISTDAN TEKSHIRILMAGAN QORALAMA SHABLON
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#fde68a", lineHeight: 1.6 }}>
              <strong>DIQQAT:</strong> Ushbu maxfiylik siyosati matni faqat namuna (draft) sifatida taqdim etilmoqda va yuridik maslahat hisoblanmaydi. O&apos;zbekiston Respublikasining &quot;Shaxsga doir ma&apos;lumotlar to&apos;g&apos;risida&quot;gi Qonuni (O&apos;RQ-547) va boshqa tegishli me&apos;yoriy hujjatlarga muvofiqlashtirish uchun yurist ko&apos;rigidan o&apos;tkazilishi shart.
            </p>
          </div>

          <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "1rem", padding: "2.5rem" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#f9fafb", marginBottom: "0.5rem" }}>
              Maxfiylik Siyosati (Privacy Policy)
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#9ca3af", marginBottom: "2rem" }}>
              Oxirgi yangilanish: 2026-yil 2-noyabr | Versiya: 0.1 (Qoralama)
            </p>

            <section style={{ display: "flex", flexDirection: "column", gap: "1.75rem", lineHeight: 1.7, color: "#d1d5db" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", color: "#38bdf8", marginBottom: "0.5rem" }}>
                  1. Qanday Ma&apos;lumotlarni Yig&apos;amiz?
                </h2>
                <p>
                  Platformadan foydalanish jarayonida biz quyidagi shaxsiy va texnik ma&apos;lumotlarni yig&apos;ishimiz mumkin:
                </p>
                <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem" }}>
                  <li><strong>Hisob ma&apos;lumotlari:</strong> Ism-familiya, elektron pochta manzili (email), ixtiyoriy telefon raqami.</li>
                  <li><strong>Xavfsizlik va audit ma&apos;lumotlari:</strong> Kirish vaqti, IP manzil, brauzer User-Agent ma&apos;lumoti, ikki bosqichli autentifikatsiya (2FA) holati.</li>
                  <li><strong>O&apos;quv jarayoni ma&apos;lumotlari:</strong> Bajarilgan laboratoriyalar, yuborilgan topshiriqlar, test natijalari, sertifikatlar va davomat.</li>
                </ul>
              </div>

              <div>
                <h2 style={{ fontSize: "1.25rem", color: "#38bdf8", marginBottom: "0.5rem" }}>
                  2. Ma&apos;lumotlardan Qanday Maqsadda Foydalanamiz?
                </h2>
                <p>Yig&apos;ilgan ma&apos;lumotlar quyidagi maqsadlarda ishlatiladi:</p>
                <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem" }}>
                  <li>Ta&apos;lim xizmatlarini ko&apos;rsatish va foydalanuvchi hisobini boshqarish;</li>
                  <li>Kiberxavfsizlik va firibgarlikning (ruxsatsiz kirish, hisobni buzish) oldini olish;</li>
                  <li>Muhim eslatmalar (topshiriq muddatlari, sertifikat tayyorligi) haqida xabar berish;</li>
                  <li>Platformaning texnik barqarorligi va ishlash tezligini monitoring qilish.</li>
                </ul>
              </div>

              <div>
                <h2 style={{ fontSize: "1.25rem", color: "#38bdf8", marginBottom: "0.5rem" }}>
                  3. Xavfsizlik va Saqlash Muddatlari
                </h2>
                <p>
                  Barcha parollar <strong>Argon2id</strong> kriptografik algoritmi bilan xeshlanadi. 2FA maxfiy kalitlari esa ma&apos;lumotlar bazasida <strong>AES-256-GCM</strong> shifrlangan holatda saqlanadi.
                </p>
                <p>
                  Sessiya cookie&apos;lari qat&apos;iy <code>HttpOnly</code>, <code>Secure</code> va <code>SameSite=Lax</code> bayroqlari bilan himoyalangan bo&apos;lib, JavaScript orqali o&apos;g&apos;irlanishidan himoyalangan.
                </p>
              </div>

              <div>
                <h2 style={{ fontSize: "1.25rem", color: "#38bdf8", marginBottom: "0.5rem" }}>
                  4. Uchinchi Shaxslarga Berilmaslik Kafolati
                </h2>
                <p>
                  Kompaniya foydalanuvchilarning shaxsiy ma&apos;lumotlarini tijoriy maqsadlarda sotmaydi, ijaraga bermaydi va uchinchi tomon reklama beruvchilariga oshkor qilmaydi. Ma&apos;lumotlar faqat qonuniy sud yoki vakolatli davlat organlari talabi asosida, O&apos;zbekiston Respublikasi qonunlariga muvofiq taqdim etilishi mumkin.
                </p>
              </div>

              <div>
                <h2 style={{ fontSize: "1.25rem", color: "#38bdf8", marginBottom: "0.5rem" }}>
                  5. Foydalanuvchining Huquqlari
                </h2>
                <p>
                  Har bir foydalanuvchi o&apos;z profilidagi ma&apos;lumotlarni ko&apos;rish, tahrirlash yoki hisobini butunlay o&apos;chirish (tozalash) huquqiga ega. Buning uchun qo&apos;llab-quvvatlash xizmati bilan bog&apos;lanish kifoya.
                </p>
              </div>

              <div>
                <h2 style={{ fontSize: "1.25rem", color: "#38bdf8", marginBottom: "0.5rem" }}>
                  6. Aloqa
                </h2>
                <p>
                  Maxfiylik siyosati bo&apos;yicha murojaatlar: <br />
                  Mas&apos;ul shaxs: <strong>[DPO / MAXFIYLIK BO&apos;YICHA MAS&apos;UL SHAXS]</strong><br />
                  Email: <strong>[PRIVACY_EMAIL, masalan: privacy@cyberedu.uz]</strong><br />
                  Manzil: <strong>[KOMPANIYA YURIDIK MANZILI]</strong>
                </p>
              </div>
            </section>

            <div style={{ marginTop: "2.5rem", borderTop: "1px solid #1f2937", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <Link href="/terms" style={{ color: "#38bdf8", textDecoration: "none", fontSize: "0.875rem" }}>
                ← Foydalanish Shartlarini o&apos;qish
              </Link>
              <Link href="/contact" style={{ color: "#38bdf8", textDecoration: "none", fontSize: "0.875rem" }}>
                Aloqa va yordam markazi →
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
