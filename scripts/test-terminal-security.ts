import { RestrictedDockerProxy } from "../src/lib/terminal/docker-proxy";
import { VirtualTerminalDriver } from "../src/lib/terminal/virtual-terminal";
import { TerminalSessionManager } from "../src/lib/terminal/session-manager";
import { generateUserFlag, verifyUserFlag } from "../src/lib/terminal/flags";
import { signSession, verifySession, SessionUser } from "../src/lib/security/session";
import { checkRateLimit } from "../src/lib/security/rate-limiter";
import { Role } from "@prisma/client";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail = "") {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ""}`);
    failedCount++;
  }
}

async function runTests() {
  console.log("\n========================================================");
  console.log("   CYBEREDU TERMINAL XAVFSIZLIK TESTLARI (1-BOSQICH)");
  console.log("========================================================\n");

  // ─────────────────────────────────────────────────────────────
  // 1. DOCKER SANDBOX XAVFSIZLIK TESTLARI
  // ─────────────────────────────────────────────────────────────
  console.log("[1] Docker Sandbox Konteyner Xavfsizlik Testlari:");

  const isDockerOk = await RestrictedDockerProxy.isAvailable();
  assert(isDockerOk, "Docker xizmati va cyberedu-terminal-sandbox image mavjud");

  if (isDockerOk) {
    const testContainer = "cyberedu-term-test-sec01";
    const userA = "std_alice_test";
    const labFiles = TerminalSessionManager.prepareLabFiles(1, userA);

    // Konteyner yaratish
    const created = await RestrictedDockerProxy.createSandbox(testContainer, labFiles);
    assert(created, "Xavfsiz sandbox konteyner yaratildi");

    try {
      // Test 1.1: Non-root foydalanuvchi tekshiruvi
      const idRes = await RestrictedDockerProxy.execCommand(testContainer, "id");
      assert(
        idRes.stdout.includes("uid=10001(student)") && !idRes.stdout.includes("uid=0"),
        "Konteyner non-root student (UID 10001) sifatida ishlayapti"
      );

      // Test 1.2: Read-only Root Filesystem
      const roRes = await RestrictedDockerProxy.execCommand(testContainer, "touch /etc/hacked.txt");
      assert(
        roRes.stderr.includes("Read-only file system") || roRes.exitCode !== 0,
        "Root filesystem himoyalangan (Read-only, yozish bloklandi)"
      );

      // Test 1.3: docker.sock yo'qligi (Konteynerdan chiqish imkonsiz)
      const sockRes = await RestrictedDockerProxy.execCommand(testContainer, "ls -la /var/run/docker.sock");
      assert(
        sockRes.stderr.includes("No such file or directory") || sockRes.exitCode !== 0,
        "/var/run/docker.sock konteyner ichida mavjud emas"
      );

      // Test 1.4: Mount operatsiyalarini bloklash (CAP_DROP ALL)
      const mountRes = await RestrictedDockerProxy.execCommand(testContainer, "mount -o remount,rw /");
      assert(
        mountRes.stderr.includes("Permission denied") ||
          mountRes.stderr.includes("Operation not permitted") ||
          mountRes.exitCode !== 0,
        "Qayta mount qilish (mount) bloklandi (Capabilities drop)"
      );

      // Test 1.5: Host fayllariga kirish (Path Traversal / Escape)
      const hostRes = await RestrictedDockerProxy.execCommand(testContainer, "cat /home/user/porftfolio/sayt/package.json");
      assert(
        hostRes.stderr.includes("No such file or directory") || hostRes.exitCode !== 0,
        "Host fayllar tizimi butunlay yopiq (No such file)"
      );

      // Test 1.6: /etc/shadow o'qish urinishi
      const shadowRes = await RestrictedDockerProxy.execCommand(testContainer, "cat /etc/shadow");
      assert(
        shadowRes.stderr.includes("Permission denied") || shadowRes.exitCode !== 0,
        "/etc/shadow o'qish bloklandi (Permission denied)"
      );

      // Test 1.7: Tarmoq izolyatsiyasi (--network none)
      const netRes = await RestrictedDockerProxy.execCommand(
        testContainer,
        `python3 -c "import socket; socket.create_connection(('8.8.8.8', 53), timeout=1)"`
      );
      assert(
        netRes.stderr.includes("Network is unreachable") ||
          netRes.stderr.includes("timed out") ||
          netRes.exitCode !== 0,
        "Tashqi tarmoqqa chiqish bloklandi (--network none)"
      );

      // Test 1.8: Katta chiqishni (Output flood) 64KB ga cheklash
      const floodRes = await RestrictedDockerProxy.execCommand(
        testContainer,
        `python3 -c "print('A' * 100000)"`
      );
      assert(
        floodRes.stdout.length <= 66000 &&
          floodRes.stdout.includes("Chiqish hajmi 64KB dan oshgani sababli qisqartirildi"),
        "Katta chiqish (Output Flood) 64KB ga qisqartirildi"
      );

      // Test 1.9: Timeout (8s) tekshiruvi
      const timeoutRes = await RestrictedDockerProxy.execCommand(testContainer, "sleep 12", "/home/student", 3000);
      assert(
        timeoutRes.exitCode === 124 || timeoutRes.stderr.includes("Timeout"),
        "Uzoq buyruqlar belgilangan vaqtda (Timeout) to'xtatildi"
      );

      // Test 1.10: Jarayonlar limit (pids-limit 64)
      const forkRes = await RestrictedDockerProxy.execCommand(
        testContainer,
        `python3 -c "import os; [os.fork() for _ in range(70)]"`
      );
      assert(
        forkRes.stderr.includes("Resource temporarily unavailable") ||
          forkRes.stderr.includes("BlockingIOError") ||
          forkRes.exitCode !== 0,
        "Jarayonlar ko'payishi (Fork-bomb) pids-limit orqali to'xtatildi"
      );
    } finally {
      await RestrictedDockerProxy.removeSandbox(testContainer);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. FOYDALANUVCHILAR O'RTASIDAGI IZOLYATSIYA VA DINAMIK FLAG'LAR
  // ─────────────────────────────────────────────────────────────
  console.log("\n[2] Foydalanuvchilar o'rtasida izolyatsiya va Dinamik Flag Testlari:");

  const userA = "std_alice_12345678";
  const userB = "std_bob_87654321";

  const flagA = generateUserFlag(1, userA);
  const flagB = generateUserFlag(1, userB);

  assert(flagA !== flagB, "Alice va Bob bir xil kurs uchun turli xil dinamik flag oldi");
  assert(verifyUserFlag(1, userA, flagA), "Alice o'zining dinamik flag'ini muvaffaqiyatli topshirdi");
  assert(!verifyUserFlag(1, userB, flagA), "Bob Alice'ning flag'ini topshira olmaydi (Boshqa user flagi rad etildi)");

  // Container-darajasida fayllar izolyatsiyasi
  if (isDockerOk) {
    const termA = "cyberedu-term-user-a-iso";
    const termB = "cyberedu-term-user-b-iso";

    await RestrictedDockerProxy.createSandbox(termA, [{ path: "alice_secret.txt", content: "AliceSecretData" }]);
    await RestrictedDockerProxy.createSandbox(termB, [{ path: "bob_secret.txt", content: "BobSecretData" }]);

    try {
      const checkB = await RestrictedDockerProxy.execCommand(termB, "cat /home/student/alice_secret.txt");
      assert(
        checkB.stderr.includes("No such file or directory"),
        "User B konteyneri User A ning fayllarini ko'ra olmaydi (To'liq izolyatsiya)"
      );
    } finally {
      await RestrictedDockerProxy.removeSandbox(termA);
      await RestrictedDockerProxy.removeSandbox(termB);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. ZAXIRA VIRTUAL TERMINAL REJIMI TESTLARI
  // ─────────────────────────────────────────────────────────────
  console.log("\n[3] Zaxira Virtual Terminal Rejimi Testlari (Fallback Driver):");

  const vfs = new VirtualTerminalDriver([
    { path: "VAZIFA.txt", content: "Virtual VAZIFA" },
    { path: "flag.txt", content: "flag{virtual_secret_123}" },
  ]);

  const vPwd = vfs.execute("pwd");
  assert(vPwd.stdout === "/home/student", "Virtual terminal: pwd to'g'ri ishlayapti");

  const vLs = vfs.execute("ls");
  assert(vLs.stdout.includes("VAZIFA.txt") && vLs.stdout.includes("flag.txt"), "Virtual terminal: ls fayllarni ko'rsatdi");

  const vCat = vfs.execute("cat flag.txt");
  assert(vCat.stdout.includes("flag{virtual_secret_123}"), "Virtual terminal: cat fayl tarkibini o'qidi");

  const vEcho = vfs.execute("echo 'salom dunyo' > mytest.txt");
  assert(vEcho.exitCode === 0, "Virtual terminal: faylga yozish (echo >) ishladi");

  const vCatTest = vfs.execute("cat mytest.txt");
  assert(vCatTest.stdout.includes("salom dunyo"), "Virtual terminal: yozilgan fayl muvaffaqiyatli o'qildi");

  const vB64 = vfs.execute("base64 mytest.txt");
  assert(vB64.exitCode === 0 && vB64.stdout.length > 0, "Virtual terminal: base64 kodlash ishladi");

  // Virtual Sandbox escape tekshiruvi
  const vEscape = vfs.execute("cd ../../../../../etc");
  assert(vEscape.cwd === "/home/student", "Virtual terminal: sandboxdan chiqish (cd ../../../) bloklandi");

  const vCatEsc = vfs.execute("cat /etc/passwd");
  assert(vCatEsc.exitCode !== 0, "Virtual terminal: /etc/passwd o'qish bloklandi");

  // ─────────────────────────────────────────────────────────────
  // 4. SESSIYA VA RATE LIMIT XAVFSIZLIK TESTLARI
  // ─────────────────────────────────────────────────────────────
  console.log("\n[4] Sessiya va Rate Limit Testlari:");

  const mockUser: SessionUser = {
    userId: "std_session_test_01",
    role: Role.student,
    email: "test@cyberedu.uz",
    name: "Test Talaba",
    createdAt: Date.now(),
  };

  const token = signSession(mockUser);
  const verified = verifySession(token);
  assert(verified !== null && verified.userId === mockUser.userId, "Sessiya imzolanishi va tekshiruvi muvaffaqiyatli");

  // Soxtalashtirilgan sessiya tekshiruvi
  const tamperedToken = token.slice(0, -4) + "abcd";
  const verifiedTampered = verifySession(tamperedToken);
  assert(verifiedTampered === null, "Soxtalashtirilgan (tampered) sessiya tokeni rad etildi");

  // Rate Limiting tekshiruvi
  const testIp = "192.168.1.99";
  for (let i = 0; i < 30; i++) {
    checkRateLimit(`test_${testIp}`, 30, 60000);
  }
  const overLimitCheck = checkRateLimit(`test_${testIp}`, 30, 60000);
  assert(!overLimitCheck.allowed, "30 tadan ortiq so'rov yuborilganda Rate Limit (429) to'g'ri ishladi");

  // ─────────────────────────────────────────────────────────────
  // NATIJALAR
  // ─────────────────────────────────────────────────────────────
  console.log("\n========================================================");
  console.log(`Testlar yakunlandi: ${passedCount} o'tdi, ${failedCount} xato.`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Testda kutilmagan xatolik:", err);
  process.exit(1);
});
