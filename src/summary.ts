import type { FlowId, RunStatus } from "./artifacts";

export interface SummaryInput {
  runId: string;
  status: RunStatus;
  flowId: FlowId;
  task: string;
  artifacts: {
    metaPath?: string;
    taskPath?: string;
  };
  nextActions?: string[];
  whyStopped?: string;
  whatChangedSoFar?: string[];
  artifactLinks?: string[];
  safeRollbackAvailable?: boolean;
}

function upperStatus(status: RunStatus): string {
  return status.toUpperCase();
}

function titleForStatus(status: RunStatus): string {
  switch (status) {
    case "blocked":
      return "# Technical Issues Found";
    case "needs-human-decision":
      return "# Human Decision Required";
    default:
      return "# AI Duo Run";
  }
}

export function renderSummary(input: SummaryInput): string {
  const nextActions = input.nextActions ?? [];
  const changedSoFar = input.whatChangedSoFar ?? [];
  const artifactLinks = input.artifactLinks ?? [];
  const lines = [
    titleForStatus(input.status),
    "",
    "## Status",
    upperStatus(input.status),
    "",
    "## Run ID",
    input.runId,
    "",
    "## Flow",
    input.flowId,
    "",
    "## Task",
    input.task || "_No task provided._",
    "",
    "## Artifacts",
    `- ${input.artifacts.metaPath ?? "00-meta.json"}`,
    `- ${input.artifacts.taskPath ?? "00-task.md"}`
  ];

  if (input.whyStopped) {
    lines.push("", "## Why This Stopped", input.whyStopped);
  }

  if (changedSoFar.length > 0) {
    lines.push("", "## What Changed So Far");
    for (const item of changedSoFar) {
      lines.push(`- ${item}`);
    }
  }

  if (nextActions.length > 0) {
    lines.push("", "## Safe Next Actions");
    for (const action of nextActions) {
      lines.push(`- ${action}`);
    }
  }

  if (artifactLinks.length > 0) {
    lines.push("", "## Artifacts To Inspect");
    for (const artifact of artifactLinks) {
      lines.push(`- ${artifact}`);
    }
  }

  if (input.status === "blocked" || input.status === "needs-human-decision") {
    lines.push(
      "",
      "## Discard Availability",
      input.safeRollbackAvailable
        ? "Safe rollback artifacts are available for this run."
        : "Safe rollback artifacts are not available. Do not discard blindly."
    );
  }

  lines.push("");
  return lines.join("\n");
}
