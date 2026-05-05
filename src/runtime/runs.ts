import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RunArtifacts } from "../artifacts";
import type { RuntimeIndex } from "./sessions";
import { loadRuntimeIndex, writeRuntimeIndex } from "./sessions";
import { getRunsDir, getRuntimeRunPath } from "./paths";

export type AiduoRuntimeRunStatus = "running" | "completed" | "failed" | "cancelled";
export type AiduoContextMode = "last-message" | "diff" | "all";

export interface AiduoRuntimeRun {
  runId: string;
  sessionId: string;
  peerSessionId?: string;
  commandName: string;
  flags: Record<string, string | number | boolean>;
  contextMode: AiduoContextMode;
  status: AiduoRuntimeRunStatus;
  createdAt: string;
  updatedAt: string;
  workspaceRoot: string;
  artifactPaths: {
    runDir: string;
    summaryPath: string;
    latestPath: string;
    sourceContextPath: string;
    dispatchedPromptPath: string;
    responsePath: string;
  };
  retryOfRunId?: string;
  errorMessage?: string;
}

async function ensureRunDirectory(workspaceRoot: string): Promise<void> {
  await mkdir(getRunsDir(workspaceRoot), { recursive: true });
}

async function writeIndexMutation(
  workspaceRoot: string,
  mutate: (index: RuntimeIndex) => void
): Promise<void> {
  const index = await loadRuntimeIndex(workspaceRoot);
  mutate(index);
  await writeRuntimeIndex(workspaceRoot, index);
}

export async function writeRuntimeRun(workspaceRoot: string, run: AiduoRuntimeRun): Promise<void> {
  await ensureRunDirectory(workspaceRoot);
  await writeFile(getRuntimeRunPath(workspaceRoot, run.runId), `${JSON.stringify(run, null, 2)}\n`, "utf8");
}

export async function createRuntimeRun(
  workspaceRoot: string,
  input: Omit<AiduoRuntimeRun, "createdAt" | "updatedAt" | "workspaceRoot">
): Promise<AiduoRuntimeRun> {
  const now = new Date().toISOString();
  const run: AiduoRuntimeRun = {
    ...input,
    createdAt: now,
    updatedAt: now,
    workspaceRoot
  };
  await writeRuntimeRun(workspaceRoot, run);
  await writeIndexMutation(workspaceRoot, (index) => {
    index.activeRunBySession[run.sessionId] = run.runId;
    index.lastRunBySession[run.sessionId] = run.runId;
  });
  return run;
}

export async function readRuntimeRun(workspaceRoot: string, runId: string): Promise<AiduoRuntimeRun | undefined> {
  try {
    const raw = await readFile(getRuntimeRunPath(workspaceRoot, runId), "utf8");
    return JSON.parse(raw) as AiduoRuntimeRun;
  } catch {
    return undefined;
  }
}

export async function getActiveRunForSession(
  workspaceRoot: string,
  sessionId: string
): Promise<AiduoRuntimeRun | undefined> {
  const index = await loadRuntimeIndex(workspaceRoot);
  const runId = index.activeRunBySession[sessionId];
  return runId ? readRuntimeRun(workspaceRoot, runId) : undefined;
}

export async function getLastRunForSession(
  workspaceRoot: string,
  sessionId: string
): Promise<AiduoRuntimeRun | undefined> {
  const index = await loadRuntimeIndex(workspaceRoot);
  const runId = index.lastRunBySession[sessionId];
  return runId ? readRuntimeRun(workspaceRoot, runId) : undefined;
}

export async function updateRuntimeRunStatus(
  workspaceRoot: string,
  runId: string,
  status: AiduoRuntimeRunStatus,
  errorMessage?: string
): Promise<AiduoRuntimeRun | undefined> {
  const run = await readRuntimeRun(workspaceRoot, runId);
  if (!run) {
    return undefined;
  }

  run.status = status;
  run.updatedAt = new Date().toISOString();
  run.errorMessage = errorMessage;
  await writeRuntimeRun(workspaceRoot, run);

  await writeIndexMutation(workspaceRoot, (index) => {
    if (index.activeRunBySession[run.sessionId] === runId) {
      delete index.activeRunBySession[run.sessionId];
    }
    index.lastRunBySession[run.sessionId] = runId;
  });

  return run;
}

export function buildRuntimeRunArtifacts(runArtifacts: RunArtifacts): AiduoRuntimeRun["artifactPaths"] {
  return {
    runDir: runArtifacts.runDir,
    summaryPath: runArtifacts.summaryPath,
    latestPath: runArtifacts.latestPath,
    sourceContextPath: join(runArtifacts.runDir, "01-source-context.md"),
    dispatchedPromptPath: join(runArtifacts.runDir, "02-dispatched-prompt.md"),
    responsePath: join(runArtifacts.runDir, "03-target-response.md")
  };
}
