/**
 * Yechim izohi:
 * Laboratoriya tavsifida berilgan ma'lumot ikki qatlamli:
 * 1-qadam: Base64 satri dekodlanadi va natijada Hex (16-lik) qatori hosil bo'ladi.
 * 2-qadam: Olingan Hex qatoridan ASCII matn o'giriladi va flag{...} hosil bo'ladi.
 */
export async function solve(): Promise<string> {
  const b64 = "NjY2YzYxNjc3YjYzNzk2MjY1NzI1ZjY4NjU3ODVmMzIzNjM0MzkzMDM3MzMzNDM1MzQzNzdk";
  const hex = Buffer.from(b64, "base64").toString("utf-8");
  const flag = Buffer.from(hex, "hex").toString("utf-8");

  if (flag !== "flag{cyber_hex_26490734547}") {
    throw new Error(`[SOLVER ERROR] crypto-base64-hex yechilmadi: ${flag}`);
  }
  return flag;
}

if (require.main === module) {
  solve().then((f) => console.log("[SOLVER SUCCESS] crypto-base64-hex flag:", f));
}
