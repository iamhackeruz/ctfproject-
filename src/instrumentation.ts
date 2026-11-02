/**
 * Next.js Instrumentation: Server ishga tushganda bajariladigan xavfsizlik va sozlamalar tekshiruvi.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnvSecrets } = await import("./lib/security/env-validator");
    assertEnvSecrets();
  }
}
