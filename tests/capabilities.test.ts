import { describe, expect, it } from "vitest";
import { parseCapabilityHelp } from "../src/capabilities";

describe("parseCapabilityHelp", () => {
  it("detects schema and sandbox support from codex help text", () => {
    const parsed = parseCapabilityHelp({
      tool: "codex",
      helpText: `Run Codex non-interactively

Usage: codex exec [OPTIONS] [PROMPT]

Options:
  -s, --sandbox <SANDBOX_MODE>
  --output-schema <FILE>
  -o, --output-last-message <FILE>

[possible values: read-only, workspace-write, danger-full-access]
`
    });

    expect(parsed.supportsNonInteractive).toBe(true);
    expect(parsed.supportsSchemaOutput).toBe(true);
    expect(parsed.supportsReadOnlySandbox).toBe(true);
    expect(parsed.supportsWorkspaceWriteSandbox).toBe(true);
    expect(parsed.supportsOutputLastMessage).toBe(true);
  });

  it("detects Claude permission and tool constraint support from help text", () => {
    const parsed = parseCapabilityHelp({
      tool: "claude",
      helpText: `Usage: claude [options] [command] [prompt]

Options:
  -p, --print
  --json-schema <schema>
  --permission-mode <mode> (choices: "acceptEdits", "plan")
  --allowedTools, --allowed-tools <tools...>
  --disallowedTools, --disallowed-tools <tools...>
  --bare
`
    });

    expect(parsed.supportsNonInteractive).toBe(true);
    expect(parsed.supportsSchemaOutput).toBe(true);
    expect(parsed.supportsPlanPermission).toBe(true);
    expect(parsed.supportsAcceptEdits).toBe(true);
    expect(parsed.supportsAllowedTools).toBe(true);
    expect(parsed.supportsDisallowedTools).toBe(true);
    expect(parsed.supportsBare).toBe(true);
  });
});
