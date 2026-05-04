import { describe, expect, it } from "vitest";
import { resolveCombinedVerdict, runDualReviewFlow, type FlowStepControl } from "../src/flows";

function step(overrides: Partial<FlowStepControl>): FlowStepControl {
  return {
    stepId: overrides.stepId ?? "step",
    agent: overrides.agent ?? "system",
    role: overrides.role ?? "reviewer",
    status: overrides.status ?? "succeeded",
    summary: overrides.summary ?? "ok",
    verdict: overrides.verdict,
    filesTouched: overrides.filesTouched ?? []
  };
}

describe("resolveCombinedVerdict", () => {
  it("returns needs-human-decision for approve versus block", () => {
    expect(resolveCombinedVerdict("approve", "block")).toBe("needs-human-decision");
  });

  it("returns approve-with-notes when one side has notes and the other approves", () => {
    expect(resolveCombinedVerdict("approve", "approve-with-notes")).toBe("approve-with-notes");
  });
});

describe("runDualReviewFlow", () => {
  it("combines conflicting reviewer verdicts into needs-human-decision", async () => {
    const result = await runDualReviewFlow({
      captureReviewScope: async () => step({ stepId: "capture-scope", role: "synthesizer" }),
      runCodexReview: async () => step({ stepId: "codex-review", agent: "codex", role: "reviewer", verdict: "block" }),
      runClaudeReview: async () => step({ stepId: "claude-review", agent: "claude", role: "reviewer", verdict: "approve" }),
      synthesize: async ({ combinedVerdict }) =>
        step({
          stepId: "combined-review",
          role: "synthesizer",
          verdict: combinedVerdict
        })
    });

    expect(result.combinedVerdict).toBe("needs-human-decision");
    expect(result.finalState).toBe("needs-human-decision");
    expect(result.steps.map((current) => current.stepId)).toEqual([
      "capture-scope",
      "codex-review",
      "claude-review",
      "combined-review"
    ]);
  });
});
