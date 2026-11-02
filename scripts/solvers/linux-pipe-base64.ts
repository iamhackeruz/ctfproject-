/**
 * Yechim izohi:
 * Fayldagi ma'lumot Base64 ko'rinishida kodlangan.
 * Talaba Linux quvuri (|) orqali 'cat encoded_data.txt | base64 -d' buyrug'ini ishlatadi
 * va ochilgan flagni terminal ekranidan oladi.
 */
import { executeTerminalCommand, extractFlagFromText, assertFlagValid } from "./solver-utils";

export async function solve(userId = "student_solver_test"): Promise<string> {
  const output = await executeTerminalCommand(
    "linux-pipe-base64",
    userId,
    "cat encoded_data.txt 2>/dev/null | base64 -d"
  );
  const flag = extractFlagFromText(output);
  return assertFlagValid("linux-pipe-base64", flag);
}

if (require.main === module) {
  solve().then((f) => console.log("[SOLVER SUCCESS] linux-pipe-base64 flag:", f));
}
