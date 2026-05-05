# PRD-v3-terminal.md — AI Duo Terminal Protocol

**Status:** Draft v3
**Date:** 2026-05-05
**Revision basis:** Terminal-first rewrite
**Positioning:** Terminal-first rewrite
**Target:** Claude and Codex live terminal sessions, especially inside Cursor terminals

---

## 1. Executive Summary

AI Duo Terminal Protocol is a local wrapper and runtime that coordinates two live agent sessions, one Claude and one Codex, through explicit slash commands typed inside those sessions.

The product is centered on the developer staying inside terminal sessions and invoking protocol actions such as:

```text
/aiduo:review
/aiduo:review --diff
/aiduo:implement
/aiduo:plan
```

The product preserves terminal-native workflow while adding:

- session pairing
- transcript-backed context resolution
- artifact-first auditability
- structured slash command semantics
- safe cancellation and retry
- optional repo bootstrap

## 2. Product Thesis

The valuable workflow is not:

- infinite multi-agent chat
- hidden GUI orchestration
- terminal output scraping

The valuable workflow is:

- two real live agent sessions
- user stays in terminal
- wrapper catches explicit protocol commands
- wrapper moves bounded context between sessions
- every action writes inspectable artifacts

AI Duo should feel like "smart relay between two terminals," not like a hidden background system.

## 3. Problem Statement

A developer already works in Claude and Codex terminals. They want to:

- ask one side to review the other's latest output
- ask one side to implement the other's plan
- ask one side to fix based on the other's review
- inspect status without leaving the terminal

The current manual workflow is copy-paste orchestration:

1. read output in one terminal
2. manually copy it
3. switch terminal
4. paste and rewrite instructions
5. try to keep track of context and git state

This is:

- slow
- lossy
- hard to reproduce
- hard to audit
- inconsistent across review and implement loops

## 4. Goals

### 4.1 Primary Goals

1. Let users keep working directly inside live Claude and Codex sessions.
2. Support slash-command orchestration without sending those slash commands to the underlying agent.
3. Move bounded context between paired sessions based on explicit command modes.
4. Record transcript events and run artifacts locally.
5. Provide status, latest, cancel, retry, and bootstrap capabilities from the same terminal UX.

### 4.2 Secondary Goals

1. Support Cursor-integrated terminals well without depending on editor-specific orchestration APIs.
2. Preserve full passthrough compatibility with normal Claude and Codex CLI arguments.
3. Keep the runtime file-backed for MVP, with optional MCP sidecar later.

## 5. Non-Goals

The MVP will not:

1. depend on editor-specific orchestration UI to function
2. scrape arbitrary terminal scrollback
3. replace Claude or Codex session persistence
4. provide a cloud backend
5. require MCP for basic operation
6. auto-guess pairings across unrelated repositories
7. support hidden background orchestration with no visible terminal activity

## 6. Product Principles

### 6.1 Terminal-first

The user remains inside the live agent sessions.

### 6.2 Wrapper-owned protocol

`/aiduo:*` commands are wrapper commands, not agent commands.

### 6.3 Explicit context scopes

Default scope is narrow. Larger scope requires explicit flags.

### 6.4 Auditability

Every protocol action creates a run with inspectable artifacts.

### 6.5 Honest control

The user should always know when AI Duo is dispatching an orchestration action and to which peer session.

## 7. User Experience Model

### 7.1 Session Startup

Users launch sessions through wrappers:

```bash
aiduo claude --resume
aiduo codex exec
```

The wrapper must pass all non-AI-Duo arguments through unchanged.

### 7.2 Normal Use

Inside the terminal session:

- normal input goes to Claude or Codex
- lines starting with `/aiduo:` are intercepted locally

Example:

```text
/aiduo:review --diff
```

### 7.3 Terminal Output

AI Duo status messages are short and visible:

```text
[AI Duo] command=review target=codex mode=diff
[AI Duo] source context resolved
[AI Duo] prompt dispatched
[AI Duo] completed -> .ai-duo/latest.md
```

## 8. Command Surface

MVP commands:

- `/aiduo:review`
- `/aiduo:review --diff`
- `/aiduo:review --all[=N]`
- `/aiduo:implement`
- `/aiduo:implement --all`
- `/aiduo:plan`
- `/aiduo:status`
- `/aiduo:latest`
- `/aiduo:cancel`
- `/aiduo:help`
- `/aiduo:fix`
- `/aiduo:judge`
- `/aiduo:retry`
- `/aiduo:bootstrap`

Optional shared flags:

- `--to claude|codex`
- `--json`
- `--force`

## 9. Command Semantics

### 9.1 `/aiduo:review`

Default input:

- peer last assistant message

Output:

- review response in current terminal
- run artifacts

### 9.2 `/aiduo:review --diff`

Input:

- peer last assistant message
- current git diff

### 9.3 `/aiduo:review --all[=N]`

Input:

- peer last assistant message
- last `N` transcript turns, default `N=6`
- current git diff

### 9.4 `/aiduo:implement`

Default input:

- peer last assistant message

Intent:

- use a plan or actionable request from the peer and implement it locally in this session

### 9.5 `/aiduo:implement --all`

Input:

- peer last assistant message
- transcript excerpt

### 9.6 `/aiduo:plan`

Default input:

- peer last assistant message

Output:

- implementation plan in current terminal

### 9.7 `/aiduo:status`

Displays:

- current session id
- paired session id
- repo root
- active run id
- active command
- latest completed run

### 9.8 `/aiduo:latest`

Shows the latest run summary.

Possible modes:

- human-readable terminal output
- `--json`

### 9.9 `/aiduo:cancel`

Cancels the active AI Duo orchestration action without closing the underlying agent session.

### 9.10 `/aiduo:help`

Shows supported commands and examples.

### 9.11 `/aiduo:fix`

Input:

- peer last assistant message, expected to be a review

Intent:

- apply a bounded fix pass in the current terminal based on that review

### 9.12 `/aiduo:judge`

Intent:

- produce final verdict

Modes:

- default: peer last message
- `--diff`: peer last message plus diff
- `--all`: peer last message plus transcript plus diff

### 9.13 `/aiduo:retry`

Intent:

- rerun the last failed or cancelled AI Duo command with the same parameters

### 9.14 `/aiduo:bootstrap`

Intent:

- write config and prompt templates to the repository with preview and guarded apply

## 10. Session Model

Each wrapped session registers a local session record:

```json
{
  "sessionId": "sess_claude_123",
  "agent": "claude",
  "pid": 12345,
  "cwd": "/repo",
  "repoRoot": "/repo",
  "rawArgs": ["--resume"],
  "startedAt": "2026-05-05T12:00:00Z",
  "pairedSessionId": "sess_codex_456"
}
```

Storage:

```text
.ai-duo/runtime/sessions/<session-id>.json
.ai-duo/runtime/index.json
```

## 11. Pairing Model

Default behavior:

- if exactly one Claude and one Codex session exist under the same repo root, pair automatically
- if multiple candidates exist, require explicit disambiguation

Commands may override the default peer with `--to`.

## 12. Transcript Model

Every wrapped session writes transcript events as JSONL:

```json
{
  "id": "evt_123",
  "sessionId": "sess_claude_123",
  "kind": "user_input",
  "timestamp": "2026-05-05T12:00:00Z",
  "text": "Implement the refresh fix"
}
```

Kinds:

- `user_input`
- `assistant_output`
- `aiduo_command`
- `system_note`

Storage:

```text
.ai-duo/runtime/transcripts/<session-id>.jsonl
```

## 13. Slash Command Parsing

Rules:

1. if a line does not begin with `/aiduo:`, forward it to the agent process unchanged
2. if a line begins with `/aiduo:`, parse and execute it locally

The parser must support:

- command names
- long flags
- quoted values
- `--all=8`
- `--to`
- `--json`
- `--force`

Slash commands are recorded in transcript as `aiduo_command` events and never forwarded to the underlying agent.

## 14. Context Resolution

AI Duo resolves context from:

- peer transcript
- local transcript
- git diff
- repo state

Default scope behavior:

- `/aiduo:review` -> peer last message
- `/aiduo:review --diff` -> peer last message plus diff
- `/aiduo:review --all` -> peer last message plus transcript plus diff

This resolution should be centralized in a `context resolver` layer.

## 15. Dispatch Model

After resolving context, AI Duo sends a visible protocol prompt into the target session.

The user should see that a protocol action is running.

AI Duo must not silently inject prompts behind the scenes.

## 16. Runtime State Machine

Per-run states:

- `idle`
- `running`
- `waiting-for-peer`
- `paused-for-human`
- `cancelled`
- `failed`
- `completed`

A run record must include:

- `runId`
- `command`
- `sourceSessionId`
- `targetSessionId`
- `contextMode`
- `status`
- timestamps

Storage:

```text
.ai-duo/runtime/runs/<run-id>/run.json
```

## 17. Concurrency Rules

- only one active AI Duo orchestration action per source session
- new actions during an active run are rejected with `busy` unless `--force` is used
- `--force` cancels the active run and starts a new one

## 18. Artifacts

Each slash command creates:

```text
.ai-duo/runs/<run-id>/
```

Minimum contents:

- `00-command.json`
- `01-source-context.md`
- `02-dispatched-prompt.md`
- `03-target-response.md`
- `summary.md`

Optional contents:

- diff patch
- transcript excerpt
- review artifact
- plan artifact
- judge artifact

`latest.md` remains the top-level pointer.

## 19. Security Model

### 19.1 Peer Output Is Untrusted

All peer content is wrapped as untrusted:

```text
--- BEGIN_PEER_OUTPUT (untrusted) ---
...
--- END_PEER_OUTPUT ---
```

### 19.2 Slash Commands Stay Local

`/aiduo:*` is never sent to Claude or Codex as-is.

### 19.3 Narrow Default Scope

Default commands use the smallest useful context.

### 19.4 Repo Guards

Commands that depend on code state must verify repo availability and root alignment.

### 19.5 Secret Redaction

Stored artifacts should redact secrets conservatively.

## 20. Passthrough and Resume

The wrapper must preserve normal CLI behavior.

Examples:

```bash
aiduo claude --resume
aiduo claude --continue
aiduo codex exec --resume
```

AI Duo maintains its own local session continuity separately from the agent's own resume logic.

## 21. Failure Modes

First-class failures:

- `peer-session-not-found`
- `peer-last-message-not-found`
- `repo-not-found`
- `active-run-exists`
- `dispatch-failed`
- `agent-process-exited`
- `transcript-corrupted`
- `context-too-large`
- `command-not-supported`

Terminal output should be short and actionable.

Artifacts should contain detail.

## 22. Bootstrap

`/aiduo:bootstrap` writes:

- `.ai-duo/config.json`
- `.ai-duo/prompts/*.md`
- marker-delimited `AGENTS.md` section
- marker-delimited `CLAUDE.md` section
- `.gitignore` addition for `.ai-duo/`

Requirements:

- preview before apply
- no overwrite by default
- marker-only edits for shared docs

## 23. Cursor Support

Cursor is a supported environment because users can run wrapped sessions in integrated terminals.

The protocol does not depend on editor-specific terminal APIs or GUI orchestration surfaces.

## 24. MCP Position

MVP:

- file-backed runtime only

V1.1 optional:

- local MCP sidecar for:
  - session queries
  - transcript lookup
  - runtime coordination
  - status and latest APIs

MCP is not the transport of agent output and does not replace the real Claude or Codex sessions.

## 25. MVP Scope

Included in MVP:

- wrapped session startup
- local session registration
- transcript storage
- command parser
- command set listed above
- context resolution
- artifact generation
- cancellation
- retry
- bootstrap

Out of MVP:

- GUI-first orchestrator UX
- cloud coordination
- multi-user support
- invisible background relay

## 26. System Architecture

Suggested modules:

```text
src/
  cli.ts
  session/
    registry.ts
    pairing.ts
  transcript/
    writer.ts
    reader.ts
  commands/
    parser.ts
    review.ts
    implement.ts
    plan.ts
    fix.ts
    judge.ts
    retry.ts
    bootstrap.ts
  context/
    resolver.ts
  runtime/
    runs.ts
    status.ts
  artifacts/
    writer.ts
  security/
    redaction.ts
    peerWrapping.ts
```

## 27. Testing Plan

### 27.1 Unit Tests

Test:

- slash parser
- session pairing
- transcript query helpers
- context resolution modes
- artifact generation
- bootstrap patch planning

### 27.2 Integration Tests

Use fake wrapped sessions to test:

- review relay
- implement relay
- review `--diff`
- review `--all`
- fix from review
- judge verdicts
- retry
- cancel
- transcript corruption handling

### 27.3 Manual Tests

Run in:

- Cursor integrated terminal
- plain macOS terminal
- zsh and bash

## 28. Release Criteria

1. `aiduo claude ...` and `aiduo codex ...` preserve normal passthrough behavior
2. `/aiduo:review`, `/aiduo:implement`, and `/aiduo:plan` work on live paired sessions
3. `--diff` and `--all` modes resolve correct context
4. artifacts are written reliably
5. cancel and retry work
6. bootstrap preview and apply work
7. status and latest are readable and accurate

## 29. Open Questions

1. Should `--all` default transcript depth be fixed at `6` or configurable?
2. Should pair discovery ever cross repository roots with an explicit override?
3. Should `judge` default to last-message only, or require explicit mode selection for safety?

## 30. Hard Product Opinion

This product should stay brutally simple in one sense:

- explicit wrapper
- explicit slash commands
- explicit context modes
- explicit artifacts

It should reject:

- hidden magic
- terminal scraping hacks
- GUI dependency as the primary workflow
- broad default context forwarding

The winning version of AI Duo is a protocol between two live agent terminals, not an IDE panel.
