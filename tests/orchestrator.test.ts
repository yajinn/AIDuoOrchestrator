import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { executeFlow } from "../src/orchestrator";
import { runProcess } from "../src/utils/process";

const FIXTURE_CLAUDE = resolve(__dirname, "fixtures/bin/fake-claude.mjs");
const FIXTURE_CODEX = resolve(__dirname, "fixtures/bin/fake-codex.mjs");

async function createGitWorkspace(): Promise<string> {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "ai-duo-orchestrator-"));
  await runProcess("git", ["init", "-b", "main"], workspaceRoot);
  await runProcess("git", ["config", "user.email", "test@example.com"], workspaceRoot);
  await runProcess("git", ["config", "user.name", "AI Duo Test"], workspaceRoot);
  await writeFile(join(workspaceRoot, ".gitignore"), ".ai-duo/\n", "utf8");
  await writeFile(join(workspaceRoot, "app.txt"), "base\n", "utf8");
  await runProcess("git", ["add", "."], workspaceRoot);
  await runProcess("git", ["commit", "-m", "initial"], workspaceRoot);
  return workspaceRoot;
}

function payload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    markdown: "# Step\n\nDone.",
    summary: "Done.",
    filesTouched: [],
    mustFix: [],
    shouldFix: [],
    missingTests: [],
    risks: [],
    testsRun: [],
    testsNotRun: [],
    suggestedNextActions: [],
    needsHumanDecision: false,
    ...overrides
  };
}

describe("executeFlow", () => {
  it("runs claude-impl end-to-end with fixture runners and produces artifacts", async () => {
    const workspaceRoot = await createGitWorkspace();
    await writeFile(
      join(workspaceRoot, ".ai-duo-test-scenario.json"),
      JSON.stringify(
        {
          claude: {
            implementer: {
              payload: payload({
                markdown: "# Implementation\n\nClaude changed app.txt.",
                summary: "Claude updated app.txt.",
                filesTouched: ["app.txt"]
              }),
              write: {
                path: "app.txt",
                mode: "append",
                content: "implemented by claude\n"
              }
            }
          },
          codex: {
            reviewer: {
              payload: payload({
                markdown: "# Review\n\nLooks good.",
                summary: "No blocking issues found.",
                verdict: "approve"
              })
            }
          }
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await executeFlow({
      workspaceRoot,
      flowId: "claude-impl",
      task: "Fix the file",
      commandPaths: {
        claudePath: FIXTURE_CLAUDE,
        codexPath: FIXTURE_CODEX
      }
    });

    expect(result.flowResult.finalState).toBe("succeeded");
    expect(result.flowResult.steps.map((step) => step.stepId)).toEqual([
      "claude-implementation",
      "after-implement",
      "codex-review"
    ]);

    const appText = await readFile(join(workspaceRoot, "app.txt"), "utf8");
    expect(appText).toContain("implemented by claude");

    const implementationArtifact = await readFile(join(result.runArtifacts.runDir, "01-claude-implementation.md"), "utf8");
    const reviewArtifact = await readFile(join(result.runArtifacts.runDir, "03-codex-review.md"), "utf8");
    const diffArtifact = await readFile(join(result.runArtifacts.runDir, "02-diff-after-claude.patch"), "utf8");

    expect(implementationArtifact).toContain("Claude changed app.txt");
    expect(reviewArtifact).toContain("Looks good");
    expect(diffArtifact).toContain("app.txt");
  });

  it("runs dual-review and surfaces combined disagreement", async () => {
    const workspaceRoot = await createGitWorkspace();
    await writeFile(join(workspaceRoot, "app.txt"), "base\nchanged\n", "utf8");
    await writeFile(
      join(workspaceRoot, ".ai-duo-test-scenario.json"),
      JSON.stringify(
        {
          claude: {
            reviewer: {
              payload: payload({
                markdown: "# Claude Review\n\nLooks safe.",
                summary: "Claude approves the diff.",
                verdict: "approve"
              })
            }
          },
          codex: {
            reviewer: {
              payload: payload({
                markdown: "# Codex Review\n\nRace remains.",
                summary: "Codex blocks the diff.",
                verdict: "block"
              })
            }
          }
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await executeFlow({
      workspaceRoot,
      flowId: "dual-review",
      task: "Review the current diff",
      commandPaths: {
        claudePath: FIXTURE_CLAUDE,
        codexPath: FIXTURE_CODEX
      }
    });

    expect(result.flowResult.finalState).toBe("needs-human-decision");

    const combinedArtifact = await readFile(join(result.runArtifacts.runDir, "04-combined-review.md"), "utf8");
    expect(combinedArtifact).toContain("needs-human-decision");
  });
});
