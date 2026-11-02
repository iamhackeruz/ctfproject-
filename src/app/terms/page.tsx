import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata = {
  title: "Foydalanish Shartlari — CyberEdu",
  description: "CyberEdu platformasidan foydalanish shartlari va qoidalari (Qoralama shablon).",
};

export default function TermsPage() {
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
              <strong>DIQQAT:</strong> Ushbu hujvat faqat namunaviy (draft) shablon bo&apos;lib, rasmiy yuridik xulosa yoki malakali advokat maslahati hisoblanmaydi. Platformani tijoriy yoki ommaviy ishga tushirishdan oldin malakali litsenziyaga ega yurist bilan to&apos;liq ko&apos;rib chiqilishi va mahalliy qonunchilikka (O&apos;zbekiston Respublikasi qonunlariga) moslashtirilishi shart.
            </p>
          </div>

          <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "1rem", padding: "2.5rem" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#f9fafb", marginBottom: "0.5rem" }}>
              Foydalanish Shartlari (Terms of Service)
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#9ca3af", marginBottom: "2rem" }}>
              Oxirgi yangilanish: 2026-yil 2-noyabr | Versiya: 0.1 (Qoralama)
            </p>

            <section style={{ display: "flex", flexDirection: "column", gap: "1.75rem", lineHeight: 1.7, color: "#d1d5db" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", color: "#38bdf8", marginBottom: "0.5rem" }}>
                  1. Umumiy Qoidalar
                </h2>
                <p>
                  Ushbu Foydalanish shartlari <strong>[KOMPANIYA NOMI / MCHJ NOMI]</strong> (keyingi o&apos;rinlarda &quot;Kompaniya&quot; yoki &quot;Platforma&quot;) tomonidan boshqariladigan <strong>[DOMEN NOMI, masalan: cyberedu.uz]</strong> veb-saytidan va ta&apos;lim xizmatlaridan foydalanish tartibini belgilaydi.
                </p>
                <p>
                  Ro&apos;yxatdan o&apos;tish, darslarni ko&apos;rish yoki interaktiv laboratoriyalardan foydalanish orqali siz ushbu shartlarga to&apos;liq rozilik bildirasiz. Agar shartlarga rozi bo&apos;lmasangiz, platformadan foydalanmasligingiz lozim.
                </p>
              </div>

              <div>
                <h2 style={{ fontSize: "1.25rem", color: "#38bdf8", marginBottom: "0.5rem" }}>
                  2. Axloqiy Kiberxavfsizlik va Ruxsatsiz Hujumlarni Taqiqlash
                </h2>
                <p>
                  CyberEdu platformasida taqdim etiladigan barcha laboratoriyalar, stsenariylar va mashg&apos;ulotlar <strong>faqat ta&apos;limiy va himoyalanish maqsadlarida</strong> yaratilgan.
                </p>
                <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem" }}>
                  <li>Olingan bilimlarni tashqi (ruxsatsiz) serverlar, tashkilotlar yoki shaxslarga qarshi hujum qilish uchun qo&apos;llash qat&apos;iyan taqiqlanadi.</li>
                  <li>Platformaning o&apos;ziga (ishlab chiqarish infratuzilmasi, asosiy serverlar yoki boshqa foydalanuvchilar konteynerlariga) nisbatan DoS/DDoS hujumlari yoki ekspluatatsiya urinishlari taqiqlanadi.</li>
                  <li>Har qanday noqonuniy kiberhujumlar O&apos;zbekiston Respublikasi Jinoyat Kodeksining tegishli moddalariga muvofiq jinoiy javobgarlikka sabab bo&apos;ladi.</li>
                </ul>
              </div>

              <div>
                <h2 style={{ fontSize: "1.25rem", color: "#38bdf8", marginBottom: "0.5rem" }}>
                  3. Foydalanuvchi Hisobi va Xavfsizlik
                </h2>
                <p>
                  Foydalanuvchi o&apos;z hisobi ma&apos;lumotlarini (parol, 2FA maxfiy kalitlari, bir martalik zaxira kodlari) uchinchi shaxslarga bermaslik majburiyatini oladi. Hisob orqali amalga oshirilgan har qanday harakatlar uchun to&apos;liq javobgarlik hisob egasi zimmasidadir.
                </p>
              </div>

              <div>
                <h2 style={{ fontSize: "1.25rem", color: "#38bdf8", marginBottom: "0.5rem" }}>
                  4. Intellektual Mulk Huquqlari
                </h2>
                <p>
                  Platformadagi barcha matnlar, video darslar, dasturiy kodlar, test savollari va o&apos;quv dasturlari <strong>[KOMPANIYA NOMI]</strong>ning intellektual mulki hisoblanadi. Materiallarni ruxsatsiz ko&apos;chirish, tarqatish yoki sotish taqiqlanadi.
                </p>
              </div>

              <div>
                <h2 style={{ fontSize: "1.25rem", color: "#38bdf8", marginBottom: "0.5rem" }}>
                  5. Javobgarlikni Cheklash (Disclaimer)
                </h2>
                <p>
                  Platforma &quot;boricha&quot; (as-is) taqdim etiladi. Kompaniya texnik uzilishlar, aloqa provayderlari nosozliklari yoki foydalanuvchi tomonidan xavfsizlik qoidalariga rioya qilmaslik oqibatida yetkazilgan zararlar uchun javobgar emas.
                </p>
              </div>

              <div>
                <h2 style={{ fontSize: "1.25rem", color: "#38bdf8", marginBottom: "0.5rem" }}>
                  6. Bog&apos;lanish
                </h2>
                <p>
                  Savollar va murojaatlar uchun: <br />
                  Yuridik manzil: <strong>[KOMPANIYA RASMIY YURIDIK MANZILI]</strong><br />
                  Email: <strong>[SUPPORT_EMAIL, masalan: support@cyberedu.uz]</strong><br />
                  Telefon: <strong>[ALOQA TELEFON RAQAMI]</strong>
                </p>
              </div>
            </section>

            <div style={{ marginTop: "2.5rem", borderTop: "1px solid #1f2937", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <Link href="/privacy" style={{ color: "#38bdf8", textDecoration: "none", fontSize: "0.875rem" }}>
                ← Maxfiylik Siyosatini o&apos;qish
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
