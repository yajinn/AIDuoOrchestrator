export type ToolName = "claude" | "codex";

export interface CapabilityHelpInput {
  tool: ToolName;
  helpText: string;
  versionText?: string;
}

export interface CliCapabilities {
  tool: ToolName;
  binaryPresent: boolean;
  versionText?: string;
  rawHelpText: string;
  supportsNonInteractive: boolean;
  supportsSchemaOutput: boolean;
  supportsOutputLastMessage: boolean;
  supportsPlanPermission: boolean;
  supportsAcceptEdits: boolean;
  supportsReadOnlySandbox: boolean;
  supportsWorkspaceWriteSandbox: boolean;
  supportsAllowedTools: boolean;
  supportsDisallowedTools: boolean;
  supportsBare: boolean;
}
