import { validateStepControl } from "../controlSchema";
import { createStructuredStepSchema } from "../prompts";
import type { RunnerExecutionInput, RunnerExecutionResult, StructuredStepPayload } from "./contracts";
import { runSpawnedProcess } from "../utils/process";

interface ClaudeJsonResponse {
  structured_output?: StructuredStepPayload;
  result?: string;
}

function parseClaudeStructuredOutput(stdout: string): StructuredStepPayload {
  const parsed = JSON.parse(stdout) as ClaudeJsonResponse;
  if (!parsed.structured_output) {
    throw new Error("Claude response did not contain structured_output.");
  }

  return parsed.structured_output;
}

export async function runClaudeStep(input: RunnerExecutionInput): Promise<RunnerExecutionResult> {
  const schema = createStructuredStepSchema(input.role);
  const args = [
    "-p",
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(schema),
    "--permission-mode",
    input.role === "implementer" || input.role === "fixer" ? "acceptEdits" : "plan",
    "--max-turns",
    input.role === "implementer" || input.role === "fixer" ? "12" : "6",
    input.prompt
  ];

  const result = await runSpawnedProcess(input.commandPath, args, {
    cwd: input.cwd,
    signal: input.signal,
    timeoutMs: input.timeoutMs
  });

  const payload = parseClaudeStructuredOutput(result.stdout);
  validateStepControl({
    schemaVersion: 1,
    stepId: "claude-step",
    agent: "claude",
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

  return {
    payload,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode
  };
}
