import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createRunArtifacts, type FlowId } from "../artifacts";
import {
  applyBootstrapPlan,
  loadBootstrapExistingFiles,
  planBootstrapOperations,
  renderBootstrapPreview
} from "../bootstrap";
import { resolveCommandContext } from "../context/resolver";
import { captureGitReviewScope } from "../git/scope";
import { buildPrompt } from "../prompts";
import { getActiveRunForSession, getLastRunForSession, type AiduoRuntimeRun, buildRuntimeRunArtifacts, createRuntimeRun, updateRuntimeRunStatus } from "../runtime/runs";
import { loadRuntimeIndex, resolvePeerSession, type AiduoSession } from "../runtime/sessions";
import { redactSecrets } from "../security/redaction";
import { renderSummary } from "../summary";
import { commandContextMode, type AiduoCommand } from "./parser";

export interface PendingAiduoDispatch {
  run: AiduoRuntimeRun;
  flowId: FlowId;
  task: string;
}

export interface AiduoHandlerContext {
  workspaceRoot: string;
  session: AiduoSession;
}

export interface AiduoHandlerResult {
  message: string;
  dispatch?: {
    prompt: string;
    pending: PendingAiduoDispatch;
  };
}

function commandRole(command: AiduoCommand): "reviewer" | "implementer" | "planner" | "fixer" | "finalJudge" {
  switch (command.name) {
    case "review":
      return "reviewer";
    case "implement":
      return "implementer";
    case "plan":
      return "planner";
    case "fix":
      return "fixer";
    case "judge":
      return "finalJudge";
    default:
      return "reviewer";
  }
}

function commandFlowId(command: AiduoCommand): FlowId {
  switch (command.name) {
    case "review":
    case "judge":
      return "review";
    case "implement":
      return "implement";
    case "plan":
      return "plan";
    case "fix":
      return "fix";
    case "retry":
      return "retry";
    case "bootstrap":
      return "bootstrap";
    default:
      return "auto";
  }
}

function describeTask(command: AiduoCommand, peerAgent: string): string {
  switch (command.name) {
    case "review":
      return `Review the latest ${peerAgent} output.`;
    case "implement":
      return `Implement the latest ${peerAgent} plan or request.`;
    case "plan":
      return `Produce an implementation plan for the latest ${peerAgent} request.`;
    case "fix":
      return `Fix the valid issues in the latest ${peerAgent} review output.`;
    case "judge":
      return `Give a final verdict for the latest ${peerAgent} output.`;
    case "retry":
      return "Retry the last AI Duo command.";
    default:
      return `Handle ${command.name}.`;
  }
}

function helpText(): string {
  return [
    "AI Duo commands:",
    "/aiduo:review [--diff] [--all[=N]]",
    "/aiduo:implement [--all]",
    "/aiduo:plan [--all]",
    "/aiduo:fix [--diff] [--all[=N]]",
    "/aiduo:judge [--diff] [--all[=N]]",
    "/aiduo:status",
    "/aiduo:latest",
    "/aiduo:cancel",
    "/aiduo:retry",
    "/aiduo:bootstrap [--apply]",
    "/aiduo:help"
  ].join("\n");
}

async function renderStatus(workspaceRoot: string, session: AiduoSession): Promise<string> {
  const index = await loadRuntimeIndex(workspaceRoot);
  const activeRunId = index.activeRunBySession[session.id];
  const lastRunId = index.lastRunBySession[session.id];
  return [
    `[AI Duo] session=${session.id}`,
    `[AI Duo] agent=${session.agent}`,
    `[AI Duo] peer=${session.pairedSessionId ?? "(unpaired)"}`,
    `[AI Duo] repo=${session.repoRoot}`,
    `[AI Duo] activeRun=${activeRunId ?? "(none)"}`,
    `[AI Duo] lastRun=${lastRunId ?? "(none)"}`
  ].join("\n");
}

async function renderLatest(workspaceRoot: string): Promise<string> {
  const latestPath = join(workspaceRoot, ".ai-duo", "latest.md");
  try {
    return await readFile(latestPath, "utf8");
  } catch {
    return "No AI Duo run artifacts exist yet.";
  }
}

async function handleBootstrap(workspaceRoot: string, applyRequested: boolean): Promise<string> {
  const existingFiles = await loadBootstrapExistingFiles(workspaceRoot);
  const plan = planBootstrapOperations({ existingFiles });
  const preview = renderBootstrapPreview(plan);
  const previewPath = join(workspaceRoot, ".ai-duo", "bootstrap-preview.md");
  await writeFile(previewPath, preview, "utf8");

  if (!applyRequested) {
    return `[AI Duo] bootstrap preview ready -> ${previewPath}`;
  }

  const applied = await applyBootstrapPlan(workspaceRoot, plan);
  return `[AI Duo] bootstrap applied ${applied.length} changes -> ${previewPath}`;
}

async function buildDispatch(
  context: AiduoHandlerContext,
  command: AiduoCommand,
  retryOfRunId?: string
): Promise<AiduoHandlerResult> {
  const activeRun = await getActiveRunForSession(context.workspaceRoot, context.session.id);
  if (activeRun && !command.flags.force) {
    return {
      message: `[AI Duo] busy: run ${activeRun.runId} is still active. Use --force after cancelling if needed.`
    };
  }

  const peerSession = await resolvePeerSession(context.workspaceRoot, context.session);
  if (!peerSession) {
    return {
      message: `[AI Duo] no paired peer session found for ${context.session.agent}.`
    };
  }

  const resolved = await resolveCommandContext(context.workspaceRoot, command, peerSession);
  const task = describeTask(command, peerSession.agent);
  const flowId = commandFlowId(command);
  const runArtifacts = await createRunArtifacts({
    workspaceRoot: context.workspaceRoot,
    flowId,
    task,
    selectedBy: "user",
    status: "running"
  });
  const artifactPaths = buildRuntimeRunArtifacts(runArtifacts);
  await writeFile(artifactPaths.sourceContextPath, `${redactSecrets(resolved.sourceContextMarkdown)}\n`, "utf8");

  const prompt = buildPrompt({
    task,
    role: commandRole(command),
    workspaceRoot: context.workspaceRoot,
    reviewScope: resolved.diffText,
    peerMarkdown: [resolved.peerLastMessage, resolved.transcriptExcerpt].filter(Boolean).join("\n\n"),
    selectedFlow: flowId
  });
  await writeFile(artifactPaths.dispatchedPromptPath, `${redactSecrets(prompt)}\n`, "utf8");

  const runtimeRun = await createRuntimeRun(context.workspaceRoot, {
    runId: runArtifacts.runId,
    sessionId: context.session.id,
    peerSessionId: peerSession.id,
    commandName: command.name,
    flags: command.flags,
    contextMode: commandContextMode(command),
    status: "running",
    artifactPaths,
    retryOfRunId
  });

  return {
    message: `[AI Duo] command=${command.name} target=${context.session.agent} peer=${peerSession.agent} mode=${runtimeRun.contextMode}`,
    dispatch: {
      prompt,
      pending: {
        run: runtimeRun,
        flowId,
        task
      }
    }
  };
}

export async function handleAiduoCommand(
  context: AiduoHandlerContext,
  command: AiduoCommand
): Promise<AiduoHandlerResult> {
  switch (command.name) {
    case "help":
      return { message: helpText() };
    case "status":
      return { message: await renderStatus(context.workspaceRoot, context.session) };
    case "latest":
      return { message: await renderLatest(context.workspaceRoot) };
    case "bootstrap":
      return { message: await handleBootstrap(context.workspaceRoot, command.flags.apply === true) };
    case "cancel": {
      const activeRun = await getActiveRunForSession(context.workspaceRoot, context.session.id);
      if (!activeRun) {
        return { message: "[AI Duo] no active run to cancel." };
      }
      return { message: `[AI Duo] cancelling run ${activeRun.runId}` };
    }
    case "retry": {
      const lastRun = await getLastRunForSession(context.workspaceRoot, context.session.id);
      if (!lastRun) {
        return { message: "[AI Duo] no previous run found to retry." };
      }

      const retryCommand: AiduoCommand = {
        name: lastRun.commandName as AiduoCommand["name"],
        raw: `/aiduo:${lastRun.commandName}`,
        args: [],
        flags: lastRun.flags
      };
      return buildDispatch(context, retryCommand, lastRun.runId);
    }
    default:
      return buildDispatch(context, command);
  }
}

export async function finalizePendingDispatch(
  workspaceRoot: string,
  pending: PendingAiduoDispatch,
  responseText: string
): Promise<void> {
  const cleanResponse = redactSecrets(responseText).trim();
  await writeFile(pending.run.artifactPaths.responsePath, `${cleanResponse}\n`, "utf8");

  const artifactLinks = [
    "01-source-context.md",
    "02-dispatched-prompt.md",
    "03-target-response.md"
  ];

  if (pending.flowId === "implement" || pending.flowId === "fix") {
    const reviewScope = await captureGitReviewScope(workspaceRoot);
    const patchPath = join(pending.run.artifactPaths.runDir, "04-diff-after-command.patch");
    await writeFile(patchPath, reviewScope.diff || "(no diff)\n", "utf8");
    artifactLinks.push("04-diff-after-command.patch");
  }

  const summary = renderSummary({
    runId: pending.run.runId,
    status: "succeeded",
    flowId: pending.flowId,
    task: pending.task,
    whyStopped: `AI Duo ${pending.run.commandName} finished and captured the agent response.`,
    whatChangedSoFar: [
      `Source context was resolved in ${pending.run.contextMode} mode.`,
      "A protocol prompt was dispatched to the current agent session.",
      "The resulting agent response was recorded."
    ],
    nextActions: ["Inspect the recorded response and continue in the same wrapped session."],
    artifactLinks,
    safeRollbackAvailable: false,
    artifacts: {
      metaPath: "00-meta.json",
      taskPath: "00-task.md"
    }
  });

  await writeFile(pending.run.artifactPaths.summaryPath, summary, "utf8");
  await writeFile(pending.run.artifactPaths.latestPath, `<!-- runId: ${pending.run.runId} -->\n${summary}`, "utf8");
  await updateRuntimeRunStatus(workspaceRoot, pending.run.runId, "completed");
}

export async function failPendingDispatch(
  workspaceRoot: string,
  pending: PendingAiduoDispatch,
  message: string,
  status: "failed" | "cancelled"
): Promise<void> {
  const summary = renderSummary({
    runId: pending.run.runId,
    status,
    flowId: pending.flowId,
    task: pending.task,
    whyStopped: message,
    nextActions: ["Inspect the artifacts, then retry or continue manually."],
    artifactLinks: ["01-source-context.md", "02-dispatched-prompt.md"],
    safeRollbackAvailable: false,
    artifacts: {
      metaPath: "00-meta.json",
      taskPath: "00-task.md"
    }
  });

  await writeFile(pending.run.artifactPaths.summaryPath, summary, "utf8");
  await writeFile(pending.run.artifactPaths.latestPath, `<!-- runId: ${pending.run.runId} -->\n${summary}`, "utf8");
  await updateRuntimeRunStatus(workspaceRoot, pending.run.runId, status, message);
}
