/**
 * Yechim izohi:
 * Tarmoq auditi hisoboti 'network/nmap_scan.txt' faylida saqlangan.
 * Talaba terminalda 'grep "flag{" network/nmap_scan.txt' buyrug'ini bajarib,
 * 1337-portdagi xizmat banneridan olingan flagni ko'radi.
 */
import { executeTerminalCommand, extractFlagFromText, assertFlagValid } from "./solver-utils";

export async function solve(userId = "student_solver_test"): Promise<string> {
  const output = await executeTerminalCommand(
    "net-nmap-audit",
    userId,
    "grep 'flag{' network/nmap_scan.txt 2>/dev/null"
  );
  const flag = extractFlagFromText(output);
  return assertFlagValid("net-nmap-audit", flag);
}

if (require.main === module) {
  solve().then((f) => console.log("[SOLVER SUCCESS] net-nmap-audit flag:", f));
}
