import { solve as solveLinux1 } from "./solvers/linux-permissions";
import { solve as solveLinux2 } from "./solvers/linux-hidden-files";
import { solve as solveLinux3 } from "./solvers/linux-grep-find";
import { solve as solveLinux4 } from "./solvers/linux-log-analysis";
import { solve as solveLinux5 } from "./solvers/linux-pipe-base64";

import { solve as solveCrypto1 } from "./solvers/crypto-caesar";
import { solve as solveCrypto2 } from "./solvers/crypto-base64-hex";
import { solve as solveCrypto3 } from "./solvers/crypto-xor";
import { solve as solveCrypto4 } from "./solvers/crypto-hash-crack";

import { solve as solveWeb1 } from "./solvers/web-xss";
import { solve as solveWeb2 } from "./solvers/web-sqli";
import { solve as solveWeb3 } from "./solvers/web-idor";
import { solve as solveWeb4 } from "./solvers/web-exposed-files";

import { solve as solveNet1 } from "./solvers/net-nmap-audit";
import { solve as solveNet2 } from "./solvers/net-pcap-analysis";

export async function runAllSolvers(testUserId = "student_automated_solver_run") {
  console.log("\n========================================================");
  console.log("   CYBEREDU 15 TA LABORATORIYA SOLVER TEKSHIRUVI");
  console.log("========================================================\n");

  const labs = [
    { id: "linux-permissions", runner: () => solveLinux1(testUserId) },
    { id: "linux-hidden-files", runner: () => solveLinux2(testUserId) },
    { id: "linux-grep-find", runner: () => solveLinux3(testUserId) },
    { id: "linux-log-analysis", runner: () => solveLinux4(testUserId) },
    { id: "linux-pipe-base64", runner: () => solveLinux5(testUserId) },

    { id: "crypto-caesar", runner: () => solveCrypto1() },
    { id: "crypto-base64-hex", runner: () => solveCrypto2() },
    { id: "crypto-xor", runner: () => solveCrypto3() },
    { id: "crypto-hash-crack", runner: () => solveCrypto4() },

    { id: "web-xss", runner: () => solveWeb1({ userId: testUserId }) },
    { id: "web-sqli", runner: () => solveWeb2({ userId: testUserId }) },
    { id: "web-idor", runner: () => solveWeb3({ userId: testUserId }) },
    { id: "web-exposed-files", runner: () => solveWeb4({ userId: testUserId }) },

    { id: "net-nmap-audit", runner: () => solveNet1(testUserId) },
    { id: "net-pcap-analysis", runner: () => solveNet2(testUserId) },
  ];

  let passed = 0;
  for (const lab of labs) {
    try {
      const flag = await lab.runner();
      if (!flag || !flag.startsWith("flag{")) {
        throw new Error(`Noto'g'ri flag formati: ${flag}`);
      }
      console.log(`  ✅ [SOLVED] ${lab.id.padEnd(22)} => ${flag}`);
      passed++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ [FAILED] ${lab.id}: ${msg}`);
      throw new Error(`Lab ${lab.id} yechilmadi: ${msg}`);
    }
  }

  console.log(`\n========================================================`);
  console.log(`Barcha 15 ta laboratoriya muvaffaqiyatli yechildi (${passed}/15).`);
  console.log(`========================================================\n`);
  return true;
}

if (require.main === module) {
  runAllSolvers()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
