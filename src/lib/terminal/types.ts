export interface TerminalRequest {
  command: string;
  sessionId?: string;
  courseId?: number;
  currentCwd?: string;
}

export interface TerminalExecutionResult {
  stdout: string;
  stderr: string;
  cwd: string;
  exitCode: number;
  isVirtual?: boolean;
}

export interface LabFileItem {
  path: string;
  content: string;
  isExecutable?: boolean;
}

export interface SandboxSessionState {
  sessionId: string;
  userId: string;
  containerId?: string;
  courseId?: number | string;
  createdAt: number;
  lastActiveAt: number;
  cwd: string;
  driver: "docker" | "virtual";
}
