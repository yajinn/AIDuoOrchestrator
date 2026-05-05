import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createRunArtifacts, type FlowId, type RunArtifacts } from "./artifacts";
import { captureWorkspaceSnapshot, snapshotsDiffer, writeDiffArtifact } from "./git/delta";
import { captureGitReviewScope } from "./git/scope";
import {
  runClaudeImplFlow,
  runCodexImplFlow,
  runDualPlanFlow,
  runDualReviewFlow,
  type FlowExecutionResult,
  type FlowStepControl
} from "./flows";
import { buildPrompt } from "./prompts";
import { runClaudeStep } from "./runners/claudeRunner";
import { runCodexStep } from "./runners/codexRunner";
import { sanitizePeerOutput } from "./security/sanitizer";
import { renderSummary } from "./summary";
import type { RunnerExecutionResult, RunnerRole } from "./runners/contracts";

export interface OrchestratorPaths {
  claudePath?: string;
  codexPath?: string;
}

export interface ExecuteFlowInput {
  workspaceRoot: string;
  flowId: Exclude<FlowId, "auto">;
  task: string;
  signal?: AbortSignal;
  commandPaths?: OrchestratorPaths;
}

export interface ExecuteFlowResult {
  runArtifacts: RunArtifacts;
  flowResult: FlowExecutionResult;
}

interface StepArtifactContext {
  runDir: string;
  index: number;
  slug: string;
  agent: "claude" | "codex" | "system";
  role: RunnerRole;
}

function formatStepFilename(index: number, slug: string, ext: string): string {
  return `${String(index).padStart(2, "0")}-${slug}.${ext}`;
}

async function writeRunnerArtifacts(
  context: StepArtifactContext,
  step: FlowStepControl,
  execution: RunnerExecutionResult
): Promise<void> {
  const markdownPath = join(context.runDir, formatStepFilename(context.index, context.slug, "md"));
  const controlPath = join(context.runDir, formatStepFilename(context.index, context.slug, "control.json"));
  const stdoutPath = join(context.runDir, formatStepFilename(context.index, context.slug, "stdout.log"));
  const stderrPath = join(context.runDir, formatStepFilename(context.index, context.slug, "stderr.log"));

  await writeFile(markdownPath, `${execution.payload.markdown}\n`, "utf8");
  await writeFile(
    controlPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        stepId: step.stepId,
        agent: context.agent,
        role: context.role,
        status: step.status,
        summary: step.summary,
        verdict: step.verdict,
        filesTouched: execution.payload.filesTouched,
        mustFix: execution.payload.mustFix,
        shouldFix: execution.payload.shouldFix,
        missingTests: execution.payload.missingTests,
        risks: execution.payload.risks,
        testsRun: execution.payload.testsRun,
        testsNotRun: execution.payload.testsNotRun,
        needsHumanDecision: execution.payload.needsHumanDecision,
        suggestedNextActions: execution.payload.suggestedNextActions
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(stdoutPath, execution.stdout, "utf8");
  await writeFile(stderrPath, execution.stderr, "utf8");
}

function toFlowStep(
  stepId: string,
  agent: "claude" | "codex",
  role: RunnerRole,
  execution: RunnerExecutionResult
): FlowStepControl {
  return {
    stepId,
    agent,
    role,
    status: "succeeded",
    summary: execution.payload.summary,
    verdict: execution.payload.verdict,
    filesTouched: execution.payload.filesTouched
  };
}

async function runClaudeStepWithArtifacts(
  runArtifacts: RunArtifacts,
  index: number,
  slug: string,
  stepId: string,
  role: RunnerRole,
  input: ExecuteFlowInput,
  reviewScope?: string,
  peerMarkdown?: string
): Promise<FlowStepControl> {
  const execution = await runClaudeStep({
    commandPath: input.commandPaths?.claudePath ?? "claude",
    cwd: input.workspaceRoot,
    role,
    prompt: buildPrompt({
      task: input.task,
      role,
      workspaceRoot: input.workspaceRoot,
      reviewScope,
      peerMarkdown,
      selectedFlow: input.flowId
    }),
    signal: input.signal,
    timeoutMs: role === "implementer" || role === "fixer" ? 15 * 60_000 : 10 * 60_000
  });
  const step = toFlowStep(stepId, "claude", role, execution);
  await writeRunnerArtifacts({ runDir: runArtifacts.runDir, index, slug, agent: "claude", role }, step, execution);
  return step;
}

async function runCodexStepWithArtifacts(
  runArtifacts: RunArtifacts,
  index: number,
  slug: string,
  stepId: string,
  role: RunnerRole,
  input: ExecuteFlowInput,
  reviewScope?: string,
  peerMarkdown?: string
): Promise<FlowStepControl> {
  const execution = await runCodexStep({
    commandPath: input.commandPaths?.codexPath ?? "codex",
    cwd: input.workspaceRoot,
    role,
    prompt: buildPrompt({
      task: input.task,
      role,
      workspaceRoot: input.workspaceRoot,
      reviewScope,
      peerMarkdown,
      selectedFlow: input.flowId
    }),
    signal: input.signal,
    timeoutMs: role === "implementer" || role === "fixer" ? 15 * 60_000 : 10 * 60_000
  });
  const step = toFlowStep(stepId, "codex", role, execution);
  await writeRunnerArtifacts({ runDir: runArtifacts.runDir, index, slug, agent: "codex", role }, step, execution);
  return step;
}

async function writeSummary(runArtifacts: RunArtifacts, input: ExecuteFlowInput, flowResult: FlowExecutionResult): Promise<void> {
  const artifactLinks = flowResult.steps.map((step, index) => {
    if (step.role === "synthesizer" && (step.stepId === "after-implement" || step.stepId === "after-fix")) {
      const prefix = String(index + 1).padStart(2, "0");
      return `${prefix}-${step.stepId}.patch`;
    }

    return `${String(index + 1).padStart(2, "0")}-${step.stepId}.md`;
  });

  const summary = renderSummary({
    runId: runArtifacts.runId,
    status: flowResult.finalState,
    flowId: input.flowId,
    task: input.task,
    whyStopped: `Flow finished with state ${flowResult.finalState}.`,
    whatChangedSoFar: flowResult.steps.map((step) => `${step.stepId}: ${step.summary}`),
    nextActions: flowResult.steps.at(-1)?.verdict
      ? [`Final verdict: ${flowResult.steps.at(-1)?.verdict}`]
      : ["Inspect the run artifacts for details."],
    artifactLinks,
    safeRollbackAvailable: false,
    artifacts: {
      metaPath: "00-meta.json",
      taskPath: "00-task.md"
    }
  });

  await writeFile(runArtifacts.summaryPath, summary, "utf8");
  await writeFile(runArtifacts.latestPath, `<!-- runId: ${runArtifacts.runId} -->\n${summary}`, "utf8");
}

async function ensureRunArtifacts(input: ExecuteFlowInput): Promise<RunArtifacts> {
  const runArtifacts = await createRunArtifacts({
    workspaceRoot: input.workspaceRoot,
    flowId: input.flowId,
    task: input.task,
    selectedBy: "user",
    status: "running"
  });
  await mkdir(runArtifacts.runDir, { recursive: true });
  return runArtifacts;
}

export async function executeFlow(input: ExecuteFlowInput): Promise<ExecuteFlowResult> {
  const runArtifacts = await ensureRunArtifacts(input);
  const reviewScope = await captureGitReviewScope(input.workspaceRoot);
  await writeFile(join(runArtifacts.runDir, "00-git-status.txt"), reviewScope.status, "utf8");
  await writeFile(join(runArtifacts.runDir, "00-review-scope.txt"), reviewScope.reviewText, "utf8");

  let flowResult: FlowExecutionResult;

  if (input.flowId === "claude-impl") {
    const postImplementationSnapshotHolder: { current?: Awaited<ReturnType<typeof captureWorkspaceSnapshot>> } = {};

    flowResult = await runClaudeImplFlow({
      runImplementer: async () => {
        const step = await runClaudeStepWithArtifacts(
          runArtifacts,
          1,
          "claude-implementation",
          "claude-implementation",
          "implementer",
          input,
          reviewScope.reviewText
        );
        postImplementationSnapshotHolder.current = await captureWorkspaceSnapshot(input.workspaceRoot);
        return step;
      },
      captureDelta: async (label) => {
        const index = label === "after-implement" ? 2 : 5;
        const slug = label === "after-implement" ? "diff-after-claude" : "diff-after-fix";
        const artifact = await writeDiffArtifact(input.workspaceRoot, runArtifacts.runDir, formatStepFilename(index, slug, "patch"));
        return {
          stepId: label,
          agent: "system",
          role: "synthesizer",
          status: "succeeded",
          summary: `Captured diff artifact ${artifact.path}.`,
          filesTouched: []
        };
      },
      runReviewer: async () => {
        const diffText = await writeDiffArtifact(input.workspaceRoot, runArtifacts.runDir, "02-diff-after-claude.patch");
        return runCodexStepWithArtifacts(
          runArtifacts,
          3,
          "codex-review",
          "codex-review",
          "reviewer",
          input,
          diffText.content
        );
      },
      shouldPauseBeforeFix: async () => {
        if (!postImplementationSnapshotHolder.current) {
          return false;
        }

        const currentSnapshot = await captureWorkspaceSnapshot(input.workspaceRoot);
        return snapshotsDiffer(postImplementationSnapshotHolder.current, currentSnapshot);
      },
      runFixer: async () => {
        const reviewMarkdown = await readFile(join(runArtifacts.runDir, "03-codex-review.md"), "utf8");
        const sanitized = sanitizePeerOutput(reviewMarkdown);
        if (sanitized.detected) {
          await writeFile(join(runArtifacts.runDir, "99-prompt-injection-warning.md"), `${sanitized.matches.join("\n")}\n`, "utf8");
        }
        return runClaudeStepWithArtifacts(
          runArtifacts,
          4,
          "claude-fix",
          "claude-fix",
          "fixer",
          input,
          reviewScope.reviewText,
          sanitized.wrapped
        );
      },
      runFinalGate: async () => {
        const diffText = await writeDiffArtifact(input.workspaceRoot, runArtifacts.runDir, "05-diff-after-fix.patch");
        return runCodexStepWithArtifacts(
          runArtifacts,
          6,
          "codex-final-gate",
          "codex-final-gate",
          "finalJudge",
          input,
          diffText.content
        );
      }
    });
  } else if (input.flowId === "codex-impl") {
    const postImplementationSnapshotHolder: { current?: Awaited<ReturnType<typeof captureWorkspaceSnapshot>> } = {};

    flowResult = await runCodexImplFlow({
      runImplementer: async () => {
        const step = await runCodexStepWithArtifacts(
          runArtifacts,
          1,
          "codex-implementation",
          "codex-implementation",
          "implementer",
          input,
          reviewScope.reviewText
        );
        postImplementationSnapshotHolder.current = await captureWorkspaceSnapshot(input.workspaceRoot);
        return step;
      },
      captureDelta: async (label) => {
        const index = label === "after-implement" ? 2 : 5;
        const slug = label === "after-implement" ? "diff-after-codex" : "diff-after-fix";
        const artifact = await writeDiffArtifact(input.workspaceRoot, runArtifacts.runDir, formatStepFilename(index, slug, "patch"));
        return {
          stepId: label,
          agent: "system",
          role: "synthesizer",
          status: "succeeded",
          summary: `Captured diff artifact ${artifact.path}.`,
          filesTouched: []
        };
      },
      runReviewer: async () => {
        const diffText = await writeDiffArtifact(input.workspaceRoot, runArtifacts.runDir, "02-diff-after-codex.patch");
        return runClaudeStepWithArtifacts(
          runArtifacts,
          3,
          "claude-review",
          "claude-review",
          "reviewer",
          input,
          diffText.content
        );
      },
      shouldPauseBeforeFix: async () => {
        if (!postImplementationSnapshotHolder.current) {
          return false;
        }

        const currentSnapshot = await captureWorkspaceSnapshot(input.workspaceRoot);
        return snapshotsDiffer(postImplementationSnapshotHolder.current, currentSnapshot);
      },
      runFixer: async () => {
        const reviewMarkdown = await readFile(join(runArtifacts.runDir, "03-claude-review.md"), "utf8");
        const sanitized = sanitizePeerOutput(reviewMarkdown);
        if (sanitized.detected) {
          await writeFile(join(runArtifacts.runDir, "99-prompt-injection-warning.md"), `${sanitized.matches.join("\n")}\n`, "utf8");
        }
        return runCodexStepWithArtifacts(
          runArtifacts,
          4,
          "codex-fix",
          "codex-fix",
          "fixer",
          input,
          reviewScope.reviewText,
          sanitized.wrapped
        );
      },
      runFinalGate: async () => {
        const diffText = await writeDiffArtifact(input.workspaceRoot, runArtifacts.runDir, "05-diff-after-fix.patch");
        return runClaudeStepWithArtifacts(
          runArtifacts,
          5,
          "claude-final-gate",
          "claude-final-gate",
          "finalJudge",
          input,
          diffText.content
        );
      }
    });
  } else if (input.flowId === "dual-review") {
    flowResult = await runDualReviewFlow({
      captureReviewScope: async () => ({
        stepId: "capture-scope",
        agent: "system",
        role: "synthesizer",
        status: "succeeded",
        summary: "Captured review scope.",
        filesTouched: []
      }),
      runCodexReview: async () =>
        runCodexStepWithArtifacts(runArtifacts, 2, "codex-review", "codex-review", "reviewer", input, reviewScope.reviewText),
      runClaudeReview: async () =>
        runClaudeStepWithArtifacts(runArtifacts, 3, "claude-review", "claude-review", "reviewer", input, reviewScope.reviewText),
      synthesize: async ({ codex, claude, combinedVerdict }) => {
        const markdown = [
          "# Combined Review",
          "",
          `Combined verdict: ${combinedVerdict}`,
          "",
          "## Codex",
          codex.summary,
          "",
          "## Claude",
          claude.summary
        ].join("\n");

        await writeFile(join(runArtifacts.runDir, "04-combined-review.md"), `${markdown}\n`, "utf8");
        await writeFile(
          join(runArtifacts.runDir, "04-combined-review.control.json"),
          `${JSON.stringify(
            {
              schemaVersion: 1,
              stepId: "combined-review",
              agent: "system",
              role: "synthesizer",
              status: "succeeded",
              summary: `Combined review verdict: ${combinedVerdict}.`,
              verdict: combinedVerdict,
              filesTouched: [],
              mustFix: [],
              shouldFix: [],
              missingTests: [],
              risks: [],
              testsRun: [],
              testsNotRun: [],
              needsHumanDecision: combinedVerdict === "needs-human-decision",
              suggestedNextActions: [`Inspect 02-codex-review.md and 03-claude-review.md.`]
            },
            null,
            2
          )}\n`,
          "utf8"
        );

        return {
          stepId: "combined-review",
          agent: "system",
          role: "synthesizer",
          status: "succeeded",
          summary: `Combined review verdict: ${combinedVerdict}.`,
          verdict: combinedVerdict,
          filesTouched: []
        };
      }
    });
  } else {
    flowResult = await runDualPlanFlow({
      runClaudePlan: async () =>
        runClaudeStepWithArtifacts(runArtifacts, 1, "claude-plan", "claude-plan", "planner", input, reviewScope.reviewText),
      runCodexPlan: async () =>
        runCodexStepWithArtifacts(runArtifacts, 2, "codex-plan", "codex-plan", "planner", input, reviewScope.reviewText),
      runClaudeCrossReview: async () =>
        runClaudeStepWithArtifacts(
          runArtifacts,
          3,
          "claude-reviews-codex",
          "claude-reviews-codex",
          "reviewer",
          input,
          reviewScope.reviewText,
          await readFile(join(runArtifacts.runDir, "02-codex-plan.md"), "utf8")
        ),
      runCodexCrossReview: async () =>
        runCodexStepWithArtifacts(
          runArtifacts,
          4,
          "codex-reviews-claude",
          "codex-reviews-claude",
          "reviewer",
          input,
          reviewScope.reviewText,
          await readFile(join(runArtifacts.runDir, "01-claude-plan.md"), "utf8")
        ),
      synthesize: async ({ claudePlan, codexPlan, combinedVerdict }) => {
        const markdown = [
          "# Final Plan",
          "",
          `Combined verdict: ${combinedVerdict}`,
          "",
          "## Claude plan summary",
          claudePlan.summary,
          "",
          "## Codex plan summary",
          codexPlan.summary
        ].join("\n");

        await writeFile(join(runArtifacts.runDir, "05-final-plan.md"), `${markdown}\n`, "utf8");
        await writeFile(
          join(runArtifacts.runDir, "05-final-plan.control.json"),
          `${JSON.stringify(
            {
              schemaVersion: 1,
              stepId: "final-plan",
              agent: "system",
              role: "synthesizer",
              status: "succeeded",
              summary: `Final plan verdict: ${combinedVerdict}.`,
              verdict: combinedVerdict,
              filesTouched: [],
              mustFix: [],
              shouldFix: [],
              missingTests: [],
              risks: [],
              testsRun: [],
              testsNotRun: [],
              needsHumanDecision: combinedVerdict === "needs-human-decision",
              suggestedNextActions: ["Review the final plan and pick an implementation path."]
            },
            null,
            2
          )}\n`,
          "utf8"
        );

        return {
          stepId: "final-plan",
          agent: "system",
          role: "synthesizer",
          status: "succeeded",
          summary: `Final plan verdict: ${combinedVerdict}.`,
          verdict: combinedVerdict,
          filesTouched: []
        };
      }
    });
  }

  await writeSummary(runArtifacts, input, flowResult);
  return {
    runArtifacts,
    flowResult
  };
}
