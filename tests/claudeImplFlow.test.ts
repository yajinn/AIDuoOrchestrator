import { describe, expect, it } from "vitest";
import { runClaudeImplFlow, type FlowStepControl } from "../src/flows";

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

describe("runClaudeImplFlow", () => {
  it("skips fix pass when review approves", async () => {
    const result = await runClaudeImplFlow({
      runImplementer: async () => step({ stepId: "claude-implement", agent: "claude", role: "implementer" }),
      captureDelta: async (label) => step({ stepId: label, role: "synthesizer" }),
      runReviewer: async () => step({ stepId: "codex-review", agent: "codex", role: "reviewer", verdict: "approve" }),
      runFixer: async () => step({ stepId: "claude-fix", agent: "claude", role: "fixer" }),
      runFinalGate: async () => step({ stepId: "codex-final", agent: "codex", role: "finalJudge", verdict: "approve" })
    });

    expect(result.finalState).toBe("succeeded");
    expect(result.steps.map((current) => current.stepId)).toEqual([
      "claude-implement",
      "after-implement",
      "codex-review"
    ]);
  });

  it("pauses before fix when a user edit gate blocks automatic continuation", async () => {
    const result = await runClaudeImplFlow({
      runImplementer: async () => step({ stepId: "claude-implement", agent: "claude", role: "implementer" }),
      captureDelta: async (label) => step({ stepId: label, role: "synthesizer" }),
      runReviewer: async () => step({ stepId: "codex-review", agent: "codex", role: "reviewer", verdict: "block" }),
      shouldPauseBeforeFix: async () => true,
      runFixer: async () => step({ stepId: "claude-fix", agent: "claude", role: "fixer" }),
      runFinalGate: async () => step({ stepId: "codex-final", agent: "codex", role: "finalJudge", verdict: "approve" })
    });

    expect(result.finalState).toBe("paused-for-user-confirmation");
    expect(result.steps.map((current) => current.stepId)).toEqual([
      "claude-implement",
      "after-implement",
      "codex-review"
    ]);
  });
});
