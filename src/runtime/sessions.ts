import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ToolName } from "../runners/contracts";
import { runProcess } from "../utils/process";
import {
  getRuntimeDir,
  getRuntimeIndexPath,
  getSessionPath,
  getSessionsDir
} from "./paths";

export type SessionStatus = "active" | "closed";

export interface AiduoSession {
  id: string;
  agent: ToolName;
  pid: number;
  cwd: string;
  repoRoot: string;
  rawArgs: string[];
  startedAt: string;
  updatedAt: string;
  status: SessionStatus;
  pairedSessionId?: string;
  resumedFromSessionId?: string;
}

export interface RuntimeIndex {
  latestByAgent: Partial<Record<ToolName, string>>;
  activeRunBySession: Record<string, string>;
  lastRunBySession: Record<string, string>;
}

export interface RegisterSessionInput {
  agent: ToolName;
  cwd: string;
  rawArgs: string[];
  pid: number;
  resumedFromSessionId?: string;
}

const EMPTY_INDEX: RuntimeIndex = {
  latestByAgent: {},
  activeRunBySession: {},
  lastRunBySession: {}
};

function sessionId(now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `sess_${stamp}_${randomBytes(2).toString("hex")}`;
}

async function ensureRuntimeDirectories(workspaceRoot: string): Promise<void> {
  await mkdir(getRuntimeDir(workspaceRoot), { recursive: true });
  await mkdir(getSessionsDir(workspaceRoot), { recursive: true });
}

export async function detectRepoRoot(cwd: string): Promise<string> {
  try {
    const result = await runProcess("git", ["rev-parse", "--show-toplevel"], cwd);
    return result.stdout.trim() || resolve(cwd);
  } catch {
    return resolve(cwd);
  }
}

export async function loadRuntimeIndex(workspaceRoot: string): Promise<RuntimeIndex> {
  try {
    const raw = await readFile(getRuntimeIndexPath(workspaceRoot), "utf8");
    const parsed = JSON.parse(raw) as Partial<RuntimeIndex>;
    return {
      latestByAgent: parsed.latestByAgent ?? {},
      activeRunBySession: parsed.activeRunBySession ?? {},
      lastRunBySession: parsed.lastRunBySession ?? {}
    };
  } catch {
    return structuredClone(EMPTY_INDEX);
  }
}

export async function writeRuntimeIndex(workspaceRoot: string, index: RuntimeIndex): Promise<void> {
  await ensureRuntimeDirectories(workspaceRoot);
  await writeFile(getRuntimeIndexPath(workspaceRoot), `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

export async function loadSession(workspaceRoot: string, id: string): Promise<AiduoSession | undefined> {
  try {
    const raw = await readFile(getSessionPath(workspaceRoot, id), "utf8");
    return JSON.parse(raw) as AiduoSession;
  } catch {
    return undefined;
  }
}

export async function writeSession(workspaceRoot: string, session: AiduoSession): Promise<void> {
  await ensureRuntimeDirectories(workspaceRoot);
  await writeFile(getSessionPath(workspaceRoot, session.id), `${JSON.stringify(session, null, 2)}\n`, "utf8");
}

export async function registerSession(input: RegisterSessionInput): Promise<AiduoSession> {
  const repoRoot = await detectRepoRoot(input.cwd);
  await ensureRuntimeDirectories(repoRoot);

  const index = await loadRuntimeIndex(repoRoot);
  const now = new Date().toISOString();
  const session: AiduoSession = {
    id: sessionId(),
    agent: input.agent,
    pid: input.pid,
    cwd: resolve(input.cwd),
    repoRoot,
    rawArgs: input.rawArgs,
    startedAt: now,
    updatedAt: now,
    status: "active",
    resumedFromSessionId: input.resumedFromSessionId
  };

  const opposite = input.agent === "claude" ? "codex" : "claude";
  const oppositeId = index.latestByAgent[opposite];
  if (oppositeId) {
    const oppositeSession = await loadSession(repoRoot, oppositeId);
    if (oppositeSession?.status === "active" && oppositeSession.repoRoot === repoRoot) {
      session.pairedSessionId = oppositeSession.id;
      oppositeSession.pairedSessionId = session.id;
      oppositeSession.updatedAt = now;
      await writeSession(repoRoot, oppositeSession);
    }
  }

  await writeSession(repoRoot, session);
  index.latestByAgent[input.agent] = session.id;
  await writeRuntimeIndex(repoRoot, index);
  return session;
}

export async function closeSession(workspaceRoot: string, sessionIdToClose: string): Promise<void> {
  const session = await loadSession(workspaceRoot, sessionIdToClose);
  if (!session) {
    return;
  }

  session.status = "closed";
  session.updatedAt = new Date().toISOString();
  await writeSession(workspaceRoot, session);
}

export async function resolvePeerSession(
  workspaceRoot: string,
  currentSession: AiduoSession
): Promise<AiduoSession | undefined> {
  if (currentSession.pairedSessionId) {
    const paired = await loadSession(workspaceRoot, currentSession.pairedSessionId);
    if (paired?.status === "active") {
      return paired;
    }
  }

  const index = await loadRuntimeIndex(workspaceRoot);
  const opposite = currentSession.agent === "claude" ? "codex" : "claude";
  const oppositeId = index.latestByAgent[opposite];
  if (!oppositeId) {
    return undefined;
  }

  const oppositeSession = await loadSession(workspaceRoot, oppositeId);
  if (!oppositeSession || oppositeSession.status !== "active" || oppositeSession.repoRoot !== currentSession.repoRoot) {
    return undefined;
  }

  currentSession.pairedSessionId = oppositeSession.id;
  currentSession.updatedAt = new Date().toISOString();
  oppositeSession.pairedSessionId = currentSession.id;
  oppositeSession.updatedAt = currentSession.updatedAt;
  await writeSession(workspaceRoot, currentSession);
  await writeSession(workspaceRoot, oppositeSession);
  return oppositeSession;
}
