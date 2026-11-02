/**
 * Yechim izohi:
 * Tizimga kirish loglarida (`logs/auth.log`) qoldirilgan xavfsizlik izlari tahlil qilinadi.
 * Talaba terminalda 'grep "flag{" logs/auth.log' buyrug'ini berib,
 * muvaffaqiyatli kirish qaydlaridagi session_note ichidan flagni chiqaradi.
 */
import { executeTerminalCommand, extractFlagFromText, assertFlagValid } from "./solver-utils";

export async function solve(userId = "student_solver_test"): Promise<string> {
  const output = await executeTerminalCommand(
    "linux-log-analysis",
    userId,
    "grep 'flag{' logs/auth.log 2>/dev/null || grep -rn 'flag{' logs/"
  );
  const flag = extractFlagFromText(output);
  return assertFlagValid("linux-log-analysis", flag);
}

if (require.main === module) {
  solve().then((f) => console.log("[SOLVER SUCCESS] linux-log-analysis flag:", f));
}
