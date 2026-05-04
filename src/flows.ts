import type { RunStatus } from "./artifacts";

export type Verdict =
  | "approve"
  | "approve-with-notes"
  | "block"
  | "needs-human-decision";

export type StepStatus = "succeeded" | "failed" | "cancelled" | "skipped";

export interface FlowStepControl {
  stepId: string;
  agent: "claude" | "codex" | "system";
  role: "implementer" | "reviewer" | "planner" | "fixer" | "finalJudge" | "synthesizer";
  status: StepStatus;
  summary: string;
  verdict?: Verdict;
  filesTouched?: string[];
}

export interface FlowExecutionResult {
  finalState: RunStatus;
  steps: FlowStepControl[];
  combinedVerdict?: Verdict;
}

export interface ClaudeImplDependencies {
  runImplementer: () => Promise<FlowStepControl>;
  captureDelta: (label: "after-implement" | "after-fix") => Promise<FlowStepControl>;
  runReviewer: () => Promise<FlowStepControl>;
  shouldPauseBeforeFix?: () => Promise<boolean> | boolean;
  runFixer: () => Promise<FlowStepControl>;
  runFinalGate: () => Promise<FlowStepControl>;
}

export interface CodexImplDependencies {
  runImplementer: () => Promise<FlowStepControl>;
  captureDelta: (label: "after-implement" | "after-fix") => Promise<FlowStepControl>;
  runReviewer: () => Promise<FlowStepControl>;
  shouldPauseBeforeFix?: () => Promise<boolean> | boolean;
  runFixer: () => Promise<FlowStepControl>;
  runFinalGate: () => Promise<FlowStepControl>;
}

export interface DualReviewDependencies {
  captureReviewScope: () => Promise<FlowStepControl>;
  runCodexReview: () => Promise<FlowStepControl>;
  runClaudeReview: () => Promise<FlowStepControl>;
  synthesize: (input: { codex: FlowStepControl; claude: FlowStepControl; combinedVerdict: Verdict }) => Promise<FlowStepControl>;
}

export interface DualPlanDependencies {
  runClaudePlan: () => Promise<FlowStepControl>;
  runCodexPlan: () => Promise<FlowStepControl>;
  runClaudeCrossReview: () => Promise<FlowStepControl>;
  runCodexCrossReview: () => Promise<FlowStepControl>;
  synthesize: (input: {
    claudePlan: FlowStepControl;
    codexPlan: FlowStepControl;
    claudeCrossReview: FlowStepControl;
    codexCrossReview: FlowStepControl;
    combinedVerdict: Verdict;
  }) => Promise<FlowStepControl>;
}

function requireVerdict(step: FlowStepControl): Verdict {
  if (!step.verdict) {
    throw new Error(`Step ${step.stepId} did not provide a verdict.`);
  }

  return step.verdict;
}

function mapVerdictToRunState(verdict: Verdict): RunStatus {
  switch (verdict) {
    case "approve":
    case "approve-with-notes":
      return "succeeded";
    case "block":
      return "blocked";
    case "needs-human-decision":
      return "needs-human-decision";
  }
}

export function resolveCombinedVerdict(left: Verdict, right: Verdict): Verdict {
  if (left === "needs-human-decision" || right === "needs-human-decision") {
    return "needs-human-decision";
  }

  if (left === "block" && right === "block") {
    return "block";
  }

  if ((left === "block" && right === "approve") || (left === "approve" && right === "block")) {
    return "needs-human-decision";
  }

  if ((left === "block" && right === "approve-with-notes") || (left === "approve-with-notes" && right === "block")) {
    return "needs-human-decision";
  }

  if (left === "approve-with-notes" || right === "approve-with-notes") {
    return "approve-with-notes";
  }

  return "approve";
}

export async function runClaudeImplFlow(deps: ClaudeImplDependencies): Promise<FlowExecutionResult> {
  const steps: FlowStepControl[] = [];

  const implementation = await deps.runImplementer();
  steps.push(implementation);

  const initialDelta = await deps.captureDelta("after-implement");
  steps.push(initialDelta);

  const review = await deps.runReviewer();
  steps.push(review);

  const reviewVerdict = requireVerdict(review);

  if (reviewVerdict === "approve" || reviewVerdict === "approve-with-notes") {
    return {
      finalState: "succeeded",
      steps
    };
  }

  if (reviewVerdict === "needs-human-decision") {
    return {
      finalState: "needs-human-decision",
      steps
    };
  }

  if (deps.shouldPauseBeforeFix && (await deps.shouldPauseBeforeFix())) {
    return {
      finalState: "paused-for-user-confirmation",
      steps
    };
  }

  const fix = await deps.runFixer();
  steps.push(fix);

  const finalDelta = await deps.captureDelta("after-fix");
  steps.push(finalDelta);

  const finalGate = await deps.runFinalGate();
  steps.push(finalGate);

  return {
    finalState: mapVerdictToRunState(requireVerdict(finalGate)),
    steps
  };
}

export async function runCodexImplFlow(deps: CodexImplDependencies): Promise<FlowExecutionResult> {
  const steps: FlowStepControl[] = [];

  const implementation = await deps.runImplementer();
  steps.push(implementation);

  const initialDelta = await deps.captureDelta("after-implement");
  steps.push(initialDelta);

  const review = await deps.runReviewer();
  steps.push(review);

  const reviewVerdict = requireVerdict(review);

  if (reviewVerdict === "approve" || reviewVerdict === "approve-with-notes") {
    return {
      finalState: "succeeded",
      steps
    };
  }

  if (reviewVerdict === "needs-human-decision") {
    return {
      finalState: "needs-human-decision",
      steps
    };
  }

  if (deps.shouldPauseBeforeFix && (await deps.shouldPauseBeforeFix())) {
    return {
      finalState: "paused-for-user-confirmation",
      steps
    };
  }

  const fix = await deps.runFixer();
  steps.push(fix);

  const finalDelta = await deps.captureDelta("after-fix");
  steps.push(finalDelta);

  const finalGate = await deps.runFinalGate();
  steps.push(finalGate);

  return {
    finalState: mapVerdictToRunState(requireVerdict(finalGate)),
    steps
  };
}

export async function runDualReviewFlow(deps: DualReviewDependencies): Promise<FlowExecutionResult> {
  const steps: FlowStepControl[] = [];

  const scope = await deps.captureReviewScope();
  steps.push(scope);

  const codex = await deps.runCodexReview();
  const claude = await deps.runClaudeReview();
  steps.push(codex, claude);

  const combinedVerdict = resolveCombinedVerdict(requireVerdict(codex), requireVerdict(claude));
  const synthesis = await deps.synthesize({
    codex,
    claude,
    combinedVerdict
  });
  steps.push(synthesis);

  return {
    finalState: mapVerdictToRunState(combinedVerdict),
    steps,
    combinedVerdict
  };
}

export async function runDualPlanFlow(deps: DualPlanDependencies): Promise<FlowExecutionResult> {
  const steps: FlowStepControl[] = [];

  const claudePlan = await deps.runClaudePlan();
  const codexPlan = await deps.runCodexPlan();
  const claudeCrossReview = await deps.runClaudeCrossReview();
  const codexCrossReview = await deps.runCodexCrossReview();

  steps.push(claudePlan, codexPlan, claudeCrossReview, codexCrossReview);

  const combinedVerdict = resolveCombinedVerdict(
    requireVerdict(claudeCrossReview),
    requireVerdict(codexCrossReview)
  );

  const synthesis = await deps.synthesize({
    claudePlan,
    codexPlan,
    claudeCrossReview,
    codexCrossReview,
    combinedVerdict
  });
  steps.push(synthesis);

  return {
    finalState: mapVerdictToRunState(combinedVerdict),
    steps,
    combinedVerdict
  };
}
