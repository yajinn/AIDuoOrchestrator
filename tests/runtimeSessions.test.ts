import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { registerSession, resolvePeerSession } from "../src/runtime/sessions";
import { runProcess } from "../src/utils/process";

async function createWorkspace(): Promise<string> {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "ai-duo-runtime-"));
  await runProcess("git", ["init", "-b", "main"], workspaceRoot);
  await runProcess("git", ["config", "user.email", "test@example.com"], workspaceRoot);
  await runProcess("git", ["config", "user.name", "AI Duo Test"], workspaceRoot);
  await writeFile(join(workspaceRoot, "README.md"), "# test\n", "utf8");
  await runProcess("git", ["add", "."], workspaceRoot);
  await runProcess("git", ["commit", "-m", "init"], workspaceRoot);
  return workspaceRoot;
}

describe("runtime sessions", () => {
  it("pairs claude and codex sessions in the same repo", async () => {
    const workspaceRoot = await createWorkspace();
    const claude = await registerSession({
      agent: "claude",
      cwd: workspaceRoot,
      rawArgs: ["--resume"],
      pid: 101
    });
    const codex = await registerSession({
      agent: "codex",
      cwd: workspaceRoot,
      rawArgs: ["exec"],
      pid: 202
    });

    expect(codex.pairedSessionId).toBe(claude.id);

    const resolved = await resolvePeerSession(workspaceRoot, codex);
    expect(resolved?.id).toBe(claude.id);
  });
});
