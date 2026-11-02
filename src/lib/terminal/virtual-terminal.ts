import { LabFileItem, TerminalExecutionResult } from "./types";

interface VFSNode {
  type: "file" | "dir";
  name: string;
  content: string;
  children: Map<string, VFSNode>;
}

export class VirtualTerminalDriver {
  private root: VFSNode;
  private cwd: string;

  constructor(files: LabFileItem[] = []) {
    this.root = {
      type: "dir",
      name: "/",
      content: "",
      children: new Map(),
    };

    // /home va /home/student yaratish
    const homeNode: VFSNode = {
      type: "dir",
      name: "home",
      content: "",
      children: new Map(),
    };
    const studentNode: VFSNode = {
      type: "dir",
      name: "student",
      content: "",
      children: new Map(),
    };
    homeNode.children.set("student", studentNode);
    this.root.children.set("home", homeNode);

    this.cwd = "/home/student";

    // Standart va lab fayllarini joylashtirish
    for (const f of files) {
      this.writeFile(f.path, f.content);
    }

    if (!this.resolvePath("/home/student/flag.txt")) {
      this.writeFile("flag.txt", "flag{cyber_virtual_sandbox_master_2026}\n");
    }
  }

  private normalizePath(targetPath: string): string {
    const resolved = targetPath.startsWith("/")
      ? targetPath
      : `${this.cwd}/${targetPath}`;

    const parts = resolved.split("/").filter(Boolean);
    const stack: string[] = [];

    for (const p of parts) {
      if (p === ".") continue;
      if (p === "..") {
        if (stack.length > 0) stack.pop();
      } else {
        stack.push(p);
      }
    }

    const res = "/" + stack.join("/");
    // Qat'iy sandbox: /home/student dan tashqariga chiqish taqiqlanadi
    if (!res.startsWith("/home/student")) {
      return "/home/student";
    }
    return res;
  }

  private resolvePath(normPath: string): VFSNode | null {
    const parts = normPath.split("/").filter(Boolean);
    let curr = this.root;

    for (const part of parts) {
      if (curr.type !== "dir") return null;
      const next = curr.children.get(part);
      if (!next) return null;
      curr = next;
    }
    return curr;
  }

  public writeFile(relOrAbsPath: string, content: string): void {
    const norm = this.normalizePath(relOrAbsPath);
    const parts = norm.split("/").filter(Boolean);
    const filename = parts.pop();
    if (!filename) return;

    let curr = this.root;
    for (const part of parts) {
      let next = curr.children.get(part);
      if (!next) {
        next = { type: "dir", name: part, content: "", children: new Map() };
        curr.children.set(part, next);
      }
      curr = next;
    }

    curr.children.set(filename, {
      type: "file",
      name: filename,
      content,
      children: new Map(),
    });
  }

  public execute(cmdStr: string): TerminalExecutionResult {
    const trimmed = cmdStr.trim();
    if (!trimmed) {
      return { stdout: "", stderr: "", cwd: this.cwd, exitCode: 0, isVirtual: true };
    }

    const tokens = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const cleanTokens = tokens.map((t) => t.replace(/^['"]|['"]$/g, ""));
    const cmd = cleanTokens[0];
    const args = cleanTokens.slice(1);

    switch (cmd) {
      case "pwd":
        return { stdout: this.cwd, stderr: "", cwd: this.cwd, exitCode: 0, isVirtual: true };

      case "cd": {
        const target = args[0] || "/home/student";
        const norm = this.normalizePath(target);
        const node = this.resolvePath(norm);

        if (!node) {
          return {
            stdout: "",
            stderr: `bash: cd: ${target}: No such file or directory`,
            cwd: this.cwd,
            exitCode: 1,
            isVirtual: true,
          };
        }
        if (node.type !== "dir") {
          return {
            stdout: "",
            stderr: `bash: cd: ${target}: Not a directory`,
            cwd: this.cwd,
            exitCode: 1,
            isVirtual: true,
          };
        }
        this.cwd = norm;
        return { stdout: "", stderr: "", cwd: this.cwd, exitCode: 0, isVirtual: true };
      }

      case "ls": {
        const showAll = args.includes("-a") || args.includes("-la") || args.includes("-al");
        const showLong = args.includes("-l") || args.includes("-la") || args.includes("-al");
        const pathArg = args.find((a) => !a.startsWith("-")) || ".";
        const norm = this.normalizePath(pathArg);
        const node = this.resolvePath(norm);

        if (!node) {
          return {
            stdout: "",
            stderr: `ls: cannot access '${pathArg}': No such file or directory`,
            cwd: this.cwd,
            exitCode: 2,
            isVirtual: true,
          };
        }

        if (node.type === "file") {
          return { stdout: node.name, stderr: "", cwd: this.cwd, exitCode: 0, isVirtual: true };
        }

        const entries: string[] = [];
        if (showAll) {
          entries.push(".");
          entries.push("..");
        }

        for (const [name, child] of node.children.entries()) {
          if (!showAll && name.startsWith(".")) continue;
          if (showLong) {
            const prefix = child.type === "dir" ? "drwxr-xr-x" : "-rw-r--r--";
            const size = child.type === "dir" ? "4096" : child.content.length.toString();
            entries.push(`${prefix} 1 student student ${size.padStart(6, " ")} Nov  1 12:00 ${name}`);
          } else {
            entries.push(name);
          }
        }

        return {
          stdout: entries.join(showLong ? "\n" : "  "),
          stderr: "",
          cwd: this.cwd,
          exitCode: 0,
          isVirtual: true,
        };
      }

      case "cat": {
        if (args.length === 0) {
          return { stdout: "", stderr: "cat: fayl ko'rsatilmadi", cwd: this.cwd, exitCode: 1, isVirtual: true };
        }
        let out = "";
        for (const arg of args) {
          const norm = this.normalizePath(arg);
          const node = this.resolvePath(norm);
          if (!node) {
            return {
              stdout: "",
              stderr: `cat: ${arg}: No such file or directory`,
              cwd: this.cwd,
              exitCode: 1,
              isVirtual: true,
            };
          }
          if (node.type === "dir") {
            return {
              stdout: "",
              stderr: `cat: ${arg}: Is a directory`,
              cwd: this.cwd,
              exitCode: 1,
              isVirtual: true,
            };
          }
          out += node.content;
        }
        return { stdout: out.trimEnd(), stderr: "", cwd: this.cwd, exitCode: 0, isVirtual: true };
      }

      case "echo": {
        // Redirection tekshirish (>)
        const redirIndex = args.indexOf(">");
        const appendIndex = args.indexOf(">>");

        if (redirIndex !== -1 || appendIndex !== -1) {
          const isAppend = appendIndex !== -1;
          const splitIdx = isAppend ? appendIndex : redirIndex;
          const text = args.slice(0, splitIdx).join(" ");
          const destFile = args[splitIdx + 1];

          if (!destFile) {
            return { stdout: "", stderr: "bash: syntax error near unexpected token 'newline'", cwd: this.cwd, exitCode: 2, isVirtual: true };
          }

          const norm = this.normalizePath(destFile);
          const existing = this.resolvePath(norm);
          const newContent = isAppend && existing ? existing.content + text + "\n" : text + "\n";
          this.writeFile(destFile, newContent);
          return { stdout: "", stderr: "", cwd: this.cwd, exitCode: 0, isVirtual: true };
        }

        return { stdout: args.join(" "), stderr: "", cwd: this.cwd, exitCode: 0, isVirtual: true };
      }

      case "mkdir": {
        const target = args.find((a) => !a.startsWith("-"));
        if (!target) {
          return { stdout: "", stderr: "mkdir: missing operand", cwd: this.cwd, exitCode: 1, isVirtual: true };
        }
        const norm = this.normalizePath(target);
        if (this.resolvePath(norm)) {
          return { stdout: "", stderr: `mkdir: cannot create directory '${target}': File exists`, cwd: this.cwd, exitCode: 1, isVirtual: true };
        }
        const parts = norm.split("/").filter(Boolean);
        const newDirName = parts.pop()!;
        const parentPath = "/" + parts.join("/");
        const parent = this.resolvePath(parentPath);
        if (!parent || parent.type !== "dir") {
          return { stdout: "", stderr: `mkdir: cannot create directory '${target}': No such file or directory`, cwd: this.cwd, exitCode: 1, isVirtual: true };
        }
        parent.children.set(newDirName, { type: "dir", name: newDirName, content: "", children: new Map() });
        return { stdout: "", stderr: "", cwd: this.cwd, exitCode: 0, isVirtual: true };
      }

      case "touch": {
        const target = args[0];
        if (!target) {
          return { stdout: "", stderr: "touch: missing file operand", cwd: this.cwd, exitCode: 1, isVirtual: true };
        }
        const norm = this.normalizePath(target);
        if (!this.resolvePath(norm)) {
          this.writeFile(target, "");
        }
        return { stdout: "", stderr: "", cwd: this.cwd, exitCode: 0, isVirtual: true };
      }

      case "rm": {
        const target = args.find((a) => !a.startsWith("-"));
        if (!target) {
          return { stdout: "", stderr: "rm: missing operand", cwd: this.cwd, exitCode: 1, isVirtual: true };
        }
        const norm = this.normalizePath(target);
        const parts = norm.split("/").filter(Boolean);
        const filename = parts.pop();
        if (!filename) {
          return { stdout: "", stderr: "rm: cannot remove '/'", cwd: this.cwd, exitCode: 1, isVirtual: true };
        }
        const parent = this.resolvePath("/" + parts.join("/"));
        if (!parent || !parent.children.has(filename)) {
          return { stdout: "", stderr: `rm: cannot remove '${target}': No such file or directory`, cwd: this.cwd, exitCode: 1, isVirtual: true };
        }
        parent.children.delete(filename);
        return { stdout: "", stderr: "", cwd: this.cwd, exitCode: 0, isVirtual: true };
      }

      case "whoami":
        return { stdout: "student", stderr: "", cwd: this.cwd, exitCode: 0, isVirtual: true };

      case "uname":
        return {
          stdout: args.includes("-a")
            ? "Linux cyberedu-virtual-sandbox 6.5.0-virtual #1 PREEMPT x86_64 GNU/Linux"
            : "Linux",
          stderr: "",
          cwd: this.cwd,
          exitCode: 0,
          isVirtual: true,
        };

      case "base64": {
        const isDecode = args.includes("-d");
        const fileOrStr = args.find((a) => !a.startsWith("-"));
        if (!fileOrStr) {
          return { stdout: "", stderr: "base64: kiritish berilmadi", cwd: this.cwd, exitCode: 1, isVirtual: true };
        }
        const node = this.resolvePath(this.normalizePath(fileOrStr));
        const raw = node && node.type === "file" ? node.content : fileOrStr;

        if (isDecode) {
          try {
            const dec = Buffer.from(raw.trim(), "base64").toString("utf-8");
            return { stdout: dec, stderr: "", cwd: this.cwd, exitCode: 0, isVirtual: true };
          } catch {
            return { stdout: "", stderr: "base64: invalid input", cwd: this.cwd, exitCode: 1, isVirtual: true };
          }
        } else {
          const enc = Buffer.from(raw).toString("base64");
          return { stdout: enc, stderr: "", cwd: this.cwd, exitCode: 0, isVirtual: true };
        }
      }

      case "grep": {
        const pattern = args[0];
        const file = args[1];
        if (!pattern || !file) {
          return { stdout: "", stderr: "grep: usage: grep <pattern> <file>", cwd: this.cwd, exitCode: 1, isVirtual: true };
        }
        const node = this.resolvePath(this.normalizePath(file));
        if (!node || node.type !== "file") {
          return { stdout: "", stderr: `grep: ${file}: No such file or directory`, cwd: this.cwd, exitCode: 2, isVirtual: true };
        }
        const lines = node.content.split("\n");
        const matched = lines.filter((l) => l.includes(pattern));
        return { stdout: matched.join("\n"), stderr: "", cwd: this.cwd, exitCode: matched.length > 0 ? 0 : 1, isVirtual: true };
      }

      case "help": {
        const helpText = `CyberEdu Virtual Terminal [Zaxira xavfsiz rejim]
Mavjud buyruqlar:
  ls [-la]             - Joriy katalogdagi fayllar
  cd <katalog>         - Boshqa katalogga o'tish
  pwd                  - Joriy manzil
  cat <fayl>           - Fayl tarkibini ko'rish
  touch <nom>          - Yangi bo'sh fayl
  mkdir <nom>          - Yangi katalog
  rm <fayl>            - Faylni o'chirish
  echo "matn" [> fayl] - Chiqarish yoki faylga yozish
  base64 [-d] <matn>   - Base64 shifrlash / dekodlash
  grep <naqsh> <fayl>  - Matn qidirish
  whoami               - Foydalanuvchi nomi
  uname -a             - Tizim ma'lumotlari
  help, clear          - Yordam va ekranni tozalash`;
        return { stdout: helpText, stderr: "", cwd: this.cwd, exitCode: 0, isVirtual: true };
      }

      default:
        return {
          stdout: "",
          stderr: `bash: ${cmd}: command not found. 'help' deb yozing.`,
          cwd: this.cwd,
          exitCode: 127,
          isVirtual: true,
        };
    }
  }
}
