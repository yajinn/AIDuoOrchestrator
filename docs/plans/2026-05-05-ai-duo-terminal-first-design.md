# AI Duo Terminal-First Design

**Date:** 2026-05-05
**Status:** Approved
**Source:** Terminal-first product direction

---

## Goal

Define a terminal-first protocol for two live agent sessions.

The product is centered on two active terminals, one for Claude and one for Codex, where the user continues working directly inside agent sessions and triggers orchestration through `/aiduo:*` commands.

## Product Shape

Users launch agent sessions through wrappers:

```bash
aiduo claude --resume
aiduo codex exec
```

The wrapper:

- forwards all regular arguments to Claude or Codex unchanged
- proxies stdin and stdout
- records local transcript events
- intercepts `/aiduo:*` commands before they reach the agent

This preserves terminal-native workflow while giving AI Duo a reliable protocol surface.

## Approved Command Set

MVP includes all of these:

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

The scope mode is explicit:

- default: peer last message
- `--diff`: peer last message plus current git diff
- `--all`: peer last message plus transcript excerpt plus diff

## Core Design Decisions

### 1. Wrapper-owned protocol

AI Duo commands are not agent prompts. They are wrapper commands intercepted locally.

This avoids:

- agent confusion about slash commands
- prompt contamination
- brittle output parsing

### 2. File-backed session and transcript runtime

MVP runtime is local and file-backed, not MCP-dependent.

It stores:

- sessions
- pair mappings
- transcript events
- active runs
- artifacts

### 3. Peer output is untrusted

Any content transported from one terminal to the other is wrapped and treated as data, not instructions.

### 4. Default context remains narrow

`/aiduo:review` and `/aiduo:implement` default to the peer's last message only.

Larger context requires explicit flags.

### 5. Cursor remains supported

Users can continue working inside Cursor-integrated terminals because the product depends on terminal wrappers, not on editor-specific orchestration APIs.

The wrapper model keeps the terminal UX while avoiding dependence on integrated terminal output scraping.

## Runtime Model

### Sessions

Each wrapped agent process gets:

- `session_id`
- `agent`
- `pid`
- `cwd`
- `repo_root`
- `raw_args`
- `paired_session_id`

### Transcripts

Each wrapper writes a `.jsonl` event stream of:

- raw user messages
- assistant outputs
- aiduo commands
- system notes

### Runs

Each `/aiduo:*` action creates a run with:

- command metadata
- source context
- dispatched prompt
- target response
- summary

## Security Posture

- slash commands never reach Claude or Codex directly
- repo guards apply to diff-aware commands
- redaction applies to stored artifacts
- busy runs reject new orchestration commands unless forced

## MCP Position

MCP is not required for MVP.

It may become useful later as a local sidecar for:

- query APIs
- runtime coordination
- cross-session status lookup

But the first version should stay file-backed and local.

## Hard Product Opinion

The right product is not a GUI orchestrator and not a terminal scraper.

It is a protocol layer embedded into normal Claude and Codex terminal sessions, with explicit slash commands, transcript-backed context resolution, and auditable artifacts.
