export const STEP_CONTROL_AGENTS = ["claude", "codex", "system"] as const;
export const STEP_CONTROL_ROLES = [
  "implementer",
  "reviewer",
  "planner",
  "fixer",
  "finalJudge",
  "synthesizer"
] as const;
export const STEP_CONTROL_STATUSES = ["succeeded", "failed", "cancelled", "skipped"] as const;
export const STEP_CONTROL_VERDICTS = [
  "approve",
  "approve-with-notes",
  "block",
  "needs-human-decision"
] as const;
export const STEP_CONTROL_ARRAY_FIELDS = [
  "filesTouched",
  "mustFix",
  "shouldFix",
  "missingTests",
  "risks",
  "testsRun",
  "testsNotRun",
  "suggestedNextActions"
] as const;
export const STEP_CONTROL_VERDICT_REQUIRED_ROLES = ["reviewer", "planner", "finalJudge"] as const;

export type StepControlAgent = (typeof STEP_CONTROL_AGENTS)[number];
export type StepControlRole = (typeof STEP_CONTROL_ROLES)[number];
export type StepControlStatus = (typeof STEP_CONTROL_STATUSES)[number];
export type StepControlVerdict = (typeof STEP_CONTROL_VERDICTS)[number];
export type StepControlArrayField = (typeof STEP_CONTROL_ARRAY_FIELDS)[number];
export type VerdictRequiredRole = (typeof STEP_CONTROL_VERDICT_REQUIRED_ROLES)[number];

export interface StepControl {
  schemaVersion: 1;
  stepId: string;
  agent: StepControlAgent;
  role: StepControlRole;
  status: StepControlStatus;
  verdict?: StepControlVerdict;
  summary: string;
  filesTouched: string[];
  mustFix: string[];
  shouldFix: string[];
  missingTests: string[];
  risks: string[];
  testsRun: string[];
  testsNotRun: string[];
  needsHumanDecision: boolean;
  suggestedNextActions: string[];
}

export interface StepControlInput {
  schemaVersion: unknown;
  stepId: unknown;
  agent: unknown;
  role: unknown;
  status: unknown;
  verdict?: unknown;
  summary: unknown;
  filesTouched?: readonly string[] | unknown;
  mustFix?: readonly string[] | unknown;
  shouldFix?: readonly string[] | unknown;
  missingTests?: readonly string[] | unknown;
  risks?: readonly string[] | unknown;
  testsRun?: readonly string[] | unknown;
  testsNotRun?: readonly string[] | unknown;
  needsHumanDecision: unknown;
  suggestedNextActions?: readonly string[] | unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Step control field "${fieldName}" must be a non-empty string.`);
  }

  return value;
}

function parseBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Step control field "${fieldName}" must be a boolean.`);
  }

  return value;
}

function parseEnumValue<const TValue extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly TValue[]
): TValue {
  if (typeof value !== "string" || !allowedValues.includes(value as TValue)) {
    throw new Error(
      `Step control field "${fieldName}" must be one of: ${allowedValues.join(", ")}.`
    );
  }

  return value as TValue;
}

function parseStringArray(source: Record<string, unknown>, fieldName: StepControlArrayField): string[] {
  const value = source[fieldName];

  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`Step control field "${fieldName}" must be a string array.`);
  }

  // Return a fresh array so later normalization or mutation stays scoped to the validated result.
  return value.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new Error(`Step control field "${fieldName}" item ${index} must be a string.`);
    }

    return entry;
  });
}

export function requiresStepVerdict(
  role: StepControlRole,
  status: StepControlStatus
): role is VerdictRequiredRole {
  return status === "succeeded" && STEP_CONTROL_VERDICT_REQUIRED_ROLES.includes(role as VerdictRequiredRole);
}

export function validateStepControl(input: unknown): StepControl {
  if (!isRecord(input)) {
    throw new Error("Step control payload must be an object.");
  }

  if (input.schemaVersion !== 1) {
    throw new Error('Step control field "schemaVersion" must be 1.');
  }

  const role = parseEnumValue(input.role, "role", STEP_CONTROL_ROLES);
  const status = parseEnumValue(input.status, "status", STEP_CONTROL_STATUSES);
  const verdict =
    input.verdict === undefined
      ? undefined
      : parseEnumValue(input.verdict, "verdict", STEP_CONTROL_VERDICTS);

  if (requiresStepVerdict(role, status) && verdict === undefined) {
    throw new Error(`Step control field "verdict" is required when ${role} steps succeed.`);
  }

  return {
    schemaVersion: 1,
    stepId: parseNonEmptyString(input.stepId, "stepId"),
    agent: parseEnumValue(input.agent, "agent", STEP_CONTROL_AGENTS),
    role,
    status,
    verdict,
    summary: parseNonEmptyString(input.summary, "summary"),
    filesTouched: parseStringArray(input, "filesTouched"),
    mustFix: parseStringArray(input, "mustFix"),
    shouldFix: parseStringArray(input, "shouldFix"),
    missingTests: parseStringArray(input, "missingTests"),
    risks: parseStringArray(input, "risks"),
    testsRun: parseStringArray(input, "testsRun"),
    testsNotRun: parseStringArray(input, "testsNotRun"),
    needsHumanDecision: parseBoolean(input.needsHumanDecision, "needsHumanDecision"),
    suggestedNextActions: parseStringArray(input, "suggestedNextActions")
  };
}

export function isStepControl(input: unknown): input is StepControl {
  try {
    validateStepControl(input);
    return true;
  } catch {
    return false;
  }
}
