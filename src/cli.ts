#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cwd } from "node:process";
import {
  applyBootstrapPlan,
  loadBootstrapExistingFiles,
  planBootstrapOperations,
  renderBootstrapPreview
} from "./bootstrap";
import { wrapSession } from "./cli/wrapSession";
import { detectRepoRoot, loadRuntimeIndex } from "./runtime/sessions";

export interface ParsedCliArgs {
  kind: "help" | "wrap" | "status" | "latest" | "bootstrap";
  agent?: "claude" | "codex";
  passthroughArgs: string[];
  slashCommand?: string;
}

export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    return {
      kind: "help",
      passthroughArgs: []
    };
  }

  if (command === "claude" || command === "codex") {
    return {
      kind: "wrap",
      agent: command,
      passthroughArgs: rest
    };
  }

  if (command === "status" || command === "latest" || command === "bootstrap") {
    return {
      kind: command,
      passthroughArgs: rest,
      slashCommand:
        command === "bootstrap" && rest.includes("--apply")
          ? "/aiduo:bootstrap --apply"
          : `/aiduo:${command}`
    };
  }

  throw new Error(`Unsupported aiduo command: ${command}`);
}

function printCliHelp(): void {
  process.stdout.write(
    [
      "AI Duo CLI",
      "",
      "Usage:",
      "  aiduo claude [claude args...]",
      "  aiduo codex [codex args...]",
      "  aiduo status",
      "  aiduo latest",
      "  aiduo bootstrap [--apply]",
      ""
    ].join("\n")
  );
}

async function runTopLevelStatus(workspaceRoot: string): Promise<void> {
  const index = await loadRuntimeIndex(workspaceRoot);
  process.stdout.write(
    [
      `[AI Duo] repo=${workspaceRoot}`,
      `[AI Duo] latestClaude=${index.latestByAgent.claude ?? "(none)"}`,
      `[AI Duo] latestCodex=${index.latestByAgent.codex ?? "(none)"}`,
      `[AI Duo] activeRuns=${Object.keys(index.activeRunBySession).length}`,
      `[AI Duo] trackedRuns=${Object.keys(index.lastRunBySession).length}`
    ].join("\n") + "\n"
  );
}

async function runTopLevelLatest(workspaceRoot: string): Promise<void> {
  try {
    const latest = await readFile(join(workspaceRoot, ".ai-duo", "latest.md"), "utf8");
    process.stdout.write(`${latest}\n`);
  } catch {
    process.stdout.write("No AI Duo run artifacts exist yet.\n");
  }
}

async function runTopLevelBootstrap(workspaceRoot: string, applyRequested: boolean): Promise<void> {
  const existingFiles = await loadBootstrapExistingFiles(workspaceRoot);
  const plan = planBootstrapOperations({ existingFiles });
  const preview = renderBootstrapPreview(plan);
  const previewPath = join(workspaceRoot, ".ai-duo", "bootstrap-preview.md");
  await writeFile(previewPath, preview, "utf8");

  if (!applyRequested) {
    process.stdout.write(`[AI Duo] bootstrap preview ready -> ${previewPath}\n`);
    return;
  }

  const applied = await applyBootstrapPlan(workspaceRoot, plan);
  process.stdout.write(`[AI Duo] bootstrap applied ${applied.length} changes -> ${previewPath}\n`);
}

async function runTopLevelCommand(kind: "status" | "latest" | "bootstrap", args: string[]): Promise<void> {
  const workspaceRoot = await detectRepoRoot(cwd());
  switch (kind) {
    case "status":
      await runTopLevelStatus(workspaceRoot);
      return;
    case "latest":
      await runTopLevelLatest(workspaceRoot);
      return;
    case "bootstrap":
      await runTopLevelBootstrap(workspaceRoot, args.includes("--apply"));
      return;
  }
}

async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2));
  switch (parsed.kind) {
    case "help":
      printCliHelp();
      return;
    case "wrap":
      await wrapSession({
        agent: parsed.agent!,
        args: parsed.passthroughArgs,
        cwd: cwd()
      });
      return;
    case "status":
    case "latest":
    case "bootstrap":
      await runTopLevelCommand(parsed.kind, parsed.passthroughArgs);
      return;
  }
}

if (require.main === module) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`AI Duo error: ${message}\n`);
    process.exit(1);
  });
}
