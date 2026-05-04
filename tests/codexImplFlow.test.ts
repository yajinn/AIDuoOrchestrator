import { describe, expect, it } from "vitest";
import { runCodexImplFlow, type FlowStepControl } from "../src/flows";

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

describe("runCodexImplFlow", () => {
  it("runs fix and final gate when reviewer blocks", async () => {
    const result = await runCodexImplFlow({
      runImplementer: async () => step({ stepId: "codex-implement", agent: "codex", role: "implementer" }),
      captureDelta: async (label) => step({ stepId: label, role: "synthesizer" }),
      runReviewer: async () => step({ stepId: "claude-review", agent: "claude", role: "reviewer", verdict: "block" }),
      runFixer: async () => step({ stepId: "codex-fix", agent: "codex", role: "fixer" }),
      runFinalGate: async () => step({ stepId: "claude-final", agent: "claude", role: "finalJudge", verdict: "approve-with-notes" })
    });

    expect(result.finalState).toBe("succeeded");
    expect(result.steps.map((current) => current.stepId)).toEqual([
      "codex-implement",
      "after-implement",
      "claude-review",
      "codex-fix",
      "after-fix",
      "claude-final"
    ]);
  });
});
