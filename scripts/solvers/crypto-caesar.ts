/**
 * Yechim izohi:
 * Laboratoriya tavsifida berilgan shifrmatn Sezar (ROT13) algoritmi orqali shifrlangan.
 * Alifbodagi har bir harf 13 qadam orqaga suriladi ((code - base + 13) % 26).
 * Talaba CyberChef yoki oddiy skript orqali shifrdan chiqarilgan flag{...} ni oladi.
 */
export async function solve(): Promise<string> {
  const cipher = "synt{plore_pnrfne_ebg13_qrpelcgvba_fhpprff}";
  // ROT13 algoritmi
  const flag = cipher.replace(/[a-zA-Z]/g, (c) => {
    const code = c.charCodeAt(0);
    const base = code >= 97 ? 97 : 65;
    return String.fromCharCode(((code - base + 13) % 26) + base);
  });

  if (flag !== "flag{cyber_caesar_rot13_decryption_success}") {
    throw new Error(`[SOLVER ERROR] crypto-caesar yechilmadi: ${flag}`);
  }
  return flag;
}

if (require.main === module) {
  solve().then((f) => console.log("[SOLVER SUCCESS] crypto-caesar flag:", f));
}
