import { describe, expect, it } from "vitest";
import { checkFlowSupport, type CapabilitySnapshot } from "../src/capabilities";

function createSnapshot(overrides?: Partial<CapabilitySnapshot>): CapabilitySnapshot {
  return {
    collectedAt: "2026-05-05T00:00:00.000Z",
    claude: {
      tool: "claude",
      binaryPresent: true,
      rawHelpText: "",
      supportsNonInteractive: true,
      supportsSchemaOutput: true,
      supportsOutputLastMessage: false,
      supportsPlanPermission: true,
      supportsAcceptEdits: true,
      supportsReadOnlySandbox: false,
      supportsWorkspaceWriteSandbox: false,
      supportsAllowedTools: true,
      supportsDisallowedTools: true,
      supportsBare: true
    },
    codex: {
      tool: "codex",
      binaryPresent: true,
      rawHelpText: "",
      supportsNonInteractive: true,
      supportsSchemaOutput: true,
      supportsOutputLastMessage: true,
      supportsPlanPermission: false,
      supportsAcceptEdits: false,
      supportsReadOnlySandbox: true,
      supportsWorkspaceWriteSandbox: true,
      supportsAllowedTools: false,
      supportsDisallowedTools: false,
      supportsBare: false
    },
    ...overrides
  };
}

describe("checkFlowSupport", () => {
  it("accepts claude-impl when required capabilities exist", () => {
    const result = checkFlowSupport("claude-impl", createSnapshot());
    expect(result.supported).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("blocks codex-impl when workspace-write support is missing", () => {
    const result = checkFlowSupport("codex-impl", createSnapshot({
      codex: {
        ...createSnapshot().codex,
        supportsWorkspaceWriteSandbox: false
      }
    }));

    expect(result.supported).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("workspace-write"))).toBe(true);
  });
});
