#!/usr/bin/env node
/**
 * scripts/verify-production-env.ts
 * Production muhit sirlari va parametrlarini tekshiruvchi CLI vositasi.
 */
import { validateEnvSecrets } from "../src/lib/security/env-validator";

function main() {
  const result = validateEnvSecrets();

  if (!result.valid) {
    console.error("\n❌ [KRITIK XAVFSIZLIK XATOSI] Muhit sirlari xavfsizlik talablariga mos emas:");
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    console.error("\nServer ishga tushishi bekor qilindi.\n");
    process.exit(1);
  }

  console.log("✅ [XAVFSIZLIK] Barcha muhit o'zgaruvchilari va sirlar to'liq xavfsizlik talablariga javob beradi.");
  process.exit(0);
}

main();
