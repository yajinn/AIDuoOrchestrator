import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderSummary } from "./summary";

export type FlowId =
  | "auto"
  | "claude-impl"
  | "codex-impl"
  | "dual-review"
  | "dual-plan"
  | "review"
  | "implement"
  | "plan"
  | "fix"
  | "judge"
  | "retry"
  | "bootstrap";

export type RunStatus =
  | "running"
  | "paused-for-user-confirmation"
  | "blocked"
  | "needs-human-decision"
  | "failed"
  | "cancelled"
  | "succeeded";

export interface RunMeta {
  id: string;
  flowId: FlowId;
  workspaceRoot: string;
  task: string;
  selectedBy: "user" | "auto";
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  steps: Array<{
    id: string;
    status: RunStatus | "pending" | "skipped";
    summary?: string;
  }>;
}

export interface CreateRunArtifactsInput {
  workspaceRoot: string;
  flowId: FlowId;
  task?: string;
  selectedBy?: "user" | "auto";
  status?: RunStatus;
  now?: Date;
  randomSuffix?: string;
}

export interface RunArtifacts {
  runId: string;
  aiDuoDir: string;
  runsDir: string;
  runDir: string;
  latestPath: string;
  metaPath: string;
  taskPath: string;
  summaryPath: string;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function buildRunId(now: Date = new Date(), randomSuffix?: string): string {
  const parts = [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate())
  ].join("");
  const time = [pad(now.getUTCHours()), pad(now.getUTCMinutes()), pad(now.getUTCSeconds())].join("");
  const suffix = randomSuffix ?? randomBytes(2).toString("hex");
  return `${parts}-${time}-${suffix}`;
}

export async function writeRunMeta(metaPath: string, meta: RunMeta): Promise<void> {
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
}

export async function copyLatestSummary(summaryPath: string, latestPath: string, runId: string): Promise<void> {
  const summary = await readFile(summaryPath, "utf8");
  const latestContent = `<!-- runId: ${runId} -->\n${summary}`;
  await writeFile(latestPath, latestContent, "utf8");
}

export async function createRunArtifacts(input: CreateRunArtifactsInput): Promise<RunArtifacts> {
  const runId = buildRunId(input.now, input.randomSuffix);
  const aiDuoDir = join(input.workspaceRoot, ".ai-duo");
  const runsDir = join(aiDuoDir, "runs");
  const runDir = join(runsDir, runId);
  const latestPath = join(aiDuoDir, "latest.md");
  const metaPath = join(runDir, "00-meta.json");
  const taskPath = join(runDir, "00-task.md");
  const summaryPath = join(runDir, "summary.md");

  await mkdir(runDir, { recursive: true });

  const meta: RunMeta = {
    id: runId,
    flowId: input.flowId,
    workspaceRoot: input.workspaceRoot,
    task: input.task ?? "",
    selectedBy: input.selectedBy ?? "user",
    status: input.status ?? "running",
    startedAt: (input.now ?? new Date()).toISOString(),
    steps: []
  };

  await writeRunMeta(metaPath, meta);
  await writeFile(taskPath, `${meta.task}\n`, "utf8");

  const summary = renderSummary({
    runId,
    status: meta.status,
    flowId: meta.flowId,
    task: meta.task,
    artifacts: {
      metaPath: "00-meta.json",
      taskPath: "00-task.md"
    }
  });

  await writeFile(summaryPath, summary, "utf8");
  await copyLatestSummary(summaryPath, latestPath, runId);

  return {
    runId,
    aiDuoDir,
    runsDir,
    runDir,
    latestPath,
    metaPath,
    taskPath,
    summaryPath
  };
}
