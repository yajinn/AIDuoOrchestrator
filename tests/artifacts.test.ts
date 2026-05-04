import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRunId, createRunArtifacts } from "../src/artifacts";

describe("artifacts", () => {
  it("builds a deterministic run id when given time and suffix", () => {
    const runId = buildRunId(new Date("2026-05-05T12:34:56.000Z"), "a1b2");
    expect(runId).toBe("20260505-123456-a1b2");
  });

  it("creates run directories and latest.md copies", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "ai-duo-artifacts-"));
    const result = await createRunArtifacts({
      workspaceRoot,
      flowId: "claude-impl",
      task: "Fix refresh token race",
      now: new Date("2026-05-05T12:34:56.000Z"),
      randomSuffix: "a1b2"
    });

    expect(result.runDir).toContain(".ai-duo/runs/20260505-123456-a1b2");
    expect(result.latestPath).toContain(".ai-duo/latest.md");

    const runStats = await stat(result.runDir);
    expect(runStats.isDirectory()).toBe(true);

    const summary = await readFile(result.summaryPath, "utf8");
    expect(summary).toContain("AI Duo Run");
    expect(summary).toContain("claude-impl");

    const latest = await readFile(result.latestPath, "utf8");
    expect(latest).toContain("<!-- runId: 20260505-123456-a1b2 -->");
    expect(latest).toContain("Fix refresh token race");

    const meta = await readFile(result.metaPath, "utf8");
    expect(meta).toContain('"flowId": "claude-impl"');
    expect(meta).toContain('"status": "running"');
  });
});
