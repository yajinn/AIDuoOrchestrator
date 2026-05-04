import type { CapabilityHelpInput, CliCapabilities } from "./runners/contracts";
import type { FlowId } from "./artifacts";
import { runProcess } from "./utils/process";

function hasPattern(source: string, pattern: RegExp): boolean {
  return pattern.test(source);
}

export function parseCapabilityHelp(input: CapabilityHelpInput): CliCapabilities {
  const { tool, helpText, versionText } = input;
  const text = helpText ?? "";

  if (tool === "claude") {
    return {
      tool,
      binaryPresent: text.length > 0,
      versionText,
      rawHelpText: text,
      supportsNonInteractive: hasPattern(text, /(?:^|\n)\s*-p,\s*--print\b/m),
      supportsSchemaOutput: hasPattern(text, /--json-schema\b/) || hasPattern(text, /--output-format\b/),
      supportsOutputLastMessage: false,
      supportsPlanPermission: hasPattern(text, /--permission-mode\b/) && hasPattern(text, /plan/),
      supportsAcceptEdits: hasPattern(text, /--permission-mode\b/) && hasPattern(text, /acceptEdits/),
      supportsReadOnlySandbox: false,
      supportsWorkspaceWriteSandbox: false,
      supportsAllowedTools: hasPattern(text, /--allowedTools\b|--allowed-tools\b/),
      supportsDisallowedTools: hasPattern(text, /--disallowedTools\b|--disallowed-tools\b/),
      supportsBare: hasPattern(text, /--bare\b/)
    };
  }

  return {
    tool,
    binaryPresent: text.length > 0,
    versionText,
    rawHelpText: text,
    supportsNonInteractive: hasPattern(text, /Usage:\s*codex exec/i),
    supportsSchemaOutput: hasPattern(text, /--output-schema\b/),
    supportsOutputLastMessage: hasPattern(text, /--output-last-message\b/),
    supportsPlanPermission: false,
    supportsAcceptEdits: false,
    supportsReadOnlySandbox: hasPattern(text, /\bread-only\b/),
    supportsWorkspaceWriteSandbox: hasPattern(text, /\bworkspace-write\b/),
    supportsAllowedTools: false,
    supportsDisallowedTools: false,
    supportsBare: false
  };
}

export interface CapabilitySnapshot {
  collectedAt: string;
  claude: CliCapabilities;
  codex: CliCapabilities;
}

export interface CapabilityPaths {
  claudePath?: string;
  codexPath?: string;
}

export interface FlowSupportResult {
  supported: boolean;
  reasons: string[];
}

function missingCapability(capability: boolean, message: string): string[] {
  return capability ? [] : [message];
}

export async function collectToolCapabilities(
  tool: "claude" | "codex",
  executable: string
): Promise<CliCapabilities> {
  const versionArgs = tool === "claude" ? ["--version"] : ["--version"];
  const helpArgs = tool === "claude" ? ["--help"] : ["exec", "--help"];

  try {
    const [versionResult, helpResult] = await Promise.all([
      runProcess(executable, versionArgs),
      runProcess(executable, helpArgs)
    ]);

    return parseCapabilityHelp({
      tool,
      versionText: versionResult.stdout.trim() || versionResult.stderr.trim(),
      helpText: helpResult.stdout || helpResult.stderr
    });
  } catch (error) {
    const errorWithOutput = error as Error & { stdout?: string; stderr?: string; code?: string };
    if (errorWithOutput.code === "ENOENT") {
      return {
        tool,
        binaryPresent: false,
        versionText: undefined,
        rawHelpText: "",
        supportsNonInteractive: false,
        supportsSchemaOutput: false,
        supportsOutputLastMessage: false,
        supportsPlanPermission: false,
        supportsAcceptEdits: false,
        supportsReadOnlySandbox: false,
        supportsWorkspaceWriteSandbox: false,
        supportsAllowedTools: false,
        supportsDisallowedTools: false,
        supportsBare: false
      };
    }

    throw error;
  }
}

export async function collectCapabilitySnapshot(paths: CapabilityPaths = {}): Promise<CapabilitySnapshot> {
  const [claude, codex] = await Promise.all([
    collectToolCapabilities("claude", paths.claudePath ?? "claude"),
    collectToolCapabilities("codex", paths.codexPath ?? "codex")
  ]);

  return {
    collectedAt: new Date().toISOString(),
    claude,
    codex
  };
}

export function checkFlowSupport(flowId: FlowId, snapshot: CapabilitySnapshot): FlowSupportResult {
  const reasons: string[] = [];

  switch (flowId) {
    case "auto":
      return {
        supported: snapshot.claude.binaryPresent || snapshot.codex.binaryPresent,
        reasons:
          snapshot.claude.binaryPresent || snapshot.codex.binaryPresent
            ? []
            : ["Neither Claude nor Codex CLI is available."]
      };
    case "claude-impl":
      reasons.push(
        ...missingCapability(snapshot.claude.binaryPresent, "Claude CLI is not installed."),
        ...missingCapability(snapshot.claude.supportsNonInteractive, "Claude CLI does not support non-interactive execution."),
        ...missingCapability(snapshot.claude.supportsAcceptEdits, "Claude CLI does not expose acceptEdits permission mode."),
        ...missingCapability(snapshot.codex.binaryPresent, "Codex CLI is not installed."),
        ...missingCapability(snapshot.codex.supportsNonInteractive, "Codex CLI does not support non-interactive execution."),
        ...missingCapability(snapshot.codex.supportsReadOnlySandbox, "Codex CLI does not expose read-only sandbox mode."),
        ...missingCapability(snapshot.codex.supportsOutputLastMessage, "Codex CLI does not expose output-last-message.")
      );
      break;
    case "codex-impl":
      reasons.push(
        ...missingCapability(snapshot.codex.binaryPresent, "Codex CLI is not installed."),
        ...missingCapability(snapshot.codex.supportsNonInteractive, "Codex CLI does not support non-interactive execution."),
        ...missingCapability(snapshot.codex.supportsWorkspaceWriteSandbox, "Codex CLI does not expose workspace-write sandbox mode."),
        ...missingCapability(snapshot.claude.binaryPresent, "Claude CLI is not installed."),
        ...missingCapability(snapshot.claude.supportsNonInteractive, "Claude CLI does not support non-interactive execution."),
        ...missingCapability(snapshot.claude.supportsPlanPermission, "Claude CLI does not expose plan permission mode.")
      );
      break;
    case "dual-review":
    case "dual-plan":
      reasons.push(
        ...missingCapability(snapshot.claude.binaryPresent, "Claude CLI is not installed."),
        ...missingCapability(snapshot.claude.supportsNonInteractive, "Claude CLI does not support non-interactive execution."),
        ...missingCapability(snapshot.codex.binaryPresent, "Codex CLI is not installed."),
        ...missingCapability(snapshot.codex.supportsNonInteractive, "Codex CLI does not support non-interactive execution.")
      );
      break;
  }

  return {
    supported: reasons.length === 0,
    reasons
  };
}
