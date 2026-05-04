import { describe, expect, it } from "vitest";
import { renderSummary } from "../src/summary";

describe("renderSummary stop states", () => {
  it("renders a blocked summary with safe next actions and rollback guidance", () => {
    const summary = renderSummary({
      runId: "20260505-123456-a1b2",
      status: "blocked",
      flowId: "claude-impl",
      task: "Fix refresh race",
      artifacts: {
        metaPath: "00-meta.json",
        taskPath: "00-task.md"
      },
      whyStopped: "Codex found a remaining race in the fallback refresh path.",
      whatChangedSoFar: ["Claude implemented a lock around primary refresh flow."],
      nextActions: ["Inspect 03-codex-review.md", "Manually patch fallback branch", "Re-run AI Duo review"],
      artifactLinks: ["03-codex-review.md", "02-diff-after-implement.patch"],
      safeRollbackAvailable: false
    });

    expect(summary).toContain("Technical Issues Found");
    expect(summary).toContain("Why This Stopped");
    expect(summary).toContain("Safe Next Actions");
    expect(summary).toContain("Do not discard blindly");
  });

  it("renders a needs-human-decision summary distinctly from block", () => {
    const summary = renderSummary({
      runId: "20260505-123456-a1b2",
      status: "needs-human-decision",
      flowId: "dual-review",
      task: "Review optimistic locking change",
      artifacts: {
        metaPath: "00-meta.json",
        taskPath: "00-task.md"
      },
      whyStopped: "Codex blocked the change while Claude approved it.",
      nextActions: ["Compare review artifacts side by side"],
      artifactLinks: ["02-codex-review.md", "03-claude-review.md"],
      safeRollbackAvailable: true
    });

    expect(summary).toContain("Human Decision Required");
    expect(summary).toContain("Compare review artifacts side by side");
    expect(summary).toContain("Safe rollback artifacts are available");
  });
});
