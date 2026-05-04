import { describe, expect, it } from "vitest";
import { runDualPlanFlow, type FlowStepControl } from "../src/flows";

function step(overrides: Partial<FlowStepControl>): FlowStepControl {
  return {
    stepId: overrides.stepId ?? "step",
    agent: overrides.agent ?? "system",
    role: overrides.role ?? "planner",
    status: overrides.status ?? "succeeded",
    summary: overrides.summary ?? "ok",
    verdict: overrides.verdict,
    filesTouched: overrides.filesTouched ?? []
  };
}

describe("runDualPlanFlow", () => {
  it("preserves human-decision state when planner cross-reviews disagree", async () => {
    const result = await runDualPlanFlow({
      runClaudePlan: async () => step({ stepId: "claude-plan", agent: "claude", role: "planner" }),
      runCodexPlan: async () => step({ stepId: "codex-plan", agent: "codex", role: "planner" }),
      runClaudeCrossReview: async () =>
        step({ stepId: "claude-cross-review", agent: "claude", role: "reviewer", verdict: "approve" }),
      runCodexCrossReview: async () =>
        step({ stepId: "codex-cross-review", agent: "codex", role: "reviewer", verdict: "block" }),
      synthesize: async ({ combinedVerdict }) =>
        step({
          stepId: "final-plan",
          role: "synthesizer",
          verdict: combinedVerdict
        })
    });

    expect(result.combinedVerdict).toBe("needs-human-decision");
    expect(result.finalState).toBe("needs-human-decision");
    expect(result.steps.map((current) => current.stepId)).toEqual([
      "claude-plan",
      "codex-plan",
      "claude-cross-review",
      "codex-cross-review",
      "final-plan"
    ]);
  });
});
