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

export type RunnerRole =
  | "implementer"
  | "reviewer"
  | "planner"
  | "fixer"
  | "finalJudge"
  | "synthesizer";

export interface RunnerPromptInput {
  task: string;
  role: RunnerRole;
  workspaceRoot: string;
  gitStatus?: string;
  reviewScope?: string;
  peerMarkdown?: string;
  selectedFlow: string;
}

export interface StructuredStepPayload {
  markdown: string;
  summary: string;
  filesTouched: string[];
  mustFix: string[];
  shouldFix: string[];
  missingTests: string[];
  risks: string[];
  testsRun: string[];
  testsNotRun: string[];
  suggestedNextActions: string[];
  needsHumanDecision: boolean;
  verdict?: "approve" | "approve-with-notes" | "block" | "needs-human-decision";
}

export interface RunnerExecutionInput {
  commandPath: string;
  cwd: string;
  prompt: string;
  role: RunnerRole;
  signal?: AbortSignal;
  timeoutMs: number;
}

export interface RunnerExecutionResult {
  payload: StructuredStepPayload;
  stdout: string;
  stderr: string;
  exitCode: number;
}
