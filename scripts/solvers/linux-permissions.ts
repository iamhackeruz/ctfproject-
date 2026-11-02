/**
 * Yechim izohi:
 * Fayl ruxsat huquqlari (600) boshqa foydalanuvchilar o'qishini cheklaydi.
 * Talaba terminalda 'chmod 644 secret_data/confidential.txt' orqali o'qish huquqini ochadi
 * va 'cat' yordamida flagni terminal ekraniga chiqaradi.
 */
import { executeTerminalCommand, extractFlagFromText, assertFlagValid } from "./solver-utils";

export async function solve(userId = "student_solver_test"): Promise<string> {
  const output = await executeTerminalCommand(
    "linux-permissions",
    userId,
    "chmod 644 secret_data/confidential.txt && cat secret_data/confidential.txt"
  );
  const flag = extractFlagFromText(output);
  return assertFlagValid("linux-permissions", flag);
}

if (require.main === module) {
  solve().then((f) => console.log("[SOLVER SUCCESS] linux-permissions flag:", f));
}
