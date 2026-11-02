/**
 * Yechim izohi:
 * Nuqta (.) bilan boshlanuvchi fayllar Linux tizimida yashirin hisoblanadi.
 * Talaba terminalda 'find . -name "*flag*"' yoki 'cat .secret_vault/hidden_flag.txt' buyrug'ini berib,
 * yashirin flagni ekranga chiqaradi.
 */
import { executeTerminalCommand, extractFlagFromText, assertFlagValid } from "./solver-utils";

export async function solve(userId = "student_solver_test"): Promise<string> {
  const output = await executeTerminalCommand(
    "linux-hidden-files",
    userId,
    "cat .secret_vault/hidden_flag.txt 2>/dev/null || find . -name '*flag*' -exec cat {} +"
  );
  const flag = extractFlagFromText(output);
  return assertFlagValid("linux-hidden-files", flag);
}

if (require.main === module) {
  solve().then((f) => console.log("[SOLVER SUCCESS] linux-hidden-files flag:", f));
}
