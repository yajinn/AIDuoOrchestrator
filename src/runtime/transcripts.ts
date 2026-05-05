import { appendFile, mkdir, readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { redactSecrets } from "../security/redaction";
import { getTranscriptPath, getTranscriptsDir } from "./paths";

export type TranscriptEventKind =
  | "user_input"
  | "assistant_output"
  | "aiduo_command"
  | "system_note";

export interface TranscriptEvent {
  id: string;
  sessionId: string;
  kind: TranscriptEventKind;
  timestamp: string;
  text: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface TranscriptExcerpt {
  lastAssistantMessage?: TranscriptEvent;
  recentEvents: TranscriptEvent[];
}

function eventId(): string {
  return `evt_${randomBytes(3).toString("hex")}`;
}

export function stripAnsi(input: string): string {
  return input.replace(
    // eslint-disable-next-line no-control-regex
    /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
    ""
  );
}

export async function appendTranscriptEvent(
  workspaceRoot: string,
  input: Omit<TranscriptEvent, "id" | "timestamp" | "text"> & { text: string }
): Promise<TranscriptEvent> {
  await mkdir(getTranscriptsDir(workspaceRoot), { recursive: true });
  const event: TranscriptEvent = {
    ...input,
    id: eventId(),
    timestamp: new Date().toISOString(),
    text: redactSecrets(stripAnsi(input.text)).trim()
  };
  await appendFile(getTranscriptPath(workspaceRoot, input.sessionId), `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

export async function readTranscriptEvents(workspaceRoot: string, sessionId: string): Promise<TranscriptEvent[]> {
  try {
    const raw = await readFile(getTranscriptPath(workspaceRoot, sessionId), "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as TranscriptEvent);
  } catch {
    return [];
  }
}

export async function getTranscriptExcerpt(
  workspaceRoot: string,
  sessionId: string,
  count: number
): Promise<TranscriptExcerpt> {
  const events = await readTranscriptEvents(workspaceRoot, sessionId);
  const conversational = events.filter((event) => event.kind === "user_input" || event.kind === "assistant_output");
  const recentEvents = conversational.slice(-count);
  const lastAssistantMessage = [...events].reverse().find((event) => event.kind === "assistant_output");
  return {
    lastAssistantMessage,
    recentEvents
  };
}
