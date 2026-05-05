import { join } from "node:path";

export function getAiDuoDir(workspaceRoot: string): string {
  return join(workspaceRoot, ".ai-duo");
}

export function getRuntimeDir(workspaceRoot: string): string {
  return join(getAiDuoDir(workspaceRoot), "runtime");
}

export function getSessionsDir(workspaceRoot: string): string {
  return join(getRuntimeDir(workspaceRoot), "sessions");
}

export function getTranscriptsDir(workspaceRoot: string): string {
  return join(getRuntimeDir(workspaceRoot), "transcripts");
}

export function getRunsDir(workspaceRoot: string): string {
  return join(getRuntimeDir(workspaceRoot), "runs");
}

export function getSessionPath(workspaceRoot: string, sessionId: string): string {
  return join(getSessionsDir(workspaceRoot), `${sessionId}.json`);
}

export function getTranscriptPath(workspaceRoot: string, sessionId: string): string {
  return join(getTranscriptsDir(workspaceRoot), `${sessionId}.jsonl`);
}

export function getRuntimeRunPath(workspaceRoot: string, runId: string): string {
  return join(getRunsDir(workspaceRoot), `${runId}.json`);
}

export function getRuntimeIndexPath(workspaceRoot: string): string {
  return join(getRuntimeDir(workspaceRoot), "index.json");
}
