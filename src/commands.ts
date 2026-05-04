import * as vscode from "vscode";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { createRunArtifacts, type FlowId } from "./artifacts";
import { collectCapabilitySnapshot, checkFlowSupport } from "./capabilities";
import { routeTask } from "./router";
import { renderSummary } from "./summary";

const COMMANDS = [
  "aiDuo.run",
  "aiDuo.reviewCurrentDiff",
  "aiDuo.planDebate",
  "aiDuo.openLatestTimeline",
  "aiDuo.bootstrapProjectRules",
  "aiDuo.cancel"
] as const;

interface CommandDependencies {
  output: vscode.OutputChannel;
}

interface FlowOption {
  label: string;
  description: string;
  flowId: FlowId;
}

const FLOW_OPTIONS: FlowOption[] = [
  { label: "Auto", description: "Let AI Duo choose the safest likely flow.", flowId: "auto" },
  { label: "Claude implementer -> Codex reviewer", description: "Default implementation path.", flowId: "claude-impl" },
  { label: "Codex implementer -> Claude reviewer", description: "Secondary implementation path.", flowId: "codex-impl" },
  { label: "Both reviewers", description: "Read-only review of current changes.", flowId: "dual-review" },
  { label: "Both planners", description: "Read-only planning and cross-review.", flowId: "dual-plan" }
];

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

async function promptForTask(flowId: FlowId): Promise<string | undefined> {
  if (flowId === "dual-review") {
    return vscode.window.showInputBox({
      prompt: "Optional review goal",
      placeHolder: "Review the current diff for correctness, risk, and missing tests."
    });
  }

  return vscode.window.showInputBox({
    prompt: "Describe the task, bug, feature, architecture question, or review goal.",
    placeHolder: "Fix refresh token race condition"
  });
}

async function openMarkdownFile(filePath: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(document, { preview: false });
}

function summarizeCapabilityReasons(reasons: string[]): string[] {
  return reasons.length > 0 ? reasons : ["Capability check passed."];
}

async function startRun(
  requestedFlowId: FlowId,
  dependencies: CommandDependencies,
  taskOverride?: string
): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();

  if (!workspaceRoot) {
    await vscode.window.showErrorMessage("Open a workspace folder before running AI Duo.");
    return;
  }

  const task = taskOverride ?? (await promptForTask(requestedFlowId));
  if (task === undefined) {
    return;
  }

  dependencies.output.appendLine(`Collecting capabilities for requested flow: ${requestedFlowId}`);
  const capabilitySnapshot = await collectCapabilitySnapshot();

  const flowDecision =
    requestedFlowId === "auto"
      ? routeTask(task, { hasDiff: false })
      : { flowId: requestedFlowId, reason: "User selected the flow explicitly." };

  const support = checkFlowSupport(flowDecision.flowId, capabilitySnapshot);
  const runArtifacts = await createRunArtifacts({
    workspaceRoot,
    flowId: flowDecision.flowId,
    task,
    selectedBy: requestedFlowId === "auto" ? "auto" : "user",
    status: support.supported ? "running" : "blocked"
  });

  await writeFile(
    join(runArtifacts.runDir, "00-capabilities.json"),
    `${JSON.stringify(capabilitySnapshot, null, 2)}\n`,
    "utf8"
  );

  const summary = renderSummary({
    runId: runArtifacts.runId,
    status: support.supported ? "running" : "blocked",
    flowId: flowDecision.flowId,
    task,
    whyStopped: support.supported
      ? `Capability probe passed. Flow selected because: ${flowDecision.reason}`
      : `Capability probe blocked this flow. Selection reason: ${flowDecision.reason}`,
    whatChangedSoFar: [
      `Capability snapshot written to ${join(".ai-duo", "runs", runArtifacts.runId, "00-capabilities.json")}`
    ],
    nextActions: support.supported
      ? [
          "Implement runner adapters for Claude and Codex execution.",
          "Connect flow engine outputs to step artifacts.",
          "Open the run folder to inspect the capability snapshot."
        ]
      : summarizeCapabilityReasons(support.reasons),
    artifactLinks: ["00-meta.json", "00-task.md", "00-capabilities.json"],
    safeRollbackAvailable: false,
    artifacts: {
      metaPath: "00-meta.json",
      taskPath: "00-task.md"
    }
  });

  await writeFile(runArtifacts.summaryPath, summary, "utf8");
  await writeFile(runArtifacts.latestPath, `<!-- runId: ${runArtifacts.runId} -->\n${summary}`, "utf8");

  dependencies.output.appendLine(
    `Run ${runArtifacts.runId} created for flow ${flowDecision.flowId}. Supported=${support.supported}`
  );

  await openMarkdownFile(runArtifacts.latestPath);
}

export function registerCommands(context: vscode.ExtensionContext, dependencies: CommandDependencies): void {
  for (const command of COMMANDS) {
    const disposable = vscode.commands.registerCommand(command, async () => {
      switch (command) {
        case "aiDuo.run": {
          const picked = await vscode.window.showQuickPick(
            FLOW_OPTIONS.map((option) => ({
              label: option.label,
              description: option.description,
              flowId: option.flowId
            })),
            {
              title: "Select AI Duo flow"
            }
          );
          if (!picked) {
            return;
          }

          await startRun(picked.flowId, dependencies);
          return;
        }
        case "aiDuo.reviewCurrentDiff":
          await startRun("dual-review", dependencies, "Review the current diff.");
          return;
        case "aiDuo.planDebate":
          await startRun("dual-plan", dependencies);
          return;
        case "aiDuo.openLatestTimeline": {
          const workspaceRoot = getWorkspaceRoot();
          if (!workspaceRoot) {
            await vscode.window.showErrorMessage("Open a workspace folder before opening AI Duo artifacts.");
            return;
          }

          await openMarkdownFile(join(workspaceRoot, ".ai-duo", "latest.md"));
          return;
        }
        case "aiDuo.bootstrapProjectRules":
          await vscode.window.showInformationMessage("Bootstrap scaffolding exists, but project rule generation is not implemented yet.");
          return;
        case "aiDuo.cancel":
          await vscode.window.showInformationMessage("No active child process is registered yet.");
          return;
        default:
          await vscode.window.showInformationMessage("AI Duo command registered.");
      }
    });

    context.subscriptions.push(disposable);
  }
}
