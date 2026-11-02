"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./CyberTerminal.module.css";
import { getLabConfigForCourse } from "@/data/labEnvironments";

interface TerminalEntry {
  id: string;
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
}

interface CyberTerminalProps {
  sessionId?: string;
  courseId?: number;
  labSlug?: string;
  initialMessage?: string;
}

const DEFAULT_COMMANDS = [
  "help",
  "ls -la",
  "pwd",
  "cat VAZIFA.txt",
  "cat flag.txt",
  "whoami",
  "clear",
];

export default function CyberTerminal({
  sessionId = "default-sandbox",
  courseId,
  labSlug,
  initialMessage,
}: CyberTerminalProps) {
  const labConfig = courseId ? getLabConfigForCourse(courseId) : null;
  const effectiveInitialMessage =
    initialMessage ||
    labConfig?.welcomeMessage ||
    "CyberEdu Linux v6.5.0-kali (x86_64) — Haqiqiy Linux terminal muhiti faol.\nBuyruqlar ro'yxatini ko'rish uchun 'help' deb yozing.";

  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [cwd, setCwd] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const terminalBodyRef = useRef<HTMLDivElement>(null);

  // Focus input when clicking anywhere inside terminal body
  const handleBodyClick = () => {
    inputRef.current?.focus();
  };

  // Scroll to bottom on new output
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [entries, isLoading]);

  const executeCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    if (trimmed === "clear") {
      setEntries([]);
      setInputVal("");
      setHistoryIndex(-1);
      return;
    }

    // Add to history
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);
    setInputVal("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: trimmed,
          sessionId: sessionId || (labSlug ? `lab-${labSlug}` : courseId ? `course-${courseId}` : "default"),
          courseId,
          labSlug,
          currentCwd: cwd,
        }),
      });

      const data = await res.json();
      if (data.cwd) {
        setCwd(data.cwd);
      }

      setEntries((prev) => [
        ...prev,
        {
          id: "entry-" + Date.now() + Math.random(),
          command: trimmed,
          cwd: cwd || "~",
          stdout: data.stdout || "",
          stderr: data.stderr || "",
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Tarmoq xatoligi";
      setEntries((prev) => [
        ...prev,
        {
          id: "entry-" + Date.now(),
          command: trimmed,
          cwd: cwd || "~",
          stdout: "",
          stderr: `Xatolik: Server bilan aloqa yo'qoldi (${msg})`,
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeCommand(inputVal);
  };

  // Keyboard navigation for history (Up/Down) & Tab autocomplete
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setInputVal(history[nextIdx] || "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx >= history.length) {
        setHistoryIndex(-1);
        setInputVal("");
      } else {
        setHistoryIndex(nextIdx);
        setInputVal(history[nextIdx] || "");
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const current = inputVal.trim();
      const match = DEFAULT_COMMANDS.find((c) => c.startsWith(current));
      if (match) {
        setInputVal(match);
      }
    }
  };

  const getDisplayPath = (fullPath: string) => {
    if (!fullPath) return "~";
    const parts = fullPath.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last ? `~/${last}` : "~";
  };

  // Get course-tailored quick buttons
  const getQuickButtons = () => {
    if (courseId === 3) {
      return [
        { label: "cat VAZIFA.txt", cmd: "cat VAZIFA.txt" },
        { label: "find .", cmd: "find ." },
        { label: "find . -name '*.txt'", cmd: "find . -name '*.txt'" },
        { label: "find . -name '.*'", cmd: "find . -name '.*'" },
        { label: "grep -rn 'PASSWORD' .", cmd: "grep -rn 'PASSWORD' ." },
        { label: "chmod +x", cmd: "chmod +x scripts/system_backup.sh && ./scripts/system_backup.sh" },
        { label: "clear", cmd: "clear" },
      ];
    }
    if (courseId === 2) {
      return [
        { label: "cat VAZIFA.txt", cmd: "cat VAZIFA.txt" },
        { label: "cat packets_dump.log", cmd: "cat packets_dump.log" },
        { label: "cat routing_table.conf", cmd: "cat routing_table.conf" },
        { label: "cat flag.txt", cmd: "cat flag.txt" },
        { label: "clear", cmd: "clear" },
      ];
    }
    if (courseId === 6) {
      return [
        { label: "cat VAZIFA.txt", cmd: "cat VAZIFA.txt" },
        { label: "python3 sql_injection_lab.py", cmd: "python3 sql_injection_lab.py" },
        { label: "cat users_dump.sql", cmd: "cat users_dump.sql" },
        { label: "cat flag.txt", cmd: "cat flag.txt" },
        { label: "clear", cmd: "clear" },
      ];
    }
    return [
      { label: "help", cmd: "help" },
      { label: "ls -la", cmd: "ls -la" },
      { label: "cat VAZIFA.txt", cmd: "cat VAZIFA.txt" },
      { label: "cat flag.txt", cmd: "cat flag.txt" },
      { label: "python3 audit.py", cmd: "python3 audit.py" },
      { label: "clear", cmd: "clear" },
    ];
  };

  const quickButtons = getQuickButtons();

  return (
    <div className={`${styles.terminalContainer} ${isFullscreen ? styles.fullscreen : ""}`}>
      {/* Top Header Bar */}
      <div className={styles.terminalTop}>
        <div className={styles.terminalDots}>
          <div className={`${styles.dot} ${styles.dotRed}`} />
          <div className={`${styles.dot} ${styles.dotYellow}`} />
          <div className={`${styles.dot} ${styles.dotGreen}`} />
          <span className={styles.terminalTitle}>
            <span>🐧</span>
            <span>root@cyberedu-sandbox: {getDisplayPath(cwd)}</span>
          </span>
        </div>

        {/* Quick click commands for convenience */}
        <div className={styles.quickActions}>
          {quickButtons.map((btn, idx) => (
            <button
              key={idx}
              type="button"
              className={styles.quickBtn}
              onClick={() => executeCommand(btn.cmd)}
            >
              {btn.label}
            </button>
          ))}
          <button
            type="button"
            className={styles.quickBtn}
            onClick={() => setIsFullscreen(!isFullscreen)}
            title="Kattalashtirish"
          >
            {isFullscreen ? "✕ Chiqish" : "⛶ Ekran"}
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div className={styles.terminalBody} ref={terminalBodyRef} onClick={handleBodyClick}>
        {/* Welcome message */}
        <div style={{ color: "#94a3b8", marginBottom: 12, fontSize: "0.82rem", whiteSpace: "pre-line" }}>
          {effectiveInitialMessage}
        </div>

        {/* History entries */}
        {entries.map((entry) => (
          <div key={entry.id} style={{ marginBottom: 10 }}>
            <div className={styles.commandEcho}>
              <span className={styles.promptUser}>root@cyberedu</span>
              <span>:</span>
              <span className={styles.promptPath}>{getDisplayPath(entry.cwd)}</span>
              <span>#</span>
              <span>{entry.command}</span>
            </div>
            {entry.stdout && <div className={styles.outputLine}>{entry.stdout}</div>}
            {entry.stderr && (
              <div className={`${styles.outputLine} ${styles.errorText}`}>{entry.stderr}</div>
            )}
          </div>
        ))}

        {/* Active prompt line */}
        <form onSubmit={handleSubmit} className={styles.activePrompt}>
          <span className={styles.promptUser}>root@cyberedu</span>
          <span>:</span>
          <span className={styles.promptPath}>{getDisplayPath(cwd)}</span>
          <span>#</span>
          <input
            ref={inputRef}
            type="text"
            className={styles.inputField}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? "Bajarilmoqda..." : "Buyruq kiriting..."}
            disabled={isLoading}
            autoFocus
          />
          {isLoading && <span className={styles.loadingSpinner} />}
        </form>
      </div>
    </div>
  );
}
