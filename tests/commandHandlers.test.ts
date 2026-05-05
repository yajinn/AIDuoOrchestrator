import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { finalizePendingDispatch, handleAiduoCommand } from "../src/commands/handlers";
import { parseAiduoCommand } from "../src/commands/parser";
import { registerSession } from "../src/runtime/sessions";
import { appendTranscriptEvent } from "../src/runtime/transcripts";
import { runProcess } from "../src/utils/process";

async function createWorkspace(): Promise<string> {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "ai-duo-command-"));
  await runProcess("git", ["init", "-b", "main"], workspaceRoot);
  await runProcess("git", ["config", "user.email", "test@example.com"], workspaceRoot);
  await runProcess("git", ["config", "user.name", "AI Duo Test"], workspaceRoot);
  await writeFile(join(workspaceRoot, ".gitignore"), ".ai-duo/\n", "utf8");
  await writeFile(join(workspaceRoot, "app.txt"), "base\n", "utf8");
  await runProcess("git", ["add", "."], workspaceRoot);
  await runProcess("git", ["commit", "-m", "initial"], workspaceRoot);
  return workspaceRoot;
}

describe("AI Duo command handlers", () => {
  it("builds a review dispatch from the peer last message and finalizes artifacts", async () => {
    const workspaceRoot = await createWorkspace();
    const claude = await registerSession({
      agent: "claude",
      cwd: workspaceRoot,
      rawArgs: ["--resume"],
      pid: 1
    });
    const codex = await registerSession({
      agent: "codex",
      cwd: workspaceRoot,
      rawArgs: ["exec"],
      pid: 2
    });

    await appendTranscriptEvent(workspaceRoot, {
      sessionId: claude.id,
      kind: "assistant_output",
      text: "Plan: update app.txt and add a test."
    });

    const result = await handleAiduoCommand(
      {
        workspaceRoot,
        session: codex
      },
      parseAiduoCommand("/aiduo:review --diff")
    );

    expect(result.dispatch).toBeDefined();
    expect(result.message).toContain("command=review");
    expect(result.dispatch?.prompt).toContain("BEGIN_PEER_OUTPUT");

    await finalizePendingDispatch(workspaceRoot, result.dispatch!.pending, "# Review\n\nLooks good.");

    const sourceContext = await readFile(
      join(result.dispatch!.pending.run.artifactPaths.runDir, "01-source-context.md"),
      "utf8"
    );
    const response = await readFile(
      join(result.dispatch!.pending.run.artifactPaths.runDir, "03-target-response.md"),
      "utf8"
    );
    const latest = await readFile(join(workspaceRoot, ".ai-duo", "latest.md"), "utf8");

    expect(sourceContext).toContain("Last assistant message");
    expect(sourceContext).toContain("Current diff");
    expect(response).toContain("Looks good");
    expect(latest).toContain("AI Duo review finished");
  });

  it("creates bootstrap preview without touching files by default", async () => {
    const workspaceRoot = await createWorkspace();
    const claude = await registerSession({
      agent: "claude",
      cwd: workspaceRoot,
      rawArgs: ["--resume"],
      pid: 1
    });

    const result = await handleAiduoCommand(
      {
        workspaceRoot,
        session: claude
      },
      parseAiduoCommand("/aiduo:bootstrap")
    );

    expect(result.message).toContain("bootstrap preview ready");
    const preview = await readFile(join(workspaceRoot, ".ai-duo", "bootstrap-preview.md"), "utf8");
    expect(preview).toContain("AI Duo Bootstrap Preview");
  });
});
