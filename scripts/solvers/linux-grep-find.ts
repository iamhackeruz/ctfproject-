/**
 * Yechim izohi:
 * Ko'p sonli log fayllar ichidan kerakli ma'lumotni filtrlash uchun grep ishlatiladi.
 * Talaba terminalda 'grep -rn "flag{" ./' buyrug'i orqali barcha fayllarni rekursiv qidirib,
 * flag qatorini terminaldan oladi.
 */
import { executeTerminalCommand, extractFlagFromText, assertFlagValid } from "./solver-utils";

export async function solve(userId = "student_solver_test"): Promise<string> {
  const output = await executeTerminalCommand(
    "linux-grep-find",
    userId,
    "grep -rn 'flag{' ./ 2>/dev/null"
  );
  const flag = extractFlagFromText(output);
  return assertFlagValid("linux-grep-find", flag);
}

if (require.main === module) {
  solve().then((f) => console.log("[SOLVER SUCCESS] linux-grep-find flag:", f));
}
