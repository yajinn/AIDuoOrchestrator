import { createInterface } from "node:readline";
import type { IPty } from "node-pty";
import * as pty from "node-pty";
import { handleAiduoCommand, type PendingAiduoDispatch, finalizePendingDispatch, failPendingDispatch } from "../commands/handlers";
import { parseAiduoCommand } from "../commands/parser";
import type { ToolName } from "../runners/contracts";
import { getActiveRunForSession } from "../runtime/runs";
import { closeSession, registerSession } from "../runtime/sessions";
import { appendTranscriptEvent, stripAnsi } from "../runtime/transcripts";
import { normalizeTerminalText, printAiduoLine } from "./stdio";

export interface WrapSessionInput {
  agent: ToolName;
  args: string[];
  cwd: string;
}

export interface WrappedSessionResult {
  sessionId: string;
  repoRoot: string;
}

export async function wrapSession(input: WrapSessionInput): Promise<WrappedSessionResult> {
  const session = await registerSession({
    agent: input.agent,
    cwd: input.cwd,
    rawArgs: input.args,
    pid: process.pid
  });

  const child: IPty = pty.spawn(input.agent, input.args, {
    name: process.env.TERM || "xterm-256color",
    cwd: session.repoRoot,
    cols: process.stdout.columns || 120,
    rows: process.stdout.rows || 40,
    env: {
      ...process.env,
      AI_DUO_SESSION_ID: session.id,
      AI_DUO_AGENT: session.agent
    }
  });

  let outputBuffer = "";
  let flushTimer: NodeJS.Timeout | undefined;
  let pendingDispatch: PendingAiduoDispatch | undefined;

  const flushOutput = async (): Promise<void> => {
    if (outputBuffer.trim().length === 0) {
      outputBuffer = "";
      return;
    }

    const text = stripAnsi(normalizeTerminalText(outputBuffer)).trim();
    outputBuffer = "";
    if (text.length === 0) {
      return;
    }

    await appendTranscriptEvent(session.repoRoot, {
      sessionId: session.id,
      kind: "assistant_output",
      text
    });

    if (pendingDispatch) {
      const current = pendingDispatch;
      pendingDispatch = undefined;
      await finalizePendingDispatch(session.repoRoot, current, text);
      printAiduoLine(`[AI Duo] completed -> ${current.run.artifactPaths.latestPath}`);
    }
  };

  const scheduleFlush = (): void => {
    if (flushTimer) {
      clearTimeout(flushTimer);
    }

    flushTimer = setTimeout(() => {
      void flushOutput();
    }, 400);
  };

  child.onData((data) => {
    process.stdout.write(data);
    outputBuffer += data;
    scheduleFlush();
  });

  child.onExit(({ exitCode }) => {
    if (flushTimer) {
      clearTimeout(flushTimer);
    }

    void flushOutput().finally(async () => {
      if (pendingDispatch) {
        await failPendingDispatch(
          session.repoRoot,
          pendingDispatch,
          `Agent process exited with code ${exitCode}.`,
          "failed"
        );
      }
      await closeSession(session.repoRoot, session.id);
      process.exitCode = exitCode;
    });
  });

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  readline.on("line", async (line) => {
    if (!line.startsWith("/aiduo:")) {
      await appendTranscriptEvent(session.repoRoot, {
        sessionId: session.id,
        kind: "user_input",
        text: line
      });
      child.write(`${line}\r`);
      return;
    }

    try {
      const command = parseAiduoCommand(line);

      if (command.name === "cancel") {
        const activeRun = await getActiveRunForSession(session.repoRoot, session.id);
        if (!activeRun) {
          printAiduoLine("[AI Duo] no active run to cancel.");
          return;
        }

        child.write("\u0003");
        if (pendingDispatch && pendingDispatch.run.runId === activeRun.runId) {
          await failPendingDispatch(session.repoRoot, pendingDispatch, "Run cancelled by user.", "cancelled");
          pendingDispatch = undefined;
        }
        printAiduoLine(`[AI Duo] cancelled ${activeRun.runId}`);
        return;
      }

      await appendTranscriptEvent(session.repoRoot, {
        sessionId: session.id,
        kind: "aiduo_command",
        text: line,
        metadata: {
          command: command.name
        }
      });

      const result = await handleAiduoCommand({
        workspaceRoot: session.repoRoot,
        session
      }, command);

      printAiduoLine(result.message);

      if (result.dispatch) {
        pendingDispatch = result.dispatch.pending;
        child.write(`${result.dispatch.prompt}\r`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      printAiduoLine(`[AI Duo] error: ${message}`);
    }
  });

  process.on("SIGINT", async () => {
    readline.close();
    child.kill();
    await closeSession(session.repoRoot, session.id);
    process.exit(130);
  });

  if (session.pairedSessionId) {
    printAiduoLine(`[AI Duo] session=${session.id} paired=${session.pairedSessionId}`);
  } else {
    printAiduoLine(`[AI Duo] session=${session.id} waiting for peer session`);
  }

  return {
    sessionId: session.id,
    repoRoot: session.repoRoot
  };
}
