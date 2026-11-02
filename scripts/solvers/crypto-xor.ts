/**
 * Yechim izohi:
 * Laboratoriya tavsifidagi Hex ma'lumot 1 baytli kalit (0x42) bilan XOR amali orqali shifrlangan.
 * Flag formati 'flag{' bilan boshlanishi ma'lum bo'lgani uchun:
 * 0x24 ^ 0x66 ('f') = 0x42 kaliti topiladi va har bir bayt 0x42 bilan XOR qilinib flag ochiladi.
 */
export async function solve(): Promise<string> {
  const hex = "242e232539213b2027301d3a2d301d3127213027361d203b36271d29273b1d76703f";
  const key = 0x42;
  const buf = Buffer.from(hex, "hex");
  const flag = Buffer.from(buf.map((b) => b ^ key)).toString("utf-8");

  if (flag !== "flag{cyber_xor_secret_byte_key_42}") {
    throw new Error(`[SOLVER ERROR] crypto-xor yechilmadi: ${flag}`);
  }
  return flag;
}

if (require.main === module) {
  solve().then((f) => console.log("[SOLVER SUCCESS] crypto-xor flag:", f));
}
