import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateStepControl } from "../controlSchema";
import { createStructuredStepSchema } from "../prompts";
import type { RunnerExecutionInput, RunnerExecutionResult, StructuredStepPayload } from "./contracts";
import { runSpawnedProcess } from "../utils/process";

function sandboxForRole(role: RunnerExecutionInput["role"]): "read-only" | "workspace-write" {
  return role === "implementer" || role === "fixer" ? "workspace-write" : "read-only";
}

function parseCodexStructuredOutput(stdout: string): StructuredStepPayload {
  return JSON.parse(stdout) as StructuredStepPayload;
}

export async function runCodexStep(input: RunnerExecutionInput): Promise<RunnerExecutionResult> {
  const tempDir = await mkdtemp(join(tmpdir(), "ai-duo-codex-"));
  const schemaPath = join(tempDir, "schema.json");
  const lastMessagePath = join(tempDir, "last-message.txt");

  try {
    await writeFile(schemaPath, `${JSON.stringify(createStructuredStepSchema(input.role), null, 2)}\n`, "utf8");

    const args = [
      "exec",
      "--sandbox",
      sandboxForRole(input.role),
      "--output-schema",
      schemaPath,
      "--output-last-message",
      lastMessagePath,
      input.prompt
    ];

    const result = await runSpawnedProcess(input.commandPath, args, {
      cwd: input.cwd,
      signal: input.signal,
      timeoutMs: input.timeoutMs
    });

    const payload = parseCodexStructuredOutput(result.stdout);
    validateStepControl({
      schemaVersion: 1,
      stepId: "codex-step",
      agent: "codex",
      role: input.role,
      status: "succeeded",
      summary: payload.summary,
      verdict: payload.verdict,
      filesTouched: payload.filesTouched,
      mustFix: payload.mustFix,
      shouldFix: payload.shouldFix,
      missingTests: payload.missingTests,
      risks: payload.risks,
      testsRun: payload.testsRun,
      testsNotRun: payload.testsNotRun,
      needsHumanDecision: payload.needsHumanDecision,
      suggestedNextActions: payload.suggestedNextActions
    });

    const lastMessage = await readFile(lastMessagePath, "utf8");

    return {
      payload: {
        ...payload,
        markdown: payload.markdown || lastMessage.trim()
      },
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
