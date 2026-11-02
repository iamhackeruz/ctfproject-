/**
 * Yechim izohi:
 * Laboratoriya tavsifidagi '5ebe2294ecd0e0f08eab7690d2a6ee69' MD5 xeshi berilgan.
 * Talaba mashhur parollar lug'ati (wordlist) orqali xeshni taqqoslaydi (Dictionary Attack).
 * 'secret' so'zining MD5 xeshi nishon bilan 100% mos keladi va 'flag{secret}' olinadi.
 */
import crypto from "crypto";

export async function solve(): Promise<string> {
  const targetHash = "5ebe2294ecd0e0f08eab7690d2a6ee69";
  // Mashhur parollar lug'ati
  const commonPasswords = [
    "admin",
    "123456",
    "password",
    "secret",
    "root",
    "qwerty",
    "cyberedu",
  ];

  let foundPassword = "";
  for (const pw of commonPasswords) {
    const hash = crypto.createHash("md5").update(pw).digest("hex");
    if (hash === targetHash) {
      foundPassword = pw;
      break;
    }
  }

  if (!foundPassword) {
    throw new Error(`[SOLVER ERROR] crypto-hash-crack MD5 lug'atdan topilmadi!`);
  }

  const flag = `flag{${foundPassword}}`;
  if (flag !== "flag{secret}") {
    throw new Error(`[SOLVER ERROR] Noto'g'ri flag: ${flag}`);
  }
  return flag;
}

if (require.main === module) {
  solve().then((f) => console.log("[SOLVER SUCCESS] crypto-hash-crack flag:", f));
}
