import type { AiduoCommand } from "../commands/parser";
import { captureGitReviewScope } from "../git/scope";
import type { AiduoSession } from "../runtime/sessions";
import { getTranscriptExcerpt } from "../runtime/transcripts";

export interface ResolvedCommandContext {
  peerLastMessage: string;
  transcriptExcerpt?: string;
  diffText?: string;
  sourceContextMarkdown: string;
}

function transcriptSize(command: AiduoCommand): number {
  const value = command.flags.all;
  if (typeof value === "number") {
    return value;
  }

  return 6;
}

export async function resolveCommandContext(
  workspaceRoot: string,
  command: AiduoCommand,
  peerSession: AiduoSession
): Promise<ResolvedCommandContext> {
  const excerpt = await getTranscriptExcerpt(workspaceRoot, peerSession.id, transcriptSize(command));
  const peerLastMessage = excerpt.lastAssistantMessage?.text?.trim();

  if (!peerLastMessage) {
    throw new Error(`Peer last message not found in ${peerSession.agent} session.`);
  }

  let diffText: string | undefined;
  if (command.flags.diff || command.flags.all) {
    const reviewScope = await captureGitReviewScope(workspaceRoot);
    diffText = reviewScope.reviewText;
  }

  let transcriptExcerpt: string | undefined;
  if (command.flags.all) {
    transcriptExcerpt = excerpt.recentEvents
      .map((event) => `### ${event.kind}\n${event.text}`)
      .join("\n\n");
  }

  const sections = [
    "# Source Context",
    "",
    `Peer session: ${peerSession.agent} (${peerSession.id})`,
    "",
    "## Last assistant message",
    peerLastMessage
  ];

  if (transcriptExcerpt) {
    sections.push("", "## Transcript excerpt", transcriptExcerpt);
  }

  if (diffText) {
    sections.push("", "## Current diff", diffText);
  }

  sections.push("");

  return {
    peerLastMessage,
    transcriptExcerpt,
    diffText,
    sourceContextMarkdown: sections.join("\n")
  };
}
