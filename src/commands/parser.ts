export type AiduoCommandName =
  | "review"
  | "implement"
  | "plan"
  | "status"
  | "latest"
  | "cancel"
  | "help"
  | "fix"
  | "judge"
  | "retry"
  | "bootstrap";

export interface AiduoCommand {
  name: AiduoCommandName;
  raw: string;
  args: string[];
  flags: Record<string, string | number | boolean>;
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "\"" | "'" | undefined;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if ((char === "\"" || char === "'") && quote === undefined) {
      quote = char;
      continue;
    }

    if (char === quote) {
      quote = undefined;
      continue;
    }

    if (/\s/u.test(char) && quote === undefined) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function parseFlagValue(value: string | undefined): string | number | boolean {
  if (value === undefined) {
    return true;
  }

  if (/^\d+$/u.test(value)) {
    return Number.parseInt(value, 10);
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}

export function parseAiduoCommand(line: string): AiduoCommand {
  const trimmed = line.trim();
  if (!trimmed.startsWith("/aiduo:")) {
    throw new Error("Not an AI Duo slash command.");
  }

  const tokens = tokenize(trimmed.slice("/aiduo:".length));
  if (tokens.length === 0) {
    throw new Error("Missing AI Duo command name.");
  }

  const [nameToken, ...rest] = tokens;
  const name = nameToken as AiduoCommandName;
  const supported: AiduoCommandName[] = [
    "review",
    "implement",
    "plan",
    "status",
    "latest",
    "cancel",
    "help",
    "fix",
    "judge",
    "retry",
    "bootstrap"
  ];

  if (!supported.includes(name)) {
    throw new Error(`Unsupported AI Duo command: ${nameToken}`);
  }

  const flags: Record<string, string | number | boolean> = {};
  const args: string[] = [];

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      args.push(token);
      continue;
    }

    const withoutPrefix = token.slice(2);
    const [rawKey, inlineValue] = withoutPrefix.split("=", 2);
    if (inlineValue !== undefined) {
      flags[rawKey] = parseFlagValue(inlineValue);
      continue;
    }

    const next = rest[index + 1];
    if (next && !next.startsWith("--")) {
      flags[rawKey] = parseFlagValue(next);
      index += 1;
      continue;
    }

    flags[rawKey] = true;
  }

  return {
    name,
    raw: trimmed,
    args,
    flags
  };
}

export function commandContextMode(command: AiduoCommand): "last-message" | "diff" | "all" {
  if (command.flags.all) {
    return "all";
  }

  if (command.flags.diff) {
    return "diff";
  }

  return "last-message";
}
