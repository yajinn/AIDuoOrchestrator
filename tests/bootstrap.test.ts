import { describe, expect, it } from "vitest";
import {
  AI_DUO_MARKER_END,
  AI_DUO_MARKER_START,
  DEFAULT_CONFIG_CONTENT,
  planBootstrapOperations
} from "../src/bootstrap";

function operationFor(path: string, operations: ReturnType<typeof planBootstrapOperations>["operations"]) {
  const operation = operations.find((current) => current.path === path);
  expect(operation).toBeDefined();
  return operation!;
}

describe("planBootstrapOperations", () => {
  it("creates missing config and prompt files as disjoint file operations", () => {
    const plan = planBootstrapOperations();

    const configOperation = operationFor(".ai-duo/config.json", plan.operations);
    const promptOperation = operationFor(".ai-duo/prompts/claude-implementer.md", plan.operations);

    expect(configOperation.kind).toBe("create");
    expect(configOperation.scope).toBe("disjoint-file");
    expect(configOperation.nextContent).toBe(DEFAULT_CONFIG_CONTENT);

    expect(promptOperation.kind).toBe("create");
    expect(promptOperation.scope).toBe("disjoint-file");
    expect(promptOperation.nextContent).toContain("ROLE: implementer");
  });

  it("skips existing config and prompt files by default instead of overwriting them", () => {
    const plan = planBootstrapOperations({
      existingFiles: {
        ".ai-duo/config.json": "{\n  \"custom\": true\n}\n",
        ".ai-duo/prompts/claude-implementer.md": "# Custom implementer\n"
      }
    });

    expect(operationFor(".ai-duo/config.json", plan.operations).kind).toBe("skip");
    expect(operationFor(".ai-duo/prompts/claude-implementer.md", plan.operations).kind).toBe("skip");
  });

  it("appends a bounded marker block to existing shared documents", () => {
    const plan = planBootstrapOperations({
      existingFiles: {
        "AGENTS.md": "# Repo rules\nKeep existing instructions.\n",
        "CLAUDE.md": "# Claude notes\nDo not remove.\n"
      }
    });

    const agentsOperation = operationFor("AGENTS.md", plan.operations);
    const claudeOperation = operationFor("CLAUDE.md", plan.operations);

    expect(agentsOperation.kind).toBe("update");
    expect(agentsOperation.scope).toBe("marker-block");
    expect(agentsOperation.nextContent).toContain("# Repo rules");
    expect(agentsOperation.nextContent).toContain(AI_DUO_MARKER_START);
    expect(agentsOperation.nextContent).toContain(AI_DUO_MARKER_END);
    expect(agentsOperation.nextContent).toContain("ROLE: reviewer");

    expect(claudeOperation.kind).toBe("update");
    expect(claudeOperation.nextContent).toContain("# Claude notes");
    expect(claudeOperation.nextContent).toContain("When acting as planner:");
  });

  it("updates only inside existing markers without touching surrounding content", () => {
    const plan = planBootstrapOperations({
      existingFiles: {
        "AGENTS.md": [
          "# Repo rules",
          "Header stays.",
          AI_DUO_MARKER_START,
          "old instructions",
          AI_DUO_MARKER_END,
          "Footer stays."
        ].join("\n")
      }
    });

    const agentsOperation = operationFor("AGENTS.md", plan.operations);
    expect(agentsOperation.kind).toBe("update");
    expect(agentsOperation.nextContent).toContain("# Repo rules");
    expect(agentsOperation.nextContent).toContain("Header stays.");
    expect(agentsOperation.nextContent).toContain("Footer stays.");
    expect(agentsOperation.nextContent).not.toContain("old instructions");
    expect(agentsOperation.nextContent?.match(/AI_DUO_START/gu)).toHaveLength(1);
    expect(agentsOperation.nextContent?.match(/AI_DUO_END/gu)).toHaveLength(1);
  });

  it("patches .gitignore once and becomes a no-op when the ignore rule already exists", () => {
    const firstPlan = planBootstrapOperations({
      existingFiles: {
        ".gitignore": "node_modules/\ndist/\n"
      }
    });

    const updateOperation = operationFor(".gitignore", firstPlan.operations);
    expect(updateOperation.kind).toBe("update");
    expect(updateOperation.scope).toBe("line-append");
    expect(updateOperation.nextContent).toBe("node_modules/\ndist/\n.ai-duo/\n");

    const secondPlan = planBootstrapOperations({
      existingFiles: {
        ".gitignore": updateOperation.nextContent
      }
    });

    const noopOperation = operationFor(".gitignore", secondPlan.operations);
    expect(noopOperation.kind).toBe("noop");
    expect(noopOperation.nextContent).toBe("node_modules/\ndist/\n.ai-duo/\n");
  });
});
