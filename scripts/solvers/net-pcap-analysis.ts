/**
 * Yechim izohi:
 * Tarmoq trafigi ushlanmasi 'network/capture_traffic.log' faylida ochiq matnda saqlangan.
 * Talaba terminalda 'grep "flag{" network/capture_traffic.log' buyrug'ini bajarib,
 * HTTP so'rov tanasidagi flagni oladi.
 */
import { executeTerminalCommand, extractFlagFromText, assertFlagValid } from "./solver-utils";

export async function solve(userId = "student_solver_test"): Promise<string> {
  const output = await executeTerminalCommand(
    "net-pcap-analysis",
    userId,
    "grep 'flag{' network/capture_traffic.log 2>/dev/null"
  );
  const flag = extractFlagFromText(output);
  return assertFlagValid("net-pcap-analysis", flag);
}

if (require.main === module) {
  solve().then((f) => console.log("[SOLVER SUCCESS] net-pcap-analysis flag:", f));
}
